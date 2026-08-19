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
 * 1. Every money write in the HTTP adapter takes `intent: WriteIntent` **and passes it on**.
 * 2. No screen mints a `new WriteIntent()` inline inside a repository call. The key must be held
 *    across retries, and one minted at the call site is a new key on every press — which is a new
 *    intent, which the API will happily accept and pay again.
 *
 * Rule 2 is the one worth the file. Rule 1 fails loudly at run time on the first request; rule 2
 * fails silently, only under a retry, and only with money.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** The writes the API refuses without an `Idempotency-Key`. */
const MONEY_WRITES = ['createBatch', 'markReleased', 'acknowledge', 'deferRelease', 'changeStatus'];

const failures = [];

// ── 1. the adapter accepts an intent and forwards it ─────────────────────────
const adapter = readFileSync(join(ROOT, 'src/app/data/http/http-repositories.ts'), 'utf8');

const releaseAdapter = /class HttpReleaseRepository[\s\S]*?\n}/.exec(adapter)?.[0] ?? '';

if (releaseAdapter === '') {
  failures.push('could not find HttpReleaseRepository — this check no longer knows what it is checking.');
}

for (const method of MONEY_WRITES) {
  const body = new RegExp(`\\n  ${method}\\(([\\s\\S]*?)\\n  \\}`).exec(releaseAdapter)?.[0];

  if (body === undefined) {
    failures.push(`HttpReleaseRepository.${method} is missing. Money writes cannot quietly disappear.`);
    continue;
  }

  if (!/intent: WriteIntent/.test(body)) {
    failures.push(
      `HttpReleaseRepository.${method} does not accept an intent.\n` +
        `    An implementation may declare fewer parameters than its interface, so this compiles\n` +
        `    and sends no Idempotency-Key. The API refuses the request; nothing here says why.`,
    );
    continue;
  }

  // Accepting it and not forwarding it is the same defect wearing a signature.
  if (!/\bintent\b\s*[,)]/.test(body.replace(/intent: WriteIntent/g, ''))) {
    failures.push(
      `HttpReleaseRepository.${method} takes an intent and never passes it to the client.\n` +
        `    The parameter is not the protection — the header is.`,
    );
  }
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

console.log(`Money check passed (${MONEY_WRITES.length} writes carry a held intent).`);
