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
  UNSERVED_PORTS,
  VERIFICATION_REPOSITORY,
  OFFICE_INBOX_REPOSITORY,
  OFFICE_REPOSITORY,
  APP_ACCOUNT_REPOSITORY,
  DIRECTORY_OFFICE_REPOSITORY,
  HOME_SCREEN_REPOSITORY,
  APP_CONFIG_REPOSITORY,
  DIGITAL_ID_REPOSITORY,
  BALITA_REPOSITORY,
  PLATFORM_AUDIT_REPOSITORY,
  HOTLINE_REPOSITORY,
  TULONG_SERVICE_REPOSITORY,
  ISSUANCE_REPOSITORY,
  RESIDENT_IMPORT_REPOSITORY,
  SECTOR_APPLICATION_REPOSITORY,
} from '@domain/index';

import {
  HttpAppAccountRepository,
  HttpCaseRepository,
  HttpBeneficiaryRepository,
  HttpDashboardRepository,
  HttpReleaseRepository,
  HttpReferralRepository,
  HttpFieldVisitRepository,
  HttpDirectoryOfficeRepository,
  HttpHomeScreenRepository,
  HttpAppConfigRepository,
  HttpDigitalIdRepository,
  HttpBalitaRepository,
  HttpPlatformAuditRepository,
  HttpResidentRepository,
  HttpFamilyRepository,
  HttpHouseholdRepository,
  HttpAssistanceRequestRepository,
  HttpProgramRepository,
  HttpSavedViewRepository,
  HttpHotlineRepository,
  HttpTulongServiceRepository,
  HttpNotificationRepository,
  HttpOfficeInboxRepository,
  HttpOfficeRepository,
  HttpSessionRefresher,
  HttpStaffRepository,
  HttpVerificationRepository,
  HttpIssuanceRepository,
  HttpResidentImportRepository,
  HttpSectorApplicationRepository,
  HttpGovernanceRepository,
  HttpEventRepository,
  HttpReportRepository,
  HttpSearchRepository,
  HttpWorkRepository,
} from './http/http-repositories';
import { identitySignInMethod } from './http/identity/identity.provider';
import { UNSERVED_HTTP_PORTS } from './http/unserved-repositories';
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
 * ## Every port served
 *
 * The Node API serves the signed-in account, its inbox, residents' ID verification review
 * (`DL-167`), the office inbox, the office directory and app accounts with their roles (`DL-168`),
 * the directory as an administrator keeps it, Tulong pages, hotlines, the home screen and the
 * app's settings (`DL-170`), residents’ digital IDs, Balita and the API's audit trail (`DL-171`),
 * the office's resident registry (`DL-174`), its household register, families and saved views
 * (casework phase 1c), its programme catalogue (`DL-176`), assistance requests (`DL-177`,
 * `DL-178`), cases (`DL-179`), releases (`DL-180`), referrals and field visits (`DL-181`), the
 * dashboard (`DL-182`), residents’ document requests with their catalogue (`DL-184`), the
 * beneficiary registry (`DL-187`), search and the work queues (`DL-189`), reports (`DL-190`), and
 * governance — staff accounts, the office's audit trail and data policy (`DL-191`) — and events,
 * the office's side of the residents' registrations (`DL-192`) — every port this console has. The
 * newsfeed, the last port bound to an `Unserved…` adapter, was retired with its screens in favour
 * of Balita (`DL-194`), so `UNSERVED_HTTP_PORTS` is empty. The mechanism stays (`DL-165`,
 * `DL-167`): a port the API does not serve is bound to an `Unserved…` adapter that makes no request
 * and fails with a sentence saying so, and moves to an `Http…` adapter only when the API serves the
 * thing the port names — not something with the same word on it.
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
    { provide: VERIFICATION_REPOSITORY, useClass: HttpVerificationRepository },
    { provide: OFFICE_INBOX_REPOSITORY, useClass: HttpOfficeInboxRepository },
    { provide: OFFICE_REPOSITORY, useClass: HttpOfficeRepository },
    { provide: APP_ACCOUNT_REPOSITORY, useClass: HttpAppAccountRepository },
    { provide: DIRECTORY_OFFICE_REPOSITORY, useClass: HttpDirectoryOfficeRepository },
    { provide: TULONG_SERVICE_REPOSITORY, useClass: HttpTulongServiceRepository },
    { provide: HOTLINE_REPOSITORY, useClass: HttpHotlineRepository },
    { provide: HOME_SCREEN_REPOSITORY, useClass: HttpHomeScreenRepository },
    { provide: APP_CONFIG_REPOSITORY, useClass: HttpAppConfigRepository },
    { provide: DIGITAL_ID_REPOSITORY, useClass: HttpDigitalIdRepository },
    { provide: BALITA_REPOSITORY, useClass: HttpBalitaRepository },
    { provide: PLATFORM_AUDIT_REPOSITORY, useClass: HttpPlatformAuditRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: HttpDashboardRepository },
    { provide: WORK_REPOSITORY, useClass: HttpWorkRepository },
    { provide: REPORT_REPOSITORY, useClass: HttpReportRepository },
    { provide: SEARCH_REPOSITORY, useClass: HttpSearchRepository },
    { provide: GOVERNANCE_REPOSITORY, useClass: HttpGovernanceRepository },
    { provide: EVENT_REPOSITORY, useClass: HttpEventRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: HttpSavedViewRepository },
    { provide: HOUSEHOLD_REPOSITORY, useClass: HttpHouseholdRepository },
    { provide: FAMILY_REPOSITORY, useClass: HttpFamilyRepository },
    { provide: CASE_REPOSITORY, useClass: HttpCaseRepository },
    { provide: BENEFICIARY_REPOSITORY, useClass: HttpBeneficiaryRepository },
    { provide: FIELD_VISIT_REPOSITORY, useClass: HttpFieldVisitRepository },
    { provide: ISSUANCE_REPOSITORY, useClass: HttpIssuanceRepository },
    { provide: RESIDENT_IMPORT_REPOSITORY, useClass: HttpResidentImportRepository },
    { provide: SECTOR_APPLICATION_REPOSITORY, useClass: HttpSectorApplicationRepository },
    // Which of the above make no request, said once for the navigation and the routes (`DL-167`):
    // a module that cannot be served leaves the menu, and its address explains why.
    { provide: UNSERVED_PORTS, useValue: UNSERVED_HTTP_PORTS },
    // Sign-in (`DL-166`): which identity provider answers is decided by which file angular.json
    // swapped in — Firebase, or the development verifier for `local-api` — never by a runtime flag.
    { provide: SIGN_IN_METHOD, useFactory: identitySignInMethod },
    { provide: SESSION_REFRESHER, useClass: HttpSessionRefresher },
  ]);
}
