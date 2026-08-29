/**
 * check:query-params — a filter key the API never reads is a filter that does nothing.
 *
 * ## The finding (L-24)
 *
 * `L-22` records the inbound half of this expression:
 *
 * ```ts
 * return this.api.page<ResidentView>(API_ENDPOINTS.residents, page, filter);
 * ```
 *
 * — a `snake_case` payload cast to a domain type with no conversion. **This check is the
 * outbound half of the same line, and it is worse**, because the inbound failure renders a
 * blank cell and the outbound failure renders a full list.
 *
 * `toQueryParams` and `toParams` copy every filter key **verbatim**. Neither converts case;
 * `per_page` is hand-written `snake_case` two lines above the copy loop, which is the whole
 * convention stated and then not applied. The API reads `snake_case` exclusively — measured
 * across every `V1` controller: `barangay_id`, `assigned_to`, `resident_id`, `program_id`,
 * `overdue_only`, `open_only`, `as_of`, and **no camelCase parameter anywhere**.
 *
 * So `?barangayId=3` arrives, `$request->query('barangay_id')` returns null, the `if` guarding
 * the `where` clause is skipped, and the endpoint answers **200 with the unfiltered list**.
 *
 * ## What this is, and what it is not
 *
 * It is **not** an authorisation bypass, and saying so would be alarmism. Every list controller
 * scopes before it filters — `scopeToBarangays($actor, ...)` runs first and `barangay_id` is
 * documented in `ResidentController` as *"narrowing only … asking for a barangay outside it
 * yields nothing rather than widening anything"*. The actor's scope holds.
 *
 * It is a filter that **fails open and fails silently**, bounded by that scope. For a barangay
 * -scoped clerk that is their own barangay. For a municipality-scoped supervisor — the MSWDO
 * head, an administrator — it is every resident of a municipality of 397,111 people, returned
 * under a heading that says the list was narrowed.
 *
 * The reason it survived every gate is that **the single-word keys work**. `status`, `search`,
 * `category`, `q` and `scope` need no conversion, so the filter panel demonstrates itself with
 * the half that functions while `barangayId`, `assignedTo`, `residentId`, `programId`,
 * `overdueOnly` and `openOnly` are discarded.
 *
 * ## Why no existing check catches it
 *
 * `check:routes` compares path and verb — this path is correct at this verb.
 * `check:wire-adoption` reads `args[1]`, the request **body**, and returns early on reads.
 * `check:contract` governs the envelope. Query parameters are covered by none of them; this
 * file is that counter.
 *
 * Proven red before it was trusted: run against `HEAD` it reports 54 offending keys across 13
 * filter interfaces and 24 call sites.
 *
 * ## What this check does NOT cover — read this before trusting a green run
 *
 * It compares **shape**, not existence. A key is accepted here if the wire could carry it as
 * written; whether the endpoint has that filter at all is a different question and this file
 * cannot answer it without the API's route table.
 *
 * There is already a known instance: `http-repositories.ts:664` sends `{ view, ... }` to
 * `admin/newsfeed`, and **no `view` parameter is read anywhere in the Content module**. It is
 * lowercase, so it passes here, and it is discarded there. Counted in neither number.
 *
 * So a green run means *"no new key was added in a case the API cannot read"*. It does not mean
 * the filters work. That claim needs the recorded consumer expectations replayed against the
 * real router — TAB 06's backend half — and until that runs, this counter is a floor.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ADAPTERS = 'src/app/data/http/http-repositories.ts';
const DOMAIN = join(ROOT, 'src/app/domain');

/**
 * A key the wire can carry as written. `snake_case` and single lowercase words only — the API
 * reads nothing else. Keys already known to be sent as-is by the transport itself are exempt.
 */
const TRANSPORT_KEYS = new Set(['page', 'per_page', 'sort']);
const wireShaped = (key) => TRANSPORT_KEYS.has(key) || /^[a-z][a-z0-9_]*$/.test(key);

const offenders = [];

// ── 1. filter interfaces in the domain ───────────────────────────────────────
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.includes('.spec.') ? [join(dir, e.name)] : [],
  );

for (const file of walk(DOMAIN)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/export interface (\w*Filter)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match;
    for (const [, key] of body.matchAll(/readonly\s+(\w+)\??\s*:/g)) {
      if (!wireShaped(key)) offenders.push({ where: name, key });
    }
  }
}

// ── 2. keys hand-written at a call site ──────────────────────────────────────
const adapters = readFileSync(join(ROOT, ADAPTERS), 'utf8');
for (const call of adapters.matchAll(/this\s*\.\s*api\s*\.\s*(?:page|collection|item|optionalItem)<[\s\S]*?>\(([\s\S]*?)\);/g)) {
  const args = call[1];
  const line = adapters.slice(0, call.index).split('\n').length;
  for (const literal of args.matchAll(/\{([^{}]*)\}/g)) {
    for (const [, key] of literal[1].matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*(?::|,|$)/g)) {
      if (!wireShaped(key)) offenders.push({ where: `${ADAPTERS}:${line}`, key });
    }
  }
}

/*
 * 54 → 55 when the scanner learned to see a chained call.
 *
 * The extra key is not new debt: it was always sent and always ignored, on a read written as
 * `this.api\n  .page<…>(…)` — a shape the contiguous `this\.api\.` pattern never matched. See
 * `check:routes` for the same blind spot and what it hid there. The number went up because the
 * check got better, which is the one direction a ratchet is allowed to move for that reason.
 */
const CEILING = 55;

if (offenders.length > CEILING) {
  const shown = offenders.slice(0, 12).map((o) => `    ${o.key}  (${o.where})`).join('\n');
  console.error(
    `\nQuery parameter check failed: ${offenders.length} filter key(s) the API cannot read.\n\n` +
      `  ceiling ${CEILING}, found ${offenders.length}\n\n${shown}\n\n` +
      `  The API reads snake_case exclusively. A camelCase key is not rejected — it is ignored,\n` +
      `  the where clause never runs, and the endpoint answers 200 with the UNFILTERED list.\n` +
      `  The single-word keys work, which is why a broken filter panel looks like a working one.\n\n` +
      `  Convert at the transport seam (toQueryParams / toParams), not at the call site, and\n` +
      `  lower CEILING in tools/check-query-params.mjs in the same commit.\n`,
  );
  process.exit(1);
}

if (offenders.length < CEILING) {
  console.error(
    `\nQuery parameters improved — ${CEILING - offenders.length} fewer unreadable key(s) than the recorded ceiling.\n\n` +
      `  Lower CEILING to ${offenders.length} in tools/check-query-params.mjs so the ground gained is held.\n`,
  );
  process.exit(1);
}

console.log(`Query parameters at the recorded ceiling (${offenders.length} unreadable keys, L-24 outstanding).`);
