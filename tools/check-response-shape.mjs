#!/usr/bin/env node
/**
 * The fourth question: **would the answer be understood?**
 *
 * `check:routes` asks whether a request reaches a real endpoint at that verb. `check:wire-adoption`
 * asks whether its body would be understood. `check:port-adoption` asks whether anybody makes it at
 * all. All three can be green about a read that hands a screen nothing.
 *
 * That is not hypothetical. `listDocumentRequests` called `collection<DocumentRequest>` on a path
 * that **is** published, at a verb that **is** served, and the endpoint answers
 * `{ "requests": [...] }` — so `data` is an object, `collection<T>` returned a non-array, and the
 * screen would have shown an empty list on a record of what an applicant was told (`DL-151`).
 *
 * ## What this compares
 *
 * Each read in the adapters names an endpoint and picks a helper. Each published route answers with
 * an envelope, vendored in `response-envelopes.json` from the controller behind it. The helper and
 * the envelope have to agree:
 *
 * | console helper | needs `data` to be | server envelope |
 * | --- | --- | --- |
 * | `item` / `optionalItem` | an object | `item` |
 * | `page` | an array plus `meta.pagination` | `page` |
 * | `collection` | a bare array | **nothing produces this** |
 *
 * ## `collection` cannot be right anywhere
 *
 * There is no `ApiResponse::collection` in the backend. Every list is either a `page` — `data` is an
 * array *and* there is pagination meta — or an `item` whose object happens to contain an array.
 *
 * The two failures are different and the report keeps them apart, because their consequences are:
 *
 * - **`collection` where the server sends `item`** — `data` is an object, the helper hands back a
 *   non-array, and the screen shows nothing. Loud, once anybody looks.
 * - **`collection` where the server sends `page`** — `data` *is* an array, so rows appear and the
 *   screen looks right. It has silently read **the first 25 rows and presented them as the whole
 *   list**, because 25 is the default page size and nothing asked for more. This is the dangerous
 *   one: `DL-112`'s wrong answer delivered with confidence, on a queue where a caseworker counts
 *   what is outstanding.
 *
 * Exit 0 = no new mismatch, 1 = the baseline grew or ground was gained and not recorded.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = join(ROOT, 'src/app/data/http/contract');
const ADAPTERS = 'src/app/data/http/http-repositories.ts';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const vendored = JSON.parse(readFileSync(join(CONTRACT, 'response-envelopes.json'), 'utf8'));
const baseline = JSON.parse(readFileSync(join(CONTRACT, 'shape-mismatches.json'), 'utf8'));

const failures = [];

if (Object.keys(vendored.envelopes).length < 200) {
  failures.push('The vendored envelope snapshot looks truncated. Re-vendor rather than proceed.');
}

/* ── the endpoint table ───────────────────────────────────────────────────── */

const contract = read('src/app/data/http/api.contract.ts');
const table = /API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract);

if (table === null) {
  failures.push('API_ENDPOINTS could not be read, so nothing was compared.');
}

const lookup =
  table === null
    ? {}
    : Object.fromEntries(
        [...table[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(
          /(\w+):\s*'([^']+)'/g,
        )].map(([, name, path]) => [name, path]),
      );

/* ── the reads ────────────────────────────────────────────────────────────── */

/**
 * Which envelope each console helper requires.
 *
 * **A helper missing from this table is not checked** — it is skipped, and its reads disappear from
 * the comparison rather than counting as wrong. `everyPage` was added to the client and three reads
 * went quiet instead of green, which is the failure this whole file exists to catch, committed
 * while fixing it. The guard below is why that surfaced.
 */
const NEEDS = {
  item: 'item',
  optionalItem: 'item',
  page: 'page',
  /** Reads every page of a paginated route, so it needs the same envelope `page` does. */
  everyPage: 'page',
  collection: 'collection',
};

