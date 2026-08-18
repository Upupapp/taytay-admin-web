#!/usr/bin/env node
/**
 * check:contract-drift — the vendored API contract must be honest about itself.
 *
 * TAB 06 vendors `docs/api/types.ts` from the backend so that a change to the
 * API's vocabulary becomes a **TypeScript error here** rather than a runtime
 * surprise. That only works while the copy and its recorded provenance agree.
 *
 * A stale vendored contract is worse than none, for the same reason a stale
 * `openapi.json` was: it is confidently wrong, and a developer builds against
 * it. So this check makes staleness loud.
 *
 * Three things it verifies, and one it deliberately cannot:
 *
 *   1. The vendored file matches the `sha256` recorded beside it — so nobody
 *      edits a generated artefact by hand to make a build pass.
 *   2. The runtime `API_ERROR_CODES` list matches the vendored union exactly —
 *      the union vanishes at build time and the list is what `isApiErrorCode`
 *      actually checks, so two descriptions exist and must not drift.
 *   3. Nothing outside the transport seam imports the vendored contract; it is
 *      wire vocabulary, not domain vocabulary.
 *
 * What it cannot check from here is whether the backend has moved on since
 * `commit` was recorded — this repository has no copy of the backend. That is
 * the backend CI job's half of TAB 06: it replays recorded consumer
 * expectations against the real router and fails when a response stops
 * satisfying one.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTRACT_DIR = join(ROOT, 'src/app/data/http/contract');

const failures = [];
const fail = (message) => failures.push(message);

// ── 1. the vendored file is what its provenance says it is ───────────────────
const source = JSON.parse(readFileSync(join(CONTRACT_DIR, 'source.json'), 'utf8'));
const vendored = readFileSync(join(CONTRACT_DIR, 'types.ts'), 'utf8');
const actual = createHash('sha256').update(vendored).digest('hex');

if (actual !== source.sha256) {
  fail(
    `src/app/data/http/contract/types.ts does not match the sha256 in source.json.\n` +
      `    recorded ${source.sha256}\n` +
      `    actual   ${actual}\n\n` +
      `    Either the file was edited by hand — it is generated, so do not — or it was re-vendored\n` +
      `    without updating source.json. Re-copy it from taytay-backend and record the new commit.`,
  );
}

for (const required of ['commit', 'sha256', 'repository', 'vendoredOn']) {
  if (!source[required]) {
    fail(`source.json is missing "${required}". A vendored artefact with no provenance cannot be checked against anything.`);
  }
}

if (source.commit && !/^[0-9a-f]{40}$/.test(source.commit)) {
  fail(`source.json records commit "${source.commit}", which is not a full SHA. A short SHA is ambiguous across repositories.`);
}

// ── 2. the runtime list matches the compile-time union ───────────────────────
//
// `isApiErrorCode` checks an array, because a TypeScript union does not exist at
// run time. Two descriptions of one vocabulary is exactly the shape of divergence
// this integration keeps finding, so the pair is checked rather than trusted.
const contract = readFileSync(join(ROOT, 'src/app/data/http/api.contract.ts'), 'utf8');

const unionBlock = /export type ApiErrorCode =([\s\S]*?);/.exec(vendored)?.[1] ?? '';
const unionCodes = [...unionBlock.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();

const listBlock = /const API_ERROR_CODES: readonly string\[\] = \[([\s\S]*?)\];/.exec(contract)?.[1] ?? '';
const listCodes = [...listBlock.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();

if (unionCodes.length === 0) {
  fail('could not read the ApiErrorCode union out of the vendored contract.');
} else if (JSON.stringify(unionCodes) !== JSON.stringify(listCodes)) {
  const missing = unionCodes.filter((c) => !listCodes.includes(c));
  const extra = listCodes.filter((c) => !unionCodes.includes(c));

  fail(
    `API_ERROR_CODES has drifted from the vendored ApiErrorCode union.\n` +
      (missing.length ? `    the API emits, and isApiErrorCode would reject: ${missing.join(', ')}\n` : '') +
      (extra.length ? `    isApiErrorCode accepts, and the API never sends: ${extra.join(', ')}\n` : '') +
      `\n    The union is compile-time only; the list is what actually runs. They describe one\n` +
      `    vocabulary and must not disagree — a code in the union but not the list means the\n` +
      `    console silently treats a real error as unrecognised.`,
  );
}

// ── 3. wire vocabulary stays behind the transport seam ───────────────────────
const SEAM = ['src/app/data/http/', 'src/app/core/http/'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

for (const file of walk(join(ROOT, 'src'))) {
  const path = relative(ROOT, file);
  if (SEAM.some((dir) => path.startsWith(dir))) continue;

  if (/from ['"].*data\/http\/contract\/types['"]/.test(readFileSync(file, 'utf8'))) {
    fail(
      `${path} imports the vendored API contract. It is wire vocabulary, not domain vocabulary —\n` +
        `    adapters map it into the domain, and everything else works in the domain's terms.`,
    );
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nVendored contract check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Vendored contract check passed (${source.repository} @ ${source.commitShort}, ${unionCodes.length} error codes).`,
);
