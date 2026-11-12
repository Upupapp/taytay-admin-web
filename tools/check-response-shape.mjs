#!/usr/bin/env node
/**
 * The fourth question: **would the answer be understood?**
 *
 * `check:routes` asks whether a request reaches a real endpoint at that verb. `check:wire-adoption`
 * asks whether its body would be understood. `check:port-adoption` asks whether anybody makes it at
 * all. All three can be green about a read that hands a screen nothing.
 *
 * That is not hypothetical. `listDocumentRequests` once called `collection<DocumentRequest>` on a
 * path that was published, at a verb that was served, and the endpoint answered
 * `{ "requests": [...] }` — so `data` was an object and the screen would have shown an empty list
 * on a record of what an applicant was told (`DL-151`).
 *
 * ## What this compares
 *
 * Each read in the adapters names an endpoint and picks a helper. Each `GET` in the vendored spec
 * declares the envelope it answers with (`contract/openapi.json`, `DL-165`), and the two have to
 * agree:
 *
 * | console helper            | needs `data` to be                    | spec envelope  |
 * | ------------------------- | ------------------------------------- | -------------- |
 * | `item` / `optionalItem`   | an object                             | `item`         |
 * | `cursorPage` / `everyPage`| an array plus `meta.pagination`       | `cursor-page`  |
 * | `list`                    | an array, `meta: {}`                  | `list`         |
 * | `blob`                    | no envelope at all: bytes             | `binary`       |
 * | `postBlob`                | no envelope at all: bytes, at `POST`  | `binary`       |
 *
 * `binary` (`DL-167`) is a `200` whose every content type is a non-JSON media type with a
 * `format: binary` schema — `GET media/{id}/content` and nothing else today. It is matched both
 * ways: `blob` on a JSON route would hand a screen an envelope as if it were an image, and a JSON
 * helper on a binary route would try to read `data` off a JPEG.
 *
 * ## `list` is right on Node, exactly where the spec says so
 *
 * `DL-156` held that a bare-array helper could be right nowhere, because the Laravel API had no
 * `ApiResponse::collection` — every list was paginated or wrapped. That was a fact about Laravel.
 * The Node API answers several lists whole, with `meta: {}` (barangays, news categories, banners,
 * hotlines), and for those a bare-array helper is the only correct one. On a cursor-paged route it
 * is still the dangerous mistake: rows appear, the screen looks right, and it has read **the first
 * twenty and presented them as the whole list**.
 *
 * ## All hard
 *
 * Against Laravel this was a ratchet: twelve reads were known to misread their answer, carried in
 * `shape-mismatches.json`, and seven more read routes the snapshot did not cover. The adapters
 * behind all nineteen were replaced by ones that make no request, so the count reached zero by
 * removal and the baseline file is gone. A mismatch fails the build, and so does a read of a route
 * the spec does not document — a read nobody can check is not one this check may call agreed.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTTP = join(ROOT, 'src', 'app', 'data', 'http');
const ADAPTERS = 'src/app/data/http/http-repositories.ts';

const read = (...segments) => readFileSync(join(...segments), 'utf8');

const spec = JSON.parse(read(HTTP, 'contract', 'openapi.json'));
const provenance = JSON.parse(read(HTTP, 'contract', 'openapi.source.json'));

const failures = [];

/* ── the envelope each GET declares ──────────────────────────────────────── */

const resolve = (schema) => {
  const ref = schema?.$ref;
  if (typeof ref !== 'string') return schema;
  return resolve(ref.replace(/^#\//, '').split('/').reduce((node, key) => node?.[key], spec));
};

/** `item`, `list`, `cursor-page`, `binary`, or `undeclared` when the spec says nothing a helper can match. */
function envelopeOf(operation) {
  const content = operation?.responses?.['200']?.content ?? {};
  const mediaTypes = Object.keys(content);
  if (
    mediaTypes.length > 0 &&
    mediaTypes.every((type) => type !== 'application/json' && resolve(content[type]?.schema)?.format === 'binary')
  ) {
    return 'binary';
  }

  const schema = resolve(content['application/json']?.schema);
  const data = resolve(schema?.properties?.data);
  const meta = resolve(schema?.properties?.meta);

  if (data === undefined) return 'undeclared';

  // An `allOf` whose every part is an object is an object (`DL-214`: an import, a sector
  // application's detail): one record extending another, not a list in disguise.
  if (Array.isArray(data.allOf)) {
    const parts = data.allOf.map(resolve);
    const objectLike = (part) =>
      part !== undefined && ([part.type].flat().includes('object') || part.properties !== undefined);
    return parts.length > 0 && parts.every(objectLike) ? 'item' : 'undeclared';
  }

  const types = [data.type].flat();
  if (types.includes('array')) return meta?.properties?.pagination !== undefined ? 'cursor-page' : 'list';
  if (types.includes('object') || data.properties !== undefined) return 'item';
  return 'undeclared';
}

const normalise = (path) => path.replace(/\{[^}]*\}/g, '{}');

/*
 * Keyed by verb as well as path. Every read helper is a `GET` except `postBlob` (`DL-178`), which
 * exchanges a single-use grant for a document's bytes: a `POST`, because it uses the grant up, and
 * whose answer is held to the `POST` operation's envelope exactly as a `GET`'s is.
 */
const serverEnvelope = new Map();
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const verb of ['get', 'post']) {
    if (item[verb] !== undefined) {
      serverEnvelope.set(`${verb} ${normalise(path.replace(/^\/api\/v1\//, ''))}`, envelopeOf(item[verb]));
    }
  }
}

if (serverEnvelope.size === 0) {
  failures.push('No GET operation was read from the vendored spec, so nothing was compared.');
}

