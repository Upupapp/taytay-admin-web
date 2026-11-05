import type { Office, OfficeId } from '@domain/index';

import { field, id, str } from './wire';

/**
 * `Office` → `Office` (`DL-168`).
 *
 * | wire         | domain      | if absent                  |
 * | ------------ | ----------- | -------------------------- |
 * | `id`         | `id`        | the office is not readable |
 * | `name`       | `name`      | the office is not readable |
 * | `slug`       | `slug`      | the office is not readable |
 * | `short_name` | `shortName` | no short label             |
 *
 * **Not read**: the head, hours, phone, email, address, map position, banner and service lines. A
 * screen here names an office and offers it in a picker; it never shows the directory entry, so
 * reading the rest would hold data nothing uses.
 *
 * @consumes GET offices
 */
export function toOffice(wire: unknown): Office | null {
  const officeId = id<OfficeId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const slug = str(field(wire, 'slug'));

  if (officeId === null || name === null || slug === null) {
    return null;
  }

  return { id: officeId, name, slug, shortName: str(field(wire, 'short_name')) };
}
