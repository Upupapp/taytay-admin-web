import { readApiError } from '@core/http/api-failure';
import { HttpErrorResponse } from '@angular/common/http';

import { fromServerIdentity } from '@domain/index';
import { toPage } from '../api.contract';

import ME from './me.json';
import STAFF_LIST from './staff-list.json';
import VALIDATION_FAILED from './validation-failed.json';
import UNAUTHENTICATED from './unauthenticated.json';
import MFA_REQUIRED from './sign-in-mfa-required.json';
import ENROLMENT_REQUIRED from './sign-in-enrolment-required.json';

/**
 * **Recorded responses, not hand-written fixtures.**
 *
 * TAB 05 step 10 asks for adapter tests against responses captured from a
 * running API — *"not hand-written fixtures, which drift toward what the author
 * expected"* — and until now that was impossible: nothing on this machine could
 * run the backend.
 *
 * These files are the real thing. The backend was migrated against a file
 * database, seeded, and served over HTTP on 18 August 2026; each payload here
 * was captured verbatim from `curl`. Bearer tokens and MFA challenges are the
 * only edits — replaced with `<redacted-…>` before entering the repository,
 * because a credential in a fixture is a credential in the repository.
 *
 * ## What they are not
 *
 * The database was **SQLite, not PostgreSQL**. Everything asserted here is about
 * the shape of a response, which does not vary by driver — but nothing about
 * concurrency, row locking or `lockForUpdate` is proven by any of it, and
 * release-gate blocker 4 stands untouched. The data is the seeded fictional
 * set: five households, thirteen residents.
 *
 * ## Why these six
 *
 * Each one is a divergence the sweep recorded, now checked against reality
 * rather than against the document that described it.
 */

describe('the error envelope, as the API actually sends it', () => {
  it('carries SCREAMING_SNAKE_CASE codes — F-08, verified on the wire', () => {
    /*
     * The whole of F-08 in one assertion. Before TAB 01 both generators
     * published the PHP case name, so `openapi.json` and `types.ts` declared
     * `ValidationFailed` while the wire carried `VALIDATION_FAILED`. Any client
     * that did what conventions.md §4 instructs — "branch on code" — matched
     * nothing, ever.
     */
    expect(VALIDATION_FAILED.error.code).toBe('VALIDATION_FAILED');
    expect(UNAUTHENTICATED.error.code).toBe('UNAUTHENTICATED');
  });

  it('is parsed by readApiError, field for field', () => {
    const failure = readApiError(
      new HttpErrorResponse({ error: VALIDATION_FAILED, status: 422, statusText: 'Unprocessable Content' }),
    );

    expect(failure.code).toBe('VALIDATION_FAILED');
    expect(failure.message).toBe('The given data was invalid.');
    expect(failure.requestId).toBe(VALIDATION_FAILED.error.request_id);
  });

  it('gives a form its field errors, which the old contract dropped', () => {
    // D6: the console previously looked for `{ message }`, so every failure
    // rendered "The server responded with 422" and `details` never reached a
    // form.
    const failure = readApiError(
      new HttpErrorResponse({ error: VALIDATION_FAILED, status: 422, statusText: 'Unprocessable Content' }),
    );

    expect(failure.details).toEqual({
      email: ['The email field is required.'],
      password: ['The password field is required.'],
    });
  });
});

describe('the success envelope, as the API actually sends it', () => {
  it('paginates under meta.pagination with all five keys — D4', () => {
    /*
     * The console read `meta.{page,pageSize,totalItems,totalPages}`. Not one of
     * those exists in this response. Every list would have rendered as a single
     * empty page while `toPage()` read `undefined` four times, and nothing would
     * have failed loudly.
     *
     * `has_more` is here because TAB 01 added it to the published contract after
     * finding it was served and documented by neither artefact.
     */
    expect(STAFF_LIST.meta.pagination).toEqual({
      page: 1,
      per_page: 2,
      total: 1,
      total_pages: 1,
      has_more: false,
    });
  });

  it('is mapped into the domain page by toPage', () => {
    const page = toPage(STAFF_LIST as never);

    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.totalItems).toBe(1);
    expect(page.totalPages).toBe(1);
  });

  it('honoured per_page, which is the parameter name the API reads — D5', () => {
    // `?per_page=2` was sent and echoed back. The console used to send
    // `pageSize`, which this API ignores, so every list silently fell back to
    // the server default of 25.
    expect(STAFF_LIST.meta.pagination.per_page).toBe(2);
  });

  it('carries a request_id on success as well as on failure', () => {
    expect(typeof STAFF_LIST.meta.request_id).toBe('string');
  });
});

describe('GET /me — the identity TAB 03 renders from', () => {
  it('resolves permissions server-side', () => {
    // The console no longer computes these. This is the API's own answer about
    // what this actor may do.
    expect(Array.isArray(ME.data.permissions)).toBe(true);
    expect(ME.data.permissions).toContain('staff.view');
  });

  it('is ingested by fromServerIdentity, granting exactly what was sent', () => {
    const user = fromServerIdentity({
      id: ME.data.id as never,
      displayName: ME.data.display_name,
      email: ME.data.email,
      roles: ME.data.roles,
      roleLabel: 'Staff',
      position: '',
      barangayId: null,
      scope: 'assigned-cases',
      permissions: ME.data.permissions,
    });

    expect([...user.permissions].sort()).toEqual(['staff.manage', 'staff.view']);
    expect(user.unknownPermissions).toEqual([]);
  });

  it('does not carry a position, a barangay or a scope', () => {
    /*
     * Which is why `fromServerIdentity` defaults the scope to the **narrowest**
     * value rather than the widest. That choice was made before this payload was
     * ever seen, and this is the response that confirms it was necessary: a
     * mapper that defaulted to `all-barangays` would widen every actor's reach
     * on the strength of a field the server never sends.
     */
    expect('position' in ME.data).toBe(false);
    expect('barangay_id' in ME.data).toBe(false);
    expect('scope' in ME.data).toBe(false);
  });
});

describe('sign-in, as the API actually answers it', () => {
  it('answers mfa-enrolment-required for a staff account with no second factor', () => {
    /*
     * The TAB 02 fix, captured from the wire. Before it, this exact request
     * returned `201` and a full twelve-hour staff session on a password alone,
     * because sign-in read `requiresMultiFactor() && confirmedTotpFactor() !== null`.
     *
     * The token in this response is real but restricted: against the running
     * API it was refused `403 FORBIDDEN` on `admin/residents` and accepted on
     * `me/mfa`.
     */
    expect(ENROLMENT_REQUIRED.data.status).toBe('mfa-enrolment-required');
    expect(ENROLMENT_REQUIRED.data.token_type).toBe('Bearer');
  });

  it('answers 200 with a challenge once a factor is enrolled, not 401', () => {
    // The password was correct, so it is deliberately not an authentication
    // failure — the client must present a second factor against this challenge.
    expect(MFA_REQUIRED.data.status).toBe('mfa-required');
    expect(MFA_REQUIRED.data.expires_in_minutes).toBe(5);
  });

  it('carries no credential into the repository', () => {
    // A recorded fixture is still a file in a public repository.
    const serialised = JSON.stringify([ENROLMENT_REQUIRED, MFA_REQUIRED]);

    expect(serialised).toContain('<redacted-token>');
    expect(serialised).not.toMatch(/\d+\|[A-Za-z0-9]{20,}/);
  });
});
