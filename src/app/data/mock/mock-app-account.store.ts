import { Injectable } from '@angular/core';

import type { AppAccount, AppAccountId } from '@domain/index';

import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';

/**
 * The residents' app accounts, in memory, shared by the two mock adapters that change them: users and
 * roles, and the ID review, whose in-person check verifies an account (`DL-219`). One store, so the
 * account list shows what a counter check did, as the server's one table would.
 */
@Injectable({ providedIn: 'root' })
export class MockAppAccountStore {
  private held: readonly AppAccount[] = MOCK_APP_ACCOUNTS;

  get accounts(): readonly AppAccount[] {
    return this.held;
  }

  find(id: AppAccountId): AppAccount | undefined {
    return this.held.find((account) => account.id === id);
  }

  save(account: AppAccount): AppAccount {
    this.held = this.held.map((candidate) => (candidate.id === account.id ? account : candidate));
    return account;
  }
}
