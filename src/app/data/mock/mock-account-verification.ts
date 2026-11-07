import type { AccountRole, AccountVerificationStatus, AppAccountId } from '@domain/index';

import { MOCK_VERIFICATION_REQUESTS } from './seed/verification-requests.seed';

/**
 * An app account's verification standing in the `local-mock` configuration: a verified account is
 * verified; otherwise its latest ID review says, and none means unverified.
 *
 * One reading for the dashboard's figures and the account list's filter, so a figure and the list
 * it opens cannot disagree in the demo either (`DL-186`).
 */
export function mockVerificationOf(
  accountId: AppAccountId,
  role: AccountRole,
): AccountVerificationStatus {
  if (role === 'verified') {
    return 'verified';
  }
  const latest = MOCK_VERIFICATION_REQUESTS.filter((request) => request.accountId === accountId)
    .slice()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  switch (latest?.status) {
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'approved':
      return 'verified';
    case undefined:
      return 'unverified';
  }
}
