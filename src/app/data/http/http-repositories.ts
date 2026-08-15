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
  type CaseFilter,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseQueueCount,
  type CaseRepository,
  type CaseSortField,
  type CaseStatus,
  type CaseSummary,
  type CaseTaskDraft,
  type CaseTaskId,
  type CaseWorkspace,
  type AdvisoryAcknowledgement,
  type AssessmentDraft,
  type IntakeAdvisory,
  type IntakeDraft,
  type RequestNote,
  type RequirementStatus,
  type RequirementId,
  type DashboardRepository,
  type DashboardFilter,
  type DashboardSummary,
  type Disbursement,
  type DisbursementFilter,
  type DisbursementId,
  type DisbursementRepository,
  type FactorState,
  type Family,
  type FamilyDetail,
  type FamilyFilter,
  type FamilyId,
  type FamilyRepository,
  type FamilyRole,
  type FamilySortField,
  type FamilySummary,
  type Household,
  type HouseholdDetail,
  type HouseholdFilter,
  type HouseholdId,
  type HouseholdRepository,
  type HouseholdSortField,
  type HouseholdSummary,
  type MembershipChange,
  type NotificationId,
  type NotificationRepository,
  type NotificationRequest,
  type Page,
  type PageRequest,
  type ProgramFilter,
  type ProgramId,
  type ProgramDraft,
  type ProgramRepository,
  type ProgramUtilization,
  type RequirementTemplate,
  type Referral,
  type ReferralFilter,
  type ReferralId,
  type ReferralRepository,
  type Resident,
  type ResidentDraft,
  type ResidentFilter,
  type ResidentId,
  type ResidentProfile,
  type ResidentRepository,
  type ResidentSortField,
  type ResidentView,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewRepository,
  type SavedViewResource,
  type SignInCredentials,
  type Relationship,
  type RelationshipEvent,
  type RelationshipId,
  type RelationshipKind,
  type ResidentTransfer,
  type VulnerabilityFactorCode,
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

  /**
   * Reads are typed as `ResidentView`, which is the contract the API owes: the
   * server applies the disclosure policy and reports what it withheld. The
   * client re-deriving redaction from a full record would defeat the point —
   * the attribute would already have crossed the wire (`DL-38`).
   */
  list(
    filter: ResidentFilter,
    page: PageRequest<ResidentSortField>,
  ): Observable<Page<ResidentView>> {
    return this.api.page<ResidentView>(API_ENDPOINTS.residents, page, { ...filter });
  }

  getById(id: ResidentId): Observable<ResidentView | null> {
    return this.api.optionalItem<ResidentView>(`${API_ENDPOINTS.residents}/${id}`);
  }

  getHousehold(id: HouseholdId): Observable<Household | null> {
    return this.api.optionalItem<Household>(`${API_ENDPOINTS.households}/${id}`);
  }

  getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    return this.api.optionalItem<ResidentProfile>(`${API_ENDPOINTS.residents}/${id}/profile`);
  }

  create(draft: ResidentDraft): Observable<Resident> {
    return this.api.post<Resident, ResidentDraft>(API_ENDPOINTS.residents, draft);
  }

  update(id: ResidentId, draft: ResidentDraft): Observable<Resident> {
    return this.api.patch<Resident, ResidentDraft>(`${API_ENDPOINTS.residents}/${id}`, draft);
  }

  setActive(id: ResidentId, isActive: boolean): Observable<Resident> {
    return this.api.patch<Resident, { isActive: boolean }>(`${API_ENDPOINTS.residents}/${id}`, {
      isActive,
    });
  }
}

@Injectable()
export class HttpHouseholdRepository implements HouseholdRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: HouseholdFilter,
    page: PageRequest<HouseholdSortField>,
  ): Observable<Page<HouseholdSummary>> {
    return this.api.page<HouseholdSummary>(API_ENDPOINTS.households, page, { ...filter });
  }

  getById(id: HouseholdId): Observable<HouseholdDetail | null> {
    return this.api.optionalItem<HouseholdDetail>(`${API_ENDPOINTS.households}/${id}`);
  }

  /**
   * One request carrying every change, because the server has to apply them as
   * a unit. Posting each change on its own would leave a household with two
   * heads between two round trips, and a failure halfway would leave it there.
   */
  changeMembership(
    id: HouseholdId,
    changes: readonly MembershipChange[],
    reason: string,
  ): Observable<HouseholdDetail> {
    return this.api.post<HouseholdDetail, { changes: readonly MembershipChange[]; reason: string }>(
      `${API_ENDPOINTS.households}/${id}/membership`,
      { changes, reason },
    );
  }

  correctFactor(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    state: FactorState,
    reason: string,
  ): Observable<HouseholdDetail> {
    return this.api.post<HouseholdDetail, { state: FactorState; reason: string }>(
      `${API_ENDPOINTS.households}/${id}/factors/${code}`,
      { state, reason },
    );
  }

  clearCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    reason: string,
  ): Observable<HouseholdDetail> {
    // A withdrawal is still a recorded act with a reason, so it is a POST and
    // not a DELETE: there is nothing to delete, only something to say.
    return this.api.post<HouseholdDetail, { reason: string }>(
      `${API_ENDPOINTS.households}/${id}/factors/${code}/clear`,
      { reason },
    );
  }
}

