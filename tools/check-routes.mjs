#!/usr/bin/env node
/**
 * check:routes — every request this console makes is one the API actually serves, at that verb.
 *
 * ## The failure this exists for
 *
 * A path that does not exist produces a 404 at runtime, on one screen, discovered by whoever opened
 * it. There is no compiler error available for "this string is not a route", so the comparison is
 * made here, mechanically, against the API's own published surface — the vendored
 * `contract/openapi.json` (`DL-165`). The backend's `tests/openapi-routes.test.ts` fails when a
 * registered route is undocumented, which is what makes the spec a route list rather than a hope.
 *
 * ## Four rules, all hard
 *
 *   1. Every `API_ENDPOINTS` entry is a path the spec publishes.
 *   2. Every request the adapters compose — base path plus segments — is published **at its verb**.
 *      A `POST` to a path served only for `GET` is refused by a router that never reaches the
 *      application, and a path-only comparison reports that as clean.
 *   3. Every call the adapters make is one this check could resolve. A call it cannot read is a
 *      call it cannot vouch for, so it fails rather than being skipped.
 *   4. Every port bound to an unserved adapter is bound to one that **makes no request**.
 *
 * Against the retired Laravel API rules 1 and 2 were a hard rule and a ratchet: fifteen composed
 * paths were known 404s, carried in `unwired-paths.json` and allowed not to grow. Against the Node
 * API every adapter that called a route it does not serve has been replaced by one that calls
 * nothing (`unserved-repositories.ts`), so the ratchet reached zero by **removal** — and a ratchet at
 * zero is a hard rule. The baseline file is gone; a new unserved path fails the build.
 *
 * ## What is still counted rather than refused
 *
 * How many ports are unserved. That number is the honest size of the gap between this console and
 * its API (`DL-164`), it may only shrink, and launch gate line 05/07 stays NO-GO while it is above
 * zero — unless the owner retires those screens.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HTTP = join(ROOT, 'src', 'app', 'data', 'http');
const CONTRACT = join(HTTP, 'contract');

const failures = [];

// ── the vendored spec, re-verified so this check can be trusted on its own ─────
const raw = readFileSync(join(CONTRACT, 'openapi.json'));
const provenance = JSON.parse(readFileSync(join(CONTRACT, 'openapi.source.json'), 'utf8'));

if (createHash('sha256').update(raw).digest('hex') !== provenance.sha256) {
  failures.push(
    'openapi.json does not match the sha256 in openapi.source.json. Run: npm run vendor:openapi',
  );
}

const spec = JSON.parse(raw.toString('utf8'));
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** `{resident}` and `{id}` are the same position; the name is documentation. */
const normalise = (path) => path.replace(/\{[^}]+\}/g, '{}');

const publishedMethods = new Map();
let operations = 0;

