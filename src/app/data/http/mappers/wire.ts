import { asId, type Branded, type IsoDate, type IsoDateTime } from '@domain/index';

/**
 * The primitives every per-resource mapper is built from.
 *
 * **There is deliberately no generic recursive case-converter here.** A
 * converter cannot tell a field name from a key inside a free-text note or an
 * opaque identifier, so it renames things it was never asked to rename and the
 * failure surfaces months later inside a case file. Each resource is mapped
 * explicitly, by hand, against the field names the API **publishes** — since
 * TAB 05 those are in `openapi.json`, read out of the projection methods that
 * build each payload, so a mapper is written against measured names rather than
 * remembered ones.
 *
 * Everything here is total: a wire value that is missing, null, or of the wrong
 * type yields the domain's "absent" rather than throwing. A mapper that can
 * throw turns one unexpected field into a blank screen, and the field that
 * surprises you is never the one you were watching.
 */

/** A string, or `null` for anything that is not one. */
export function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** A required string, with a stated fallback. Never `undefined` on screen. */
export function text(value: unknown, fallback = ''): string {
  return str(value) ?? fallback;
}

export function bool(value: unknown): boolean {
  return value === true;
}

/**
 * An integer, or `null`.
 *
 * Rejects a non-integer rather than rounding one: the only numbers this API
 * sends are counts and **centavos**, and silently rounding money is how a
 * rounding bug becomes a payout discrepancy nobody can trace.
 */
export function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/**
 * Money arrives as integer minor units plus a currency (`conventions.md` §6),
 * and the domain holds centavos. No floating point at any point in the chain.
 */
export function money(amount: unknown, currency: unknown): { amount: number; currency: string } | null {
  const centavos = int(amount);

  return centavos === null ? null : { amount: centavos, currency: text(currency, 'PHP') };
}

/**
 * An ISO-8601 UTC timestamp, converted **once, here**.
 *
 * The wire carries a string. Letting that string reach the domain means
 * something downstream eventually does arithmetic on it, and string arithmetic
 * on a date is wrong in a way that looks right for most of the year.
 */
export function dateTime(value: unknown): IsoDateTime | null {
  const raw = str(value);

  if (raw === null || Number.isNaN(Date.parse(raw))) {
    return null;
  }

  return raw as IsoDateTime;
}

/** A date with no time (`YYYY-MM-DD`). */
export function date(value: unknown): IsoDate | null {
  const raw = str(value);

  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? (raw as IsoDate) : null;
}

/** A branded identifier. `null` when the wire omitted it. */
export function id<T extends Branded<string, string>>(value: unknown): T | null {
  const raw = str(value);

  return raw === null ? null : asId<T>(raw);
}

/**
 * Narrows a wire string to a domain union, or returns `null`.
 *
 * **Never widens.** An unrecognised value becomes absent rather than being
 * passed through, because a status the console cannot render is a status it
 * must not claim to understand — that is the failure ledger finding L-07
 * describes, where a payload painted through the wrong catalog renders blank
 * and reads as missing data.
 */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const raw = str(value);

  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** A list, mapped element by element, with unmappable entries dropped. */
export function list<T>(value: unknown, map: (item: unknown) => T | null): readonly T[] {
  return Array.isArray(value) ? value.map(map).filter((item): item is T => item !== null) : [];
}

/** Reads a property off an unknown wire object without asserting its shape. */
export function field(source: unknown, name: string): unknown {
  return source !== null && typeof source === 'object' && name in source
    ? (source as Record<string, unknown>)[name]
    : undefined;
}