@Injectable()
export class HttpFamilyRepository implements FamilyRepository {
  private readonly api = inject(ApiClient);

  list(filter: FamilyFilter, page: PageRequest<FamilySortField>): Observable<Page<FamilySummary>> {
    return this.api.page<FamilySummary>(API_ENDPOINTS.families, page, { ...filter });
  }

  getById(id: FamilyId): Observable<FamilyDetail | null> {
    return this.api.optionalItem<FamilyDetail>(`${API_ENDPOINTS.families}/${id}`);
  }

  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]> {
    return this.api.collection<FamilySummary>(API_ENDPOINTS.families, { residentId });
  }

  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
  ): Observable<Relationship> {
    return this.api.post<Relationship, Record<string, unknown>>(API_ENDPOINTS.relationships, {
      fromResidentId,
      toResidentId,
      kind,
      reason,
    });
  }

  /**
   * A POST, not a DELETE. Ending a relationship records that it ended; there is
   * nothing to delete, and the server must keep the row (`DL-48`).
   */
  endRelationship(id: RelationshipId, reason: string): Observable<Relationship> {
    return this.api.post<Relationship, { reason: string }>(
      `${API_ENDPOINTS.relationships}/${id}/end`,
      { reason },
    );
  }

  /** One request, because the move must be one transaction on the server too. */
  transferResident(transfer: ResidentTransfer): Observable<FamilyDetail> {
    return this.api.post<FamilyDetail, ResidentTransfer>(
      `${API_ENDPOINTS.families}/transfers`,
      transfer,
    );
  }

  changeMemberRole(
    familyId: FamilyId,
    residentId: ResidentId,
    role: FamilyRole,
    reason: string,
  ): Observable<Family> {
    return this.api.patch<Family, { role: FamilyRole; reason: string }>(
      `${API_ENDPOINTS.families}/${familyId}/members/${residentId}`,
      { role, reason },
    );
  }

  historyForResident(residentId: ResidentId): Observable<readonly RelationshipEvent[]> {
    return this.api.collection<RelationshipEvent>(
      `${API_ENDPOINTS.residents}/${residentId}/relationship-history`,
    );
  }
}

/**
 * The case workspace over HTTP.
 *
 * Every mutation is a POST carrying its reason, and every one of them answers
 * with the whole workspace. Both are contract terms, not conveniences: the
 * reason is what the audit event is written from, and returning the workspace
 * is what stops a screen showing a status its timeline has not caught up with.
 * Nothing here is a DELETE, because nothing about a case is ever deleted
 * (`DL-54`).
 */
@Injectable()
export class HttpCaseRepository implements CaseRepository {
  private readonly api = inject(ApiClient);

  list(filter: CaseFilter, page: PageRequest<CaseSortField>): Observable<Page<CaseSummary>> {
    return this.api.page<CaseSummary>(API_ENDPOINTS.cases, page, { ...filter });
  }

  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]> {
    return this.api.collection<CaseQueueCount>(`${API_ENDPOINTS.cases}/queues`, { ...filter });
  }

  getById(id: CaseId): Observable<CaseWorkspace | null> {
    return this.api.optionalItem<CaseWorkspace>(`${API_ENDPOINTS.cases}/${id}`);
  }

  casesForResident(residentId: ResidentId): Observable<readonly CaseSummary[]> {
    return this.api.collection<CaseSummary>(API_ENDPOINTS.cases, { residentId });
  }

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { to: CaseStatus; reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/status`,
      { to, reason },
    );
  }

  assign(id: CaseId, staffUserId: StaffUserId | null, reason: string): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { staffUserId: StaffUserId | null; reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/assignment`,
      { staffUserId, reason },
    );
  }

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, Record<string, unknown>>(
      `${API_ENDPOINTS.cases}/${id}/notes`,
      { body, sensitivity, reason },
    );
  }

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { draft: CaseTaskDraft; reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/tasks`,
      { draft, reason },
    );
  }

  completeTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/tasks/${taskId}/complete`,
      { reason },
    );
  }
}

