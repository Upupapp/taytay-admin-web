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
 * It was a ratchet while the work was outstanding. It never claimed the 45 — later 71 — were
 * acceptable; it guaranteed the next could not be added quietly. Since `DL-165` the ceiling is zero,
 * which makes it a gate: every call is mapped, and the first cast fails the build.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ADAPTERS = 'src/app/data/http/http-repositories.ts';

/*
 * 71 → 0 on 5 November 2026 (`DL-165`), and not because 71 casts were repaired. The Laravel
 * adapters that held 69 of them were deleted with the API they called, and the two reads that
 * survive — `GET me` and `GET notifications` — were rewritten through `me.mapper.ts` and
 * `notification.mapper.ts`. Removal, recorded as removal. At zero the ratchet is a hard rule: a
 * single cast fails the build.
 */
const CEILING = 0;

const source = readFileSync(join(ROOT, ADAPTERS), 'utf8');

/*
 * Every helper on ApiClient is examined — writes as well as reads, because `post<Foo>` asserts the
 * shape of the answer exactly as `item<Foo>` does. The list is not trusted: it is compared with the
 * client's surface, because a check that enumerates the helpers it inspects has missed the next one
 * four times (`DL-162`).
 */
/*
 * `blob` (`DL-167`) answers `Blob` and takes no type argument, so it can assert no domain shape; it
 * is listed so the surface comparison below stays exact rather than so it can be found guilty.
 */
const HELPERS = [
  'cursorPage',
  'everyPage',
  'list',
  'item',
  'optionalItem',
  'blob',
  // Bytes for a grant (`DL-178`): answers `Blob`, takes no type argument for its answer.
  'postBlob',
  'post',
  'patch',
  // Form bodies (`DL-170`): their answer is an envelope like any write's, so a generic on one
  // asserts a shape exactly as `post<Foo>` does.
  'postForm',
  'patchForm',
  'delete',
];

const client = readFileSync(join(ROOT, 'src/app/data/http/api.client.ts'), 'utf8');
const surface = [...client.matchAll(/^  ([a-zA-Z]\w*)\s*[<(]/gm)].map((m) => m[1]);
const unknown = surface.filter((name) => !HELPERS.includes(name));
const vanished = HELPERS.filter((name) => !surface.includes(name));

if (unknown.length > 0 || vanished.length > 0) {
  console.error(
    `\nMapper adoption check cannot run: its view of ApiClient is out of date.\n` +
      (unknown.length ? `  not examined: ${unknown.join(', ')}\n` : '') +
      (vanished.length ? `  no longer on ApiClient: ${vanished.join(', ')}\n` : ''),
  );
  process.exit(1);
}

// A call that hands a domain type straight to the transport: `api.item<ResidentView>(…)`.
const generics = [
  ...source.matchAll(new RegExp(String.raw`\bthis\s*\.\s*api\s*\.\s*(${HELPERS.join('|')})\s*<([^>]+)>`, 'g')),
];

/*
 * A call typed as a **wire** shape is the pattern this check asks for, not the one it forbids. A
 * name ending `Wire` is this repository's convention for a payload shape declared beside its mapper;
 * `Record<string, unknown>` and `unknown` assert nothing a template could read. Only the first type
 * argument is the answer's type — a write's second is its body, which `check:wire-adoption` owns.
 */
const answerType = (generic) => generic.split(',')[0].trim();
const isWireShape = (type) => /Wire\b/.test(type) || /^Record\s*</.test(type) || type === 'unknown';

const casts = generics.filter((match) => !isWireShape(answerType(match[2])));

if (casts.length > CEILING) {
  console.error(
    `\nMapper adoption check failed: ${casts.length} unmapped call${casts.length === 1 ? '' : 's'} in ${ADAPTERS}.\n\n` +
      casts.map((match) => `    this.api.${match[1]}<${match[2]}>`).join('\n') +
      `\n\n  A generic on this.api.<helper><T> is an assertion, not a conversion. It tells TypeScript the\n` +
      `  snake_case payload is a domain object; nothing at run time makes that true, so every\n` +
      `  camelCase property a template reads comes back undefined — and undefined renders blank.\n\n` +
      `  Read it as unknown and map it through src/app/data/http/mappers/.\n`,
  );
  process.exit(1);
}

console.log(`Mapper adoption check passed (${generics.length} typed calls, none of them a cast to a domain type).`);
