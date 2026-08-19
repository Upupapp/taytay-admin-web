import type { EnvironmentProviders } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';

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
  STAFF_REPOSITORY,
} from '@domain/index';

import {
  HttpAssistanceRequestRepository,
  HttpBeneficiaryRepository,
  HttpCaseRepository,
  HttpDashboardRepository,
  HttpReportRepository,
  HttpGovernanceRepository,
  HttpEventRepository,
  HttpNewsfeedRepository,
  HttpSearchRepository,
  HttpWorkRepository,
  HttpReleaseRepository,
  HttpFieldVisitRepository,
  HttpFamilyRepository,
  HttpHouseholdRepository,
  HttpNotificationRepository,
  HttpProgramRepository,
  HttpReferralRepository,
  HttpResidentRepository,
  HttpSavedViewRepository,
  HttpStaffRepository,
} from './http/http-repositories';
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
 */

export function provideDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RESIDENT_REPOSITORY, useClass: HttpResidentRepository },
    { provide: PROGRAM_REPOSITORY, useClass: HttpProgramRepository },
    { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: HttpAssistanceRequestRepository },
    { provide: RELEASE_REPOSITORY, useClass: HttpReleaseRepository },
    { provide: REFERRAL_REPOSITORY, useClass: HttpReferralRepository },
    { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: HttpNotificationRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: HttpDashboardRepository },
    { provide: WORK_REPOSITORY, useClass: HttpWorkRepository },
    { provide: REPORT_REPOSITORY, useClass: HttpReportRepository },
    { provide: SEARCH_REPOSITORY, useClass: HttpSearchRepository },
    { provide: GOVERNANCE_REPOSITORY, useClass: HttpGovernanceRepository },
    { provide: NEWSFEED_REPOSITORY, useClass: HttpNewsfeedRepository },
    { provide: EVENT_REPOSITORY, useClass: HttpEventRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: HttpSavedViewRepository },
    { provide: HOUSEHOLD_REPOSITORY, useClass: HttpHouseholdRepository },
    { provide: FAMILY_REPOSITORY, useClass: HttpFamilyRepository },
    { provide: CASE_REPOSITORY, useClass: HttpCaseRepository },
    { provide: BENEFICIARY_REPOSITORY, useClass: HttpBeneficiaryRepository },
    { provide: FIELD_VISIT_REPOSITORY, useClass: HttpFieldVisitRepository },
  ]);
}