const adapters = read(ADAPTERS);
const reads = [];

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

  if (path !== null) {
    reads.push({
      needs,
      helper: match[1],
      path: path.replace(/\/$/, ''),
      line: adapters.slice(0, match.index).split('\n').length,
    });
  }
}

if (reads.length < 40) {
  failures.push(`Only ${reads.length} reads were extracted from the adapters. The parser is broken, not the code.`);
}

/*
 * Every read helper the client offers must appear in NEEDS.
 *
 * Otherwise adding one silently narrows what this check covers: the new reads are skipped, the
 * count of disagreements falls, and the ratchet reports progress for a surface it stopped watching.
 */
const client = read('src/app/data/http/api.client.ts');
const declared = [...client.matchAll(/^  (\w+)<T\w*>\(/gm)].map((match) => match[1]);
const READ_HELPERS = /^(item|optionalItem|page|everyPage|collection)$/;

for (const helper of declared) {
  if (READ_HELPERS.test(helper) && NEEDS[helper] === undefined) {
    failures.push(
      `ApiClient.${helper} is a read helper and is not in NEEDS, so its reads are skipped rather ` +
        `than checked. Add it, or this check quietly stops covering them.`,
    );
  }
}

/* ── compare ──────────────────────────────────────────────────────────────── */

const normalise = (path) => path.replace(/\{[^}]*\}/g, '{}');

const serverEnvelope = new Map();
for (const [route, envelope] of Object.entries(vendored.envelopes)) {
  const [verb, path] = route.split(' ');
  if (verb === 'GET') serverEnvelope.set(normalise(path), envelope);
}

const mismatches = [];
let agree = 0;
let unpublished = 0;

for (const entry of reads) {
  const server = serverEnvelope.get(normalise(entry.path));

  if (server === undefined || server === 'none' || server === 'unresolved') {
    unpublished++;
    continue;
  }

  if (server === entry.needs) {
    agree++;
    continue;
  }

  mismatches.push(`${entry.helper} ${entry.path} <- ${server}`);
}

const found = [...new Set(mismatches)].sort();

if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    join(CONTRACT, 'shape-mismatches.json'),
    `${JSON.stringify({ ...baseline, count: found.length, mismatches: found }, null, 2)}\n`,
  );
  console.log(`Baseline rewritten: ${found.length} reads that would misread the answer.`);
  process.exit(0);
}

const recorded = new Set(baseline.mismatches);
const added = found.filter((entry) => !recorded.has(entry));
const gone = [...recorded].filter((entry) => !found.includes(entry));

if (added.length > 0) {
  failures.push(
    `${added.length} read(s) would misread the answer:\n` +
      added.map((entry) => `      ${entry}`).join('\n'),
  );
}

if (gone.length > 0) {
  failures.push(
    `${gone.length} read(s) are fixed and still in the baseline. Shrink it:\n` +
      gone.map((entry) => `      ${entry}`).join('\n') +
      '\n      Run: node tools/check-response-shape.mjs --write-baseline',
  );
}

if (failures.length > 0) {
  console.error('\nResponse-shape check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

const silentlyTruncated = found.filter((entry) => entry.endsWith('<- page') && entry.startsWith('collection'));
const returnsNothing = found.filter((entry) => entry.endsWith('<- item') && entry.startsWith('collection'));

console.log(
  `Response-shape check passed (${agree}/${agree + found.length} reads agree with the envelope ` +
    `their route answers, ${vendored.commitShort}).`,
);
console.log(`\n  [31m${found.length} reads would misread the answer[0m:`);
console.log(
  `    ${silentlyTruncated.length} read a paginated route as a plain list — the first 25 rows, ` +
    `shown as the whole of it.`,
);
console.log(`    ${returnsNothing.length} read an object as an array — the screen shows nothing.`);
console.log(
  `    ${found.length - silentlyTruncated.length - returnsNothing.length} other.` +
    `\n  ${unpublished} read a route this snapshot does not cover.` +
    `\n  See docs/integration/release-engineering.md.\n`,
);
