#!/usr/bin/env node
/**
 * check:wire-adoption — what this console SENDS is mapped, not merely typed.
 *
 * ## The defect class this counts
 *
 * `check:mapper-adoption` counts the read side: a generic like `this.api.page<ResidentView>(…)` is
 * an **assertion, not a check** — it tells TypeScript the `snake_case` payload *is* a
 * `ResidentView`, and nothing converts anything at run time.
 *
 * The write side has the same hole and no counter at all. `this.api.post<Resident, ResidentDraft>(…)`
 * sends the domain object **verbatim**, so the request carries `birthDate` where the API validates
 * `birth_date` — and every field is rejected at once with a 422 nobody has ever seen, because the
 * console has never run against the API.
 *
 * It is not merely a casing problem. `ResidentDraft` nests `name`, `address` and `contact`; the API
 * wants `first_name`, `barangay_id`, `mobile_number` **flat**. No generic converter could bridge
 * that, which is exactly why `CLAUDE.md` forbids one: *"never a generic recursive case-converter,
 * which cannot tell a field name from a key inside a free-text note."* Each payload is written out.
 *
 * ## What counts as mapped
 *
 * A write whose body is either
 *
 *   1. a call to a `toWire…()` function — the explicit mapper, or
 *   2. an inline literal every one of whose keys is already wire-shaped (`snake_case`, or a single
 *      lowercase word, which is the same thing).
 *
 * Anything else is counted. The number is printed on every run and the check fails when it grows,
 * exactly like `check:routes` — a baseline, never an allow-list.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = join(ROOT, 'src/app/data/http/http-repositories.ts');
const BASELINE = join(ROOT, 'src/app/data/http/contract/unmapped-writes.json');

const RED = '[31m';
const RESET = '[0m';

const src = readFileSync(SOURCE, 'utf8');
const failures = [];

/** `birthDate` is not wire-shaped; `reason`, `status` and `birth_date` are. */
const wireShaped = (key) => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(key);

/**
 * Walk from a `this.api.<verb><…>(` to its matching close paren, counting depth.
 *
 * A regex cannot find the end of a call whose arguments contain template literals, nested objects
 * and further calls. The first version of this used one, matched the wrong closing paren, and
 * reported "bodies" that were really fragments of the following argument.
 */
function callsIn(text) {
  const out = [];
  // Whitespace around the dot, for the reason `check:routes` records: a chained call that Prettier
  // wrapped was invisible to this scan, so its body was never counted either way.
  const start = /this\s*\.\s*api\s*\.\s*(post|patch|delete|postVoid)\s*</g;
  let m;

  while ((m = start.exec(text)) !== null) {
    // Skip the generic parameter list to reach the argument list.
    let i = m.index + m[0].length;
    let angle = 1;

    while (i < text.length && angle > 0) {
      if (text[i] === '<') angle++;
      else if (text[i] === '>') angle--;
      i++;
    }

    while (i < text.length && text[i] !== '(') i++;

    let depth = 0;
    const open = i;

    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    out.push({
      verb: m[1],
      args: text.slice(open + 1, i),
      line: text.slice(0, m.index).split('\n').length,
    });
  }

  return out;
}

/** Split an argument list on top-level commas only. */
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

const unmapped = [];
let checked = 0;

for (const call of callsIn(src)) {
  const args = topLevelArgs(call.args);
  const body = args[1];

  // `deleteVoid`, and a DELETE with no body, send nothing to map.
  if (body === undefined) continue;

  checked++;

  if (/^toWire\w*\(/.test(body)) continue;

  if (body.startsWith('{')) {
    const keys = [
      ...[...body.matchAll(/(?:^|[{,]\s*)([A-Za-z_]\w*)\s*:/g)].map((k) => k[1]),
      ...[...body.matchAll(/(?:^|[{,]\s*)([A-Za-z_]\w*)\s*(?=[,}])/g)].map((k) => k[1]),
    ];

    const offenders = [...new Set(keys.filter((k) => !wireShaped(k)))];

    if (offenders.length === 0) continue;

    unmapped.push(`${call.line}: inline literal sends ${offenders.join(', ')}`);
    continue;
  }

  unmapped.push(`${call.line}: sends ${body} verbatim`);
}

/*
 * A walker that found nothing would report a spotlessly mapped adapter. Every detector here
 * asserts its own reach, because one that reaches nothing is indistinguishable from a codebase
 * with nothing to find.
 */
if (checked < 40) {
  failures.push(`Only ${checked} write bodies were found. The parser is broken, not the code.`);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ ...baseline, count: unmapped.length, writes: unmapped }, null, 2)}\n`,
  );
  console.log(`Baseline rewritten: ${unmapped.length} unmapped writes.`);
  process.exit(0);
}

/*
 * Compared by COUNT and by the payload named, never by line number.
 *
 * A baseline keyed on line numbers would fail on every edit above it, which is the fastest way to
 * teach somebody to regenerate a baseline without reading what changed.
 */
const shape = (entry) => entry.replace(/^\d+: /, '');
const tally = (entries) => {
  const counts = new Map();
  for (const entry of entries) counts.set(shape(entry), (counts.get(shape(entry)) ?? 0) + 1);
  return counts;
};

const known = tally(baseline.writes);
const now = tally(unmapped);

for (const [what, count] of now) {
  if (count > (known.get(what) ?? 0)) {
    failures.push(
      `A new unmapped write: ${what}\n` +
        `    The API validates snake_case and this sends the domain object as it stands, so every\n` +
        `    field is rejected at once. Add a toWire… mapper in data/http/mappers/to-wire.ts.`,
    );
  }
}

for (const [what, count] of known) {
  if ((now.get(what) ?? 0) < count) {
    failures.push(
      `Mapped now, still in the baseline: ${what}\n` +
        `    Run: node tools/check-wire-adoption.mjs --write-baseline`,
    );
  }
}

if (failures.length > 0) {
  console.error('\nWire-adoption check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Wire-adoption check passed (${checked - unmapped.length}/${checked} write bodies mapped).`,
);

if (unmapped.length > 0) {
  console.error(
    `\n  ${RED}${unmapped.length} of ${checked} write bodies are sent unmapped${RESET}.\n` +
      `  Each is a 422 against the real API. The console has never run against it, so nothing has\n` +
      `  ever rejected them. See docs/integration/release-engineering.md.\n`,
  );
}
