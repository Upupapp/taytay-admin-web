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
  ]);
}
