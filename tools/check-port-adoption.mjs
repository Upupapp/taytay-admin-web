#!/usr/bin/env node
/**
 * check:port-adoption — a port method no screen calls is a feature nobody can reach.
 *
 * ## What this counts that the other checks cannot
 *
 * `check:routes` asks whether a request would reach a real endpoint. `check:wire-adoption` asks
 * whether its body would be understood. Both assume somebody makes the request.
 *
 * This asks the prior question. A port method can be declared, implemented in **both** adapters,
 * covered by tests on both, pass every other gate — and be called by no screen in the application.
 * Every check stays green, because each one is asking about code that is never run.
 *
 * That is not hypothetical here. It was found by hand in TAB 19:
 *
 *   * `recordDocument` and `requestDocument` — a document cannot be uploaded, and there is no
 *     `<input type="file">` anywhere in `src/app`. `FileTransport`, built for exactly this with
 *     progress and 413 handling, is injected by nothing but its own spec.
 *   * `send` — **a referral cannot be sent**, which is the one irreversible outward act.
 *   * `createBatch` — a payout session cannot be created.
 *
 * `check:documents-transport` passed throughout, and correctly: every rule it enforces is a
 * prohibition — nothing deletes a version, nothing builds its own URL — and a prohibition holds
 * trivially where the feature is absent. **A green check over an absent feature is the failure
 * this one exists to make visible.**
 *
 * ## The direction it errs in, which matters for a ratchet
 *
 * A call is found by searching `features/`, `shared/` and `core/` for `.methodName(`. That is
 * textual, and a method named `list`, `create` or `remove` will match something eventually whether
 * or not it is the port's.
 *
 * So this **under-reports**: it can call a method adopted when it is not, and will not invent an
 * orphan that does not exist. For a ratchet that is the safe direction — a check that cries wolf
 * is a check somebody turns off — but it means the number is a **floor**. The real count is at
 * least this.
 *
 * It is deliberately not made precise by resolving receivers to their injected token. That needs a
 * type-aware pass, and a wrong one would be worse than a plain search nobody mistakes for exact.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORTS = join(ROOT, 'src/app/domain/ports/repositories.ts');
const BASELINE = join(ROOT, 'src/app/data/http/contract/unreached-ports.json');

const RED = '[31m';
const RESET = '[0m';

const failures = [];

function walk(dir) {
  const out = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(full);
  }

  return out;
}

/**
 * Methods, grouped by the interface that declares them.
 *
 * Grouping is what makes the output actionable: "eight `CaseRepository` methods are unreachable"
 * points at a missing screen, where eight scattered names read as eight unrelated oversights.
 */
const ports = new Map();
const source = readFileSync(PORTS, 'utf8');

let current = null;

for (const line of source.split('\n')) {
  const declaration = /^export interface (\w+Repository)\b/.exec(line);

  if (declaration !== null) {
    current = declaration[1];
    ports.set(current, []);
    continue;
  }

  if (line === '}') {
    current = null;
    continue;
  }

  const method = /^ {2}(\w+)\(/.exec(line);

  if (current !== null && method !== null) ports.get(current).push(method[1]);
}

const total = [...ports.values()].reduce((n, methods) => n + methods.length, 0);

/*
 * A parser that found nothing would report a spotlessly adopted set of ports. Every detector here
 * asserts its own reach, because one that reaches nothing is indistinguishable from a codebase
 * with nothing to find.
 */
if (total < 80) {
  failures.push(`Only ${total} port methods were parsed from repositories.ts. The parser is broken, not the code.`);
}

const callers = ['src/app/features', 'src/app/shared', 'src/app/core']
  .flatMap((dir) => walk(join(ROOT, dir)))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

const unreached = [];

for (const [port, methods] of ports) {
  for (const method of methods) {
    if (!new RegExp(`\\.${method}\\s*\\(`).test(callers)) unreached.push(`${port}.${method}`);
  }
}

unreached.sort();

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ ...baseline, count: unreached.length, methods: unreached }, null, 2)}\n`,
  );
  console.log(`Baseline rewritten: ${unreached.length} unreached port methods.`);
  process.exit(0);
}

const known = new Set(baseline.methods);

for (const entry of unreached) {
  if (!known.has(entry)) {
    failures.push(
      `A new unreached port method: ${entry}\n` +
        `    It is declared, implemented on both adapters and reachable from no screen. Either wire\n` +
        `    it to the feature that needs it, or remove it — an unused port method passes every\n` +
        `    other gate in this repository, because none of them runs it.`,
    );
  }
}

for (const entry of known) {
  if (!unreached.includes(entry)) {
    failures.push(
      `Reached now, still in the baseline: ${entry}\n` +
        `    Run: node tools/check-port-adoption.mjs --write-baseline`,
    );
  }
}

if (failures.length > 0) {
  console.error('\nPort-adoption check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(`Port-adoption check passed (${total - unreached.length}/${total} port methods reached by a screen).`);

if (unreached.length > 0) {
  const byPort = new Map();

  for (const entry of unreached) {
    const port = entry.split('.')[0];
    byPort.set(port, (byPort.get(port) ?? 0) + 1);
  }

  const worst = [...byPort.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  console.error(
    `\n  ${RED}${unreached.length} of ${total} port methods are reachable from no screen${RESET} ` +
      `(at least — this search under-reports).\n` +
      `  Most affected: ${worst.map(([port, n]) => `${port} (${n})`).join(', ')}.\n` +
      `  See docs/integration/release-engineering.md.\n`,
  );
}
