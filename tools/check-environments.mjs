#!/usr/bin/env node
/**
 * check:environments — a production build cannot serve invented residents.
 *
 * ## The defect this exists for, which already happened
 *
 * TAB 12: *"A production build with [mock], or with a localhost API URL, must fail the build. This
 * exact combination has shipped in production once already — the current environment.ts is a
 * production configuration pointing at mock data."*
 *
 * That is accurate. `environment.ts` carried `production: true` alongside `dataSource: 'mock'`, and
 * nothing objected: the build succeeded, the bundle was valid, every test passed, and the
 * application would have served seeded residents to whoever opened it. There is no compiler error
 * available for "this configuration is a lie", which is exactly the shape a check is for.
 *
 * ## The rules
 *
 * 1. Every configuration in the matrix exists and names itself.
 * 2. A production build never selects the mock.
 * 3. A production build never points at a local or plaintext API.
 * 4. Staging and production never share an API host — a staging build that can reach production
 *    is one that will eventually write to it, and the failure reads as a data-entry mistake.
 * 5. No environment file carries anything that looks like a credential. Build variables on a
 *    static host are public.
 * 6. Production ships no developer tooling.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'src/environments');

const EXPECTED = ['environment.ts', 'environment.staging.ts', 'environment.local-api.ts', 'environment.local-mock.ts'];

const failures = [];

/**
 * Comments explain these rules and must not trip them.
 *
 * `environment.ts`'s own docblock says the file *used to* carry `dataSource: 'mock'`, and the
 * first version of this check read that sentence and failed the build on it. A check that fires on
 * an accurate comment teaches people to delete the comment.
 */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Read the literal fields out of an environment file without executing it. */
function fieldsOf(source) {
  const read = (key, pattern) => pattern.exec(source)?.[1] ?? null;

  return {
    name: read('name', /name:\s*'([^']+)'/),
    production: /production:\s*true/.test(source),
    apiBaseUrl: read('apiBaseUrl', /apiBaseUrl:\s*'([^']+)'/),
    dataSource: read('dataSource', /dataSource:\s*'([^']+)'/),
    enableDevTools: /enableDevTools:\s*true/.test(source),
  };
}

const present = readdirSync(DIR);

for (const file of EXPECTED) {
  if (!present.includes(file)) {
    failures.push(`src/environments/${file} is missing. The matrix is local-mock, local-api, staging, production.`);
  }
}

const environments = {};

for (const file of EXPECTED.filter((f) => present.includes(f))) {
  environments[file] = fieldsOf(code(readFileSync(join(DIR, file), 'utf8')));
}

for (const [file, env] of Object.entries(environments)) {
  const where = `src/environments/${file}`;

  if (env.name === null) {
    failures.push(`${where} does not name itself. "Which build is this?" is the first question asked when something is wrong in an environment nobody can attach a debugger to.`);
  }

  // ── 5. nothing that looks like a credential ──────────────────────────────
  const source = code(readFileSync(join(DIR, file), 'utf8'));

  if (/\b(apiKey|api_key|secret|token|password|clientSecret)\b\s*:/i.test(source)) {
    failures.push(
      `${where} carries something shaped like a credential.\n` +
        `    Build variables on a static host are public — anything here ships to every browser.`,
    );
  }
}

const production = environments['environment.ts'];

if (production !== undefined) {
  // ── 2. never the mock ────────────────────────────────────────────────────
  if (production.production && production.dataSource !== 'http') {
    failures.push(
      `src/environments/environment.ts is a production configuration with dataSource '${production.dataSource}'.\n` +
        `    This has shipped once already. The build succeeds, the bundle is valid, and the\n` +
        `    application serves invented residents to whoever opens it.`,
    );
  }

  // ── 3. never a local or plaintext API ────────────────────────────────────
  const url = production.apiBaseUrl ?? '';

  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(url)) {
    failures.push(
      `src/environments/environment.ts points production at '${url}'.\n` +
        `    A production bundle asking for localhost reaches the machine of whoever opened it.`,
    );
  }

  if (production.production && !url.startsWith('https://')) {
    failures.push(
      `src/environments/environment.ts serves production over '${url}'.\n` +
        `    A bearer token on a plaintext connection is a bearer token anybody on the path holds.`,
    );
  }

  // ── 6. no developer tooling in production ────────────────────────────────
  if (production.production && production.enableDevTools) {
    failures.push(
      'src/environments/environment.ts enables developer tooling in production.\n' +
        '    The detail a developer needs is the detail a caseworker must never be shown.',
    );
  }
}

// ── 4. staging and production are different systems ────────────────────────
const staging = environments['environment.staging.ts'];

if (staging !== undefined && production !== undefined) {
  const host = (url) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  if (staging.apiBaseUrl !== null && production.apiBaseUrl !== null
      && host(staging.apiBaseUrl) === host(production.apiBaseUrl)) {
    failures.push(
      `staging and production share the API host '${host(staging.apiBaseUrl)}'.\n` +
        `    A staging build that can reach production is one that will eventually write to it, and\n` +
        `    the failure reads as a data-entry mistake rather than a deployment one.`,
    );
  }

  if (staging.dataSource !== 'http') {
    failures.push("staging must run against the API; it is where the real thing is exercised before it ships.");
  }
}

/*
 * ── 7. the CSP must allow the API each build actually calls ────────────────
 *
 * A `connect-src` that names a different host from the one in the environment file produces an
 * application that loads perfectly and cannot reach its API — every request blocked by the
 * browser before it leaves, reported as a network error with nothing in any server log.
 *
 * This rule exists because I introduced exactly that in TAB 12: the deploy-preview CSP had long
 * said `api-staging.<approved-domain>` and I wrote a new staging environment pointing at
 * `staging-api.<approved-domain>`. Both plausible, neither wrong on its own, and together a
 * console that silently cannot work.
 */
const hosting = ['netlify.toml', 'public/_headers']
  .map((file) => {
    try {
      return readFileSync(join(ROOT, file), 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

for (const [file, env] of Object.entries(environments)) {
  const url = env.apiBaseUrl ?? '';

  // Only the deployed configurations have a CSP to agree with; localhost has none.
  if (!url.startsWith('https://')) {
    continue;
  }

  /*
   * Sliced textually rather than parsed. Every URL here still carries the
   * `<approved-domain>` placeholder, and `new URL` throws on it — so the first version of
   * this rule caught the exception, skipped, and could never fail. A check that cannot fail
   * is worse than no check: it reports a guarantee nobody has.
   */
  const origin = url.split('/').slice(0, 3).join('/');

  if (hosting !== '' && !hosting.includes(origin)) {
    failures.push(
      `src/environments/${file} calls ${origin}, which no CSP in netlify.toml or public/_headers allows.\n` +
        `    The application would load and be unable to reach its API — every request blocked by the\n` +
        `    browser before it leaves, with nothing in any server log to explain it.`,
    );
  }
}

if (failures.length > 0) {
  console.error('\nEnvironment check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Environment check passed (${Object.keys(environments).length} configurations: ` +
    `${Object.values(environments).map((e) => e.name).join(', ')}).`,
);
