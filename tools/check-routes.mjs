#!/usr/bin/env node
/**
 * check:routes — every endpoint this console calls is one the API actually serves.
 *
 * ## The failure this exists for
 *
 * TAB 05 repointed twenty adapters against `php artisan route:list`, by hand, once. Nothing has
 * re-checked them since, and nothing would: a path that no longer exists produces a 404 at
 * runtime, on one screen, discovered by whoever opened it. There is no compiler error available
 * for "this string is not a route".
 *
 * TAB 18 makes that mechanical, because it is also what decides deployment order: *"The API deploys
 * before the console when the console needs a new endpoint; the console deploys before the API when
 * the API removes one."* Both halves of that sentence are answerable by comparing this console's
 * endpoint table against the API's published surface — and neither is answerable from memory.
 *
 * ## The snapshot is vendored, with provenance
 *
 * `contract/routes.published.json` is a copy of the backend's own generated snapshot, recorded in
 * `routes.source.json` with the commit it came from and its sha256 — the same treatment
 * `types.ts` gets, for the same reason. **A vendored artefact that cannot say where it came from
 * is one nobody can tell is stale**, and a stale route list is confidently wrong rather than
 * merely absent.
 *
 * The staleness this cannot see is the backend having moved on since that commit. That is the
 * backend's half: `PublishedRoutesAreStableTest` fails there when a route disappears without the
 * snapshot changing, so the removal becomes a line in a diff before it can become a 404 here.
 *
 * ## What it compares
 *
 * `API_ENDPOINTS` holds the base paths; adapters append segments and identifiers. So the rule is
 * that every base path must match a published route **as a prefix** — an exact match would reject
 * `admin/residents` (only ever called as `admin/residents/{id}` for reads), and a substring match
 * would accept anything. Parameter names are normalised away: `{resident}` and `{id}` are the same
 * position.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTRACT = join(ROOT, 'src/app/data/http/contract');

const failures = [];

// ── 1. the vendored snapshot is what it says it is ─────────────────────────
const raw = readFileSync(join(CONTRACT, 'routes.published.json'), 'utf8');
const provenance = JSON.parse(readFileSync(join(CONTRACT, 'routes.source.json'), 'utf8'));
const actual = createHash('sha256').update(raw).digest('hex');

if (actual !== provenance.sha256) {
  failures.push(
    'routes.published.json does not match the sha256 in routes.source.json.\n' +
      '    Either it was edited by hand — which makes the provenance a lie — or it was re-copied\n' +
      `    without updating the record. Re-vendor from the backend and rewrite both.`,
  );
}

const published = JSON.parse(raw).routes ?? [];

if (published.length !== provenance.routeCount) {
  failures.push(
    `routes.source.json records ${provenance.routeCount} routes and the snapshot holds ${published.length}.`,
  );
}

/*
 * A comparison against an empty list would pass every endpoint. Every detector here asserts its
 * own reach, because one that reaches nothing is indistinguishable from a codebase with nothing
 * to find.
 */
if (published.length < 100) {
  failures.push(
    `The vendored route snapshot holds only ${published.length} routes, which is too few to be the\n` +
      '    whole API. Every endpoint would pass against it, and the check would report a guarantee\n' +
      '    nobody has.',
  );
}

// ── 2. every endpoint the console names is one the API publishes ───────────
const contract = readFileSync(join(ROOT, 'src/app/data/http/api.contract.ts'), 'utf8');

const table = /export const API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract);

