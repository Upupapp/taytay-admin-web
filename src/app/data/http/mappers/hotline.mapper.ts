import { isHotlineKind, type Hotline, type HotlineId, type HotlineKind } from '@domain/index';

import { dateTime, field, id, int, str } from './wire';

/** A boolean, or `null` for anything that is not one. */
function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * One of the API's kinds; `null` when the API sent none (`DL-220`); `undefined` for a value it
 * does not know, which makes the line unreadable.
 */
function kindOf(value: unknown): HotlineKind | null | undefined {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return isHotlineKind(value) ? value : undefined;
}

/**
 * `Hotline` → `Hotline` (`DL-170`). Every field is required by the spec, and every one is needed:
 * a line without its number, its order or whether it is shown is one this screen cannot say
 * anything true about, so it is unreadable and the list refuses it rather than leaving it out.
 *
 * Whether a line is shown is never guessed: a missing or unreadable `active` makes it unreadable,
 * because "hidden" said of a line residents can see is as wrong as the reverse.
 *
 * Nor is its kind (`DL-217`): it is never read as `other`. A line read as "not the command
 * center" when it is one would have the page tell the office it has none. An **absent** kind is
 * not set (`DL-220`): the console and the API deploy separately, and an API older than `ebd7aeb`
 * sends none — refusing every line would empty the list over a field the server does not have. An
 * **unknown** kind stays unreadable: that is a server newer than this console, saying something it
 * cannot word.
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
  const kind = kindOf(field(wire, 'kind'));
  const sortOrder = int(field(wire, 'sort_order'));
  const active = flag(field(wire, 'active'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    hotlineId === null ||
    name === null ||
    number === null ||
    category === null ||
    kind === undefined ||
    sortOrder === null ||
    active === null ||
    updatedAt === null
  ) {
    return null;
  }

  return { id: hotlineId, name, number, category, kind, sortOrder, active, updatedAt };
}
