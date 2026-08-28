import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  combineLatest,
  concatMap,
  filter,
  from,
  map,
  of,
  switchMap,
  tap,
  throwError,
  toArray,
  type Observable,
} from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { WriteIntent } from '@domain/index';

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
  type ReleaseSortField,
  type ReleaseStatus,
  type AcknowledgementKind,
  type DisclosureBasis,
  type ReleaseAcknowledgementDraft,
  type SharedField,
  type VulnerabilitySector,
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
  type Release,
  type ReleaseFilter,
  type ReleaseId,
  type ReleaseRepository,
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
import { UPLOAD_POLICY } from './api.contract';
import { FileTransport, type UploadProgress } from './file-transport';
import {
  toWireDocumentVersion,
  toWireEventDraft,
  toWireFieldVisitDraft,
  toWirePostDraft,
  toWireReferralDraft,
  toWireReleaseBatch,
  toWireResidentDraft,
  toWireSavedViewDraft,
  toWireVisitOutcome,
} from './mappers/to-wire';
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

  /**
   * Composed from four published reads, because the API projects no profile.
   *
   * This asked for `/{id}/profile`, which 404s — there has never been such an endpoint, and
   * `port-mapping.md` recorded the alternative it needed: *"assembled from resident + households +
   * vulnerability + assistance-history — four calls or a TAB 07 projection."* TAB 07 built the
   * pieces and not the projection, so the four calls are what exist.
   *
   * Composed **here, in the data layer**, and not in the screen. A page assembling this itself
   * would be a second assembly of the same history, and `DL-71` is explicit that two assemblies
   * eventually disagree — in front of the family.
   *
   * The cost is four round trips per profile view rather than one. That is a performance concern
   * and not a correctness one, and it is the honest shape until a projection exists: each of the
   * four is separately permission-checked server-side, which a single composite endpoint would
   * have to reproduce anyway.
   *
   * A missing resident yields `null` for the whole profile; a missing household is a legitimate
   * absence — `DL-47`, a family may have no household while it is between addresses — so the
   * other three reads are allowed to come back empty without collapsing the profile.
   */
  getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    const base = `${API_ENDPOINTS.residents}/${id}`;

    return combineLatest([
      this.api.optionalItem<ResidentView>(base),
      this.api.collection<Household>(`${base}/households`),
      this.api.item<ResidentProfile['history']>(`${base}/assistance-history`),
    ]).pipe(
      switchMap(([view, households, history]) => {
        if (view === null) {
          return of(null);
        }

        const household = households[0] ?? null;

        // Members live on the household, so a resident between addresses simply has none.
        return household === null
          ? of({ view, household: null, householdMembers: [], history })
          : this.api
              .optionalItem<HouseholdDetail>(`${API_ENDPOINTS.households}/${household.id}`)
              .pipe(
                map((detail) => ({
                  view,
                  household,
                  householdMembers: detail?.members ?? [],
                  history,
                })),
              );
      }),
    );
  }

  /**
   * `POST admin/residents/{resident}/sectors`, which did not exist until TAB 19.
   *
   * `resident_sectors` was read by the eligibility facts and the vulnerability snapshot and
   * written by nothing, so a resident enrolled through this API had no sectors at all — and every
   * fact derived from them was absent rather than false.
   */
  recordSector(
    id: ResidentId,
    sector: VulnerabilitySector,
    reason: string,
  ): Observable<void> {
    return this.api.postVoid<{ sector: VulnerabilitySector; reason: string }>(
      `${API_ENDPOINTS.residents}/${id}/sectors`,
      { sector, reason },
    );
  }

  endSector(id: ResidentId, sector: VulnerabilitySector, reason: string): Observable<void> {
    // A DELETE that carries its reason: the membership ends, the audit entry stays.
    return this.api
      .delete<unknown, { reason: string }>(
        `${API_ENDPOINTS.residents}/${id}/sectors/${sector}`,
        { reason },
      )
      .pipe(map(() => undefined));
  }

  create(draft: ResidentDraft): Observable<Resident> {
    return this.api.post<Resident, ReturnType<typeof toWireResidentDraft>>(
      API_ENDPOINTS.residents,
      toWireResidentDraft(draft),
    );
  }

  /**
   * A correction takes the same twelve fields as a create, so it takes the same mapper.
   *
   * The endpoint derives its accepted set from `CorrectableField` rather than hand-writing it, and
   * that set is exactly what `toWireResidentDraft` produces — which is why the two agree without a
   * second mapper to keep in step.
   */
  update(id: ResidentId, draft: ResidentDraft): Observable<Resident> {
    return this.api.patch<Resident, ReturnType<typeof toWireResidentDraft>>(
      `${API_ENDPOINTS.residents}/${id}`,
      toWireResidentDraft(draft),
    );
  }

  /**
   * Activation is its own act, and the endpoint requires a reason this port does not carry.
   *
   * It PATCHed the resident with `{ isActive }`, which the correction endpoint does not accept —
   * retiring a registry record is not a field correction, and `POST .../activation` is where it
   * belongs. `DL-116`'s sibling rule applies: a record switched off is a record whose history must
   * stay attributable, so the server demands why.
   *
   * The port has no `reason` parameter, so one is composed here rather than sent blank. That is
   * weaker than asking the person — recorded as a gap — but far better than a required field
   * arriving empty, which the server would refuse and the screen would report as a failed save.
   */
  setActive(id: ResidentId, isActive: boolean): Observable<Resident> {
    return this.api.post<Resident, { is_active: boolean; reason: string }>(
      `${API_ENDPOINTS.residents}/${id}/activation`,
      {
        is_active: isActive,
        reason: isActive
          ? 'Reactivated from the resident registry.'
          : 'Retired from the resident registry.',
      },
    );
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
    // `members`, not `membership` — the API names the sub-resource being changed.
    return this.api.post<HouseholdDetail, { changes: readonly MembershipChange[]; reason: string }>(
      `${API_ENDPOINTS.households}/${id}/members`,
      { changes, reason },
    );
  }

  correctFactor(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    state: FactorState,
    reason: string,
  ): Observable<HouseholdDetail> {
    return this.api.post<HouseholdDetail, { code: VulnerabilityFactorCode; state: FactorState; reason: string }>(
      `${API_ENDPOINTS.households}/${id}/vulnerability-factors`,
      { code, state, reason },
    );
  }

  clearCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    reason: string,
  ): Observable<HouseholdDetail> {
    /*
     * A DELETE that carries a reason, which reads oddly and is what the API serves.
     *
     * The comment here used to argue that a withdrawal is a recorded act and therefore a POST:
     * *"there is nothing to delete, only something to say."* The doctrine is right and the verb
     * was the console's own invention — the server records the withdrawal as an event either way,
     * and `DELETE .../vulnerability-factors/{factor}` is the route that exists.
     */
    return this.api.delete<HouseholdDetail, { reason: string }>(
      `${API_ENDPOINTS.households}/${id}/vulnerability-factors/${code}`,
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
    /*
     * The subject is in the path and the other person is the payload.
     *
     * This posted all four fields to a collection route, where the API scopes relationships under
     * the resident they belong to. Recorded resident-to-resident so they survive either person
     * moving (`DL-47`), which is what the sub-resource shape expresses.
     */
    return this.api.post<Relationship, { related_resident_id: ResidentId; type: RelationshipKind; note: string }>(
      `${API_ENDPOINTS.residents}/${fromResidentId}/relationships`,
      { related_resident_id: toResidentId, type: kind, note: reason },
    );
  }

  /**
   * `DELETE admin/residents/{resident}/relationships/{relationship}`, carrying its reason.
   *
   * This posted to `.../{id}/end`, a route the console invented. The comment above it argued that
   * ending a relationship is a recorded act rather than a deletion and so must be a POST — the
   * doctrine is right and the verb was ours. The server records the event either way, and it is
   * the DELETE that exists.
   */
  endRelationship(
    residentId: ResidentId,
    id: RelationshipId,
    reason: string,
  ): Observable<Relationship> {
    return this.api.delete<Relationship, { reason: string }>(
      `${API_ENDPOINTS.residents}/${residentId}/relationships/${id}`,
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

  /**
   * The port's `reason` is **not accepted here**, because the endpoint has no field for it.
   *
   * `DL-48` holds that family history is append-only with a reason on every change, and
   * `POST admin/families/{family}/head` validates `resident_id` alone. The act is recorded on the
   * server's trail; the sentence explaining it is not. Recorded as a gap rather than smuggled into
   * a field that means something else.
   */
  changeMemberRole(
    familyId: FamilyId,
    residentId: ResidentId,
    role: FamilyRole,
  ): Observable<Family> {
    /*
     * ONLY THE HEAD IS SETTABLE, and the route says which act it is.
     *
     * This PATCHed `families/{}/members/{}`, where the API serves DELETE and nothing else — a
     * mismatch a path-only check cannot see, because the path is real. What exists is
     * `POST admin/families/{family}/head`, and the other family roles have no endpoint at all.
     *
     * Refused loudly rather than silently posting a head change for a role the caller did not ask
     * for. Who heads a family is a claim about that family (`DL-47`); quietly making somebody the
     * head because there was no route for "child" would be a worse answer than none.
     */
    if (role !== 'head') {
      return throwError(
        () =>
          new Error(
            'Only the head of a family can be set from here. Other family roles have no server ' +
              'counterpart yet.',
          ),
      );
    }

    return this.api.post<Family, { resident_id: ResidentId }>(
      `${API_ENDPOINTS.families}/${familyId}/head`,
      { resident_id: residentId },
    );
  }

  historyForResident(residentId: ResidentId): Observable<readonly RelationshipEvent[]> {
    return this.api.collection<RelationshipEvent>(
      `${API_ENDPOINTS.residents}/${residentId}/kinship-history`,
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

  /** POST to create, PATCH to update. There is no `drafts` sub-resource; a draft is a status. */
  saveDraft(draft: PostDraft, id: PostId | null): Observable<Post> {
    return id === null
      ? this.api.post<Post, ReturnType<typeof toWirePostDraft>>(
          API_ENDPOINTS.newsfeed,
          toWirePostDraft(draft),
        )
      : this.api.patch<Post, ReturnType<typeof toWirePostDraft>>(
          `${API_ENDPOINTS.newsfeed}/${id}`,
          toWirePostDraft(draft),
        );
  }

  /*
   * ── one transition endpoint, not a verb per act ────────────────────────────
   *
   * `publish`, `schedule` and `archive` were three invented routes. The API serves one
   * `POST .../status` carrying the target, which is the same shape as every other lifecycle in
   * this system — and the reason each of these screens *requires* now reaches the trail, which it
   * would not have done had these been wired without it.
   */
  publish(id: PostId, reason: string): Observable<Post> {
    return this.transition(id, 'published', reason);
  }

  schedule(id: PostId, at: IsoDateTime, reason: string): Observable<Post> {
    return this.transition(id, 'scheduled', reason, at);
  }

  archive(id: PostId, reason: string): Observable<Post> {
    return this.transition(id, 'archived', reason);
  }

  private transition(
    id: PostId,
    status: 'published' | 'scheduled' | 'archived' | 'draft',
    reason: string,
    publishAt?: IsoDateTime,
  ): Observable<Post> {
    /*
     * The body is one literal rather than a ternary between two.
     *
     * `check:wire-adoption` reads the argument to decide whether a payload was mapped, and a
     * conditional expression reads as an opaque value however wire-shaped both branches are. A
     * call site shaped so the check can see it is also the one a person can see, so this is not a
     * concession to the tool.
     */
    return this.api.post<Post, { status: string; reason: string; publish_at: IsoDateTime | null }>(
      `${API_ENDPOINTS.newsfeed}/${id}/status`,
      { status, reason, publish_at: publishAt ?? null },
    );
  }

  /** The API takes `is_pinned` and nothing else; the reason is recorded by the field moving. */
  setPinned(id: PostId, isPinned: boolean): Observable<Post> {
    return this.api.post<Post, { is_pinned: boolean }>(
      `${API_ENDPOINTS.newsfeed}/${id}/pin`,
      { is_pinned: isPinned },
    );
  }

  /**
   * A field on the post, not a status.
   *
   * The port's `reason` is deliberately **not accepted here**. Turning comments off is a setting,
   * the PATCH has no field for it, and the trail records the field that moved. An implementation
   * may take fewer parameters than its interface, which says that more honestly than a parameter
   * named to look ignored.
   */
  setCommentsEnabled(id: PostId, enabled: boolean): Observable<Post> {
    return this.api.patch<Post, { comments_enabled: boolean }>(
      `${API_ENDPOINTS.newsfeed}/${id}`,
      { comments_enabled: enabled },
    );
  }

  /** The moderation queue is one global collection, filtered by post. */
  comments(postId: PostId, filter: CommentFilter): Observable<readonly Comment[]> {
    return this.api.collection<Comment>(API_ENDPOINTS.newsfeedComments, {
      ...toParams(filter),
      post: postId,
    });
  }

  moderate(
    commentId: CommentId,
    action: ModerationAction,
    text: string,
  ): Observable<Comment> {
    return this.api.post<Comment, { moderation_state: ModerationAction; reason: string }>(
      `${API_ENDPOINTS.newsfeedComments}/${commentId}/moderation`,
      { moderation_state: action, reason: text },
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

  /**
   * The entry itself. There is no `/values` sub-resource and there must not be.
   *
   * `DL-114` splits the row from the recorded values, and this adapter asked for the second tier
   * at a URL nobody serves. The API records **which fields moved and never what they became**
   * (G-33), so the detail read is the entry — the split is achieved by the trail holding no
   * values at all, which is stronger than a permission on a second endpoint.
   */
  auditDetail(id: AuditEntryId): Observable<AuditEntryDetail | null> {
    return this.api.optionalItem<AuditEntryDetail>(`${API_ENDPOINTS.audit}/${id}`);
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
    return this.api.post<SavedView, ReturnType<typeof toWireSavedViewDraft>>(
      API_ENDPOINTS.savedViews,
      toWireSavedViewDraft(draft),
    );
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

  listRequirementTemplates(id: ProgramId): Observable<readonly RequirementTemplate[]> {
    return this.api.collection<RequirementTemplate>(
      `${API_ENDPOINTS.programsAdmin}/${id}/requirement-templates`,
    );
  }

  /**
   * POST to create, PATCH to update. The server applies the same responsibility
   * rule (`DL-65`): a client that let a national programme be recorded as
   * municipally owned must still be refused.
   */
  save(draft: ProgramDraft, id: ProgramId | null): Observable<AssistanceProgram> {
    /*
     * WRITES GO TO `admin/programs`, READS TO THE PUBLIC CATALOG.
     *
     * Both of these posted to `programs` — the surface a resident may browse, which the API serves
     * GET-only. The path existed, so the route check passed it until the check learned to compare
     * verbs; the request would have been refused by a router that never reached the application.
     */
    return id === null
      ? this.api.post<AssistanceProgram, ProgramDraft>(API_ENDPOINTS.programsAdmin, draft)
      : this.api.patch<AssistanceProgram, ProgramDraft>(
          `${API_ENDPOINTS.programsAdmin}/${id}`,
          draft,
        );
  }

  /*
   * Utilisation is an ADMIN read, not a public-catalog one.
   *
   * `programs` is the public surface a resident may browse; how much of a programme's funds have
   * been drawn is office information, and the API places it under `admin/` accordingly. Reading it
   * from the catalog path was both a 404 and, had it worked, a disclosure.
   */
  utilizationFor(id: ProgramId): Observable<ProgramUtilization> {
    return this.api.item<ProgramUtilization>(
      `${API_ENDPOINTS.programsAdmin}/${id}/utilization`,
    );
  }

  utilizationSummary(): Observable<readonly ProgramUtilization[]> {
    return this.api.collection<ProgramUtilization>(
      `${API_ENDPOINTS.programsAdmin}/utilization`,
    );
  }

  listActive(): Observable<readonly AssistanceProgram[]> {
    return this.api.collection<AssistanceProgram>(API_ENDPOINTS.programs, { status: 'active' });
  }
}

@Injectable()
export class HttpAssistanceRequestRepository implements AssistanceRequestRepository {
  private readonly api = inject(ApiClient);
  private readonly files = inject(FileTransport);

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
    /*
     * ONE transition endpoint, and the field is `to` (ADR 0007 §2).
     *
     * This posted `{ status, reason }` to a `/status` route that does not exist. Both halves were
     * wrong, and the payload half is the one no path check can see.
     */
    return this.api.post<AssistanceRequest, { to: AssistanceRequestStatus; reason: string | null }>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/transitions`,
      { to, reason },
    );
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
    /*
     * An intake is its own resource; `assistance-requests/drafts` was never one.
     *
     * The update half has **no counterpart**: the API serves `POST admin/assistance-intakes` and
     * no PATCH beside it, so re-saving a draft after the first save cannot round-trip. Left
     * pointing at the intake resource rather than silently re-creating, because a PATCH to a route
     * that does not exist fails loudly where a second POST would quietly produce a second draft —
     * and `DL-63` exists precisely so a retried create cannot become two records.
     */
    return id === null
      ? this.api.post<AssistanceRequest, IntakeDraft>(API_ENDPOINTS.assistanceIntakes, draft)
      : this.api.patch<AssistanceRequest, IntakeDraft>(
          `${API_ENDPOINTS.assistanceIntakes}/${id}`,
          draft,
        );
  }

  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> {
    /*
     * Submitting is a transition, not a route of its own.
     *
     * The encoder's SENTENCE travels as the reason — not the acknowledgement object serialised.
     * `DL-60` requires that a caution asks for a sentence before filing and that the sentence is
     * kept, and a reason field is read by a person in a trail: JSON in it is a sentence nobody
     * reads. The codes, actor and timestamp the object also carries are the server's own to
     * record, and duplicating them into free text would put a second, unparsed copy of the trail
     * inside the trail.
     *
     * It is not smuggled into `applicant_message`: that field is what the resident is told, and an
     * internal acknowledgement is not a message to the applicant.
     */
    return this.api.post<AssistanceRequest, { to: 'submitted'; reason: string | null }>(
      `${API_ENDPOINTS.assistanceRequests}/${id}/transitions`,
      { to: 'submitted', reason: acknowledgement?.reason ?? null },
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
    /*
     * ── the bytes go over multipart, not as JSON ────────────────────────────────
     *
     * This posted the draft as a JSON body. The endpoint reads `$request->file('file')`, and the
     * draft carried file *metadata* rather than a file — so an upload could never have worked, and
     * `FileTransport` (built for exactly this in TAB 09, with progress, cancellation and 413
     * handling) was injected by nothing but its own spec.
     *
     * POST, never PUT: recording a document appends a version to a history and never replaces one
     * (`DL-77`). The verb is part of the contract.
     *
     * Only the completed upload is surfaced here, because the port returns the updated request.
     * The progress events `FileTransport` emits are for a screen that shows a bar; a screen that
     * wants one calls the transport directly rather than having this method grow a second shape.
     */
    const path = `${API_ENDPOINTS.assistanceRequests}/${id}/requirements/${requirementId}/documents`;

    if (draft.file === null) {
      // A source that holds no file is a real record — a document seen at the counter and handed
      // back. It needs no multipart request, and `documentProblems` has already refused the
      // combinations that make no sense.
      return this.api.post<AssistanceRequest, ReturnType<typeof toWireDocumentVersion>>(
        path,
        toWireDocumentVersion(draft),
      );
    }

    return this.files.upload(path, draft.file, UPLOAD_POLICY, toWireDocumentVersion(draft)).pipe(
      filter((progress): progress is Extract<UploadProgress, { kind: 'done' }> =>
        progress.kind === 'done',
      ),
      map((progress) => (progress.response as ApiItemResponse<AssistanceRequest>).data),
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
export class HttpReleaseRepository implements ReleaseRepository {
  private readonly api = inject(ApiClient);

  list(
    filter: ReleaseFilter,
    page: PageRequest<ReleaseSortField>,
  ): Observable<Page<Release>> {
    return this.api.page<Release>(API_ENDPOINTS.releases, page, toParams(filter));
  }

  getById(id: ReleaseId): Observable<Release | null> {
    return this.api.optionalItem<Release>(`${API_ENDPOINTS.releases}/${id}`);
  }

  listForRequest(id: AssistanceRequestId): Observable<readonly Release[]> {
    return this.api.collection<Release>(API_ENDPOINTS.releases, { requestId: id });
  }

  /** A filter on the collection, not a resource of its own. */
  queue(filter: ReleaseFilter): Observable<readonly Release[]> {
    return this.api.collection<Release>(API_ENDPOINTS.releases, toParams(filter));
  }

  /**
   * Read off the release itself, because there is no approver endpoint and there should not be.
   *
   * This asked for `/{id}/approver`, which 404s. The API snapshots `approved_by` onto the release
   * at creation — deliberately not read through to the case at release time, so a later
   * reassignment cannot rewrite who authorised this specific payment (ADR 0023 §3). That makes the
   * approver a **field of the record**, and a second endpoint returning it would be a second
   * answer that could disagree with the first.
   *
   * `DL-91` needs it to warn before a self-release, and one read is enough.
   */
  approverFor(id: ReleaseId): Observable<StaffUserId | null> {
    return this.getById(id).pipe(map((release) => release?.approvedBy ?? null));
  }

  listBatches(): Observable<readonly ReleaseBatch[]> {
    return this.api.collection<ReleaseBatch>(API_ENDPOINTS.releaseBatches);
  }

  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null> {
    return this.api.optionalItem<ReleaseBatch>(`${API_ENDPOINTS.releaseBatches}/${id}`);
  }

  /**
   * Opens a payout session, then adds each release to it as its own act.
   *
   * The API takes the session on its own and members through
   * `POST admin/release-batches/{batch}/releases`, one at a time. That is the API's shape and it is
   * the right one: a batch arriving with its membership baked in would make "when did this family
   * get scheduled" unanswerable, because there would be no separate act to record.
   *
   * **The session survives a member that fails.** `concatMap` adds them in order and a failure
   * stops the chain, returning the batch as it stands — so an officer sees a session holding the
   * families that made it rather than losing the session entirely. `DL-90` already says a batch
   * has no status of its own and what it amounts to is derived by counting its members; a
   * half-filled session is a countable, visible state rather than an error.
   *
   * The idempotency key covers the session itself. Adding a member is naturally idempotent — the
   * server sets `release_batch_id`, so a replay writes the same value.
   */
  createBatch(draft: ReleaseBatchDraft, intent: WriteIntent): Observable<ReleaseBatch> {
    return this.api
      .post<ReleaseBatch, ReturnType<typeof toWireReleaseBatch>>(
        API_ENDPOINTS.releaseBatches,
        toWireReleaseBatch(draft),
        intent,
      )
      .pipe(
        switchMap((batch) =>
          draft.releaseIds.length === 0
            ? of(batch)
            : from(draft.releaseIds).pipe(
                concatMap((releaseId) =>
                  this.api.post<unknown, { release_id: ReleaseId }>(
                    `${API_ENDPOINTS.releaseBatches}/${batch.id}/releases`,
                    { release_id: releaseId },
                  ),
                ),
                toArray(),
                map(() => batch),
                catchError(() => of(batch)),
              ),
        ),
      );
  }

  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null> {
    // Server-composed, like the referral summary. This adapter must never
    // assemble a manifest client-side from fuller records (`DL-92`).
    return this.api.optionalItem<ReleaseManifest>(
      `${API_ENDPOINTS.releaseBatches}/${id}/manifest`,
    );
  }

  markReleased(
    id: ReleaseId,
    instrumentReference: string | null,
    remarks: string | null,
    intent: WriteIntent,
  ): Observable<Release> {
    /*
     * `/confirmation` IS THE MONEY WRITE — this posted to `/release`, which does not exist.
     *
     * The endpoint carries the segregation-of-duties check, the row lock and the idempotency
     * contract together, which is why the API refuses to reach `released` through the generic
     * status route at all.
     */
    return this.api.post<
      Release,
      { instrument_reference: string | null; remarks: string | null }
    >(
      `${API_ENDPOINTS.releases}/${id}/confirmation`,
      { instrument_reference: instrumentReference, remarks },
      intent,
    );
  }

  acknowledge(
    id: ReleaseId,
    acknowledgement: ReleaseAcknowledgementDraft,
    intent: WriteIntent,
  ): Observable<Release> {
    /*
     * The receipt is the move to `completed`, and the two vocabularies do not line up.
     *
     * The console's `kind` mixes **how** the receipt was evidenced with **who** gave it —
     * `representative` is a relationship, not a method. The API keeps those apart, which is the
     * better model, so the mapping splits them: a representative's collection is recorded as
     * witnessed, with the authority they presented in `acknowledged_relationship`.
     *
     * Lossy in one direction and recorded as such: a representative who signed is stored as
     * witnessed rather than signed. The console cannot currently express both, and inventing a
     * method the clerk did not choose would be worse than a coarser true one.
     */
    const method: Readonly<Record<AcknowledgementKind, string>> = {
      signature: 'signature',
      thumbprint: 'thumbmark',
      digital: 'digital-confirmation',
      representative: 'witnessed',
    };

    return this.api.post<
      Release,
      {
        status: 'completed';
        acknowledged_by_name: string | null;
        acknowledged_relationship: string | null;
        acknowledgement_method: string;
      }
    >(
      `${API_ENDPOINTS.releases}/${id}/status`,
      {
        status: 'completed',
        acknowledged_by_name: acknowledgement.collectedBy,
        acknowledged_relationship: acknowledgement.authority,
        acknowledgement_method: method[acknowledgement.kind],
      },
      intent,
    );
  }

  deferRelease(
    id: ReleaseId,
    reason: DeferralReason,
    remarks: string,
    intent: WriteIntent,
  ): Observable<Release> {
    /*
     * Deferral is a status, and the reason is one string on the wire.
     *
     * `DL-94` still holds where it matters: every `DeferralReason` the console offers is the
     * office's own failing, and non-attendance is `unclaimed`, which maps to the API's `failed`.
     * Collapsing the code and the remarks into one sentence loses no distinction the server draws.
     */
    return this.api.post<Release, { status: 'deferred'; reason: string }>(
      `${API_ENDPOINTS.releases}/${id}/status`,
      { status: 'deferred', reason: `${reason}: ${remarks}` },
      intent,
    );
  }

  changeStatus(
    id: ReleaseId,
    to: ReleaseStatus,
    reason: string,
    intent: WriteIntent,
  ): Observable<Release> {
    return this.api.post<Release, { to: ReleaseStatus; reason: string }>(
      `${API_ENDPOINTS.releases}/${id}/status`,
      { to, reason },
      intent,
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
    // The ordering is still the server's: overdue-first depends on today's date, and two clients
    // in different time zones must not disagree about the queue. What changed is that the queue is
    // a filter on the collection rather than a resource of its own.
    return this.api.collection<Referral>(API_ENDPOINTS.referrals, toParams(filter));
  }

  createDraft(draft: ReferralDraft): Observable<Referral> {
    return this.api.post<Referral, ReturnType<typeof toWireReferralDraft>>(
      API_ENDPOINTS.referrals,
      toWireReferralDraft(draft),
    );
  }

  recordDisclosureBasis(
    id: ReferralId,
    basis: DisclosureBasis,
    note: string,
  ): Observable<Referral> {
    return this.api.post<Referral, { basis: DisclosureBasis; note: string }>(
      `${API_ENDPOINTS.referrals}/${id}/authority`,
      { basis, note },
    );
  }

  shareField(id: ReferralId, field: SharedField, because: string): Observable<Referral> {
    return this.api.post<Referral, { field: SharedField; because: string }>(
      `${API_ENDPOINTS.referrals}/${id}/shared-fields`,
      { field, because },
    );
  }

  /**
   * No body, because there is nothing left to say.
   *
   * This posted a whole `DisclosurePlan` to an endpoint that **accepts none** — the basis and the
   * fields are recorded before this point, and the server checks the basis inside the row lock
   * before performing the transition.
   */
  send(id: ReferralId): Observable<Referral> {
    return this.api.post<Referral, Record<string, never>>(
      `${API_ENDPOINTS.referrals}/${id}/send`,
      {},
    );
  }

  summaryFor(id: ReferralId): Observable<ReferralSummarySheet | null> {
    return this.api.optionalItem<ReferralSummarySheet>(
      `${API_ENDPOINTS.referrals}/${id}/summary`,
    );
  }

  /*
   * ── the path was right and the payload was not ─────────────────────────────
   *
   * `changeStatus` already posted to `/status`, so no path check could see it — and it sent
   * `{ to, reason }` where the API validates `{ status, outcome }`. Laravel would have refused it
   * 422 with `status` missing, on every status change of every referral.
   *
   * That is a second class of defect underneath the wrong-path one, and nothing in this repository
   * looks for it: the request body is a TypeScript literal the compiler happily accepts and the
   * server has never seen.
   */
  changeStatus(id: ReferralId, to: ReferralStatus, reason: string): Observable<Referral> {
    return this.api.post<Referral, { status: ReferralStatus; outcome: string }>(
      `${API_ENDPOINTS.referrals}/${id}/status`,
      { status: to, outcome: reason },
    );
  }

  /** The outcome is carried on the status transition; it was never its own route. */
  recordOutcome(id: ReferralId, outcome: string, status: ReferralStatus): Observable<Referral> {
    return this.api.post<Referral, { status: ReferralStatus; outcome: string }>(
      `${API_ENDPOINTS.referrals}/${id}/status`,
      { status, outcome },
    );
  }

  /**
   * The follow-up date is a field, not a route.
   *
   * The port's `reason` is deliberately **not accepted here**, and specifically not written to the
   * PATCH's own `reason` field — that one is why the *client* is being referred, and overwriting it
   * with why a follow-up moved would corrupt the referral itself.
   */
  reschedule(id: ReferralId, followUpOn: IsoDate): Observable<Referral> {
    return this.api.patch<Referral, { follow_up_on: IsoDate }>(
      `${API_ENDPOINTS.referrals}/${id}`,
      { follow_up_on: followUpOn },
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

  /*
   * ── a beneficiary has no sub-resources, because a beneficiary is not a record ──────
   *
   * These three asked for `admin/beneficiaries/{id}/…`, and none of those paths exists. The API
   * serves each as a **filtered collection of the thing itself** — enrollments, duplicate pairs,
   * findings — which is the wire expressing `DL-71`: there is no `Beneficiary` entity and no
   * `BeneficiaryId`. The registry is a projection over residents, keyed on `ResidentId` throughout.
   *
   * Reading them as sub-resources of a beneficiary was the console asserting an entity the whole
   * model denies, and every one of the three 404s.
   */
  enrollmentsFor(id: ResidentId): Observable<readonly ProgramEnrollment[]> {
    return this.api.collection<ProgramEnrollment>(API_ENDPOINTS.enrollments, {
      residentId: id,
    });
  }

  duplicateQueue(page: PageRequest): Observable<Page<DuplicateCandidate>> {
    return this.api.page<DuplicateCandidate>(API_ENDPOINTS.identityReview, page);
  }

  duplicatesFor(id: ResidentId): Observable<readonly DuplicateCandidate[]> {
    return this.api.collection<DuplicateCandidate>(API_ENDPOINTS.identityReview, {
      residentId: id,
    });
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

  /**
   * The findings recorded against **this resident**, which is where the API keeps them.
   *
   * `admin/residents/{resident}/duplicate-findings` — the per-record history TAB 07 added so that
   * a decided pair stops resurfacing in the queue while staying readable on the record it concerns.
   */
  resolutionsFor(id: ResidentId): Observable<readonly IdentityResolution[]> {
    return this.api.collection<IdentityResolution>(
      `${API_ENDPOINTS.residents}/${id}/duplicate-findings`,
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

  /** A scope on the collection, not a resource of its own. */
  mine(filter: FieldVisitFilter): Observable<readonly FieldVisit[]> {
    return this.api.collection<FieldVisit>(API_ENDPOINTS.fieldVisits, {
      ...toParams(filter),
      scope: 'mine',
    });
  }

  forResident(id: ResidentId): Observable<readonly FieldVisit[]> {
    return this.api.collection<FieldVisit>(API_ENDPOINTS.fieldVisits, { residentId: id });
  }

  schedule(draft: FieldVisitDraft): Observable<FieldVisit> {
    return this.api.post<FieldVisit, ReturnType<typeof toWireFieldVisitDraft>>(
      API_ENDPOINTS.fieldVisits,
      toWireFieldVisitDraft(draft),
    );
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
    return this.api.post<FieldVisit, ReturnType<typeof toWireVisitOutcome>>(
      `${API_ENDPOINTS.fieldVisits}/${id}/conclusion`,
      toWireVisitOutcome(outcome),
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
    return id === null
      ? this.api.post<LguEvent, ReturnType<typeof toWireEventDraft>>(
          API_ENDPOINTS.events,
          toWireEventDraft(draft),
        )
      : this.api.patch<LguEvent, ReturnType<typeof toWireEventDraft>>(
          `${API_ENDPOINTS.events}/${id}`,
          toWireEventDraft(draft),
        );
  }

  /*
   * Four invented verbs onto the one transition the API serves. `DL-131` holds either way:
   * cancelling is one-way and an event that is back on is a new event naming the old, which is a
   * rule about what the console offers rather than about the shape of the request.
   */
  publish(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.transition(id, 'published', reason);
  }

  cancel(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.transition(id, 'cancelled', reason);
  }

  complete(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.transition(id, 'completed', reason);
  }

  archive(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.transition(id, 'archived', reason);
  }

  private transition(id: LguEventId, status: string, reason: string): Observable<LguEvent> {
    return this.api.post<LguEvent, { status: string; reason: string }>(
      `${API_ENDPOINTS.events}/${id}/status`,
      { status, reason },
    );
  }

  registrants(id: LguEventId, filter: RegistrantFilter): Observable<readonly RegistrantView[]> {
    return this.api.collection<RegistrantView>(
      `${API_ENDPOINTS.events}/${id}/registrations`,
      toParams(filter),
    );
  }

  /** `DL-129`: this carries the server's `asOf`, and the server decides who gets the last place. */
  capacity(id: LguEventId): Observable<EventCapacitySummary> {
    return this.api.item<EventCapacitySummary>(
      `${API_ENDPOINTS.events}/${id}/registration-summary`,
    );
  }

  metrics(id: LguEventId): Observable<EventMetrics> {
    return this.api.item<EventMetrics>(`${API_ENDPOINTS.events}/${id}/metrics`);
  }

  /**
   * A registration belongs to an event, and the route says so.
   *
   * This used to post to `events/registrations/{id}` — a top-level collection that does not
   * exist. The API scopes every registration under its event, which is also what lets it
   * authorize the act against the event rather than against a bare identifier.
   *
   * Three routes rather than one action field: cancel, restore and promote are genuinely
   * different acts, and promotion is **attempted** rather than predicted (`DL-129`) — the caller
   * reads back what the server did instead of deciding in advance that a place was free.
   */
  actOnRegistration(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView> {
    const base = `${API_ENDPOINTS.events}/${eventId}/registrations`;

    switch (action) {
      case 'promote':
        return this.api.post<RegistrantView, { reason: string }>(`${base}/promote`, { reason });
      case 'cancel':
        return this.api.post<RegistrantView, { reason: string }>(
          `${base}/${registrationId}/cancel`,
          { reason },
        );
      case 'restore':
        return this.api.post<RegistrantView, { reason: string }>(
          `${base}/${registrationId}/restore`,
          { reason },
        );
      case 'waitlist':
        /*
         * NO ENDPOINT, AND DELIBERATELY NOT COLLAPSED INTO `restore`.
         *
         * The API serves cancel, restore and promote. Moving somebody *onto* the waitlist has no
         * route, and the tempting one-line version — a ternary treating anything that is not
         * `cancel` as `restore` — would silently give a resident a confirmed place when the clerk
         * asked to waitlist them. A person's place at an event is not a field to guess at.
         *
         * Refused loudly here and recorded as a gap, so the screen surfaces it rather than the
         * office discovering it at the door.
         */
        return throwError(
          () =>
            new Error(
              'Moving a registration onto the waitlist has no server counterpart yet. ' +
                'Cancel the registration instead, or record the change on the day.',
            ),
        );
    }
  }

  markAttendance(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    attendance: AttendanceStatus,
  ): Observable<RegistrantView> {
    return this.api.post<RegistrantView, { attendance: AttendanceStatus }>(
      `${API_ENDPOINTS.events}/${eventId}/registrations/${registrationId}/attendance`,
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