/* ── the endpoint table ──────────────────────────────────────────────────── */

const contract = read(HTTP, 'api.contract.ts');
const table = /API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract);

if (table === null) {
  failures.push('API_ENDPOINTS could not be read, so nothing was compared.');
}

const lookup =
  table === null
    ? {}
    : Object.fromEntries(
        [
          ...table[1]
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\n]*/g, '')
            .matchAll(/(\w+):\s*'([^']+)'/g),
        ].map(([, name, path]) => [name, path]),
      );

/* ── the reads ───────────────────────────────────────────────────────────── */

/**
 * Which envelope each console helper requires.
 *
 * **A helper missing from this table would not be checked**, which is why the client's surface is
 * asserted against it below: `everyPage` was once added to the client, three reads went quiet
 * instead of green, and that was the failure this file exists to catch, committed while fixing it.
 */
const NEEDS = {
  item: 'item',
  optionalItem: 'item',
  cursorPage: 'cursor-page',
  /** Follows `next_cursor`, so it needs the same envelope `cursorPage` does. */
  everyPage: 'cursor-page',
  /** One page plus the figures its route answers beside the pagination (`DL-212`). */
  cursorPageWithMeta: 'cursor-page',
  list: 'list',
  /** Bytes, not an envelope: only a route whose every answer is a binary media type. */
  blob: 'binary',
  /** Bytes for a grant, at `POST` (`DL-178`): judged against that operation's answer. */
  postBlob: 'binary',
};

/** The verb a read helper is judged at; anything not named here is a `GET`. */
const VERB_OF = { postBlob: 'post' };

const WRITES = new Set(['post', 'patch', 'put', 'postForm', 'patchForm', 'delete']);

const client = read(HTTP, 'api.client.ts');
for (const [, helper] of client.matchAll(/^  ([a-zA-Z]\w*)\s*[<(]/gm)) {
  if (NEEDS[helper] === undefined && !WRITES.has(helper)) {
    failures.push(
      `ApiClient.${helper} is neither a known read helper nor a write. Add it to NEEDS, or its reads ` +
        `are skipped rather than checked.`,
    );
  }
}

const adapters = read(ROOT, ADAPTERS);
const reads = [];
let unresolved = 0;

const start = /this\s*\.\s*api\s*\.\s*(\w+)\s*[<(]/g;
let match;

while ((match = start.exec(adapters)) !== null) {
  const needs = NEEDS[match[1]];
  if (needs === undefined) continue;

  let i = match.index + match[0].length - 1;

  if (adapters[i] === '<') {
    let angle = 1;
    i++;
    while (i < adapters.length && angle > 0) {
      if (adapters[i] === '<') angle++;
      else if (adapters[i] === '>') angle--;
      i++;
    }
    while (i < adapters.length && adapters[i] !== '(') i++;
  }

  const open = i;
  let depth = 0;
  for (; i < adapters.length; i++) {
    if (adapters[i] === '(') depth++;
    else if (adapters[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }

  const first = adapters
    .slice(open + 1, i)
    .split(/,(?![^{[(]*[}\])])/)[0]
    .trim();

  const templated = /^`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`$/.exec(first);
  const bare = /^API_ENDPOINTS\.(\w+)$/.exec(first);

  let path = null;
  if (templated !== null && lookup[templated[1]] !== undefined) {
    path = lookup[templated[1]] + templated[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
  } else if (bare !== null && lookup[bare[1]] !== undefined) {
    path = lookup[bare[1]];
  }

  if (path === null) {
    unresolved++;
    continue;
  }

  reads.push({
    needs,
    verb: VERB_OF[match[1]] ?? 'get',
    helper: match[1],
    path: path.replace(/\/$/, ''),
    line: adapters.slice(0, match.index).split('\n').length,
  });
}

/*
 * Relative, not a magic floor: every read call site in the adapters must have been extracted. A
 * parser that silently drops calls reports agreement about reads it never saw.
 */
const readSites = [...adapters.matchAll(/this\s*\.\s*api\s*\.\s*(\w+)/g)].filter(
  ([, helper]) => NEEDS[helper] !== undefined,
).length;

if (reads.length + unresolved !== readSites || unresolved > 0) {
  failures.push(
    `${readSites} read call sites in ${ADAPTERS}, ${reads.length} resolved to a path. Build every read ` +
      `from API_ENDPOINTS, or this check cannot say what it answers with.`,
  );
}

/* ── compare ─────────────────────────────────────────────────────────────── */

let agree = 0;

for (const entry of reads) {
  const server = serverEnvelope.get(`${entry.verb} ${normalise(entry.path)}`);

  if (server === undefined || server === 'undeclared') {
    failures.push(
      `${ADAPTERS}:${entry.line} reads ${entry.verb.toUpperCase()} ${entry.path} with ${entry.helper}, and the spec declares no ` +
        `envelope for it. A read nobody can check is not one this check may call agreed.`,
    );
    continue;
  }

  if (server !== entry.needs) {
    const consequence =
      entry.needs === 'list' && server === 'cursor-page'
        ? 'It reads the first page and presents it as the whole list.'
        : entry.needs === 'list' && server === 'item'
          ? 'data is an object, so the screen shows nothing.'
          : `${entry.helper} needs ${entry.needs} and the route answers ${server}.`;

    failures.push(`${ADAPTERS}:${entry.line} ${entry.helper} ${entry.verb.toUpperCase()} ${entry.path} <- ${server}. ${consequence}`);
    continue;
  }

  agree++;
}

if (failures.length > 0) {
  console.error('\nResponse-shape check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `Response-shape check passed (${agree}/${reads.length} reads agree with the envelope their route ` +
    `declares, ${provenance.repository}@${provenance.commitShort}).`,
);
