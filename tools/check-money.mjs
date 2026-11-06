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
 *    because that API honoured an `Idempotency-Key`. The Node API refused that header at CORS
 *    (`DL-165`), so while it held no payouts the release port stayed unserved. Since phase 4
 *    (`DL-180`) it honours `idempotency_key` **in the body** — the CORS policy is not widened — and
 *    the rule is restored in that form: every money write in `HttpReleaseRepository` takes
 *    `intent: WriteIntent` and hands it to the `toWire…` mapper that writes its body, every one of
 *    those mappers writes `idempotency_key: intent.key`, and no adapter mints an intent of its own.
 *    The port still demands an intent on every money write, so the screens hold one across retries.
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
const MONEY_WRITES = ['createBatch', 'prepare', 'markReleased', 'acknowledge', 'deferRelease', 'changeStatus'];

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

// The transport half. Unserved sends nothing, so it needs no key; served, every money write carries
// the intent's key in its body, and nothing but the screen mints one.
const providers = readFileSync(join(ROOT, 'src/app/data/data-access.providers.ts'), 'utf8');
const releaseBinding = /provide:\s*RELEASE_REPOSITORY,\s*useClass:\s*(\w+)/.exec(providers)?.[1];

if (releaseBinding === undefined) {
  failures.push('could not find the RELEASE_REPOSITORY binding in data-access.providers.ts.');
} else if (releaseBinding === 'HttpReleaseRepository') {
  const http = readFileSync(join(ROOT, 'src/app/data/http/http-repositories.ts'), 'utf8');
  const classStart = http.indexOf('export class HttpReleaseRepository');
  const adapter = classStart === -1 ? '' : http.slice(classStart, http.indexOf('\n}\n', classStart));

  if (adapter === '') {
    failures.push('could not find HttpReleaseRepository — this check no longer knows what it is checking.');
  }
  if (/new\s+WriteIntent\s*\(/.test(http)) {
    failures.push(
      'The http adapters mint a WriteIntent. A key made in the adapter is a new key on every retry,\n' +
        '    and a new key is a new intent: the API would accept it and pay again.',
    );
  }

  for (const method of MONEY_WRITES) {
    const match = new RegExp(String.raw`\n  ${method}\(([\s\S]*?)\): Observable<[^>]+> \{([\s\S]*?)\n  \}`).exec(adapter);
    if (match === null) {
      failures.push(`HttpReleaseRepository.${method} is missing or no longer reads as a method.`);
      continue;
    }
    const [, signature = '', body = ''] = match;
    if (!/\bintent\s*:\s*WriteIntent\b/.test(signature)) {
      failures.push(
        `HttpReleaseRepository.${method} does not take the intent. An implementation may declare fewer\n` +
          `    parameters than its port, and drop the key on the floor with a green build.`,
      );
    }
    if (!/toWire\w+\([^;]*\bintent\s*\)/.test(body)) {
      failures.push(
        `HttpReleaseRepository.${method} does not hand its intent to the mapper that writes its body.\n` +
          `    The money write would reach the API with no key, and a retry would pay twice.`,
      );
    }
  }

  const mapper = readFileSync(join(ROOT, 'src/app/data/http/mappers/release.mapper.ts'), 'utf8');
  const writers = [...mapper.matchAll(/export function (toWire\w+)\(([\s\S]*?)\n\}/g)];
  if (writers.length < MONEY_WRITES.length) {
    failures.push(`release.mapper.ts writes ${writers.length} bodies for ${MONEY_WRITES.length} money writes.`);
  }
  for (const [, name, body = ''] of writers) {
    if (!/\bidempotency_key:\s*intent\.key\b/.test(body)) {
      failures.push(`${name} writes a money body without idempotency_key: intent.key.`);
    }
  }
} else if (releaseBinding !== 'UnservedReleaseRepository') {
  failures.push(
    `RELEASE_REPOSITORY is bound to ${releaseBinding}, which this check does not know. A money write\n` +
      `    sent by an adapter nobody has held to the key rule has no replay protection (DL-180).`,
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
  `Money check passed (${MONEY_WRITES.length} writes demand a held intent; served over HTTP, each carries its key in the body).`,
);
