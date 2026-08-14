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
import type { SignInCredentials } from '../access/credentials';
import type { AppNotification, NotificationRequest } from '../notifications/notification';
import type { AssistanceProgram, ProgramFilter } from '../programs/program';
import type { DashboardFilter, DashboardSummary } from '../dashboard/dashboard-summary';
import type { Disbursement, DisbursementFilter } from '../disbursements/disbursement';
import type {
  Household,
  Resident,
  ResidentDraft,
  ResidentFilter,
  ResidentSortField,
} from '../residents/resident';
import type { ResidentView } from '../residents/resident-disclosure';
import type { ResidentProfile } from '../residents/resident-profile';
import type { Referral, ReferralFilter } from '../referrals/referral';
import type { SavedView, SavedViewDraft, SavedViewResource } from '../views/saved-view';
import type { Page, PageRequest } from '../shared/pagination';
import type {
  AssistanceRequestId,
  DisbursementId,
  HouseholdId,
  NotificationId,
  ProgramId,
  ReferralId,
  ResidentId,
  SavedViewId,
  StaffUserId,
} from '../shared/ids';

/**
 * Ports (hexagonal boundary).
 *
 * Feature code depends on these interfaces and their injection tokens only.
 * `src/app/data/mock` and `src/app/data/http` provide interchangeable adapters;
 * swapping one for the other must never require touching a component.
 */

/**
 * The resident registry — the canonical record every other workflow links to.
 *
 * Reads return `ResidentView`, never a bare `Resident`: the adapter applies the
 * disclosure policy on the way out, so a caller physically cannot render an
 * attribute its user is not cleared for (`DL-38`). Writes take a `ResidentDraft`
 * and return the stored `Resident`, because the writer necessarily saw what they
 * typed.
 */
export interface ResidentRepository {
  list(
    filter: ResidentFilter,
    page: PageRequest<ResidentSortField>,
  ): Observable<Page<ResidentView>>;
  getById(id: ResidentId): Observable<ResidentView | null>;
  getHousehold(id: HouseholdId): Observable<Household | null>;
  /**
   * Resident, household, family and assistance history in one call — the
   * traceability guarantee of the registry. `null` for "not found *or* not
   * yours", which are deliberately indistinguishable (`DL-31`).
   */
  getProfile(id: ResidentId): Observable<ResidentProfile | null>;
  create(draft: ResidentDraft): Observable<Resident>;
  update(id: ResidentId, draft: ResidentDraft): Observable<Resident>;
  /** Registry records are retired, never deleted: history must stay attributable. */
  setActive(id: ResidentId, isActive: boolean): Observable<Resident>;
}

export const RESIDENT_REPOSITORY = new InjectionToken<ResidentRepository>('ResidentRepository');

/**
 * Named list parameters. A hook rather than a product surface: the API will own
 * persistence and sharing, and this port is the shape it has to honour.
 */
export interface SavedViewRepository {
  listFor(resource: SavedViewResource): Observable<readonly SavedView[]>;
  create(draft: SavedViewDraft): Observable<SavedView>;
  remove(id: SavedViewId): Observable<void>;
}

export const SAVED_VIEW_REPOSITORY = new InjectionToken<SavedViewRepository>('SavedViewRepository');

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
  /**
   * Credential sign-in. Fails with `SignInError('invalid-credentials')` for an
   * unknown email, a wrong password and a deactivated account alike — telling
   * them apart would let anyone enumerate staff addresses.
   *
   * There is deliberately no `register` counterpart: staff accounts are
   * provisioned by an administrator, never self-created (`DL-32`).
   */
  signIn(credentials: SignInCredentials): Observable<AuthenticatedUser>;
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
  /**
   * Every figure is computed under `filter`, and the summary echoes the filter
   * back. That is what lets the view hand the *same* filter to the list a
   * metric links to, so a number and the records behind it cannot disagree.
   */
  summary(filter: DashboardFilter): Observable<DashboardSummary>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
