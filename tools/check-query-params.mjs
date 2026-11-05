/**
 * check:query-params — a query key the API never reads is a filter that does nothing.
 *
 * ## The finding (L-24)
 *
 * The console used to copy every filter key into the query string **verbatim**, so `?barangayId=3`
 * arrived where the server read `barangay_id`, the `where` clause was skipped, and the endpoint
 * answered **200 with the unfiltered list** under a heading that said it was narrowed. It is not an
 * authorisation bypass — the server scopes before it filters — but it is a filter that fails open
 * and fails silently, and the single-word keys that do work make a broken filter panel look like a
 * working one.
 *
 * ## The measure changed with the API, and got stronger (`DL-165`)
 *
 * Against Laravel this compared **shape**: a key passed if the wire could carry it as written,
 * because the console had no route table to ask whether the endpoint read it at all. Its own
 * docblock said a green run did not mean the filters worked. It counted 53 keys, nearly all in the
 * domain's `…Filter` interfaces, which reached the wire only through adapters that no longer exist.
 *
 * The Node API's spec declares every query parameter of every operation, and its query schemas
 * are not strict: an unknown key is not refused, it is dropped. So this now asks the question the
 * old docblock said it could not — **existence** — and it is a hard rule:
 *
 *   1. Every key a read sends is declared as a query parameter of that operation. That includes
 *      `limit` and `cursor`, which `toQueryParams` adds to every cursor read.
 *   2. Every filter argument is an object literal, so its keys can be read here. A variable — a
 *      domain filter passed whole — is exactly how `barangayId` reached the wire unconverted, and a
 *      check that cannot see the keys cannot vouch for them.
 *   3. Every key is wire-shaped (`snake_case` or one lowercase word).
 *
 * The domain-interface scan is retired with the adapters that gave it meaning: no domain filter
 * reaches the wire, and rule 2 refuses one that would. A new measure, so a new first value: 0.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HTTP = join(ROOT, 'src', 'app', 'data', 'http');
const ADAPTERS = 'src/app/data/http/http-repositories.ts';

const wireShaped = (key) => /^[a-z][a-z0-9_]*$/.test(key);

/*
 * ── Which ApiClient helpers this check inspects, and why the list is asserted ─────────
 *
 * `everyPage` was once added to ApiClient and this tool did not know the name, so it SKIPPED those
 * calls rather than checking them (DL-162). *"A check that enumerates the names of things it
 * inspects has a hole shaped like the next name."* So the sets below are asserted against
 * ApiClient's actual public surface, and anything it grows that is in neither set fails this check.
 *
 * For each read helper: which argument carries query keys, and whether the transport adds the
 * cursor keys itself.
 */
const READ_HELPERS = {
  cursorPage: { filterAt: 2, cursorKeys: true },
  everyPage: { filterAt: 1, cursorKeys: true },
  list: { filterAt: 1, cursorKeys: false },
  item: { filterAt: 1, cursorKeys: false },
  optionalItem: { filterAt: null, cursorKeys: false },
  /* Takes a path and nothing else: an image is addressed, never filtered (`DL-167`). */
  blob: { filterAt: null, cursorKeys: false },
};

/* Writes. Excluded because their arguments are a BODY, which `check:wire-adoption` owns. */
const WRITE_HELPERS = new Set(['post', 'patch', 'postForm', 'patchForm', 'delete']);

