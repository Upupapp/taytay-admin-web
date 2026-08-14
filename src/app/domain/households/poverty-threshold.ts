import { asIsoDate } from '../shared/ids';
import type { IsoDate } from '../shared/ids';
import type { Money } from '../shared/money';

/**
 * A published poverty threshold, carried with its provenance.
 *
 * A bare number in the code would be unciteable: nobody reading it later could
 * tell which geography it describes, which year it belongs to, or whether it
 * had ever been checked. So the figure travels with the answers to all three,
 * and the screen shows them beside the arithmetic (`DL-46`, superseding the
 * placeholder this file replaced in `DL-45`).
 *
 * The annual figure is the authoritative one, because that is the unit the PSA
 * publishes in. The monthly value is derived for display only and **never used
 * for the comparison** — see `isPerCapitaBelowThreshold`.
 */
export interface PovertyThreshold {
  /** Per person, per year. The published unit. */
  readonly annualPerCapita: Money;
  /** The published geography this figure describes, in the publisher's words. */
  readonly geography: string;
  /** The year the statistic is *about*, not the year it was released. */
  readonly referenceYear: number;
  readonly publishedOn: IsoDate;
  readonly source: string;
  readonly sourceUrl: string;
}

/**
 * PSA 2023 Full Year Official Poverty Statistics, Table 1 — annual per-capita
 * poverty threshold for **Rizal province**, ₱39,055.
 *
 * Rizal rather than CALABARZON (₱37,096) because Taytay is in Rizal, and the
 * province is the closest authoritative geography the PSA publishes for this
 * municipality. The regional figure would understate the local threshold by
 * roughly 5%, which for an advisory indicator means quietly declining to flag
 * families the province's own statistics would count as poor.
 *
 * Reviewed and selected 2026-08-14. When the PSA publishes a later full-year
 * release, replace this constant and update `referenceYear` and `publishedOn`
 * together — they are one fact, not three.
 */
export const RIZAL_2023_POVERTY_THRESHOLD: PovertyThreshold = {
  annualPerCapita: { centavos: 3_905_500, currency: 'PHP' },
  geography: 'Rizal (province)',
  referenceYear: 2023,
  publishedOn: asIsoDate('2024-08-15'),
  source: 'Philippine Statistics Authority, 2023 Full Year Official Poverty Statistics, Table 1',
  sourceUrl:
    'https://psa.gov.ph/sites/default/files/phdsd/2023%20FY%20Official%20PovStat%20Publication%20Report_r2.pdf',
};

/** The threshold the indicators currently read. One place to change it. */
export const ACTIVE_POVERTY_THRESHOLD: PovertyThreshold = RIZAL_2023_POVERTY_THRESHOLD;

/** Annual per-capita ÷ 12, rounded to the centavo. **Display only.** */
export function monthlyPerCapita(threshold: PovertyThreshold): Money {
  return {
    centavos: Math.round(threshold.annualPerCapita.centavos / 12),
    currency: 'PHP',
  };
}

/** A month's household income, annualised. Exact: a multiplication, not a division. */
export function annualise(monthly: Money): Money {
  return { centavos: monthly.centavos * 12, currency: 'PHP' };
}

/** What a household of this size would need for a year to reach the threshold. */
export function annualHouseholdThreshold(size: number, threshold: PovertyThreshold): Money {
  return { centavos: threshold.annualPerCapita.centavos * size, currency: 'PHP' };
}

/**
 * Whether a household's recorded monthly income puts it below the threshold.
 *
 * Compared **annually**, so the arithmetic is two integer multiplications and
 * no division at all. Dividing the published annual figure by twelve gives
 * ₱3,254.58…, and rounding that to a centavo would move the boundary by a
 * fraction — invisibly, and in a direction nobody chose. Annualising the income
 * instead keeps the published number exactly as published, and keeps the
 * decision boundary exactly where the PSA put it.
 */
export function isPerCapitaBelowThreshold(
  monthlyHouseholdIncome: Money,
  householdSize: number,
  threshold: PovertyThreshold = ACTIVE_POVERTY_THRESHOLD,
): boolean {
  if (householdSize <= 0) {
    return false;
  }
  return (
    annualise(monthlyHouseholdIncome).centavos <
    annualHouseholdThreshold(householdSize, threshold).centavos
  );
}
