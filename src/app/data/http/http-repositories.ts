import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, tap, throwError, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';

import {
  asId,
  type AppNotification,
  type AssistanceProgram,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestSortField,
  type AssistanceRequestStatus,
  type AuthenticatedUser,
  type BeneficiaryDetail,
  type BeneficiaryFilter,
  type BeneficiaryRepository,
  type BeneficiarySortField,
  type BeneficiarySummary,
  type DuplicateCandidate,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type MergePreview,
  type ProgramEnrollment,
  type DisclosurePlan,
  type IsoDate,
  type IsoDateTime,
  type ReferralDraft,
  type ReferralSortField,
  type ReferralStatus,
  type ReferralSummarySheet,
  type ServiceProvider,
  type ServiceProviderFilter,
  type ServiceProviderId,
  type DeferralReason,
  type DisbursementSortField,
  type DisbursementStatus,
  type ReleaseAcknowledgementDraft,
  type ReleaseBatch,
  type ReleaseBatchDraft,
  type ReleaseBatchId,
  type ReleaseManifest,
  type FieldVisit,
  type FieldVisitDraft,
  type FieldVisitFilter,
  type FieldVisitId,
  type FieldVisitRepository,
  type FieldVisitSortField,
  type VisitObservationDraft,
  type VisitOutcomeDraft,
  type ConditionalApplicability,
  type DocumentAccessGrant,
  type DocumentRequest,
  type DocumentRequestDraft,
  type DocumentVersionDraft,
  type DocumentVersionId,
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
  type ExportFormat,
  type OfficeAlert,
  type ReportDefinition,
  type ReportExport,
  type ReportFilter,
  type ReportId,
  type ReportRepository,
  type ReportResult,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditFilter,
  type AuditRow,
  type Comment,
  type CommentFilter,
  type CommentId,
  type ModerationAction,
  type AttendanceStatus,
  type EventCapacitySummary,
  type EventDraft,
  type EventFilter,
  type EventMetrics,
  type EventRegistrationId,
  type EventRepository,
  type EventView,
  type LguEvent,
  type LguEventId,
  type NewsfeedRepository,
  type RegistrantExport,
  type RegistrantFilter,
  type RegistrantView,
  type RegistrationAction,
  type Post,
  type PostDraft,
  type PostFilter,
  type PostId,
  type PostView,
  type ClassifiedRecordType,
  type CorrectionRequest,
  type GovernanceRepository,
  type RetentionRule,
  type SearchRepository,
  type StaffAccount,
  type SearchResults,
  type TeamQueue,
  type WorkQueue,
  type WorkRepository,
  type MfaCredentials,
  SignInError,
  type SignInOutcome,
  fromServerIdentity,
  type DataScope,
  type BarangayId,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS, type ApiItemResponse } from './api.contract';

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

  assignTask(
    id: CaseId,
    taskId: CaseTaskId,
    staffUserId: StaffUserId | null,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { staffUserId: StaffUserId | null; reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/tasks/${taskId}/assignment`,
      { staffUserId, reason },
    );
  }

  rescheduleTask(
    id: CaseId,
    taskId: CaseTaskId,
    dueOn: IsoDate,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.api.post<CaseWorkspace, { dueOn: IsoDate; reason: string }>(
      `${API_ENDPOINTS.cases}/${id}/tasks/${taskId}/schedule`,
      { dueOn, reason },
    );
  }
}

/**
 * The newsfeed over HTTP.
 *
 * One `moderate` endpoint rather than four, matching the port: hiding,
 * restoring, removing and replying are the same act with different outcomes,
 * and four endpoints would be four places for the reason to become optional
 * (`DL-127`).
 */
@Injectable()
export class HttpNewsfeedRepository implements NewsfeedRepository {
  private readonly api = inject(ApiClient);

  list(view: PostView, filter: PostFilter): Observable<readonly Post[]> {
    return this.api.collection<Post>(API_ENDPOINTS.newsfeed, { view, ...toParams(filter) });
  }

  getById(id: PostId): Observable<Post | null> {
    return this.api.optionalItem<Post>(`${API_ENDPOINTS.newsfeed}/${id}`);
  }

  saveDraft(draft: PostDraft, id: PostId | null): Observable<Post> {
    return this.api.post<Post, { draft: PostDraft; id: PostId | null }>(
      `${API_ENDPOINTS.newsfeed}/drafts`,
      { draft, id },
    );
  }

  publish(id: PostId, reason: string): Observable<Post> {
    return this.api.post<Post, { reason: string }>(
      `${API_ENDPOINTS.newsfeed}/${id}/publish`,
      { reason },
    );
  }

  schedule(id: PostId, at: IsoDateTime, reason: string): Observable<Post> {
    return this.api.post<Post, { at: IsoDateTime; reason: string }>(
      `${API_ENDPOINTS.newsfeed}/${id}/schedule`,
      { at, reason },
    );
  }

  archive(id: PostId, reason: string): Observable<Post> {
    return this.api.post<Post, { reason: string }>(
      `${API_ENDPOINTS.newsfeed}/${id}/archive`,
      { reason },
    );
  }

  setPinned(id: PostId, isPinned: boolean, reason: string): Observable<Post> {
    return this.api.post<Post, { isPinned: boolean; reason: string }>(
      `${API_ENDPOINTS.newsfeed}/${id}/pin`,
      { isPinned, reason },
    );
  }

  setCommentsEnabled(id: PostId, enabled: boolean, reason: string): Observable<Post> {
    return this.api.post<Post, { enabled: boolean; reason: string }>(
      `${API_ENDPOINTS.newsfeed}/${id}/comments-enabled`,
      { enabled, reason },
    );
  }

  comments(postId: PostId, filter: CommentFilter): Observable<readonly Comment[]> {
    return this.api.collection<Comment>(
      `${API_ENDPOINTS.newsfeed}/${postId}/comments`,
      toParams(filter),
    );
  }

  moderate(
    commentId: CommentId,
    action: ModerationAction,
    text: string,
  ): Observable<Comment> {
    return this.api.post<Comment, { action: ModerationAction; text: string }>(
      `${API_ENDPOINTS.newsfeed}/comments/${commentId}/moderate`,
      { action, text },
    );
  }

  history(id: PostId): Observable<readonly AuditRow[]> {
    return this.api.collection<AuditRow>(`${API_ENDPOINTS.newsfeed}/${id}/history`);
  }
}

/**
 * Governance over HTTP.
 *
 * Note the two reads. `auditRows` returns rows; `auditDetail` returns the
 * recorded values, from a different path, behind a different permission. There
 * is no `include=values` and no `expand` — the split is in the API shape, not
 * in what a client remembers to ask for (`DL-114`).
 *
 * And there is no `create`, `invite` or `resetAccess`: accounts are provisioned
 * outside this console (`DL-32`).
 */
@Injectable()
export class HttpGovernanceRepository implements GovernanceRepository {
  private readonly api = inject(ApiClient);

  accounts(): Observable<readonly StaffAccount[]> {
    return this.api.collection<StaffAccount>(API_ENDPOINTS.staffAccounts);
  }

  accountById(id: StaffUserId): Observable<StaffAccount | null> {
    return this.api.optionalItem<StaffAccount>(`${API_ENDPOINTS.staffAccounts}/${id}`);
  }

  setAccountActive(
    id: StaffUserId,
    isActive: boolean,
    reason: string,
  ): Observable<StaffAccount> {
    return this.api.post<StaffAccount, { isActive: boolean; reason: string }>(
      `${API_ENDPOINTS.staffAccounts}/${id}/status`,
      { isActive, reason },
    );
  }

  auditRows(filter: AuditFilter): Observable<readonly AuditRow[]> {
    return this.api.collection<AuditRow>(API_ENDPOINTS.audit, toParams(filter));
  }

  auditDetail(id: AuditEntryId): Observable<AuditEntryDetail | null> {
    return this.api.optionalItem<AuditEntryDetail>(`${API_ENDPOINTS.audit}/${id}/values`);
  }

  classifications(): Observable<readonly ClassifiedRecordType[]> {
    return this.api.collection<ClassifiedRecordType>(
      `${API_ENDPOINTS.governance}/classifications`,
    );
  }

  retention(): Observable<readonly RetentionRule[]> {
    return this.api.collection<RetentionRule>(`${API_ENDPOINTS.governance}/retention`);
  }

  corrections(): Observable<readonly CorrectionRequest[]> {
    return this.api.collection<CorrectionRequest>(`${API_ENDPOINTS.governance}/corrections`);
  }
}

/**
 * Global search over HTTP.
 *
 * One term, nothing else. There is deliberately no way to ask the server to
 * search wider: the searchable and displayable fields are the same closed set,
 * enforced on both sides (`DL-109`).
 */
@Injectable()
export class HttpSearchRepository implements SearchRepository {
  private readonly api = inject(ApiClient);

  search(term: string): Observable<SearchResults> {
    return this.api.item<SearchResults>(API_ENDPOINTS.search, { term });
  }
}

/**
 * Reports over HTTP.
 *
 * Note what is absent: there is no parameter asking the server for
 * unsuppressed figures, and no client-side aggregation. The server applies the
 * same small-cell rule and composes the export file itself, so a screen never
 * holds the raw set it would have to be trusted not to render (`DL-105`).
 */
@Injectable()
export class HttpReportRepository implements ReportRepository {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<readonly ReportDefinition[]> {
    return this.api.collection<ReportDefinition>(API_ENDPOINTS.reports);
  }

  run(id: ReportId, filter: ReportFilter): Observable<ReportResult | null> {
    return this.api.optionalItem<ReportResult>(
      `${API_ENDPOINTS.reports}/${id}?${new URLSearchParams(toParams(filter)).toString()}`,
    );
  }

  export(id: ReportId, filter: ReportFilter, format: ExportFormat): Observable<ReportExport> {
    return this.api.post<ReportExport, { filter: ReportFilter; format: ExportFormat }>(
      `${API_ENDPOINTS.reports}/${id}/export`,
      { filter, format },
    );
  }
}

/**
 * Work queues over HTTP.
 *
 * Three reads and nothing else — the port has no mutator and neither does this
 * (`DL-97`). `asOf` travels as a parameter rather than being taken from the
 * server's clock so the heading a user reads and the urgencies underneath it
 * cannot disagree.
 */
@Injectable()
export class HttpWorkRepository implements WorkRepository {
  private readonly api = inject(ApiClient);

  myQueue(asOf: IsoDate): Observable<WorkQueue> {
    return this.api.item<WorkQueue>(`${API_ENDPOINTS.work}/mine`, { asOf });
  }

  teamQueue(asOf: IsoDate): Observable<TeamQueue> {
    return this.api.item<TeamQueue>(`${API_ENDPOINTS.work}/team`, { asOf });
  }

  alerts(): Observable<readonly OfficeAlert[]> {
    return this.api.collection<OfficeAlert>(`${API_ENDPOINTS.work}/alerts`);
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

  recordDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Observable<AssistanceRequest> {
    // POST, never PUT: recording a document appends a version to a history and
    // never replaces one (`DL-77`). The verb is part of the contract.
    return this.api.post<AssistanceRequest, DocumentVersionDraft>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/requirements/${requirementId}/documents`,
      draft,
    );
  }

  decideApplicability(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    applicability: ConditionalApplicability,
    reason: string,
  ): Observable<AssistanceRequest> {
    return this.api.post<
      AssistanceRequest,
      { applicability: ConditionalApplicability; reason: string }
    >(`${API_ENDPOINTS.assistanceRequests}/${id}/requirements/${requirementId}/applicability`, {
      applicability,
      reason,
    });
  }

  requestDocument(
    id: AssistanceRequestId,
    draft: DocumentRequestDraft,
  ): Observable<readonly DocumentRequest[]> {
    return this.api.post<readonly DocumentRequest[], DocumentRequestDraft>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/document-requests`,
      draft,
    );
  }

  listDocumentRequests(id: AssistanceRequestId): Observable<readonly DocumentRequest[]> {
    return this.api.collection<DocumentRequest>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/document-requests`,
    );
  }

  openDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    versionId: DocumentVersionId,
  ): Observable<DocumentAccessGrant> {
    // A POST for a read, deliberately: opening a file is an act the API records
    // against the reader, and a cacheable GET would let a proxy serve it again
    // without the server ever seeing the second read.
    return this.api.post<DocumentAccessGrant, Record<string, never>>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/requirements/${requirementId}/documents/${versionId}/access`,
      {},
    );
  }
}

@Injectable()
export class HttpDisbursementRepository implements DisbursementRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: DisbursementFilter,
    page: PageRequest<DisbursementSortField>,
  ): Observable<Page<Disbursement>> {
    return this.api.page<Disbursement>(API_ENDPOINTS.disbursements, page, toParams(filter));
  }

  getById(id: DisbursementId): Observable<Disbursement | null> {
    return this.api.optionalItem<Disbursement>(`${API_ENDPOINTS.disbursements}/${id}`);
  }

  listForRequest(id: AssistanceRequestId): Observable<readonly Disbursement[]> {
    return this.api.collection<Disbursement>(API_ENDPOINTS.disbursements, { requestId: id });
  }

  queue(filter: DisbursementFilter): Observable<readonly Disbursement[]> {
    return this.api.collection<Disbursement>(
      `${API_ENDPOINTS.disbursements}/queue`,
      toParams(filter),
    );
  }

  approverFor(id: DisbursementId): Observable<StaffUserId | null> {
    return this.api.optionalItem<StaffUserId>(`${API_ENDPOINTS.disbursements}/${id}/approver`);
  }

  listBatches(): Observable<readonly ReleaseBatch[]> {
    return this.api.collection<ReleaseBatch>(API_ENDPOINTS.releaseBatches);
  }

  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null> {
    return this.api.optionalItem<ReleaseBatch>(`${API_ENDPOINTS.releaseBatches}/${id}`);
  }

  createBatch(draft: ReleaseBatchDraft): Observable<ReleaseBatch> {
    return this.api.post<ReleaseBatch, ReleaseBatchDraft>(API_ENDPOINTS.releaseBatches, draft);
  }

  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null> {
    // Server-composed, like the referral summary. This adapter must never
    // assemble a manifest client-side from fuller records (`DL-92`).
    return this.api.optionalItem<ReleaseManifest>(
      `${API_ENDPOINTS.releaseBatches}/${id}/manifest`,
    );
  }

  markReleased(
    id: DisbursementId,
    instrumentReference: string | null,
    remarks: string | null,
  ): Observable<Disbursement> {
    return this.api.post<
      Disbursement,
      { instrumentReference: string | null; remarks: string | null }
    >(`${API_ENDPOINTS.disbursements}/${id}/release`, { instrumentReference, remarks });
  }

  acknowledge(
    id: DisbursementId,
    acknowledgement: ReleaseAcknowledgementDraft,
  ): Observable<Disbursement> {
    return this.api.post<Disbursement, ReleaseAcknowledgementDraft>(
      `${API_ENDPOINTS.disbursements}/${id}/acknowledgement`,
      acknowledgement,
    );
  }

  deferRelease(
    id: DisbursementId,
    reason: DeferralReason,
    remarks: string,
  ): Observable<Disbursement> {
    return this.api.post<Disbursement, { reason: DeferralReason; remarks: string }>(
      `${API_ENDPOINTS.disbursements}/${id}/defer`,
      { reason, remarks },
    );
  }

  changeStatus(
    id: DisbursementId,
    to: DisbursementStatus,
    reason: string,
  ): Observable<Disbursement> {
    return this.api.post<Disbursement, { to: DisbursementStatus; reason: string }>(
      `${API_ENDPOINTS.disbursements}/${id}/status`,
      { to, reason },
    );
  }
}

/**
 * Referrals over HTTP.
 *
 * `send` posts the disclosure plan with the send itself, which is the contract
 * the API owes: a referral must not be transmittable in one call and
 * authorised in another, or there is a window in which it can go without a
 * lawful basis (`DL-81`). `summaryFor` is a server-composed sheet — this
 * adapter must never assemble one client-side from a fuller record.
 */
@Injectable()
export class HttpReferralRepository implements ReferralRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: ReferralFilter,
    page: PageRequest<ReferralSortField>,
  ): Observable<Page<Referral>> {
    return this.api.page<Referral>(API_ENDPOINTS.referrals, page, { ...filter });
  }

  getById(id: ReferralId): Observable<Referral | null> {
    return this.api.optionalItem<Referral>(`${API_ENDPOINTS.referrals}/${id}`);
  }

  forResident(id: ResidentId): Observable<readonly Referral[]> {
    return this.api.collection<Referral>(API_ENDPOINTS.referrals, { residentId: id });
  }

  queue(filter: ReferralFilter): Observable<readonly Referral[]> {
    // The ordering is the server's: overdue-first depends on today's date, and
    // two clients in different time zones must not disagree about the queue.
    return this.api.collection<Referral>(`${API_ENDPOINTS.referrals}/queue`, toParams(filter));
  }

  createDraft(draft: ReferralDraft): Observable<Referral> {
    return this.api.post<Referral, ReferralDraft>(API_ENDPOINTS.referrals, draft);
  }

  send(id: ReferralId, plan: DisclosurePlan): Observable<Referral> {
    return this.api.post<Referral, DisclosurePlan>(
      `${API_ENDPOINTS.referrals}/${id}/send`,
      plan,
    );
  }

  summaryFor(id: ReferralId): Observable<ReferralSummarySheet | null> {
    return this.api.optionalItem<ReferralSummarySheet>(
      `${API_ENDPOINTS.referrals}/${id}/summary`,
    );
  }

  changeStatus(id: ReferralId, to: ReferralStatus, reason: string): Observable<Referral> {
    return this.api.post<Referral, { to: ReferralStatus; reason: string }>(
      `${API_ENDPOINTS.referrals}/${id}/status`,
      { to, reason },
    );
  }

  recordOutcome(id: ReferralId, outcome: string, status: ReferralStatus): Observable<Referral> {
    return this.api.post<Referral, { outcome: string; status: ReferralStatus }>(
      `${API_ENDPOINTS.referrals}/${id}/outcome`,
      { outcome, status },
    );
  }

  reschedule(id: ReferralId, followUpOn: IsoDate, reason: string): Observable<Referral> {
    return this.api.post<Referral, { followUpOn: IsoDate; reason: string }>(
      `${API_ENDPOINTS.referrals}/${id}/follow-up`,
      { followUpOn, reason },
    );
  }

  addNote(id: ReferralId, body: string): Observable<Referral> {
    return this.api.post<Referral, { body: string }>(
      `${API_ENDPOINTS.referrals}/${id}/notes`,
      { body },
    );
  }

  listProviders(filter: ServiceProviderFilter): Observable<readonly ServiceProvider[]> {
    return this.api.collection<ServiceProvider>(API_ENDPOINTS.serviceProviders, { ...filter });
  }

  getProvider(id: ServiceProviderId): Observable<ServiceProvider | null> {
    return this.api.optionalItem<ServiceProvider>(`${API_ENDPOINTS.serviceProviders}/${id}`);
  }
}

/**
 * The beneficiary registry over HTTP.
 *
 * The rules this port carries are enforced by the API, not here: the server
 * decides what a caller may read, redacts what it may not, and returns match
 * *signals* rather than the other person's record (`DL-73`). This adapter must
 * never reconstruct a comparison client-side to fill a gap in a response.
 */
@Injectable()
export class HttpBeneficiaryRepository implements BeneficiaryRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: BeneficiaryFilter,
    page: PageRequest<BeneficiarySortField>,
  ): Observable<Page<BeneficiarySummary>> {
    return this.api.page<BeneficiarySummary>(API_ENDPOINTS.beneficiaries, page, { ...filter });
  }

  getByResidentId(id: ResidentId): Observable<BeneficiaryDetail | null> {
    return this.api.optionalItem<BeneficiaryDetail>(`${API_ENDPOINTS.beneficiaries}/${id}`);
  }

  enrollmentsFor(id: ResidentId): Observable<readonly ProgramEnrollment[]> {
    return this.api.collection<ProgramEnrollment>(
      `${API_ENDPOINTS.beneficiaries}/${id}/enrollments`,
    );
  }

  duplicateQueue(page: PageRequest): Observable<Page<DuplicateCandidate>> {
    return this.api.page<DuplicateCandidate>(API_ENDPOINTS.identityReview, page);
  }

  duplicatesFor(id: ResidentId): Observable<readonly DuplicateCandidate[]> {
    return this.api.collection<DuplicateCandidate>(
      `${API_ENDPOINTS.beneficiaries}/${id}/duplicates`,
    );
  }

  previewResolution(
    canonicalResidentId: ResidentId,
    supersededResidentId: ResidentId,
  ): Observable<MergePreview> {
    return this.api.item<MergePreview>(`${API_ENDPOINTS.identityReview}/preview`, {
      canonicalResidentId,
      supersededResidentId,
    });
  }

  resolveIdentity(draft: IdentityResolutionDraft): Observable<IdentityResolution> {
    return this.api.post<IdentityResolution, IdentityResolutionDraft>(
      API_ENDPOINTS.identityReview,
      draft,
    );
  }

  resolutionsFor(id: ResidentId): Observable<readonly IdentityResolution[]> {
    return this.api.collection<IdentityResolution>(
      `${API_ENDPOINTS.beneficiaries}/${id}/identity-findings`,
    );
  }
}

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(AuthTokenHolder);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl.replace(/\/+$/, '');

  list(filter: StaffFilter, page: PageRequest): Observable<Page<StaffUser>> {
    return this.api.page<StaffUser>(API_ENDPOINTS.staff, page, { ...filter });
  }

  getById(id: StaffUserId): Observable<StaffUser | null> {
    return this.api.optionalItem<StaffUser>(`${API_ENDPOINTS.staff}/${id}`);
  }

  /**
   * Who the server says the caller is.
   *
   * `GET me` returns the account **with the permissions and roles the server
   * resolved** — TAB 03 moves the console onto those. Until then the identity is
   * still assembled from the role map, and this only answers "is there a live
   * session"; with a memory-only token, on a fresh page load there is not.
   */
  currentUser(): Observable<AuthenticatedUser | null> {
    if (!this.tokens.hasToken()) {
      // No round-trip: without a token there is nothing to ask about, and an
      // unauthenticated GET would answer 401 and bounce the user to sign-in
      // through the error interceptor — on every reload, before they had done
      // anything.
      return of(null);
    }

    return this.api
      .optionalItem<MeWire>(API_ENDPOINTS.me)
      .pipe(map((me) => (me ? toIdentity(me) : null)));
  }

  /**
   * Step one. Answers either a token or a second-factor challenge.
   *
   * `POST auth/tokens` returns **200** with `{status: "mfa-required", challenge}`
   * when a second factor is enrolled — the password was right, so it is
   * deliberately not a 401 — and **201** with `{token, expires_at}` otherwise.
   */
  signIn(credentials: SignInCredentials): Observable<SignInOutcome> {
    return this.http
      .post<ApiItemResponse<SignInWire>>(this.authUrl('auth/tokens'), {
        email: credentials.email,
        password: credentials.password,
        device_name: DEVICE_NAME,
      })
      .pipe(
        switchMap((response) => this.readSignIn(response.data)),
        catchError((error: unknown) => throwError(() => toSignInError(error))),
      );
  }

  /** Step two. The challenge is single-use and expires. */
  completeMfa(credentials: MfaCredentials): Observable<AuthenticatedUser> {
    return this.http
      .post<ApiItemResponse<SignInWire>>(this.authUrl('auth/tokens/mfa'), {
        challenge: credentials.challenge,
        code: credentials.code,
      })
      .pipe(
        switchMap((response) => this.readSignIn(response.data)),
        map((outcome) => {
          if (outcome.kind !== 'authenticated') {
            // The API does not chain a second challenge onto a completed one.
            // If that ever changes, failing loudly here beats returning a user
            // the server never issued a token for.
            throw new SignInError('unavailable', SIGN_IN_UNAVAILABLE);
          }
          return outcome.user;
        }),
        catchError((error: unknown) => throwError(() => toSignInError(error))),
      );
  }

  /**
   * Sign-out is server-side revocation.
   *
   * The token is dropped only after the API confirms. Clearing it first would
   * show a signed-out screen while the credential stayed valid on the server —
   * and would make the failure invisible, because the request that would have
   * revoked it now goes out unauthenticated.
   */
  signOut(): Observable<void> {
    return this.http.delete<unknown>(this.authUrl('auth/tokens/current')).pipe(
      tap(() => this.tokens.clear()),
      map(() => undefined),
    );
  }

  private readSignIn(payload: SignInWire): Observable<SignInOutcome> {
    if (payload.status === 'mfa-required' && typeof payload.challenge === 'string') {
      return of({
        kind: 'mfa-required' as const,
        challenge: {
          challenge: payload.challenge,
          expiresInMinutes: payload.expires_in_minutes ?? 0,
        },
      });
    }

    if (payload.status === 'mfa-enrolment-required') {
      /*
       * The API answered with a token, and the console deliberately drops it.
       *
       * It is an enrolment-scoped credential: `EnforceTokenAbilities` refuses it
       * everywhere except second-factor enrolment. Holding it would give this
       * application a session that looks real to every guard and can do nothing,
       * which is worse than no session — the caseworker would find out one
       * refused screen at a time.
       *
       * Enrolment itself is not built here yet (TAB 02 report, deferred): until
       * it is, the honest answer is to say what has to happen and to whom.
       */
      return throwError(
        () =>
          new SignInError(
            'second-factor-enrolment-required',
            'This account still needs an authenticator app set up before it can be used. Contact the MSWDO administrator to complete enrolment.',
          ),
      );
    }

    if (typeof payload.token !== 'string') {
      return throwError(() => new SignInError('unavailable', SIGN_IN_UNAVAILABLE));
    }

    this.tokens.hold(payload.token, payload.expires_at ? new Date(payload.expires_at) : null);

    // The token has to be held before this call, because `GET me` is
    // authenticated by it. This is the one ordering in the flow that matters.
    return this.api
      .item<MeWire>(API_ENDPOINTS.me)
      .pipe(map((me) => ({ kind: 'authenticated' as const, user: toIdentity(me) })));
  }

  /**
   * The sign-in calls bypass `ApiClient` because they are the only two requests
   * whose response envelope is read directly rather than unwrapped to `data`.
   * They still go through the same versioned base and the same interceptors.
   */
  private authUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
}

/**
 * `GET /api/v1/me`, as the wire carries it.
 *
 * The two fields that matter are `permissions` and `roles`: they are the
 * server's own answer about this actor, and the console renders from them
 * rather than recomputing anything (`DL-133`).
 */
interface MeWire {
  readonly id: string;
  readonly display_name?: string;
  readonly name?: string;
  readonly email: string;
  readonly position?: string;
  readonly barangay_id?: string | null;
  readonly scope?: string;
  readonly permissions?: readonly string[];
  readonly roles?: readonly string[];
}

/**
 * Maps `/me` into the console's identity.
 *
 * The scope is narrowed here rather than trusted: the wire is a string, and an
 * unrecognised one becomes the **narrowest** scope, not the widest. A value the
 * console does not understand must never widen what somebody can reach.
 */
function toIdentity(me: MeWire): AuthenticatedUser {
  return fromServerIdentity({
    id: asId<StaffUserId>(me.id),
    displayName: me.display_name ?? me.name ?? me.email,
    email: me.email,
    roles: me.roles ?? [],
    roleLabel: 'Staff',
    position: me.position ?? '',
    barangayId: me.barangay_id ? asId<BarangayId>(me.barangay_id) : null,
    scope: toScope(me.scope),
    permissions: me.permissions ?? [],
  });
}

function toScope(value: string | undefined): DataScope {
  return value === 'all-barangays' || value === 'own-barangay' || value === 'assigned-cases'
    ? value
    : 'assigned-cases';
}

/** What the console calls itself in the staff member's device list. */
const DEVICE_NAME = 'MSWDO admin console';

const SIGN_IN_UNAVAILABLE = 'Sign-in is unavailable right now. Please try again shortly.';

/**
 * The wire shape of both sign-in steps. One interface, because the API answers
 * on the same endpoint with either half populated.
 */
interface SignInWire {
  readonly status?: string;
  readonly challenge?: string;
  readonly expires_in_minutes?: number;
  readonly token?: string;
  readonly token_type?: string;
  readonly expires_at?: string;
}

/**
 * Every refusal says the same thing, except throttling.
 *
 * A wrong password, an unknown address, a locked account and a deactivated one
 * are one message: any difference turns the sign-in form into a directory of
 * which municipal staff addresses exist. Throttling is different — it discloses
 * nothing about the account, and the user can act on it once told how long.
 */
function toSignInError(error: unknown): SignInError {
  if (error instanceof SignInError) {
    return error;
  }

  const failure = error as { status?: number; code?: string | null; retryAfterSeconds?: number | null };

  if (failure.status === 429 || failure.code === 'RATE_LIMITED') {
    return new SignInError(
      'throttled',
      'Too many sign-in attempts. Please wait before trying again.',
      failure.retryAfterSeconds ?? null,
    );
  }

  if (failure.status === 401 || failure.status === 422) {
    return new SignInError('invalid-credentials', 'That email address and password do not match.');
  }

  return new SignInError('unavailable', SIGN_IN_UNAVAILABLE);
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

/**
 * Query parameters are strings on the wire. Booleans and ids are stringified
 * here rather than at each call site, and `undefined` is dropped so an absent
 * filter does not arrive as the literal "undefined".
 */
function toParams(filter: object): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) {
      continue;
    }
    params[key] = String(value);
  }
  return params;
}

/**
 * Field visits over HTTP.
 *
 * `recordObservations` is a POST that appends; there is deliberately no PUT or
 * DELETE for an observation. A worker correcting an earlier one records another
 * saying so (`DL-85`), and the verb is part of the contract the API owes.
 *
 * Nothing here sends a location. That absence is the contract too.
 */
@Injectable()
export class HttpFieldVisitRepository implements FieldVisitRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: FieldVisitFilter,
    page: PageRequest<FieldVisitSortField>,
  ): Observable<Page<FieldVisit>> {
    return this.api.page<FieldVisit>(API_ENDPOINTS.fieldVisits, page, toParams(filter));
  }

  getById(id: FieldVisitId): Observable<FieldVisit | null> {
    return this.api.optionalItem<FieldVisit>(`${API_ENDPOINTS.fieldVisits}/${id}`);
  }

  mine(filter: FieldVisitFilter): Observable<readonly FieldVisit[]> {
    return this.api.collection<FieldVisit>(`${API_ENDPOINTS.fieldVisits}/mine`, toParams(filter));
  }

  forResident(id: ResidentId): Observable<readonly FieldVisit[]> {
    return this.api.collection<FieldVisit>(API_ENDPOINTS.fieldVisits, { residentId: id });
  }

  schedule(draft: FieldVisitDraft): Observable<FieldVisit> {
    return this.api.post<FieldVisit, FieldVisitDraft>(API_ENDPOINTS.fieldVisits, draft);
  }

  recordObservations(
    id: FieldVisitId,
    observations: readonly VisitObservationDraft[],
  ): Observable<FieldVisit> {
    return this.api.post<FieldVisit, { observations: readonly VisitObservationDraft[] }>(
      `${API_ENDPOINTS.fieldVisits}/${id}/observations`,
      { observations },
    );
  }

  setChecklist(id: FieldVisitId, checkedCodes: readonly string[]): Observable<FieldVisit> {
    return this.api.post<FieldVisit, { checkedCodes: readonly string[] }>(
      `${API_ENDPOINTS.fieldVisits}/${id}/checklist`,
      { checkedCodes },
    );
  }

  close(id: FieldVisitId, outcome: VisitOutcomeDraft): Observable<FieldVisit> {
    return this.api.post<FieldVisit, VisitOutcomeDraft>(
      `${API_ENDPOINTS.fieldVisits}/${id}/close`,
      outcome,
    );
  }
}

/**
 * Events over HTTP.
 *
 * Capacity is read back from the server on every call rather than tracked
 * here, and promotion posts an intent and returns whatever the server did with
 * it. The client never decides that a place is free (`DL-129`).
 */
@Injectable()
export class HttpEventRepository implements EventRepository {
  private readonly api = inject(ApiClient);

  list(view: EventView, filter: EventFilter): Observable<readonly LguEvent[]> {
    return this.api.collection<LguEvent>(API_ENDPOINTS.events, { view, ...toParams(filter) });
  }

  getById(id: LguEventId): Observable<LguEvent | null> {
    return this.api.optionalItem<LguEvent>(`${API_ENDPOINTS.events}/${id}`);
  }

  saveDraft(draft: EventDraft, id: LguEventId | null): Observable<LguEvent> {
    return this.api.post<LguEvent, { draft: EventDraft; id: LguEventId | null }>(
      `${API_ENDPOINTS.events}/drafts`,
      { draft, id },
    );
  }

  publish(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.api.post<LguEvent, { reason: string }>(
      `${API_ENDPOINTS.events}/${id}/publish`,
      { reason },
    );
  }

  cancel(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.api.post<LguEvent, { reason: string }>(
      `${API_ENDPOINTS.events}/${id}/cancel`,
      { reason },
    );
  }

  complete(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.api.post<LguEvent, { reason: string }>(
      `${API_ENDPOINTS.events}/${id}/complete`,
      { reason },
    );
  }

  archive(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.api.post<LguEvent, { reason: string }>(
      `${API_ENDPOINTS.events}/${id}/archive`,
      { reason },
    );
  }

  registrants(id: LguEventId, filter: RegistrantFilter): Observable<readonly RegistrantView[]> {
    return this.api.collection<RegistrantView>(
      `${API_ENDPOINTS.events}/${id}/registrants`,
      toParams(filter),
    );
  }

  capacity(id: LguEventId): Observable<EventCapacitySummary> {
    return this.api.item<EventCapacitySummary>(`${API_ENDPOINTS.events}/${id}/capacity`);
  }

  metrics(id: LguEventId): Observable<EventMetrics> {
    return this.api.item<EventMetrics>(`${API_ENDPOINTS.events}/${id}/metrics`);
  }

  actOnRegistration(
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView> {
    return this.api.post<RegistrantView, { action: RegistrationAction; reason: string }>(
      `${API_ENDPOINTS.events}/registrations/${registrationId}`,
      { action, reason },
    );
  }

  markAttendance(
    registrationId: EventRegistrationId,
    attendance: AttendanceStatus,
  ): Observable<RegistrantView> {
    return this.api.post<RegistrantView, { attendance: AttendanceStatus }>(
      `${API_ENDPOINTS.events}/registrations/${registrationId}/attendance`,
      { attendance },
    );
  }

  exportRegistrants(id: LguEventId): Observable<RegistrantExport> {
    return this.api.item<RegistrantExport>(`${API_ENDPOINTS.events}/${id}/registrants/export`);
  }

  history(id: LguEventId): Observable<readonly AuditRow[]> {
    return this.api.collection<AuditRow>(`${API_ENDPOINTS.events}/${id}/history`);
  }
}
