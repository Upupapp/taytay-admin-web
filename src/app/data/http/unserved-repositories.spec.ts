import { firstValueFrom, isObservable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DATA_PORT_HOLDINGS } from '@domain/index';

import { UNSERVED_HTTP_PORTS, UnservedError, unserved } from './unserved-repositories';

/**
 * An unserved port must fail **loudly and without a request**. An empty answer would assert
 * something about the office — "no cases" — when the truth is that nothing was asked (`DL-112`);
 * a request would come back as a 404 the screen reads as an absence of records.
 *
 * No port is unserved since the newsfeed was retired (`DL-194`), so no `Unserved…` class is left to
 * construct. The refusal they were built on is still held here: the served staff adapter answers
 * two methods with it, and the next port the console gains ahead of its API will need it.
 */
describe('the ports the API does not serve', () => {
  it('covers none since the newsfeed was retired (DL-194)', () => {
    // The resident registry left this list in casework phase 1b (`DL-174`); the household register,
    // saved views and families in phase 1c; programmes in phase 1d (`DL-176`), taking seven methods;
    // assistance requests in phase 2a (`DL-177`), taking nineteen; cases in phase 3 (`DL-179`),
    // taking eleven; releases in phase 4 (`DL-180`), taking thirteen; referrals and field visits in
    // phase 5 (`DL-181`), taking fifteen and eight; the dashboard (`DL-182`), taking one; the
    // beneficiary registry (`DL-187`), taking eight; search and the work queues (`DL-189`), taking
    // one and three; reports (`DL-190`), taking three; governance (`DL-191`), taking eight; events
    // (`DL-192`), taking fourteen. The newsfeed's eleven went with its screens (`DL-194`).
    expect(UNSERVED_HTTP_PORTS).toEqual([]);
  });

  it('refuses with a sentence that says nothing was sent', async () => {
    const result = unserved(DATA_PORT_HOLDINGS.event);

    expect(isObservable(result)).toBe(true);
    const refusal: unknown = await firstValueFrom(result).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(UnservedError);
    expect(refusal instanceof UnservedError ? refusal.module : '').toBe('events');
    expect(refusal instanceof Error ? refusal.message : '').toMatch(
      /^This part of the console has no server yet: the API it is connected to does not serve events\. Nothing was sent/,
    );
  });
});
