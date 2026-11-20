import type { EnvironmentProviders } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';

import { SESSION_REFRESHER } from '@core/auth/session-refresher';
import { CHANGE_FEED } from '@core/live/change-feed';
import { UNSERVED_PORTS } from '@domain/ports/data-ports';
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
  STAFF_REPOSITORY,
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
  ASSISTANCE_IMPORT_REPOSITORY,
  SECTOR_APPLICATION_REPOSITORY,
} from '@domain/ports/repositories';
import { SIGN_IN_METHOD } from '@domain/ports/sign-in-method';

import { lazyPort } from './http/lazy-port';
import { HttpStaffRepository } from './http/staff-repository';
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
 *
 * ## Fetched on the first question (`DL-224`)
 *
 * Every port but the staff one is bound through `lazyPort`, so its adapter is downloaded the first
 * time a screen asks it something rather than before the sign-in screen can paint. A `useClass`
 * here would put that adapter — and, because a module is bundled whole, every adapter — back in the
 * first download.
 */

export function provideDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RESIDENT_REPOSITORY, useFactory: lazyPort((m) => m.HttpResidentRepository) },
    { provide: PROGRAM_REPOSITORY, useFactory: lazyPort((m) => m.HttpProgramRepository) },
    {
      provide: ASSISTANCE_REQUEST_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpAssistanceRequestRepository),
    },
    { provide: RELEASE_REPOSITORY, useFactory: lazyPort((m) => m.HttpReleaseRepository) },
    { provide: REFERRAL_REPOSITORY, useFactory: lazyPort((m) => m.HttpReferralRepository) },
    // Eager, alone (`DL-224`): the session is asked for before the first screen. Every other
    // adapter is fetched on its port's first question, so the sign-in screen does not wait for it.
    { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useFactory: lazyPort((m) => m.HttpNotificationRepository) },
    { provide: VERIFICATION_REPOSITORY, useFactory: lazyPort((m) => m.HttpVerificationRepository) },
    { provide: OFFICE_INBOX_REPOSITORY, useFactory: lazyPort((m) => m.HttpOfficeInboxRepository) },
    { provide: OFFICE_REPOSITORY, useFactory: lazyPort((m) => m.HttpOfficeRepository) },
    { provide: APP_ACCOUNT_REPOSITORY, useFactory: lazyPort((m) => m.HttpAppAccountRepository) },
    {
      provide: DIRECTORY_OFFICE_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpDirectoryOfficeRepository),
    },
    {
      provide: TULONG_SERVICE_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpTulongServiceRepository),
    },
    { provide: HOTLINE_REPOSITORY, useFactory: lazyPort((m) => m.HttpHotlineRepository) },
    { provide: HOME_SCREEN_REPOSITORY, useFactory: lazyPort((m) => m.HttpHomeScreenRepository) },
    { provide: APP_CONFIG_REPOSITORY, useFactory: lazyPort((m) => m.HttpAppConfigRepository) },
    { provide: DIGITAL_ID_REPOSITORY, useFactory: lazyPort((m) => m.HttpDigitalIdRepository) },
    { provide: BALITA_REPOSITORY, useFactory: lazyPort((m) => m.HttpBalitaRepository) },
    {
      provide: PLATFORM_AUDIT_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpPlatformAuditRepository),
    },
    { provide: DASHBOARD_REPOSITORY, useFactory: lazyPort((m) => m.HttpDashboardRepository) },
    { provide: WORK_REPOSITORY, useFactory: lazyPort((m) => m.HttpWorkRepository) },
    { provide: REPORT_REPOSITORY, useFactory: lazyPort((m) => m.HttpReportRepository) },
    { provide: SEARCH_REPOSITORY, useFactory: lazyPort((m) => m.HttpSearchRepository) },
    { provide: GOVERNANCE_REPOSITORY, useFactory: lazyPort((m) => m.HttpGovernanceRepository) },
    { provide: EVENT_REPOSITORY, useFactory: lazyPort((m) => m.HttpEventRepository) },
    { provide: SAVED_VIEW_REPOSITORY, useFactory: lazyPort((m) => m.HttpSavedViewRepository) },
    { provide: HOUSEHOLD_REPOSITORY, useFactory: lazyPort((m) => m.HttpHouseholdRepository) },
    { provide: FAMILY_REPOSITORY, useFactory: lazyPort((m) => m.HttpFamilyRepository) },
    { provide: CASE_REPOSITORY, useFactory: lazyPort((m) => m.HttpCaseRepository) },
    { provide: BENEFICIARY_REPOSITORY, useFactory: lazyPort((m) => m.HttpBeneficiaryRepository) },
    { provide: FIELD_VISIT_REPOSITORY, useFactory: lazyPort((m) => m.HttpFieldVisitRepository) },
    { provide: ISSUANCE_REPOSITORY, useFactory: lazyPort((m) => m.HttpIssuanceRepository) },
    {
      provide: RESIDENT_IMPORT_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpResidentImportRepository),
    },
    {
      provide: ASSISTANCE_IMPORT_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpAssistanceImportRepository),
    },
    {
      provide: SECTOR_APPLICATION_REPOSITORY,
      useFactory: lazyPort((m) => m.HttpSectorApplicationRepository),
    },
    // Which of the above make no request, said once for the navigation and the routes (`DL-167`):
    // a module that cannot be served leaves the menu, and its address explains why.
    { provide: UNSERVED_PORTS, useValue: UNSERVED_HTTP_PORTS },
    // Sign-in (`DL-166`): which identity provider answers is decided by which file angular.json
    // swapped in — Firebase, or the development verifier for `local-api` — never by a runtime flag.
    { provide: SIGN_IN_METHOD, useFactory: identitySignInMethod },
    { provide: SESSION_REFRESHER, useFactory: lazyPort((m) => m.HttpSessionRefresher) },
    // Live updates (`DL-222`): only the API can push a hint, so the mock set binds nothing and the
    // console there is simply not live.
    { provide: CHANGE_FEED, useFactory: lazyPort((m) => m.HttpChangeFeed) },
  ]);
}
