#!/usr/bin/env node
/**
 * vendor:openapi — copy the Node API's published spec into this console, with its provenance.
 *
 * ## Why a copy, and why the record beside it
 *
 * Every contract check here (`check:routes`, `check:response-shape`, `check:contract-drift`,
 * `check:query-params`, `check:wire-adoption`, `check:consumer-contract`,
 * `check:permission-parity`) compares the console against **one** description of the API. If that
 * description were read live from a sibling checkout, a build would pass or fail depending on which
 * branch somebody happened to have checked out next door. So it is vendored: a byte-for-byte copy
 * of `openapi/openapi.json`, and `openapi.source.json` saying which repository, which commit and
 * which sha256 it is.
 *
 * A vendored artefact that cannot say where it came from is one nobody can tell is stale (the
 * reasoning that `types.ts` and `routes.published.json` carried before the Laravel API was retired,
 * `DL-164`). The spec is hand-maintained in the backend, and the backend's own
 * `tests/openapi-routes.test.ts` fails when a registered route is undocumented — which is what
 * makes it trustworthy as a route list rather than a description somebody hoped was complete.
 *
 * ## It refuses a dirty copy
 *
 * The commit recorded is the backend's `HEAD`. If the spec has uncommitted edits, the bytes copied
 * are not the bytes at that commit, and the record would be a lie nobody could detect. So an
 * uncommitted spec is refused rather than vendored.
 *
 * Usage: `npm run vendor:openapi [-- <path to taytay-backend>]`
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BACKEND = resolve(process.argv[2] ?? join(ROOT, '..', 'taytay-backend'));
const SPEC_IN_BACKEND = 'openapi/openapi.json';
const CONTRACT = join(ROOT, 'src', 'app', 'data', 'http', 'contract');

const git = (...args) => execFileSync('git', args, { cwd: BACKEND, encoding: 'utf8' }).trim();

const dirty = git('status', '--porcelain', '--', SPEC_IN_BACKEND);

if (dirty !== '') {
  console.error(
    `\n${SPEC_IN_BACKEND} has uncommitted changes in ${BACKEND}.\n` +
      '  The record would name a commit whose spec is not the one copied. Commit it there first.\n',
  );
  process.exit(1);
}

const commit = git('rev-parse', 'HEAD');
const remote = git('remote', 'get-url', 'origin');
const repository = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)?.[1] ?? remote;

const bytes = readFileSync(join(BACKEND, ...SPEC_IN_BACKEND.split('/')));
const spec = JSON.parse(bytes.toString('utf8'));

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
let operationCount = 0;
for (const operations of Object.values(spec.paths ?? {})) {
  for (const method of Object.keys(operations)) if (METHODS.has(method)) operationCount++;
}

if (operationCount === 0) {
  console.error('\nThe spec declares no operations. Refusing to vendor something every check would pass.\n');
  process.exit(1);
}

writeFileSync(join(CONTRACT, 'openapi.json'), bytes);

const source = {
  $comment:
    'Provenance for openapi.json. Written by tools/vendor-openapi.mjs — do not edit by hand. ' +
    'check:contract-drift recomputes the sha256 and the operation count on every build.',
  artefact: SPEC_IN_BACKEND,
  repository,
  commit,
  commitShort: commit.slice(0, 7),
  sha256: createHash('sha256').update(bytes).digest('hex'),
  operationCount,
  openapi: spec.openapi,
  vendoredOn: new Date().toISOString().slice(0, 10),
};

writeFileSync(join(CONTRACT, 'openapi.source.json'), `${JSON.stringify(source, null, 2)}\n`);

console.log(
  `Vendored ${SPEC_IN_BACKEND} from ${repository}@${source.commitShort}: ${operationCount} operations, sha256 ${source.sha256.slice(0, 12)}…`,
);
