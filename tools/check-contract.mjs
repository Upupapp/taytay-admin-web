#!/usr/bin/env node
/**
 * check:contract — the transport rules TAB 01 settled, enforced.
 *
 * Six of the eight divergences the integration sweep found were not bugs anyone
 * introduced; they were a provisional contract nobody had reconciled, compiling
 * and typechecking cleanly the whole time. Strict TypeScript cannot see any of
 * them, because the envelope is cast at the boundary — which is exactly why
 * they need a checker rather than a type.
 *
 * Each rule below was validated against a planted regression: the rule was
 * written, the defect reintroduced, and the checker watched failing before it
 * was trusted.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Paths are compared against '/'-separated literals; on Windows `relative` answers with '\',
// and a comparison that can never match fails on correct code or skips the file it guards.
const posix = (path) => path.split(sep).join('/');

const SRC = join(ROOT, 'src');

/**
 * The two directories that are allowed to know what the wire looks like.
 *
 * `data/http` holds the adapters and the contract; `core/http` holds the
 * interceptors, which have to read the error envelope to translate it. Both are
 * the transport seam. Everywhere else — domain, features, shared, layout —
 * works in the application's own vocabulary, and a `snake_case` field name
 * appearing there means a wire shape has leaked past the seam.
 */
const TRANSPORT_SEAM = ['src/app/data/http/', 'src/app/core/http/'];

const failures = [];

function fail(file, message) {
  failures.push(`${file}\n    ${message}`);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Comments are prose, not behaviour.
 *
 * Every rule below reasons about what the code *does*, so each file is stripped
 * of block comments and comment-only lines first. Without this the checker
 * fails on the paragraph explaining why `withCredentials` was removed — the
 * documentation of a rule tripping the rule, which teaches the team to delete
 * the explanation rather than keep the guard.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}

const files = walk(SRC).map((f) => {
  const source = readFileSync(f, 'utf8');
  return { path: posix(relative(ROOT, f)), source, code: stripComments(source) };
});

const read = (path) => files.find((f) => f.path === path)?.code ?? '';

// ── 1. Credentialed requests, in any form ────────────────────────────────────
//
// `withCredentials: true` against an API whose CORS policy sends no Allow-Credentials
// is refused by the browser before any application code runs. It is a CORS
// failure rather than a status, so nothing in the app can catch it, and the
// only symptom is a message in the developer console. There is no configuration
// in which it is correct against this API.
for (const { path, code } of files) {
  if (/withCredentials\s*:\s*true/.test(code)) {
    fail(
      path,
      'withCredentials: true — the API sends no Access-Control-Allow-Credentials, so the browser ' +
        'refuses the response outright (ADR 0005/0006). Never widen the server to make this work.',
    );
  }
}

// ── 2. The versioned base URL ────────────────────────────────────────────────
//
// The version is in the path, never a header (conventions.md §1), and the
// topology is cross-origin, so a relative base resolves against the static host.
// Discovered rather than listed: TAB 12 replaced the two-file setup with a four-configuration
// matrix, and this loop still named `environment.development.ts`, which no longer exists. A rule
// that hardcodes filenames stops checking the moment somebody adds one.
for (const path of readdirSync(join(ROOT, 'src/environments'))
  .filter((file) => file.startsWith('environment.') && file !== 'environment.model.ts')
  .map((file) => `src/environments/${file}`)) {
  const source = read(path);
  const match = /apiBaseUrl:\s*'([^']*)'/.exec(source);

  if (!match) {
    fail(path, 'no apiBaseUrl found.');
    continue;
  }

  const url = match[1];

  if (!url.endsWith('/api/v1')) {
    fail(path, `apiBaseUrl is '${url}' — it must end with /api/v1. The API serves no unversioned route.`);
  }

  if (!/^https?:\/\//.test(url)) {
    fail(
      path,
      `apiBaseUrl is '${url}' — it must be an absolute origin. The console and the API are ` +
        'different hosts by design (admin.<domain> calling api.<domain>), so a relative path ' +
        'resolves against the static host and never reaches the API.',
    );
  }
}

