#!/usr/bin/env node
/**
 * check:mapper-adoption — the gap between the mappers and the adapters may only close.
 *
 * ## The finding this exists for (L-22)
 *
 * TAB 05 built five mappers, tested them against payloads recorded from a running API, and proved
 * one real defect with them (L-15). None of them is wired into an adapter. All 45 reads in
 * `http-repositories.ts` still do this:
 *
 *     return this.api.page<ResidentView>(API_ENDPOINTS.residents, page, filter);
 *
 * That generic is an **assertion, not a check**. It tells TypeScript the `snake_case` wire payload
 * *is* a `ResidentView`; the compiler has no way to disagree, and at run time nothing converts
 * anything. `barangay_id` never becomes `address.barangayId`, so the property the templates read
 * is `undefined` — and `undefined` renders as blank rather than as an error.
 *
 * So the mapping layer is proven and unused, and the console is presently no safer than it was
 * before TAB 05. Repointing twenty adapters is TAB 12's work, not this one's.
 *
 * ## Why a number and not an allowlist
 *
 * A 45-path allowlist would need editing every time a file moved, and a list somebody edits
 * routinely is a list nobody reads. A single ceiling can only be lowered, and lowering it is the
 * commit that also removes the cast — the two cannot drift apart.
 *
 * This is a ratchet, not a gate. It does not claim the 45 are acceptable. It guarantees the
 * forty-sixth cannot be added quietly, which is the only thing a check can honestly promise while
 * the work is outstanding.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ADAPTERS = 'src/app/data/http/http-repositories.ts';

/**
 * Recorded 18 August 2026, TAB 06. LOWER THIS when you repoint an adapter through a mapper;
 * never raise it. Raising it is the change this file exists to make somebody argue for.
 */
const CEILING = 44;

const source = readFileSync(join(ROOT, ADAPTERS), 'utf8');

// A read that hands a domain type straight to the transport: `api.page<ResidentView>(…)`.
const casts = [...source.matchAll(/\bthis\.api\.(page|item|optionalItem|list)<([^>]+)>/g)];

if (casts.length > CEILING) {
  const added = casts.length - CEILING;

  console.error(
    `\nMapper adoption check failed: ${added} new unmapped read${added === 1 ? '' : 's'} in ${ADAPTERS}.\n\n` +
      `  ceiling ${CEILING}, found ${casts.length}\n\n` +
      `  A generic on this.api.page<T> is an assertion, not a conversion. It tells TypeScript the\n` +
      `  snake_case payload is a domain object; nothing at run time makes that true, so every\n` +
      `  camelCase property a template reads comes back undefined — and undefined renders blank\n` +
      `  rather than raising anything.\n\n` +
      `  Map the response through src/app/data/http/mappers/ instead. If you are removing casts,\n` +
      `  lower CEILING in tools/check-mapper-adoption.mjs in the same commit.\n`,
  );
  process.exit(1);
}

if (casts.length < CEILING) {
  console.error(
    `\nMapper adoption improved — ${CEILING - casts.length} fewer unmapped reads than the recorded ceiling.\n\n` +
      `  Lower CEILING to ${casts.length} in tools/check-mapper-adoption.mjs so the ground gained is held.\n` +
      `  A ratchet that is not tightened is a ratchet that slips back.\n`,
  );
  process.exit(1);
}

console.log(`Mapper adoption at the recorded ceiling (${casts.length} unmapped reads, L-22 outstanding).`);
