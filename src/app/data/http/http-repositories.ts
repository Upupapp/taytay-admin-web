import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toAuthenticatedUser,
  type AppNotification,
  type AssistanceProgram,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestSortField,
  type AssistanceRequestStatus,
  type AuthenticatedUser,
  type CaseNote,
  type DashboardRepository,
  type DashboardSummary,
  type Disbursement,
  type DisbursementFilter,
  type DisbursementId,
  type DisbursementRepository,
  type Household,
  type HouseholdId,
  type NotificationId,
  type NotificationRepository,
  type NotificationRequest,
  type Page,
  type PageRequest,
  type ProgramFilter,
  type ProgramId,
  type ProgramRepository,
  type Referral,
  type ReferralFilter,
  type ReferralId,
  type ReferralRepository,
  type Resident,
  type ResidentFilter,
  type ResidentId,
  type ResidentRepository,
  type ResidentSortField,
  type SignInCredentials,
  type StaffFilter,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';

/**
 * HTTP adapters implementing the domain ports against the provisional contract
 * in `api.contract.ts`. They are wired only when `environment.dataSource` is
 * `'http'`; until the API exists the mock adapters are used instead. Keeping
 * both sets compiled means the seam cannot silently rot.
 */

@Injectable()
export class HttpResidentRepository implements ResidentRepository {
  private readonly api = inject(ApiClient);

  list(filter: ResidentFilter, page: PageRequest<ResidentSortField>): Observable<Page<Resident>> {
    return this.api.page<Resident>(API_ENDPOINTS.residents, page, { ...filter });
  }

  getById(id: ResidentId): Observable<Resident | null> {
    return this.api.optionalItem<Resident>(`${API_ENDPOINTS.residents}/${id}`);
  }

  getHousehold(id: HouseholdId): Observable<Household | null> {
    return this.api.optionalItem<Household>(`${API_ENDPOINTS.households}/${id}`);
  }
}

@Injectable()
export class HttpProgramRepository implements ProgramRepository {
  private readonly api = inject(ApiClient);

  list(filter: ProgramFilter, page: PageRequest): Observable<Page<AssistanceProgram>> {
    return this.api.page<AssistanceProgram>(API_ENDPOINTS.programs, page, { ...filter });
  }

  getById(id: ProgramId): Observable<AssistanceProgram | null> {
    return this.api.optionalItem<AssistanceProgram>(`${API_ENDPOINTS.programs}/${id}`);
  }

  listActive(): Observable<readonly AssistanceProgram[]> {
    return this.api.collection<AssistanceProgram>(API_ENDPOINTS.programs, { status: 'active' });
  }
}

@Injectable()
export class HttpAssistanceRequestRepository implements AssistanceRequestRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: AssistanceRequestFilter,
    page: PageRequest<AssistanceRequestSortField>,
  ): Observable<Page<AssistanceRequest>> {
    return this.api.page<AssistanceRequest>(API_ENDPOINTS.assistanceRequests, page, { ...filter });
  }

  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null> {
    return this.api.optionalItem<AssistanceRequest>(`${API_ENDPOINTS.assistanceRequests}/${id}`);
  }

  listNotes(id: AssistanceRequestId): Observable<readonly CaseNote[]> {
    return this.api.collection<CaseNote>(`${API_ENDPOINTS.assistanceRequests}/${id}/notes`);
  }

  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest> {
    return this.api.post<AssistanceRequest>(`${API_ENDPOINTS.assistanceRequests}/${id}/status`, {
      status: to,
      reason,
    });
  }
}

@Injectable()
export class HttpDisbursementRepository implements DisbursementRepository {
  private readonly api = inject(ApiClient);

  list(filter: DisbursementFilter, page: PageRequest): Observable<Page<Disbursement>> {
    return this.api.page<Disbursement>(API_ENDPOINTS.disbursements, page, { ...filter });
  }

  getById(id: DisbursementId): Observable<Disbursement | null> {
    return this.api.optionalItem<Disbursement>(`${API_ENDPOINTS.disbursements}/${id}`);
  }

  listForRequest(id: AssistanceRequestId): Observable<readonly Disbursement[]> {
    return this.api.collection<Disbursement>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/disbursements`,
    );
  }
}

@Injectable()
export class HttpReferralRepository implements ReferralRepository {
  private readonly api = inject(ApiClient);

  list(filter: ReferralFilter, page: PageRequest): Observable<Page<Referral>> {
    return this.api.page<Referral>(API_ENDPOINTS.referrals, page, { ...filter });
  }

  getById(id: ReferralId): Observable<Referral | null> {
    return this.api.optionalItem<Referral>(`${API_ENDPOINTS.referrals}/${id}`);
  }
}

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);

  list(filter: StaffFilter, page: PageRequest): Observable<Page<StaffUser>> {
    return this.api.page<StaffUser>(API_ENDPOINTS.staff, page, { ...filter });
  }

  getById(id: StaffUserId): Observable<StaffUser | null> {
    return this.api.optionalItem<StaffUser>(`${API_ENDPOINTS.staff}/${id}`);
  }

  currentUser(): Observable<AuthenticatedUser | null> {
    return this.api
      .optionalItem<StaffUser>(API_ENDPOINTS.session)
      .pipe(map((staff) => (staff ? toAuthenticatedUser(staff) : null)));
  }

  signIn(credentials: SignInCredentials): Observable<AuthenticatedUser> {
    // Credentials travel in the request body over the session endpoint; the
    // API sets an HTTP-only cookie. Nothing is stored client-side.
    return this.api
      .post<StaffUser>(API_ENDPOINTS.session, credentials)
      .pipe(map(toAuthenticatedUser));
  }

  signOut(): Observable<void> {
    return this.api.postVoid(`${API_ENDPOINTS.session}/sign-out`, {});
  }
}

@Injectable()
export class HttpNotificationRepository implements NotificationRepository {
  private readonly api = inject(ApiClient);

  listForCurrentUser(): Observable<readonly AppNotification[]> {
    return this.api.collection<AppNotification>(API_ENDPOINTS.notifications);
  }

  create(request: NotificationRequest): Observable<AppNotification> {
    return this.api.post<AppNotification>(API_ENDPOINTS.notifications, request);
  }

  markRead(id: NotificationId): Observable<AppNotification> {
    return this.api.patch<AppNotification>(`${API_ENDPOINTS.notifications}/${id}`, { read: true });
  }

  markAllRead(): Observable<readonly AppNotification[]> {
    return this.api
      .post<readonly AppNotification[]>(`${API_ENDPOINTS.notifications}/read-all`, {})
      .pipe(map((notifications) => notifications));
  }
}

@Injectable()
export class HttpDashboardRepository implements DashboardRepository {
  private readonly api = inject(ApiClient);

  summary(): Observable<DashboardSummary> {
    return this.api.item<DashboardSummary>(API_ENDPOINTS.dashboardSummary);
  }
}
