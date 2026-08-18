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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
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
  return { path: relative(ROOT, f), source, code: stripComments(source) };
});

const read = (path) => files.find((f) => f.path === path)?.code ?? '';

// ── 1. Credentialed requests, in any form ────────────────────────────────────
//
// `withCredentials: true` against an API with `supports_credentials => false`
// is refused by the browser before any application code runs. It is a CORS
// failure rather than a status, so nothing in the app can catch it, and the
// only symptom is a message in the developer console. There is no configuration
// in which it is correct against this API.
for (const { path, code } of files) {
  if (/withCredentials\s*:\s*true/.test(code)) {
    fail(
      path,
      'withCredentials: true — the API sets supports_credentials => false, so the browser ' +
        'refuses the response outright (ADR 0005/0006). Never widen the server to make this work.',
    );
  }
}

// ── 2. The versioned base URL ────────────────────────────────────────────────
//
// The version is in the path, never a header (conventions.md §1), and the
// topology is cross-origin, so a relative base resolves against the static host.
for (const path of ['src/environments/environment.ts', 'src/environments/environment.development.ts']) {
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
        'resolves against the static host and never reaches Laravel.',
    );
  }
}

// ── 3. Adapters build URLs from the shared client ────────────────────────────
//
// An adapter that hand-builds an absolute URL bypasses the base entirely, and
// the version with it.
for (const { path, code } of files) {
  if (!path.startsWith('src/app/data/http/')) continue;

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
const contract = read('src/app/data/http/api.contract.ts');

for (const key of ['per_page', 'total_pages', 'has_more']) {
  if (!contract.includes(key)) {
    fail('src/app/data/http/api.contract.ts', `the pagination contract must name '${key}' — it is what meta.pagination carries.`);
  }
}

if (/meta\.(pageSize|totalItems)\b/.test(contract) || /\bpageSize:\s*response\.meta\./.test(contract)) {
  fail(
    'src/app/data/http/api.contract.ts',
    'reads meta.pageSize / meta.totalItems. The API sends meta.pagination.{page,per_page,total,total_pages,has_more}; ' +
      'those keys are undefined and every list renders as one empty page.',
  );
}

if (!/meta\.pagination/.test(contract)) {
  fail('src/app/data/http/api.contract.ts', 'toPage must read meta.pagination.');
}

// ── 5. Sorting is a leading '-', not a direction parameter ───────────────────
//
// The server has no `direction` parameter. Sending one means the sort is
// silently ignored while the grid's header arrow asserts an order the data does
// not have — a lie the user acts on.
if (/params\['direction'\]/.test(contract) || /\bdirection:\s*String\(/.test(contract)) {
  fail(
    'src/app/data/http/api.contract.ts',
    "emits a 'direction' query parameter. The API encodes descending as a leading '-' on 'sort' " +
      '(conventions.md §5) and ignores anything else.',
  );
}

if (!/per_page/.test(contract) || /params\['pageSize'\]|pageSize:\s*String\(/.test(contract)) {
  fail('src/app/data/http/api.contract.ts', "toQueryParams must emit 'per_page'; the API does not read 'pageSize'.");
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
