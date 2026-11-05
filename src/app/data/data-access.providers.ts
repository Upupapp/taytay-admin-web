import type { EnvironmentProviders } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';

import { SESSION_REFRESHER } from '@core/auth/session-refresher';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  BENEFICIARY_REPOSITORY,
  CASE_REPOSITORY,
  DASHBOARD_REPOSITORY,
  REPORT_REPOSITORY,
  GOVERNANCE_REPOSITORY,
  EVENT_REPOSITORY,
  NEWSFEED_REPOSITORY,
  SEARCH_REPOSITORY,
  WORK_REPOSITORY,
  RELEASE_REPOSITORY,
  FIELD_VISIT_REPOSITORY,
  FAMILY_REPOSITORY,
  HOUSEHOLD_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  REFERRAL_REPOSITORY,
  RESIDENT_REPOSITORY,
  SAVED_VIEW_REPOSITORY,
  SIGN_IN_METHOD,
  STAFF_REPOSITORY,
} from '@domain/index';

import {
  HttpNotificationRepository,
  HttpSessionRefresher,
  HttpStaffRepository,
} from './http/http-repositories';
import { identitySignInMethod } from './http/identity/identity.provider';
import {
  UnservedAssistanceRequestRepository,
  UnservedBeneficiaryRepository,
  UnservedCaseRepository,
  UnservedDashboardRepository,
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
} from './http/unserved-repositories';
/**
 * THE MOCK/HTTP SEAM — the HTTP half.
 *
 * ## Why this is a file replacement rather than an `if`
 *
 * It used to be one module holding both adapter sets, chosen by
 * `environment.dataSource === 'http' ? httpProviders() : mockProviders()`.
 *
 * That is a **runtime** decision over **static** imports, so every mock repository — and through
 * them the whole seed registry — stayed reachable from a live import and shipped in the production
 * bundle. `check:bundle` found it on its first run: `Marilou`, `Bautista family`, invented
 * residents in an artefact that claims to be production.
 *
 * The seeds are fictional, so this was not a privacy breach. It was worse in a quieter way: a
 * production build carrying a registry-shaped payload a reader could mistake for real, and the
 * mock reaching a build that says it is production — the misconfiguration `check:environments`
 * exists to prevent, arriving through a different door.
 *
 * Tree-shaking *usually* removes it. It stops doing so when a seed module gains a side effect, a
 * barrel re-exports it, or a build flag changes — none of which produce an error. TAB 12 is
 * explicit that an assumption is not a guarantee, so the guarantee is now structural: this file
 * names no mock class at all, and `angular.json` swaps in `data-access.providers.mock.ts` for the
 * one configuration that wants them.
 *
 * ## Two ports served, eighteen unserved
 *
 * The Node API serves the signed-in account and its inbox and nothing else this console has a port
 * for (`DL-164`). Every other port is bound to an `Unserved…` adapter that makes no request and
 * fails with a sentence saying so (`DL-165`). A port moves from that list to an `Http…` adapter
 * only when the API serves the thing the port names — not something with the same word on it.
 */

export function provideDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RESIDENT_REPOSITORY, useClass: UnservedResidentRepository },
    { provide: PROGRAM_REPOSITORY, useClass: UnservedProgramRepository },
    { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: UnservedAssistanceRequestRepository },
    { provide: RELEASE_REPOSITORY, useClass: UnservedReleaseRepository },
    { provide: REFERRAL_REPOSITORY, useClass: UnservedReferralRepository },
    { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: HttpNotificationRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: UnservedDashboardRepository },
    { provide: WORK_REPOSITORY, useClass: UnservedWorkRepository },
    { provide: REPORT_REPOSITORY, useClass: UnservedReportRepository },
    { provide: SEARCH_REPOSITORY, useClass: UnservedSearchRepository },
    { provide: GOVERNANCE_REPOSITORY, useClass: UnservedGovernanceRepository },
    { provide: NEWSFEED_REPOSITORY, useClass: UnservedNewsfeedRepository },
    { provide: EVENT_REPOSITORY, useClass: UnservedEventRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: UnservedSavedViewRepository },
    { provide: HOUSEHOLD_REPOSITORY, useClass: UnservedHouseholdRepository },
    { provide: FAMILY_REPOSITORY, useClass: UnservedFamilyRepository },
    { provide: CASE_REPOSITORY, useClass: UnservedCaseRepository },
    { provide: BENEFICIARY_REPOSITORY, useClass: UnservedBeneficiaryRepository },
    { provide: FIELD_VISIT_REPOSITORY, useClass: UnservedFieldVisitRepository },
    // Sign-in (`DL-166`): which identity provider answers is decided by which file angular.json
    // swapped in — Firebase, or the development verifier for `local-api` — never by a runtime flag.
    { provide: SIGN_IN_METHOD, useFactory: identitySignInMethod },
    { provide: SESSION_REFRESHER, useClass: HttpSessionRefresher },
  ]);
}