// ── 3. Adapters build URLs from the shared client ────────────────────────────
//
// An adapter that hand-builds an absolute URL bypasses the base entirely, and
// the version with it.
//
// SPECS ARE EXEMPT, and only specs. A test has to supply an API origin to configure
// APP_ENVIRONMENT, and asserting the URL a request actually used is how it proves the base was
// applied — the opposite of the defect this rule exists to catch. The exemption is narrow on
// purpose: the rule still covers every adapter, including the file transport, which builds its
// own URLs from the environment rather than through ApiClient because FormData and upload
// progress are outside what ApiClient does.
for (const { path, code } of files) {
  if (!path.startsWith('src/app/data/http/')) continue;
  if (path.endsWith('.spec.ts')) continue;

  for (const [index, line] of code.split('\n').entries()) {
    if (/['"`]https?:\/\//.test(line)) {
      fail(path, `line ${index + 1}: builds an absolute URL. Go through ApiClient, which owns the versioned base.`);
    }
    if (/['"`]\/api\//.test(line)) {
      fail(path, `line ${index + 1}: hard-codes an /api/ prefix. The base URL already carries it.`);
    }
  }
}

// ── 4. The pagination shape the API actually sends ───────────────────────────
//
// Cursor paging (`DL-165`): `meta.pagination` is `{ has_more, next_cursor }` and nothing else. A
// contract that names a total or a page count is reading keys the server never sends — every one
// `undefined`, rendered as "page 1 of NaN" or as nothing.
const contract = read('src/app/data/http/api.contract.ts');

for (const key of ['has_more', 'next_cursor']) {
  if (!contract.includes(key)) {
    fail('src/app/data/http/api.contract.ts', `the pagination contract must name '${key}' — it is what meta.pagination carries.`);
  }
}

for (const key of ['total_pages', 'per_page', 'total']) {
  if (
    new RegExp(String.raw`\b${key}\b\s*[:?]`).test(contract) ||
    new RegExp(String.raw`pagination\s*\.\s*${key}\b`).test(contract)
  ) {
    fail(
      'src/app/data/http/api.contract.ts',
      `names '${key}' in the pagination contract. The API sends no total, no page size and no page count; ` +
        'a screen built on one shows a number nobody computed.',
    );
  }
}

if (!/meta\s*\.\s*pagination/.test(contract)) {
  fail('src/app/data/http/api.contract.ts', 'toCursorPage must read meta.pagination.');
}

// ── 5. Only the query keys the API reads: limit, cursor, filters ─────────────
//
// The API's query schemas are not strict. An unknown key is DROPPED, not refused, so a `sort`
// would be ignored while a header arrow asserted an order the rows do not have, and a `page` would
// fetch the first rows again for ever. A parameter the server ignores is worse than one it refuses.
if (!/params\s*\[\s*'cursor'\s*\]|\bcursor:\s*/.test(contract) || !/\blimit:\s*String\(/.test(contract)) {
  fail('src/app/data/http/api.contract.ts', "toQueryParams must emit 'limit' and 'cursor', the only paging keys the API reads.");
}

for (const ignored of ['page', 'per_page', 'sort', 'direction', 'pageSize']) {
  if (new RegExp(String.raw`params\s*\[\s*'${ignored}'\s*\]\s*=|\b${ignored}:\s*String\(`).test(contract)) {
    fail(
      'src/app/data/http/api.contract.ts',
      `emits '${ignored}'. The API declares no such query parameter and silently drops it — the list ` +
        'comes back unpaged or unsorted under a control that says otherwise.',
    );
  }
}

// ── 5b. Only the request headers the API's CORS policy allows ───────────────
//
// A non-safelisted header the API does not list in `Access-Control-Allow-Headers` fails the
// preflight of every request carrying it: status 0, before the server sees anything, and nothing
// for an interceptor to read. The list below is the backend's `src/http/cors.ts` at the vendored
// commit; `Accept` and `Content-Type: application/json` are what the browser and HttpClient send.
const CORS_ALLOWED_HEADERS = new Set(['authorization', 'content-type', 'x-request-id', 'x-client-channel', 'accept']);

for (const { path, code } of files) {
  if (!TRANSPORT_SEAM.some((dir) => path.startsWith(dir)) || path.endsWith('.spec.ts')) continue;

  for (const block of code.matchAll(/(?:setHeaders|headers)\s*:\s*\{([^}]*)\}/g)) {
    for (const [, name] of block[1].matchAll(/['"]?([A-Za-z][A-Za-z-]*)['"]?\s*:/g)) {
      if (!CORS_ALLOWED_HEADERS.has(name.toLowerCase())) {
        fail(
          path,
          `sets the request header '${name}', which the API's CORS policy does not allow. Every request ` +
            'carrying it fails its preflight before the server sees it.',
        );
      }
    }
  }

  if (/['"`]Idempotency-Key['"`]/.test(code)) {
    fail(
      path,
      "sends 'Idempotency-Key'. The API does not implement it and its CORS policy refuses it, so it " +
        'promises a replay safety nobody provides and breaks the request it is attached to (DL-165).',
    );
  }
}

// ── 6. The error envelope ────────────────────────────────────────────────────
const failureReader = read('src/app/core/http/api-failure.ts');

if (!/'error'\s*in\s*body/.test(failureReader)) {
  fail('src/app/core/http/api-failure.ts', 'must read the { error: { … } } envelope the API sends.');
}

for (const field of ['request_id', 'details']) {
  if (!failureReader.includes(field)) {
    fail('src/app/core/http/api-failure.ts', `drops '${field}'. Validation detail and the id a caseworker quotes are both lost without it.`);
  }
}

const interceptors = read('src/app/core/http/api.interceptors.ts');

if (!/X-Client-Channel/.test(interceptors)) {
  fail('src/app/core/http/api.interceptors.ts', "must send X-Client-Channel: admin-console. It is telemetry, never authority, and its absence leaves every staff request recorded as an unknown channel.");
}

if (/error\.status\s*===\s*(401|403)/.test(interceptors) && !/failure\.code/.test(interceptors)) {
  fail('src/app/core/http/api.interceptors.ts', 'branches on status alone. Branch on error.code (conventions.md §4).');
}

// ── 7. Wire shapes stay behind the transport seam ────────────────────────────
//
// A snake_case field name outside data/http or core/http means a wire shape
// reached the domain, a feature or a template — which is how a payload starts
// dictating a domain model instead of being mapped into one.
const WIRE_NAMES = [
  'per_page',
  'total_pages',
  'has_more',
  'next_cursor',
  'request_id',
  'created_at',
  'updated_at',
  'first_name',
  'last_name',
  'birth_date',
  'case_number',
  'assigned_to',
  'program_id',
  'resident_id',
  'archived_at',
  'is_citizen_visible',
  'citizen_message',
];

for (const { path, code } of files) {
  if (TRANSPORT_SEAM.some((dir) => path.startsWith(dir))) continue;
  if (path.endsWith('.spec.ts')) continue;

  for (const name of WIRE_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(code)) {
      fail(path, `names the wire field '${name}' outside the transport seam. Adapters map wire shapes into the domain; nothing else should see one.`);
    }
  }
}

// ── 8. The hosting configuration, and the CSP two ADRs depend on ────────────
//
// F-09: no hosting configuration existed at all. ADR 0005 and ADR 0006 both name
// a strict CSP among the mitigations for the XSS exposure bearer tokens carry,
// and the backend's topology document states that without it "the residual risk
// both ADRs accepted is unmitigated, not merely undocumented".
//
// So this is checked here rather than left to a deployment review: the whole
// point of committing the policy is that weakening it shows up in a diff.
/*
 * Comments stripped for the same reason the TypeScript rules strip them, and it
 * bit twice: this file's own paragraphs explain the CSP and say why HSTS is
 * deliberately absent, and the first version of these rules read that prose as
 * configuration. A rule that fails on its own documentation teaches people to
 * delete the documentation.
 */
const withoutComments = (source) =>
  source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const hosting = withoutComments(readFileSync(join(ROOT, 'netlify.toml'), 'utf8'));

if (!/\[\[redirects\]\]/.test(hosting) || !/to = "\/index\.html"/.test(hosting)) {
  fail('netlify.toml', 'no SPA fallback. Every deep link 404s — a bookmarked case URL, and every link a caseworker pastes to a colleague.');
}

for (const [name, source] of [['netlify.toml', hosting], ['public/_headers', withoutComments(readFileSync(join(ROOT, 'public/_headers'), 'utf8'))]]) {
  const csp = /Content-Security-Policy[ =:]+"?([^"\n]+)/.exec(source)?.[1] ?? '';

  if (csp === '') {
    fail(name, 'declares no Content-Security-Policy. ADR 0005 and ADR 0006 both depend on it.');
    continue;
  }

  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'"]) {
    if (csp.includes(forbidden)) {
      fail(
        name,
        `the CSP contains ${forbidden}, which defeats the control it exists to be. Angular's inline ` +
          'component styles are answered with ngCspNonce, never by widening the policy — that is the ' +
          'exact silent weakening the deployment topology warns about.',
      );
    }
  }

  if (/connect-src[^;]*\*/.test(csp)) {
    fail(name, 'connect-src carries a wildcard. It names one API origin for this environment, never a pattern — anybody can create a site on a shared hosting domain.');
  }

  for (const directive of ['default-src', 'script-src', 'frame-ancestors', 'base-uri', 'object-src', 'form-action']) {
    if (!csp.includes(directive)) {
      fail(name, `the CSP is missing ${directive}. The baseline is in taytay-backend/docs/architecture/deployment-topology.md and is an obligation, not a starting point.`);
    }
  }
}

if (/Strict-Transport-Security/.test(hosting)) {
  fail(
    'netlify.toml',
    'sets Strict-Transport-Security. It cannot be undone from the server — a certificate problem then ' +
      'locks the office out of its own console with no server-side remedy — so it is added in TAB 13 ' +
      'only after the custom domain and certificate chain are confirmed.',
  );
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nContract check failed:\n');
  for (const failure of failures) {
    console.error(`  ${failure}\n`);
  }
  console.error(
    `${failures.length} problem${failures.length === 1 ? '' : 's'}.\n\n` +
      'These are the divergences TAB 01 reconciled. Each one compiles and typechecks; that is\n' +
      'why they are checked here rather than left to the compiler.\n',
  );
  process.exit(1);
}

console.log('Contract check passed.');
