import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  isOwnAccount,
  takesAnOffice,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type AppAccountRepository,
  type CursorPage,
  type CursorRequest,
  type OfficeId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { MOCK_OFFICES } from './seed/offices.seed';

/** The API's own ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

/**
 * Residents' app accounts, in memory (`DL-168`), refusing the way the API does.
 *
 * - Cursor-paged with no total, newest first as the seed is written — the shape
 *   `HttpAppAccountRepository` answers.
 * - A change to the signed-in account's own role is refused, as the API refuses it with `403`.
 * - An office for an account that is not staff, or an office that does not exist, is refused, as the
 *   API refuses it with `422`. The office link survives a role change, as it does on the server.
 * - Each act re-checks its own key. Hiding the screen is not protection (rule 4).
 */
@Injectable()
export class MockAppAccountRepository implements AppAccountRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private accounts: readonly AppAccount[] = MOCK_APP_ACCOUNTS;

  list(page: CursorRequest): Observable<CursorPage<AppAccount>> {
    const denied = denyUnless<CursorPage<AppAccount>>(this.access.currentUser(), 'user.view');
    if (denied) {
      return denied;
    }
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const limit = Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const end = start + limit;
    const hasMore = end < this.accounts.length;

    return this.latency.respond({
      items: this.accounts.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  changeRole(id: AppAccountId, role: AccountRole): Observable<AppAccount> {
    const user = this.access.currentUser();
    const denied = denyUnless<AppAccount>(user, 'user.change-role');
    if (denied) {
      return denied;
    }
    const account = this.accounts.find((candidate) => candidate.id === id);
    if (account === undefined) {
      return throwError(() => new Error('That user was not found.'));
    }
    if (isOwnAccount(account, user === null ? null : String(user.id))) {
      return throwError(() => new Error('You cannot change your own role.'));
    }
    return this.save({ ...account, role });
  }

  assignOffice(id: AppAccountId, office: OfficeId | null): Observable<AppAccount> {
    const denied = denyUnless<AppAccount>(this.access.currentUser(), 'user.assign-office');
    if (denied) {
      return denied;
    }
    const account = this.accounts.find((candidate) => candidate.id === id);
    if (account === undefined) {
      return throwError(() => new Error('That user was not found.'));
    }
    if (office !== null && !takesAnOffice(account)) {
      return throwError(() => new Error('Only a staff account can be linked to an office.'));
    }
    if (office !== null && !MOCK_OFFICES.some((candidate) => candidate.id === office)) {
      return throwError(() => new Error('That office was not found.'));
    }
    return this.save({ ...account, officeId: office });
  }

  private save(account: AppAccount): Observable<AppAccount> {
    this.accounts = this.accounts.map((candidate) =>
      candidate.id === account.id ? account : candidate,
    );
    return this.latency.respond(account);
  }
}
