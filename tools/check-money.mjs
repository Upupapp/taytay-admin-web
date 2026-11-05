#!/usr/bin/env node
/**
 * check:money — every money write carries the intent it was given.
 *
 * ## The hole the compiler leaves open
 *
 * `ReleaseRepository` requires a `WriteIntent` on all five money writes, and TypeScript enforces
 * that **callers** pass one. It does not enforce that the implementation uses it: an
 * implementation may declare fewer parameters than the interface it satisfies, so
 *
 *     markReleased(id, ref, remarks): Observable<Release> {
 *       return this.api.post(path, body);      // compiles, sends no header
 *     }
 *
 * type-checks cleanly, drops the key on the floor, and produces a green build with an API that
 * now refuses the request. That is a whole class of defect the compiler is structurally unable to
 * see, which is exactly the kind a check should hold.
 *
 * ## The two rules
 *
 * 1. **No money write reaches the network without replay protection.** Against the Laravel API this
 *    read "every money write in the HTTP adapter takes `intent: WriteIntent` and passes it on",
 *    because that API honoured an `Idempotency-Key`. The Node API that replaced it implements no
 *    such key, and its CORS policy refuses the header outright (`DL-165`). There is nothing for an
 *    adapter to pass an intent *to*, so the only state in which no family can be paid twice by a
 *    retry is the one where no money write is served over HTTP at all: the release port is bound to
 *    its unserved adapter, and the port itself still demands an intent on all five writes, so the
 *    screens keep holding one for whichever server takes these writes next.
 * 2. No screen mints a `new WriteIntent()` inline inside a repository call. The key must be held
 *    across retries, and one minted at the call site is a new key on every press — which is a new
 *    intent, which an idempotent API will happily accept and pay again.
 *
 * Rule 2 is the one worth the file. It fails silently, only under a retry, and only with money.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The money writes. Each must be replayable, so each takes an intent. */
const MONEY_WRITES = ['createBatch', 'markReleased', 'acknowledge', 'deferRelease', 'changeStatus'];

const failures = [];

// ── 1. no money write reaches the network without replay protection ─────────
//
// The port half: every money write still demands an intent, so the screens keep holding one.
const ports = readFileSync(join(ROOT, 'src/app/domain/ports/repositories.ts'), 'utf8');
const releasePortStart = ports.indexOf('export interface ReleaseRepository {');
const releasePort = releasePortStart === -1 ? '' : ports.slice(releasePortStart, ports.indexOf('\n}', releasePortStart));

if (releasePort === '') {
  failures.push('could not find the ReleaseRepository port — this check no longer knows what it is checking.');
}

for (const method of MONEY_WRITES) {
  const signature = new RegExp(String.raw`\n  ${method}\(([\s\S]*?)\):`).exec(releasePort)?.[1];

  if (signature === undefined) {
    failures.push(`ReleaseRepository.${method} is missing. Money writes cannot quietly disappear.`);
    continue;
  }

  if (!/\bintent\s*:\s*WriteIntent\b/.test(signature)) {
    failures.push(
      `ReleaseRepository.${method} no longer demands a WriteIntent. A screen that is not made to hold\n` +
        `    one across retries will mint a new key per press the day an API honours the key.`,
    );
  }
}

// The transport half: with no idempotency on the API, the release port must not be served at all.
const providers = readFileSync(join(ROOT, 'src/app/data/data-access.providers.ts'), 'utf8');
const releaseBinding = /provide:\s*RELEASE_REPOSITORY,\s*useClass:\s*(\w+)/.exec(providers)?.[1];

if (releaseBinding === undefined) {
  failures.push('could not find the RELEASE_REPOSITORY binding in data-access.providers.ts.');
} else if (releaseBinding !== 'UnservedReleaseRepository') {
  failures.push(
    `RELEASE_REPOSITORY is bound to ${releaseBinding} in the http configuration.\n` +
      `    The API implements no Idempotency-Key and its CORS policy refuses the header, so a money\n` +
      `    write sent over HTTP has no replay protection: a retry after a dropped answer pays the same\n` +
      `    family twice. Serve releases only once the API honours the key and allows it across\n` +
      `    origins, and restore the rule that every money write forwards its intent (DL-165).`,
  );
}

// ── 2. no screen mints an intent inside the call it is protecting ────────────
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}


for (const file of walk(join(ROOT, 'src/app/features'))) {
  const source = readFileSync(file, 'utf8');

  for (const method of MONEY_WRITES) {
    // `repository.markReleased(…, new WriteIntent())` — a fresh key on every press.
    const inline = new RegExp(`\\.${method}\\(([^;]*?)new WriteIntent\\(`, 's');

    if (inline.test(source)) {
      failures.push(
        `${file.slice(ROOT.length)} mints a WriteIntent inside the ${method} call.\n` +
          `    A key created at the call site is a new key on every press, and a new key is a new\n` +
          `    intent — so a retry after a failure pays a second time instead of replaying the first\n` +
          `    answer. Hold the intent outside the call and clear it only on success.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\nMoney check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Money check passed (${MONEY_WRITES.length} writes demand a held intent; none is served over HTTP without replay protection).`,
);