if (table === null) {
  failures.push('API_ENDPOINTS could not be read from api.contract.ts, so nothing was checked.');
} else {
  /** Comments in that table explain the exceptions and must not be mistaken for entries. */
  const body = table[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const entries = [...body.matchAll(/(\w+):\s*'([^']+)'/g)].map(([, name, path]) => ({ name, path }));

  if (entries.length < 20) {
    failures.push(`Only ${entries.length} endpoints were parsed from API_ENDPOINTS. The parser is broken, not the table.`);
  }

  /** `{resident}` and `{id}` are the same position; the name is documentation. */
  const normalise = (path) => path.replace(/\{[^}]+\}/g, '{}');

  const prefixes = new Set();

  for (const route of published) {
    const [, path] = route.split(' ');
    const normalised = normalise(path.replace(/^\/api\/v1\//, ''));

    // Record every prefix, so `admin/residents` matches a published `admin/residents/{}`.
    const segments = normalised.split('/');
    for (let i = 1; i <= segments.length; i++) prefixes.add(segments.slice(0, i).join('/'));
  }

  /*
   * A deliberately-absent endpoint, asserted absent rather than skipped.
   *
   * `cases` holds the route that used to exist and no longer does, so an adapter wired to it fails
   * loudly at 404 instead of quietly succeeding against `admin/assistance-requests` — the
   * "looks like success when wrong" trap TAB 04 exists to prevent (L-07).
   *
   * Skipping it would mean this check stays silent on the day the API finally publishes the case
   * surface, which is exactly the day somebody needs telling to wire it. So it is checked in
   * reverse: present is the failure.
   */
  const INTENTIONALLY_ABSENT = {
    cases: 'Blocked on ADR 0044. The value is a 404 sentinel, not an endpoint.',
  };

  for (const [name, why] of Object.entries(INTENTIONALLY_ABSENT)) {
    const entry = entries.find((e) => e.name === name);

    if (entry !== undefined && prefixes.has(normalise(entry.path))) {
      failures.push(
        `API_ENDPOINTS.${name} is now published by the API.\n` +
          `    ${why}\n` +
          `    It is no longer absent, so wire the adapters and remove it from INTENTIONALLY_ABSENT.`,
      );
    }
  }

  for (const { name, path } of entries) {
    if (name in INTENTIONALLY_ABSENT) continue;

    if (!prefixes.has(normalise(path))) {
      failures.push(
        `API_ENDPOINTS.${name} is '${path}', which the API does not publish.\n` +
          `    Either the API must deploy first with this endpoint, or the console is calling a path\n` +
          `    that was removed — in which case every screen using it 404s, discovered by whoever\n` +
          `    opens it. See docs/integration/release-engineering.md for which order this release needs.`,
      );
    }
  }
}

/*
 * ── 3. the composed paths, which is where the defects actually are ─────────
 *
 * `API_ENDPOINTS` holds base paths. The adapters compose the rest — `${releases}/${id}/release`,
 * `${newsfeed}/${id}/publish` — and TAB 05 repointed the twenty base paths without bringing those
 * composed paths in line with the 148-row mapping it produced in the same command.
 *
 * That mapping is CORRECT and the code does not follow it. `port-mapping.md` records
 * `markReleased → POST admin/releases/{release}/status`; the adapter posts to
 * `admin/releases/{id}/release`. Appendix A named this failure in advance: *"TAB 05 is estimated
 * from the 146 call sites rather than from the 147-row mapping. The call sites are typing; the
 * mapping is the work."*
 *
 * ## Why a baseline and not a hard failure
 *
 * There are 61 of them, including every money write. Failing the build outright would stop all
 * other work behind a body of rework that belongs to TAB 05, and the realistic outcome of a check
 * nobody can make pass is a check somebody removes.
 *
 * So the count is printed on **every** run, and the check fails when the list GROWS. The number is
 * visible, it cannot quietly increase, and shrinking it is the work. It is a baseline, never an
 * allow-list: nothing here is acceptable, and gate line 05/07 stays NO-GO until it is empty.
 */
const adapters = readFileSync(join(ROOT, 'src/app/data/http/http-repositories.ts'), 'utf8');
const baseline = JSON.parse(readFileSync(join(CONTRACT, 'unwired-paths.json'), 'utf8'));

const composed = new Set();

if (table !== null) {
  const body = table[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const lookup = Object.fromEntries([...body.matchAll(/(\w+):\s*'([^']+)'/g)].map(([, n, p]) => [n, p]));

  for (const m of adapters.matchAll(/`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`/g)) {
    const rest = m[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
    if (lookup[m[1]] !== undefined) composed.add((lookup[m[1]] + rest).replace(/\/$/, ''));
  }

  for (const m of adapters.matchAll(/API_ENDPOINTS\.(\w+)(?![\w`])/g)) {
    if (lookup[m[1]] !== undefined) composed.add(lookup[m[1]].replace(/\/$/, ''));
  }
}

const normalisePath = (p) => p.replace(/\{[^}]+\}/g, '{}');
const publishedPaths = new Set(published.map((r) => normalisePath(r.split(' ')[1].replace(/^\/api\/v1\//, ''))));

const unwired = [...composed]
  .filter((p) => !publishedPaths.has(p) && ![...publishedPaths].some((q) => q.startsWith(`${p}/`)))
  .sort();

if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    join(CONTRACT, 'unwired-paths.json'),
    `${JSON.stringify({ ...baseline, count: unwired.length, paths: unwired }, null, 2)}\n`,
  );
  console.log(`Baseline rewritten: ${unwired.length} unwired composed paths.`);
  process.exit(0);
}

if (composed.size < 50) {
  failures.push(`Only ${composed.size} composed paths were extracted from the adapters. The parser is broken, not the code.`);
}

const known = new Set(baseline.paths);
const newlyUnwired = unwired.filter((p) => !known.has(p));

if (newlyUnwired.length > 0) {
  failures.push(
    `${newlyUnwired.length} NEW composed path(s) the API does not publish:\n` +
      newlyUnwired.map((p) => `      ${p}`).join('\n') +
      `\n\n    Each is a 404 in the HTTP configuration. Check port-mapping.md — it very likely already\n` +
      `    records the right route, because the mapping was done and the code did not follow it.`,
  );
}

const fixed = [...known].filter((p) => !unwired.includes(p));

if (fixed.length > 0) {
  failures.push(
    `${fixed.length} baseline path(s) are now published. Shrink the baseline:\n` +
      fixed.map((p) => `      ${p}`).join('\n') +
      `\n\n    Run: node tools/check-routes.mjs --write-baseline`,
  );
}

if (failures.length > 0) {
  console.error('\nRoute check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Route check passed (every API_ENDPOINTS entry is published by ${provenance.repository}@${provenance.commitShort}, ${published.length} routes).`,
);

/*
 * Printed on every run, in red, whether or not the check passed. A number in a file is a number
 * nobody reads; a number on every build is one somebody eventually asks about.
 */
const blocked = unwired.filter((p) => p.startsWith('admin/cases')).length;

/*
 * The breakdown is computed, not asserted.
 *
 * This line used to end "Every money write is among them", which was true when it was written and
 * became false the moment the release cluster was wired — a hardcoded claim about a changing set,
 * which is the same species of error as the stale port-mapping document this check exists to
 * correct for.
 */
console.error(
  `\n  \u001b[31m${unwired.length} composed request paths are still 404s\u001b[0m ` +
    `(${composed.size} checked)` +
    (blocked > 0 ? `, of which ${blocked} are the case surface blocked on ADR 0044` : '') +
    `.\n  Gate line 05/07 — "no port method is unresolved" — is NO-GO until this reaches zero.\n` +
    `  See docs/integration/release-engineering.md.\n`,
);
