import { firstValueFrom, isObservable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  UnservedError,
  UnservedEventRepository,
  UnservedGovernanceRepository,
  UnservedNewsfeedRepository,
} from './unserved-repositories';

/*
 * Constructed directly rather than through `provideDataAccess()`: the test build swaps that file
 * for the mock one, exactly as `local-mock` does. Which port is bound to which class is checked
 * statically instead, by `check:routes`.
 */
const UNSERVED = [
  new UnservedGovernanceRepository(),
  new UnservedNewsfeedRepository(),
  new UnservedEventRepository(),
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
  it('covers three ports and every method each declares', () => {
    // The resident registry left this list in casework phase 1b (`DL-174`); the household register,
    // saved views and families in phase 1c; programmes in phase 1d (`DL-176`), taking seven methods;
    // assistance requests in phase 2a (`DL-177`), taking nineteen — their phase 2b methods refuse
    // from the served adapter now, and are held to that in http-assistance-requests.spec.ts; and
    // cases in phase 3 (`DL-179`), taking eleven; releases in phase 4 (`DL-180`), taking thirteen; and
    // referrals and field visits in phase 5 (`DL-181`), taking fifteen and eight; and the dashboard
    // (`DL-182`), taking one; and the beneficiary registry (`DL-187`), taking eight; and search and
    // the work queues (`DL-189`), taking one and three; and reports (`DL-190`), taking three.
    expect(UNSERVED).toHaveLength(3);
    expect(UNSERVED.flatMap((adapter) => everyCall(adapter))).toHaveLength(33);
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
