import type { Hotline, HotlineId } from '@domain/index';

import { dateTime, field, id, int, str } from './wire';

/** A boolean, or `null` for anything that is not one. */
function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * `Hotline` → `Hotline` (`DL-170`). Every field is required by the spec, and every one is needed:
 * a line without its number, its order or whether it is shown is one this screen cannot say
 * anything true about, so it is unreadable and the list refuses it rather than leaving it out.
 *
 * Whether a line is shown is never guessed: a missing or unreadable `active` makes it unreadable,
 * because "hidden" said of a line residents can see is as wrong as the reverse.
 *
 * @consumes GET admin/hotlines
 * @consumes POST admin/hotlines
 * @consumes PATCH admin/hotlines/{id}
 */
export function toHotline(wire: unknown): Hotline | null {
  const hotlineId = id<HotlineId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const number = str(field(wire, 'number'));
  const category = str(field(wire, 'category'));
  const sortOrder = int(field(wire, 'sort_order'));
  const active = flag(field(wire, 'active'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    hotlineId === null ||
    name === null ||
    number === null ||
    category === null ||
    sortOrder === null ||
    active === null ||
    updatedAt === null
  ) {
    return null;
  }

  return { id: hotlineId, name, number, category, sortOrder, active, updatedAt };
}
