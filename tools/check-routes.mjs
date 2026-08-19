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
import { readFileSync } from 'node:fs';
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

if (failures.length > 0) {
  console.error('\nRoute check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Route check passed (every API_ENDPOINTS entry is published by ${provenance.repository}@${provenance.commitShort}, ${published.length} routes).`,
);
