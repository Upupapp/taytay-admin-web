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

/*
 * ── the METHOD is part of the contract ─────────────────────────────────────
 *
 * The first version compared paths alone, and a `POST` to a path the API serves `GET`-only passed
 * cleanly. That is how the programme composer came to write to `/programs` — the public catalog a
 * resident may browse — while `POST admin/programs` sat unused. The path existed, so nothing
 * objected, and the request would have been refused by a router that never reached the application.
 *
 * A path-only check is the more dangerous half-measure, because it reports a clean result.
 *
 * Each call is walked to its own closing paren and its FIRST ARGUMENT taken as the path. An earlier
 * attempt scanned for `API_ENDPOINTS.x` and looked backwards for the nearest verb; that
 * mis-attributed verbs across call boundaries and reported a `DELETE admin/households` that nothing
 * performs. Only the call being examined knows which verb owns its path.
 */
const VERBS = {
  post: 'POST',
  postVoid: 'POST',
  patch: 'PATCH',
  delete: 'DELETE',
  deleteVoid: 'DELETE',
  page: 'GET',
  collection: 'GET',
  item: 'GET',
  optionalItem: 'GET',
};

if (table !== null) {
  const body = table[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const lookup = Object.fromEntries([...body.matchAll(/(\w+):\s*'([^']+)'/g)].map(([, n, p]) => [n, p]));

  for (const call of apiCalls(adapters)) {
    const verb = VERBS[call.verb];

    if (verb === undefined) continue;

    const argument = firstArgument(call.args);
    const template = /^`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`$/.exec(argument);
    const bare = /^API_ENDPOINTS\.(\w+)$/.exec(argument);

    let path = null;

    if (template !== null && lookup[template[1]] !== undefined) {
      path = lookup[template[1]] + template[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
    } else if (bare !== null && lookup[bare[1]] !== undefined) {
      path = lookup[bare[1]];
    }

    if (path !== null) composed.add(`${verb} ${path.replace(/\/$/, '')}`);
  }
}

const normalisePath = (p) => p.replace(/\{[^}]+\}/g, '{}');

const publishedMethods = new Map();

for (const route of published) {
  const [method, path] = route.split(' ');
  const key = normalisePath(path.replace(/^\/api\/v1\//, ''));
  publishedMethods.set(key, (publishedMethods.get(key) ?? new Set()).add(method));
}

const publishedPaths = new Set(publishedMethods.keys());

const unwired = [...composed]
  .filter((entry) => {
    const [verb, path] = entry.split(' ');
    const serves = publishedMethods.get(path);

    /*
     * A base path with no published route of its own is legitimate when something extends it.
     * A path that IS published is judged on its verbs, which is the point of this pass.
     */
    if (serves === undefined) {
      return ![...publishedPaths].some((q) => q.startsWith(`${path}/`));
    }

    return !serves.has(verb);
  })
  .sort();

/*
 * ── Nearest published routes, printed with every unwired path ────────────────
 *
 * Written after a triage done by hand got four of seven entries wrong.
 *
 * The method was to grep the published list for a substring guessed from the composed path —
 * `'reports/'`, `'privacy/'`, `'families/transfers'` — and conclude "nothing published covers this"
 * when nothing came back. But `POST admin/reports/{}/export` is served by `POST admin/exports`
 * with the report in the body; `GET admin/privacy/corrections` by `GET admin/resident-corrections`;
 * `POST admin/families/transfers` by `POST admin/households/{household}/transfers`. None of them
 * shares the substring that was searched for, and each was filed as a backend request that would
 * have had somebody build a route the API already serves.
 *
 * A guessed substring is a scan that under-reports, and this file already carries two entries about
 * exactly that failure (`DL-142`, `DL-143`). So the comparison is no longer done by eye: every
 * unwired path prints its closest published routes, scored on shared path segments, and whoever
 * reads the list is looking at candidates rather than remembering to search for them.
 *
 * It suggests and never decides. `POST .../assessment` and `POST .../assessment/complete` score
 * identically and mean different things (`DL-141`), so a match here is a prompt to read the
 * controller, never a repoint.
 */
const SEGMENT_NOISE = new Set(['admin', 'api', 'v1', '{}', 'me']);

const segmentsOf = (path) =>
  path
    .split(/[/{}]/)
    .map((part) => part.trim().toLowerCase().replace(/s$/, ''))
    .filter((part) => part.length > 3 && !SEGMENT_NOISE.has(part));

function nearestPublished(entry, limit = 3) {
  const [, path] = entry.split(' ');
  const wanted = segmentsOf(path);
  if (wanted.length === 0) return [];

  return published
    .map((route) => {
      const [, candidate] = route.split(' ');
      const shared = segmentsOf(candidate.replace(/^\/api\/v1\//, ''));
      const score = wanted.filter((part) => shared.includes(part)).length;
      return { route: route.replace('/api/v1/', ''), score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.route.length - b.route.length)
    .slice(0, limit);
}

if (process.argv.includes('--nearest')) {
  for (const entry of unwired) {
    console.log(`\n${entry}`);
    const matches = nearestPublished(entry, 4);
    if (matches.length === 0) {
      console.log('   (no published route shares a path segment)');
    }
    for (const match of matches) console.log(`   [${match.score}] ${match.route}`);
  }
  console.log(
    `\n${unwired.length} unwired paths. A match is a prompt to read the controller, never a repoint.\n`,
  );
  process.exit(0);
}

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
const blocked = unwired.filter((entry) => entry.split(' ')[1]?.startsWith('admin/cases')).length;

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


/** Walk each `this.api.<verb>(` to its matching close paren, counting depth. */
function apiCalls(text) {
  const out = [];
  /*
   * Whitespace is allowed around the dot, and finding that out cost three adapter methods.
   *
   * The pattern was `this\.api\.(\w+)`, contiguous. Every call written as
   *
   *     return this.api
   *       .item<Foo>(API_ENDPOINTS.bar)
   *       .pipe(...)
   *
   * — the shape Prettier produces the moment a chain is long enough to wrap — was invisible to
   * this check. It did not report them as unwired; it never saw them at all, which is worse: the
   * count looked healthy because the paths were absent from both sides of the comparison.
   *
   * A ratchet that silently stops watching part of the surface is the failure mode this whole file
   * exists to prevent elsewhere.
   */
  const start = /this\s*\.\s*api\s*\.\s*(\w+)\s*[<(]/g;
  let m;

  while ((m = start.exec(text)) !== null) {
    let i = m.index + m[0].length - 1;

    if (text[i] === '<') {
      let angle = 1;
      i++;
      while (i < text.length && angle > 0) {
        if (text[i] === '<') angle++;
        else if (text[i] === '>') angle--;
        i++;
      }
      while (i < text.length && text[i] !== '(') i++;
    }

    let depth = 0;
    const open = i;

    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    out.push({ verb: m[1], args: text.slice(open + 1, i) });
  }

  return out;
}

/** The first top-level argument of a call — its path expression. */
function firstArgument(args) {
  let depth = 0;
  let tick = false;

  for (let i = 0; i < args.length; i++) {
    const ch = args[i];

    if (ch === '`') tick = !tick;

    if (!tick) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) return args.slice(0, i).trim();
    }
  }

  return args.trim();
}