@Injectable()
export class HttpSavedViewRepository implements SavedViewRepository {
  private readonly api = inject(ApiClient);

  listFor(resource: SavedViewResource): Observable<readonly SavedView[]> {
    return this.api.collection<SavedView>(API_ENDPOINTS.savedViews, { resource });
  }

  create(draft: SavedViewDraft): Observable<SavedView> {
    return this.api.post<SavedView, SavedViewDraft>(API_ENDPOINTS.savedViews, draft);
  }

  remove(id: SavedViewId): Observable<void> {
    return this.api.deleteVoid(`${API_ENDPOINTS.savedViews}/${id}`);
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

  listRequirementTemplates(): Observable<readonly RequirementTemplate[]> {
    return this.api.collection<RequirementTemplate>(
      `${API_ENDPOINTS.programs}/requirement-templates`,
    );
  }

  /**
   * POST to create, PATCH to update. The server applies the same responsibility
   * rule (`DL-65`): a client that let a national programme be recorded as
   * municipally owned must still be refused.
   */
  save(draft: ProgramDraft, id: ProgramId | null): Observable<AssistanceProgram> {
    return id === null
      ? this.api.post<AssistanceProgram, ProgramDraft>(API_ENDPOINTS.programs, draft)
      : this.api.patch<AssistanceProgram, ProgramDraft>(`${API_ENDPOINTS.programs}/${id}`, draft);
  }

  utilizationFor(id: ProgramId): Observable<ProgramUtilization> {
    return this.api.item<ProgramUtilization>(`${API_ENDPOINTS.programs}/${id}/utilization`);
  }

  utilizationSummary(): Observable<readonly ProgramUtilization[]> {
    return this.api.collection<ProgramUtilization>(`${API_ENDPOINTS.programs}/utilization`);
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

  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]> {
    return this.api.collection<RequestNote>(`${API_ENDPOINTS.assistanceRequests}/${id}/notes`);
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

  /**
   * A GET, and read-only on the server too. The advisory reports what the
   * records say; it must never be the call that also creates or reserves
   * anything, or a screen refresh starts having consequences (`DL-60`).
   */
  advisoryFor(residentId: ResidentId, programId: ProgramId | null): Observable<IntakeAdvisory> {
    return this.api.item<IntakeAdvisory>(`${API_ENDPOINTS.assistanceRequests}/advisory`, {
      residentId,
      ...(programId === null ? {} : { programId }),
    });
  }

  /**
   * POST to create, PATCH to update — so a retried create cannot become a
   * second draft once the caller holds an id (`DL-63`).
   */
  saveDraft(draft: IntakeDraft, id: AssistanceRequestId | null): Observable<AssistanceRequest> {
    return id === null
      ? this.api.post<AssistanceRequest, IntakeDraft>(
          `${API_ENDPOINTS.assistanceRequests}/drafts`,
          draft,
        )
      : this.api.patch<AssistanceRequest, IntakeDraft>(
          `${API_ENDPOINTS.assistanceRequests}/drafts/${id}`,
          draft,
        );
  }

  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> {
    return this.api.post<AssistanceRequest, { acknowledgement: AdvisoryAcknowledgement | null }>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/submission`,
      { acknowledgement },
    );
  }

  recordAssessment(
    id: AssistanceRequestId,
    assessment: AssessmentDraft,
  ): Observable<AssistanceRequest> {
    return this.api.post<AssistanceRequest, AssessmentDraft>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/assessment`,
      assessment,
    );
  }

  reviewRequirement(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    status: RequirementStatus,
    remarks: string | null,
  ): Observable<AssistanceRequest> {
    return this.api.post<AssistanceRequest, { status: RequirementStatus; remarks: string | null }>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/requirements/${requirementId}`,
      { status, remarks },
    );
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

  summary(filter: DashboardFilter): Observable<DashboardSummary> {
    // The filter goes to the API so the server computes the figures under the
    // same constraints the view will use to drill into them.
    return this.api.item<DashboardSummary>(
      `${API_ENDPOINTS.dashboardSummary}?${new URLSearchParams({ ...filter }).toString()}`,
    );
  }
}
