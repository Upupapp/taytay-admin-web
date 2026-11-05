import { firstValueFrom, isObservable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  UnservedAssistanceRequestRepository,
  UnservedBeneficiaryRepository,
  UnservedCaseRepository,
  UnservedDashboardRepository,
  UnservedError,
  UnservedEventRepository,
  UnservedFamilyRepository,
  UnservedFieldVisitRepository,
  UnservedGovernanceRepository,
  UnservedHouseholdRepository,
  UnservedNewsfeedRepository,
  UnservedProgramRepository,
  UnservedReferralRepository,
  UnservedReleaseRepository,
  UnservedReportRepository,
  UnservedResidentRepository,
  UnservedSavedViewRepository,
  UnservedSearchRepository,
  UnservedWorkRepository,
} from './unserved-repositories';

/*
 * Constructed directly rather than through `provideDataAccess()`: the test build swaps that file
 * for the mock one, exactly as `local-mock` does. Which port is bound to which class is checked
 * statically instead, by `check:routes`.
 */
const UNSERVED = [
  new UnservedResidentRepository(),
  new UnservedHouseholdRepository(),
  new UnservedFamilyRepository(),
  new UnservedCaseRepository(),
  new UnservedSavedViewRepository(),
  new UnservedProgramRepository(),
  new UnservedAssistanceRequestRepository(),
  new UnservedBeneficiaryRepository(),
  new UnservedFieldVisitRepository(),
  new UnservedReleaseRepository(),
  new UnservedReferralRepository(),
  new UnservedWorkRepository(),
  new UnservedReportRepository(),
  new UnservedSearchRepository(),
  new UnservedGovernanceRepository(),
  new UnservedNewsfeedRepository(),
  new UnservedEventRepository(),
  new UnservedDashboardRepository(),
] as const;

/** Every method an adapter's class declares, called with nothing. */
function everyCall(adapter: object): readonly { name: string; result: unknown }[] {
  const prototype: unknown = Object.getPrototypeOf(adapter);

  if (prototype === null || typeof prototype !== 'object') {
    return [];
  }

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const method: unknown = Reflect.get(adapter, name);
      const result: unknown = typeof method === 'function' ? method.call(adapter) : undefined;
      return { name, result };
    });
}

/**
 * An unserved port must fail **loudly and without a request**. An empty answer would assert
 * something about the office — "no cases" — when the truth is that nothing was asked (`DL-112`);
 * a request would come back as a 404 the screen reads as an absence of records.
 *
 * These classes inject nothing, so they have no way to make a request; constructing them with
 * `new`, outside any injector, is the proof.
 */
describe('the ports the API does not serve', () => {
  it('covers eighteen ports and every method each declares', () => {
    expect(UNSERVED).toHaveLength(18);
    expect(UNSERVED.flatMap((adapter) => everyCall(adapter))).toHaveLength(146);
  });

  it.each(UNSERVED.map((adapter) => [adapter.constructor.name, adapter] as const))(
    '%s refuses every method with a sentence',
    async (_name, adapter) => {
      for (const { name, result } of everyCall(adapter)) {
        expect(isObservable(result), `${name} returns an Observable`).toBe(true);

        if (isObservable(result)) {
          const refusal: unknown = await firstValueFrom(result).catch((error: unknown) => error);

          expect(refusal, name).toBeInstanceOf(UnservedError);
          expect(refusal instanceof Error ? refusal.message : '').toMatch(
            /^This part of the console has no server yet: the API it is connected to does not serve .+\. Nothing was sent/,
          );
        }
      }
    },
  );
});
