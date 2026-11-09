import { PLATFORM_AUDIT_ACTIONS } from '@domain/platform-audit/platform-audit';

import OPENAPI from './contract/openapi.json';

// The API's own descriptions name the action an operation is audited as. A code the console has no
// words for reaches the app audit trail as "No description in this console for …", which is how
// office_event.corrected shipped (found while filming the November 2026 changes video). This catches
// every code the spec names; it cannot see an action the spec leaves undescribed.
describe('the app audit trail’s words', () => {
  it('has words for every action the API says an operation is audited as', () => {
    const named = new Set(
      [...JSON.stringify(OPENAPI).matchAll(/[Aa]udited as `?([a-z_]+\.[a-z_]+)`?/g)].map(
        (match) => match[1] ?? '',
      ),
    );

    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((code) => PLATFORM_AUDIT_ACTIONS[code] === undefined)).toEqual([]);
  });
});
