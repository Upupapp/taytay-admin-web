#!/usr/bin/env node
/**
 * check:contract-drift — the vendored API contract must be honest about itself.
 *
 * The console vendors the Node API's published spec, `contract/openapi.json`, with its provenance in
 * `contract/openapi.source.json` (`tools/vendor-openapi.mjs`, `DL-165`). Every other contract check
 * reads it, so a copy that is not what it says it is would make all of them confidently wrong at
 * once. This check makes that loud.
 *
 * Four things it verifies, and one it deliberately cannot:
 *
 *   1. The vendored file matches the `sha256` and the operation count recorded beside it — so
 *      nobody edits a vendored artefact by hand to make a build pass.
 *   2. The `ApiErrorCode` union in `api.contract.ts` names exactly the codes the spec's
 *      `ErrorEnvelope` publishes. The Laravel API published a TypeScript file this console
 *      imported; the Node API publishes only JSON, so the union is restated — and is safe to
 *      restate only because it is compared here on every build.
 *   3. The runtime `API_ERROR_CODES` list matches the same set. The union vanishes at build time and
 *      the list is what `isApiErrorCode` actually checks, so three descriptions exist and none may
 *      drift.
 *   4. Nothing outside the transport seam imports the vendored contract; it is wire vocabulary, not
 *      domain vocabulary.
 *
 * What it cannot check from here is whether the backend has moved on since `commit` was recorded.
 * That is the backend's half: `tests/openapi-routes.test.ts` there fails when a route is
 * registered without being documented, so a new route becomes a line in the spec's diff — and
 * re-vendoring brings it here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Paths are compared against '/'-separated literals; on Windows `relative` answers with '\',
// and a comparison that can never match fails on correct code or skips the file it guards.
const posix = (path) => path.split(sep).join('/');

const CONTRACT_DIR = join(ROOT, 'src', 'app', 'data', 'http', 'contract');

const failures = [];
const fail = (message) => failures.push(message);

// ── 1. the vendored file is what its provenance says it is ───────────────────
const source = JSON.parse(readFileSync(join(CONTRACT_DIR, 'openapi.source.json'), 'utf8'));
const raw = readFileSync(join(CONTRACT_DIR, 'openapi.json'));
const actual = createHash('sha256').update(raw).digest('hex');

if (actual !== source.sha256) {
  fail(
    `src/app/data/http/contract/openapi.json does not match the sha256 in openapi.source.json.\n` +
      `    recorded ${source.sha256}\n` +
      `    actual   ${actual}\n\n` +
      `    Either the file was edited by hand — it is vendored, so do not — or it was re-copied\n` +
      `    without updating the record. Run: npm run vendor:openapi`,
  );
}

for (const required of ['repository', 'commit', 'sha256', 'operationCount', 'vendoredOn']) {
  if (source[required] === undefined || source[required] === '') {
    fail(`openapi.source.json is missing "${required}". A vendored artefact with no provenance cannot be checked against anything.`);
  }
}

if (source.commit && !/^[0-9a-f]{40}$/.test(source.commit)) {
  fail(`openapi.source.json records commit "${source.commit}", which is not a full SHA. A short SHA is ambiguous across repositories.`);
}

const spec = JSON.parse(raw.toString('utf8'));
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
let operations = 0;
for (const path of Object.values(spec.paths ?? {})) {
  for (const method of Object.keys(path)) if (METHODS.has(method)) operations++;
}

/*
 * Relative rather than a magic floor. A spec that lost half its operations would still clear any
 * number somebody guessed once; it cannot also match the count recorded when it was vendored.
 */
if (operations === 0 || operations !== source.operationCount) {
  fail(
    `openapi.json declares ${operations} operations and openapi.source.json records ${source.operationCount}.\n` +
      `    Every route check reads this file, and one that reads a truncated spec reports a guarantee\n` +
      `    nobody has. Re-vendor rather than proceed.`,
  );
}

// ── 2 & 3. one error vocabulary, three descriptions of it ────────────────────
const published = spec.components?.schemas?.ErrorEnvelope?.properties?.error?.properties?.code?.enum;
const specCodes = Array.isArray(published) ? [...published].sort() : [];

const contract = readFileSync(join(ROOT, 'src', 'app', 'data', 'http', 'api.contract.ts'), 'utf8');

const unionBlock = /export type ApiErrorCode =([\s\S]*?);/.exec(contract)?.[1] ?? '';
const unionCodes = [...unionBlock.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]).sort();

const listBlock = /const API_ERROR_CODES: readonly string\[\] = \[([\s\S]*?)\];/.exec(contract)?.[1] ?? '';
const listCodes = [...listBlock.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]).sort();

if (specCodes.length === 0) {
  fail('could not read ErrorEnvelope.error.code.enum out of the vendored spec, so nothing was compared.');
}

for (const [name, codes] of [['ApiErrorCode', unionCodes], ['API_ERROR_CODES', listCodes]]) {
  if (codes.length === 0) {
    fail(`could not read ${name} out of api.contract.ts, so nothing was compared.`);
    continue;
  }

  const missing = specCodes.filter((c) => !codes.includes(c));
  const extra = codes.filter((c) => !specCodes.includes(c));

  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${name} has drifted from the codes the vendored spec publishes.\n` +
        (missing.length ? `    the API emits, and ${name} does not name: ${missing.join(', ')}\n` : '') +
        (extra.length ? `    ${name} names, and the API never sends: ${extra.join(', ')}\n` : '') +
        `\n    A code the API sends and the console does not recognise is treated as unknown; a code\n` +
        `    the console expects and the API never sends is a branch nothing can reach.`,
    );
  }
}

// ── 4. wire vocabulary stays behind the transport seam ───────────────────────
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
  const path = posix(relative(ROOT, file));
  if (SEAM.some((dir) => path.startsWith(dir))) continue;

  if (/from\s+['"][^'"]*data\/http\/contract\//.test(readFileSync(file, 'utf8'))) {
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
  `Vendored contract check passed (${source.repository} @ ${source.commitShort}, ${operations} operations, ${specCodes.length} error codes).`,
);
