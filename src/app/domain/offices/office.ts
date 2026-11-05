import type { OfficeId } from '../shared/ids';

/**
 * An LGU office as the residents' app lists it (`DL-168`) — the office a resident writes to, and the
 * office a staff account answers for.
 *
 * Only what a screen here names an office by. The API's directory entry also carries hours, a head,
 * a phone, an address and a map position; none of them is needed to say which office a
 * conversation went to or which office a staff account belongs to, so none is read.
 */
export interface Office {
  readonly id: OfficeId;
  readonly name: string;
  readonly slug: string;
  /** A display label such as "MSWDO", when the office has one. */
  readonly shortName: string | null;
}

/** "Municipal Social Welfare and Development Office (MSWDO)", or the name alone. */
export function officeLabel(office: Office): string {
  return office.shortName === null || office.shortName === office.name
    ? office.name
    : `${office.name} (${office.shortName})`;
}
