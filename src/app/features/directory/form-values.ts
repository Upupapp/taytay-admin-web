/**
 * Reading form controls into the domain's values (`DL-170`). An empty field is `null` — "not given" —
 * never an empty string, because the API refuses an empty one and would refuse the whole form.
 */

/** The value an `input`, `textarea` or `select` event carries, or `''`. */
export function readText(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
    ? target.value
    : '';
}

/** Whether a checkbox event left the box ticked. */
export function readChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement && event.target.checked;
}

export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** One entry per non-empty line, trimmed: what to bring, the steps to claim. */
export function linesOf(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** A coordinate typed as text: `null` when empty, `NaN` when it is not a number. */
export function coordinateOf(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

/** Why a typed coordinate cannot be sent, or `null`. A range is the domain's to check. */
export function coordinateProblem(name: 'latitude' | 'longitude', value: string): string | null {
  const coordinate = coordinateOf(value);
  return coordinate !== null && !Number.isFinite(coordinate)
    ? `A ${name} is a number in decimal degrees, such as ${name === 'latitude' ? '14.5574' : '121.1323'}.`
    : null;
}

/** A whole number typed as text, or `NaN`. */
export function wholeNumberOf(value: string): number {
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
