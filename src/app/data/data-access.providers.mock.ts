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
} from '@domain/index';

import { MockAssistanceRequestRepository } from './mock/mock-assistance-request.repository';
import { MockBeneficiaryRepository } from './mock/mock-beneficiary.repository';
import { MockCaseRepository } from './mock/mock-case.repository';
import { MockDashboardRepository } from './mock/mock-dashboard.repository';
import { MockReportRepository } from './mock/mock-report.repository';
import { MockGovernanceRepository } from './mock/mock-governance.repository';
import { MockEventRepository } from './mock/mock-event.repository';
import { MockNewsfeedRepository } from './mock/mock-newsfeed.repository';
import { MockSearchRepository } from './mock/mock-search.repository';
import { MockWorkRepository } from './mock/mock-work.repository';
import { MockReleaseRepository } from './mock/mock-release.repository';
import { MockFieldVisitRepository } from './mock/mock-field-visit.repository';
import { MockFamilyRepository } from './mock/mock-family.repository';
import { MockHouseholdRepository } from './mock/mock-household.repository';
import { MockNotificationRepository } from './mock/mock-notification.repository';
import { MockProgramRepository } from './mock/mock-program.repository';
import { MockReferralRepository } from './mock/mock-referral.repository';
import { MockResidentRepository } from './mock/mock-resident.repository';
import { MockSavedViewRepository } from './mock/mock-saved-view.repository';
import { MockStaffRepository } from './mock/mock-staff.repository';
import { MockVerificationRepository } from './mock/mock-verification.repository';
import { MockOfficeInboxRepository } from './mock/mock-office-inbox.repository';
import { MockOfficeRepository } from './mock/mock-office.repository';
import { MockAppAccountRepository } from './mock/mock-app-account.repository';
import {
  MockDirectoryOfficeRepository,
  MockHotlineRepository,
  MockTulongServiceRepository,
} from './mock/mock-directory.repositories';
import { MockHomeScreenRepository } from './mock/mock-home-screen.repository';
import { MockAppConfigRepository } from './mock/mock-app-config.repository';
import { MockDigitalIdRepository } from './mock/mock-digital-id.repository';
import { MockBalitaRepository } from './mock/mock-balita.repository';
import { MockPlatformAuditRepository } from './mock/mock-platform-audit.repository';

/**
 * THE MOCK/HTTP SEAM — the mock half.
 *
 * Swapped in by `angular.json` for the `development` (local-mock) configuration only. See
 * `data-access.providers.ts` for why the choice is a file replacement rather than a runtime `if`.
 *
 * Kept rather than deleted (`DL-136`): this is the offline path and the fast feature-test double.
 * What it must never be is reachable from a production build, which is now structural — a
 * production build never imports this file, and `check:bundle` inspects the artefact to prove it.
 */
export function provideDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
    { provide: PROGRAM_REPOSITORY, useClass: MockProgramRepository },
    { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: MockAssistanceRequestRepository },
    { provide: RELEASE_REPOSITORY, useClass: MockReleaseRepository },
    { provide: REFERRAL_REPOSITORY, useClass: MockReferralRepository },
    { provide: STAFF_REPOSITORY, useClass: MockStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: MockDashboardRepository },
    { provide: WORK_REPOSITORY, useClass: MockWorkRepository },
    { provide: REPORT_REPOSITORY, useClass: MockReportRepository },
    { provide: SEARCH_REPOSITORY, useClass: MockSearchRepository },
    { provide: GOVERNANCE_REPOSITORY, useClass: MockGovernanceRepository },
    { provide: NEWSFEED_REPOSITORY, useClass: MockNewsfeedRepository },
    { provide: EVENT_REPOSITORY, useClass: MockEventRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: MockSavedViewRepository },
    { provide: HOUSEHOLD_REPOSITORY, useClass: MockHouseholdRepository },
    { provide: FAMILY_REPOSITORY, useClass: MockFamilyRepository },
    { provide: CASE_REPOSITORY, useClass: MockCaseRepository },
    { provide: BENEFICIARY_REPOSITORY, useClass: MockBeneficiaryRepository },
    { provide: FIELD_VISIT_REPOSITORY, useClass: MockFieldVisitRepository },
    { provide: VERIFICATION_REPOSITORY, useClass: MockVerificationRepository },
    { provide: OFFICE_INBOX_REPOSITORY, useClass: MockOfficeInboxRepository },
    { provide: OFFICE_REPOSITORY, useClass: MockOfficeRepository },
    { provide: APP_ACCOUNT_REPOSITORY, useClass: MockAppAccountRepository },
    { provide: DIRECTORY_OFFICE_REPOSITORY, useClass: MockDirectoryOfficeRepository },
    { provide: TULONG_SERVICE_REPOSITORY, useClass: MockTulongServiceRepository },
    { provide: HOTLINE_REPOSITORY, useClass: MockHotlineRepository },
    { provide: HOME_SCREEN_REPOSITORY, useClass: MockHomeScreenRepository },
    { provide: APP_CONFIG_REPOSITORY, useClass: MockAppConfigRepository },
    { provide: DIGITAL_ID_REPOSITORY, useClass: MockDigitalIdRepository },
    { provide: BALITA_REPOSITORY, useClass: MockBalitaRepository },
    { provide: PLATFORM_AUDIT_REPOSITORY, useClass: MockPlatformAuditRepository },
    // The mock serves every port, and says so rather than leaving the token unbound (`DL-167`).
    { provide: UNSERVED_PORTS, useValue: [] },
  ]);
}
