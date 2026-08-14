import type { EnvironmentProviders, Provider } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';

import {
  ASSISTANCE_REQUEST_REPOSITORY,
  DASHBOARD_REPOSITORY,
  DISBURSEMENT_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  REFERRAL_REPOSITORY,
  RESIDENT_REPOSITORY,
  SAVED_VIEW_REPOSITORY,
  STAFF_REPOSITORY,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import {
  HttpAssistanceRequestRepository,
  HttpDashboardRepository,
  HttpDisbursementRepository,
  HttpNotificationRepository,
  HttpProgramRepository,
  HttpReferralRepository,
  HttpResidentRepository,
  HttpSavedViewRepository,
  HttpStaffRepository,
} from './http/http-repositories';
import { MockAssistanceRequestRepository } from './mock/mock-assistance-request.repository';
import { MockDashboardRepository } from './mock/mock-dashboard.repository';
import { MockDisbursementRepository } from './mock/mock-disbursement.repository';
import { MockNotificationRepository } from './mock/mock-notification.repository';
import { MockProgramRepository } from './mock/mock-program.repository';
import { MockReferralRepository } from './mock/mock-referral.repository';
import { MockResidentRepository } from './mock/mock-resident.repository';
import { MockSavedViewRepository } from './mock/mock-saved-view.repository';
import { MockStaffRepository } from './mock/mock-staff.repository';

/**
 * THE MOCK/HTTP SEAM.
 *
 * This is the only place in the application that decides which adapters back
 * the domain ports. Nothing else may import from `data/mock` or `data/http`.
 * Flipping `environment.dataSource` swaps every repository at once.
 */
export function provideDataAccess(environment: AppEnvironment): EnvironmentProviders {
  const providers: Provider[] =
    environment.dataSource === 'http' ? httpProviders() : mockProviders();

  return makeEnvironmentProviders(providers);
}

function mockProviders(): Provider[] {
  return [
    { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
    { provide: PROGRAM_REPOSITORY, useClass: MockProgramRepository },
    { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: MockAssistanceRequestRepository },
    { provide: DISBURSEMENT_REPOSITORY, useClass: MockDisbursementRepository },
    { provide: REFERRAL_REPOSITORY, useClass: MockReferralRepository },
    { provide: STAFF_REPOSITORY, useClass: MockStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: MockDashboardRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: MockSavedViewRepository },
  ];
}

function httpProviders(): Provider[] {
  return [
    { provide: RESIDENT_REPOSITORY, useClass: HttpResidentRepository },
    { provide: PROGRAM_REPOSITORY, useClass: HttpProgramRepository },
    { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: HttpAssistanceRequestRepository },
    { provide: DISBURSEMENT_REPOSITORY, useClass: HttpDisbursementRepository },
    { provide: REFERRAL_REPOSITORY, useClass: HttpReferralRepository },
    { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: HttpNotificationRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: HttpDashboardRepository },
    { provide: SAVED_VIEW_REPOSITORY, useClass: HttpSavedViewRepository },
  ];
}
