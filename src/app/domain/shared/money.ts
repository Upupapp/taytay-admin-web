/**
 * Money is always carried as whole centavos in an integer so that no rounding
 * error can reach a disbursement record. Formatting to `₱1,234.56` happens in
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
