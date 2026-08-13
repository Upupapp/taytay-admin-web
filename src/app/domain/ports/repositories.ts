import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AssistanceRequest,
  AssistanceRequestFilter,
  AssistanceRequestSortField,
  AssistanceRequestStatus,
  CaseNote,
} from '../assistance/assistance-request';
import type { AuthenticatedUser, StaffFilter, StaffUser } from '../access/staff-user';
import type { AppNotification, NotificationRequest } from '../notifications/notification';
import type { AssistanceProgram, ProgramFilter } from '../programs/program';
import type { DashboardSummary } from '../dashboard/dashboard-summary';
import type { Disbursement, DisbursementFilter } from '../disbursements/disbursement';
import type { Household, Resident, ResidentFilter, ResidentSortField } from '../residents/resident';
import type { Referral, ReferralFilter } from '../referrals/referral';
import type { Page, PageRequest } from '../shared/pagination';
import type {
  AssistanceRequestId,
  DisbursementId,
  HouseholdId,
  NotificationId,
  ProgramId,
  ReferralId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';

/**
 * Ports (hexagonal boundary).
 *
 * Feature code depends on these interfaces and their injection tokens only.
 * `src/app/data/mock` and `src/app/data/http` provide interchangeable adapters;
 * swapping one for the other must never require touching a component.
 */

export interface ResidentRepository {
  list(filter: ResidentFilter, page: PageRequest<ResidentSortField>): Observable<Page<Resident>>;
  getById(id: ResidentId): Observable<Resident | null>;
  getHousehold(id: HouseholdId): Observable<Household | null>;
}

export const RESIDENT_REPOSITORY = new InjectionToken<ResidentRepository>('ResidentRepository');

export interface ProgramRepository {
  list(filter: ProgramFilter, page: PageRequest): Observable<Page<AssistanceProgram>>;
  getById(id: ProgramId): Observable<AssistanceProgram | null>;
  listActive(): Observable<readonly AssistanceProgram[]>;
}

export const PROGRAM_REPOSITORY = new InjectionToken<ProgramRepository>('ProgramRepository');

export interface AssistanceRequestRepository {
  list(
    filter: AssistanceRequestFilter,
    page: PageRequest<AssistanceRequestSortField>,
  ): Observable<Page<AssistanceRequest>>;
  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null>;
  listNotes(id: AssistanceRequestId): Observable<readonly CaseNote[]>;
  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest>;
}

export const ASSISTANCE_REQUEST_REPOSITORY = new InjectionToken<AssistanceRequestRepository>(
  'AssistanceRequestRepository',
);

export interface DisbursementRepository {
  list(filter: DisbursementFilter, page: PageRequest): Observable<Page<Disbursement>>;
  getById(id: DisbursementId): Observable<Disbursement | null>;
  listForRequest(id: AssistanceRequestId): Observable<readonly Disbursement[]>;
}

export const DISBURSEMENT_REPOSITORY = new InjectionToken<DisbursementRepository>(
  'DisbursementRepository',
);

export interface ReferralRepository {
  list(filter: ReferralFilter, page: PageRequest): Observable<Page<Referral>>;
  getById(id: ReferralId): Observable<Referral | null>;
}

export const REFERRAL_REPOSITORY = new InjectionToken<ReferralRepository>('ReferralRepository');

export interface StaffRepository {
  list(filter: StaffFilter, page: PageRequest): Observable<Page<StaffUser>>;
  getById(id: StaffUserId): Observable<StaffUser | null>;
  /** Resolves the signed-in identity, or `null` when there is no session. */
  currentUser(): Observable<AuthenticatedUser | null>;
  signInAs(id: StaffUserId): Observable<AuthenticatedUser>;
  signOut(): Observable<void>;
}

export const STAFF_REPOSITORY = new InjectionToken<StaffRepository>('StaffRepository');

export interface NotificationRepository {
  listForCurrentUser(): Observable<readonly AppNotification[]>;
  create(request: NotificationRequest): Observable<AppNotification>;
  markRead(id: NotificationId): Observable<AppNotification>;
  markAllRead(): Observable<readonly AppNotification[]>;
}

export const NOTIFICATION_REPOSITORY = new InjectionToken<NotificationRepository>(
  'NotificationRepository',
);

export interface DashboardRepository {
  summary(): Observable<DashboardSummary>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
