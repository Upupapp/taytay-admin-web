/**
 * Money is always carried as whole centavos in an integer so that no rounding
 * error can reach a release record. Formatting to `₱1,234.56` happens in
 * the presentation layer only.
 */
export interface Money {
  readonly centavos: number;
  readonly currency: 'PHP';
}

export function pesos(amount: number): Money {
  return { centavos: Math.round(amount * 100), currency: 'PHP' };
}

export function centavos(amount: number): Money {
  return { centavos: Math.round(amount), currency: 'PHP' };
}

export const ZERO_PESOS: Money = { centavos: 0, currency: 'PHP' };

export function addMoney(a: Money, b: Money): Money {
  return { centavos: a.centavos + b.centavos, currency: 'PHP' };
}

export function sumMoney(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO_PESOS);
}

export function toDecimal(value: Money): number {
  return value.centavos / 100;
}

/**
 * A peso amount as somebody typed it — `3200`, `3,200.50`, `₱ 3,200.5` — read into whole centavos
 * **without floating-point arithmetic**: the pesos and the centavos are read as two integers from
 * the text, never as one decimal multiplied by a hundred. `null` for anything that is not an amount
 * (a third decimal place included: a centavo cannot be split, and rounding it would record a figure
 * nobody typed).
 */
export function parsePesos(text: string): Money | null {
  const cleaned = text.replace(/[₱,\s]/g, '').replace(/^PHP/i, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (match === null) {
    return null;
  }
  const whole = Number.parseInt(match[1] ?? '0', 10);
  const fraction = Number.parseInt((match[2] ?? '').padEnd(2, '0'), 10);
  const total = whole * 100 + fraction;
  return Number.isSafeInteger(total) ? { centavos: total, currency: 'PHP' } : null;
}
