import {
  ACTIVE_POVERTY_THRESHOLD,
  annualHouseholdThreshold,
  annualise,
  isPerCapitaBelowThreshold,
  monthlyPerCapita,
  pesos,
  RIZAL_2023_POVERTY_THRESHOLD,
  toDecimal,
} from '@domain/index';

/*
 * The threshold is a published statistic, so these tests are as much about its
 * provenance as its arithmetic. A figure nobody can trace is a figure nobody
 * can defend, and this one is quoted to families.
 */

describe('the poverty threshold is published, not invented', () => {
  it('is the PSA 2023 annual per-capita figure for Rizal', () => {
    expect(toDecimal(RIZAL_2023_POVERTY_THRESHOLD.annualPerCapita)).toBe(39_055);
    expect(RIZAL_2023_POVERTY_THRESHOLD.geography).toBe('Rizal (province)');
    expect(RIZAL_2023_POVERTY_THRESHOLD.referenceYear).toBe(2023);
  });

  it('carries a source and a URL that can actually be followed', () => {
    expect(RIZAL_2023_POVERTY_THRESHOLD.source).toContain('Philippine Statistics Authority');
    expect(RIZAL_2023_POVERTY_THRESHOLD.sourceUrl).toMatch(/^https:\/\/psa\.gov\.ph\//);
  });

  it('separates the year the statistic is about from the day it was released', () => {
    // 2023 data, published 15 August 2024. Conflating the two is how a figure
    // ends up described as current when it is two releases old.
    expect(RIZAL_2023_POVERTY_THRESHOLD.referenceYear).toBe(2023);
    expect(RIZAL_2023_POVERTY_THRESHOLD.publishedOn).toBe('2024-08-15');
  });

  it('is the one the indicators actually read', () => {
    expect(ACTIVE_POVERTY_THRESHOLD).toBe(RIZAL_2023_POVERTY_THRESHOLD);
  });
});

describe('the monthly figure is derived for display and nothing else', () => {
  it('is the annual figure over twelve, to the centavo', () => {
    // 39,055 / 12 = 3,254.583… → ₱3,254.58 shown.
    expect(toDecimal(monthlyPerCapita(RIZAL_2023_POVERTY_THRESHOLD))).toBeCloseTo(3_254.58, 2);
  });

  it('does not divide evenly, which is exactly why it is not the boundary', () => {
    expect(RIZAL_2023_POVERTY_THRESHOLD.annualPerCapita.centavos % 12).not.toBe(0);
  });
});

describe('the comparison keeps the published boundary exactly where it is', () => {
  const threshold = RIZAL_2023_POVERTY_THRESHOLD;

  it('annualises the income rather than dividing the threshold', () => {
    expect(annualise(pesos(1_000)).centavos).toBe(1_200_000);
    expect(annualHouseholdThreshold(3, threshold).centavos).toBe(3_905_500 * 3);
  });

  it('flags a household below the line', () => {
    // Four people on ₱10,000 a month: ₱120,000 a year against ₱156,220.
    expect(isPerCapitaBelowThreshold(pesos(10_000), 4)).toBe(true);
  });

  it('does not flag a household above it', () => {
    // Two people on ₱8,000 a month: ₱96,000 a year against ₱78,110.
    expect(isPerCapitaBelowThreshold(pesos(8_000), 2)).toBe(false);
  });

  it('decides the boundary case without a rounding error', () => {
    // A single person on exactly one twelfth of the annual threshold. Rounding
    // that twelfth to a centavo would answer this differently depending on
    // which way the rounding went; annualising cannot.
    const exactlyOnTheLine = { centavos: Math.round(3_905_500 / 12), currency: 'PHP' } as const;
    // The rounded monthly figure is fractionally *below* a twelfth of the
    // annual threshold, so annualised it stays below the line.
    expect(isPerCapitaBelowThreshold(exactlyOnTheLine, 1)).toBe(true);

    // One centavo more a month is ₱0.12 more a year, which clears it.
    expect(
      isPerCapitaBelowThreshold({ centavos: exactlyOnTheLine.centavos + 1, currency: 'PHP' }, 1),
    ).toBe(false);
  });

  it('never divides by zero on an empty household', () => {
    expect(isPerCapitaBelowThreshold(pesos(1_000), 0)).toBe(false);
  });

  it('scales with household size, so the same income means different things', () => {
    // PHP15,000 a month is PHP180,000 a year: below PHP195,275 for five people,
    // far above PHP78,110 for two. The household is the unit, not the wage.
    expect(isPerCapitaBelowThreshold(pesos(15_000), 5)).toBe(true);
    expect(isPerCapitaBelowThreshold(pesos(15_000), 2)).toBe(false);
  });
});