{
  const client = readFileSync(join(HTTP, 'api.client.ts'), 'utf8');
  const declared = new Set(
    [...client.matchAll(/\n  ([a-zA-Z]\w*)\s*[<(]/g)]
      .map((m) => m[1])
      .filter((n) => !['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return'].includes(n)),
  );
  const known = [...Object.keys(READ_HELPERS), ...WRITE_HELPERS];
  const unclassified = [...declared].filter((n) => !known.includes(n));
  const vanished = known.filter((n) => !declared.has(n));

  if (unclassified.length > 0 || vanished.length > 0) {
    console.error(
      `\nQuery parameter check cannot run: its view of ApiClient is out of date.\n\n` +
        (unclassified.length
          ? `  ApiClient declares method(s) this check has never heard of: ${unclassified.join(', ')}\n` +
            `  A name this tool does not know is a name it SKIPS. Classify each above.\n\n`
          : '') +
        (vanished.length
          ? `  These are classified here but no longer exist on ApiClient: ${vanished.join(', ')}\n\n`
          : ''),
    );
    process.exit(1);
  }
}

const spec = JSON.parse(readFileSync(join(HTTP, 'contract', 'openapi.json'), 'utf8'));
const contract = readFileSync(join(HTTP, 'api.contract.ts'), 'utf8');

const resolve = (node) => {
  const ref = node?.$ref;
  if (typeof ref !== 'string') return node;
  return resolve(ref.replace(/^#\//, '').split('/').reduce((n, key) => n?.[key], spec));
};

const normalise = (path) => path.replace(/\{[^}]+\}/g, '{}');

/** `GET path` → the query parameter names it declares, path-level ones included. */
const declaredQuery = new Map();
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  if (item.get === undefined) continue;
  const names = [...(item.parameters ?? []), ...(item.get.parameters ?? [])]
    .map(resolve)
    .filter((parameter) => parameter?.in === 'query')
    .map((parameter) => parameter.name);
  declaredQuery.set(normalise(path.replace(/^\/api\/v1\//, '')), new Set(names));
}

const table = /export const API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract)?.[1] ?? '';
const lookup = Object.fromEntries(
  [...table.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(/(\w+):\s*'([^']+)'/g)].map(
    ([, name, path]) => [name, path],
  ),
);

/*
 * The call's OWN parentheses, counted — not everything up to the next `);`. An earlier bound
 * swallowed whole pipelines and put a key from a mapped result on the list (DL-145).
 */
function callArguments(text) {
  const out = [];
  const start = new RegExp(String.raw`this\s*\.\s*api\s*\.\s*(${Object.keys(READ_HELPERS).join('|')})\s*[<(]`, 'g');
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

    const open = i;
    let depth = 0;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    out.push({ helper: m[1], args: topLevelArgs(text.slice(open + 1, i)), index: m.index });
  }

  return out;
}

function topLevelArgs(args) {
  const parts = [];
  let depth = 0;
  let tick = false;
  let current = '';
  for (const ch of args) {
    if (ch === '`') tick = !tick;
    if (!tick) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

function pathOf(argument) {
  const template = /^`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`$/.exec(argument);
  const bare = /^API_ENDPOINTS\.(\w+)$/.exec(argument);
  if (template !== null && lookup[template[1]] !== undefined) {
    return lookup[template[1]] + template[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
  }
  return bare !== null ? (lookup[bare[1]] ?? null) : null;
}

const adapters = readFileSync(join(ROOT, ADAPTERS), 'utf8');
const calls = callArguments(adapters);
const offenders = [];

/* Every read call site walked, relative to a raw count rather than a guessed floor. */
const rawReads = [...adapters.matchAll(/this\s*\.\s*api\s*\.\s*(\w+)/g)].filter(([, h]) => h in READ_HELPERS).length;

if (calls.length !== rawReads) {
  offenders.push(`${rawReads} read call sites and ${calls.length} walked — the parser is broken, not the code`);
}

for (const call of calls) {
  const line = adapters.slice(0, call.index).split('\n').length;
  const where = `${ADAPTERS}:${line}`;
  const path = pathOf(call.args[0] ?? '');
  const declared = path === null ? undefined : declaredQuery.get(normalise(path.replace(/\/$/, '')));

  if (declared === undefined) {
    offenders.push(`${where}: GET ${call.args[0]} is no GET in the vendored spec, so its query cannot be checked`);
    continue;
  }

  const { filterAt, cursorKeys } = READ_HELPERS[call.helper];
  const sent = cursorKeys ? ['limit', 'cursor'] : [];
  const filter = filterAt === null ? undefined : call.args[filterAt];

  if (filter !== undefined) {
    if (!filter.startsWith('{')) {
      offenders.push(`${where}: passes ${filter} as its query, whose keys this check cannot read`);
      continue;
    }
    sent.push(...[...filter.matchAll(/(?:^|[{,]\s*)([A-Za-z_]\w*)\s*(?::|,|\})/g)].map((k) => k[1]));
  }

  for (const key of new Set(sent)) {
    if (!wireShaped(key)) offenders.push(`${where}: '${key}' is not wire-shaped`);
    else if (!declared.has(key)) offenders.push(`${where}: GET ${path} does not declare '${key}'`);
  }
}

if (offenders.length > 0) {
  console.error(
    `\nQuery parameter check failed: ${offenders.length} problem(s).\n\n` +
      offenders.map((o) => `    ${o}`).join('\n') +
      `\n\n  The API drops a query key it does not declare. The request is not refused — it answers\n` +
      `  200 with the UNFILTERED list, under a heading that says it was narrowed.\n`,
  );
  process.exit(1);
}

console.log(`Query parameters check passed (${calls.length} reads, every key declared by its operation).`);