for (const [path, item] of Object.entries(spec.paths ?? {})) {
  const key = normalise(path.replace(/^\/api\/v1\//, ''));
  for (const method of METHODS) {
    if (item[method] === undefined) continue;
    operations++;
    publishedMethods.set(key, (publishedMethods.get(key) ?? new Set()).add(method.toUpperCase()));
  }
}

/*
 * A comparison against an empty list would pass every endpoint. The floor is the count recorded
 * when the spec was vendored, not a number somebody guessed once.
 */
if (operations === 0 || operations !== provenance.operationCount) {
  failures.push(
    `The vendored spec yields ${operations} operations; openapi.source.json records ` +
      `${provenance.operationCount}. Every path would be judged against a truncated surface.`,
  );
}

const published = [...publishedMethods.keys()];

/*
 * Nearest published routes, printed with every failure. A triage done by eye once got four of seven
 * entries wrong by grepping for a guessed substring (`DL-142`, `DL-143`); these are candidates to
 * read, never a repoint.
 */
const SEGMENT_NOISE = new Set(['admin', 'api', 'v1', '{}', 'me']);
const segmentsOf = (path) =>
  path
    .split(/[/{}]/)
    .map((part) => part.trim().toLowerCase().replace(/s$/, ''))
    .filter((part) => part.length > 3 && !SEGMENT_NOISE.has(part));

function nearest(path, limit = 3) {
  const wanted = segmentsOf(path);
  return published
    .map((candidate) => ({
      route: `${[...publishedMethods.get(candidate)].join('|')} ${candidate}`,
      score: wanted.filter((part) => segmentsOf(candidate).includes(part)).length,
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.route.length - b.route.length)
    .slice(0, limit)
    .map((match) => `        nearest: ${match.route}`)
    .join('\n');
}

// ── 1. every endpoint the console names is one the API publishes ─────────────
const contract = readFileSync(join(HTTP, 'api.contract.ts'), 'utf8');
const table = /export const API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract);

/** Comments in that table explain the entries and must not be mistaken for them. */
const tableBody = table === null ? '' : table[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const entries = [...tableBody.matchAll(/(\w+):\s*'([^']+)'/g)].map(([, name, path]) => ({ name, path }));
const lookup = Object.fromEntries(entries.map(({ name, path }) => [name, path]));

if (table === null) {
  failures.push('API_ENDPOINTS could not be read from api.contract.ts, so nothing was checked.');
}

/*
 * The parser's reach, asserted against a second reading of the same table: every property line must
 * have produced an entry. A value written in double quotes or as an expression would otherwise drop
 * out of the comparison silently and pass by absence.
 */
const propertyLines = [...tableBody.matchAll(/^\s*\w+\s*:/gm)].length;

if (table !== null && (entries.length === 0 || entries.length !== propertyLines)) {
  failures.push(
    `API_ENDPOINTS has ${propertyLines} properties and ${entries.length} were read as paths. ` +
      `Write each value as a single-quoted path, or this check cannot see it.`,
  );
}

for (const { name, path } of entries) {
  const key = normalise(path);
  if (!published.some((candidate) => candidate === key || candidate.startsWith(`${key}/`))) {
    failures.push(
      `API_ENDPOINTS.${name} is '${path}', which the API does not publish.\n` +
        `    Either the API must deploy first with this endpoint, or the console is calling a path\n` +
        `    nobody serves — every screen using it 404s.\n${nearest(key)}`,
    );
  }
}

// ── 2 & 3. the composed requests, at their verbs ─────────────────────────────
const VERBS = {
  cursorPage: 'GET',
  everyPage: 'GET',
  list: 'GET',
  item: 'GET',
  optionalItem: 'GET',
  /** Image bytes (`DL-167`): a read, judged at its verb like any other. */
  blob: 'GET',
  post: 'POST',
  patch: 'PATCH',
  /** A body that carries a file (`DL-170`): judged at its verb exactly as a JSON body is. */
  postForm: 'POST',
  patchForm: 'PATCH',
  delete: 'DELETE',
};

/*
 * The helper names are asserted against ApiClient's surface. A check that enumerates the names of
 * the things it inspects has a hole shaped like the next name (`DL-162`): a helper added to the
 * client and not to this table would have its calls skipped, not judged.
 */
const client = readFileSync(join(HTTP, 'api.client.ts'), 'utf8');
const declared = [...client.matchAll(/^  ([a-zA-Z]\w*)\s*[<(]/gm)].map((m) => m[1]);

for (const helper of declared) {
  if (VERBS[helper] === undefined) {
    failures.push(`ApiClient.${helper} has no verb in this check's VERBS table, so its calls cannot be judged.`);
  }
}

const adapters = readFileSync(join(HTTP, 'http-repositories.ts'), 'utf8');
const calls = apiCalls(adapters);
const rawCallSites = [...adapters.matchAll(/this\s*\.\s*api\s*\.\s*\w+/g)].length;

if (calls.length !== rawCallSites) {
  failures.push(
    `${rawCallSites} call sites on this.api and ${calls.length} were walked. The walker is broken, not the code.`,
  );
}

const composed = new Set();

for (const call of calls) {
  const verb = VERBS[call.verb];
  const argument = firstArgument(call.args);
  const template = /^`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`$/.exec(argument);
  const bare = /^API_ENDPOINTS\.(\w+)$/.exec(argument);

  let path = null;
  if (template !== null && lookup[template[1]] !== undefined) {
    path = lookup[template[1]] + template[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
  } else if (bare !== null && lookup[bare[1]] !== undefined) {
    path = lookup[bare[1]];
  }

  if (verb === undefined || path === null) {
    failures.push(
      `http-repositories.ts:${call.line} calls this.api.${call.verb}(${argument}), which this check cannot resolve.\n` +
        `    Build the path from API_ENDPOINTS through a known ApiClient helper, or nobody can say which route it reaches.`,
    );
    continue;
  }

  composed.add(`${verb} ${normalise(path.replace(/\/$/, ''))}`);
}

for (const entry of [...composed].sort()) {
  const [verb, path] = entry.split(' ');
  const serves = publishedMethods.get(path);

  if (serves === undefined || !serves.has(verb)) {
    failures.push(
      `${entry} is not served` +
        (serves === undefined ? '.' : ` at that verb (the API serves ${[...serves].join(', ')}).`) +
        `\n    Every screen that reaches this call fails with a 404 or 405 in the http configuration.\n${nearest(path)}`,
    );
  }
}

// ── 4. an unserved port makes no request ─────────────────────────────────────
const providers = readFileSync(join(ROOT, 'src', 'app', 'data', 'data-access.providers.ts'), 'utf8');
const unservedSource = readFileSync(join(HTTP, 'unserved-repositories.ts'), 'utf8');
const bindings = [...providers.matchAll(/provide:\s*(\w+),\s*useClass:\s*(\w+)/g)].map(([, token, adapter]) => ({
  token,
  adapter,
}));

if (bindings.length === 0) {
  failures.push('No port bindings were read from data-access.providers.ts, so none was checked.');
}

const unservedBindings = bindings.filter((b) => b.adapter.startsWith('Unserved'));

for (const { token, adapter } of bindings) {
  const home = adapter.startsWith('Unserved') ? unservedSource : adapter.startsWith('Http') ? adapters : null;

  if (home === null || !new RegExp(`export class ${adapter}\\b`).test(home)) {
    failures.push(
      `${token} is bound to ${adapter}, which is neither an Http adapter in http-repositories.ts nor an\n` +
        `    Unserved adapter in unserved-repositories.ts. A port is served by a route or it says it is not.`,
    );
  }
}

/*
 * Comments stripped first: the file's own docblock explains why it never injects `ApiClient`, and a
 * rule that fails on its own documentation teaches people to delete the documentation.
 */
const unservedCode = unservedSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/[^\n]*$/gm, '');

for (const [pattern, what] of [
  [/\binject\s*\(/, 'injects a dependency'],
  [/\b(ApiClient|HttpClient|HttpBackend)\b/, 'names an HTTP client'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/, 'reaches the network directly'],
  [/\bfrom\s+'[^']*\/mock\//, 'imports the mock adapters'],
]) {
  if (pattern.test(unservedCode)) {
    failures.push(
      `unserved-repositories.ts ${what}. An unserved adapter makes no request and falls back to no\n` +
        `    sample data: either would put an answer on screen that no server gave (DL-112, DL-136).`,
    );
  }
}

/**
 * Recorded 5 November 2026, `DL-165`: eighteen of twenty ports have no Node route. LOWER THIS as a
 * port is served (or retired by the owner); never raise it. Raising it means a screen that worked
 * against the API has stopped.
 */
const UNSERVED_CEILING = 18;

if (unservedBindings.length > UNSERVED_CEILING) {
  failures.push(
    `${unservedBindings.length} ports are unserved; the recorded ceiling is ${UNSERVED_CEILING}. A port that was served has\n` +
      `    been unbound from its route.`,
  );
} else if (unservedBindings.length < UNSERVED_CEILING) {
  failures.push(
    `${UNSERVED_CEILING - unservedBindings.length} fewer unserved ports than recorded. Lower UNSERVED_CEILING to ` +
      `${unservedBindings.length} in tools/check-routes.mjs so the ground is held.`,
  );
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nRoute check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Route check passed (${entries.length} endpoints and ${composed.size} composed requests, each served at its verb by ` +
    `${provenance.repository}@${provenance.commitShort}, ${operations} operations).`,
);

console.error(
  `\n  \u001b[31m${unservedBindings.length} of ${bindings.length} ports have no route\u001b[0m and are bound to an adapter that ` +
    `makes no request.\n  Gate line 05/07 is NO-GO until this reaches zero or the owner retires those screens (DL-164).\n`,
);

/** Walk each `this.api.<verb>(` to its matching close paren, counting depth. */
function apiCalls(text) {
  const out = [];
  /*
   * Whitespace is allowed around the dot. The contiguous `this\.api\.` pattern this replaced never
   * saw a call Prettier had wrapped onto a second line — not reported as wrong, never seen at all
   * (`DL-143`), and `check:scanners` now fails any scanner written that way.
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

    out.push({
      verb: m[1],
      args: text.slice(open + 1, i),
      line: text.slice(0, m.index).split('\n').length,
    });
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
