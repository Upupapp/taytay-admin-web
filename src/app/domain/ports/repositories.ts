import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { DocumentUpload } from '../requirements/upload-policy';

import type { WriteIntent } from '../shared/write-intent';

import type {
  ReportDefinition,
  ReportId,
} from '../reports/report-definition';
import type {
  ExportFormat,
  ReportExport,
  ReportFilter,
  ReportResult,
} from '../reports/report-result';
import type {
  AuditEntryDetail,
  AuditFilter,
  AuditRow,
} from '../governance/audit-view';
import type { CorrectionRequest } from '../governance/correction-request';
import type {
  Comment,
  CommentFilter,
  ModerationAction,
} from '../newsfeed/comment';
import type { Post, PostDraft, PostFilter, PostView } from '../newsfeed/post';
import type { EventDraft, EventFilter, EventView, LguEvent } from '../events/event';
import type {
  AttendanceStatus,
  EventCapacitySummary,
  EventMetrics,
  RegistrantExport,
  RegistrantFilter,
  RegistrantView,
  RegistrationAction,
} from '../events/registration';
import type { ClassifiedRecordType } from '../governance/data-classification';
import type { RetentionRule } from '../governance/retention';
import type { StaffAccount } from '../governance/staff-profile';
import type { SearchResults } from '../search/search-result';
import type { OfficeAlert } from '../work/office-alert';
import type { TeamQueue, WorkQueue } from '../work/work-queue';
import type {
  AssistanceRequest,
  AssistanceRequestFilter,
  AssistanceRequestStatus,
  RequestApproval,
  RequestNote,
  RequestNoteDraft,
  RequirementStatus,
  SocialWorker,
} from '../assistance/assistance-request';
import type {
  BeneficiaryDetail,
  BeneficiaryFilter,
  BeneficiarySortField,
  BeneficiarySummary,
} from '../beneficiaries/beneficiary';
import type {
  DuplicateCandidate,
  IdentityResolution,
  IdentityResolutionDraft,
  MergePreview,
} from '../beneficiaries/duplicate-review';
import type {
  DocumentRequest,
  DocumentRequestDraft,
} from '../requirements/document-request';
import type { DocumentVersionDraft } from '../requirements/requirement-document';
import type { ConditionalApplicability } from '../requirements/requirement-obligation';
import type {
  AssessmentAnswers,
  AssessmentTemplate,
  OpenAssessment,
} from '../intake/assessment-template';
import type { AssessmentDraft } from '../intake/assessment';
import type { AdvisoryAcknowledgement, IntakeAdvisory } from '../intake/intake-advisory';
import type { IntakeDraft } from '../intake/intake-draft';
import type { AuthenticatedUser, StaffFilter, StaffUser } from '../access/staff-user';
import type { MfaCredentials, SignInCredentials, SignInOutcome } from '../access/credentials';
import type { AppNotification } from '../notifications/notification';
import type { AssistanceProgram, ProgramDraft, ProgramFilter } from '../programs/program';
import type {
  ProgramUtilizationReading,
  ProgramUtilizationSummary,
} from '../programs/program-utilization';
import type {
  RequirementTemplate,
  RequirementTemplateDraft,
} from '../programs/requirement-template';
import type { DashboardFilter, DashboardSummary } from '../dashboard/dashboard-summary';
import type {
  AcknowledgementKind,
  DeferralReason,
  Release,
  ReleaseFilter,
  ReleaseDraft,
  ReleaseStatus,
} from '../releases/release';
import type {
  ReleaseBatch,
  ReleaseBatchDraft,
} from '../releases/release-batch';
import type { ReleaseManifest } from '../releases/release-manifest';
import type {
  Resident,
  ResidentDraft,
  ResidentFilter,
  VulnerabilitySector,
} from '../residents/resident';
import type {
  HouseholdDraft,
  HouseholdFilter,
  MembershipChange,
} from '../households/household';
import type { HouseholdDetail, HouseholdSummary } from '../households/household-profile';
import type {
  AppAccountId,
  BalitaArticleId,
  DigitalIdId,
  DocumentRequestId,
  DuplicatePairId,
  HomeBannerId,
  HotlineId,
  MediaId,
  OfficeId,
  OfficeThreadId,
  QuickLinkId,
  TulongServiceId,
  VerificationRequestId,
} from '../shared/ids';
import type {
  InboxListing,
  OfficeThread,
  ThreadMessage,
} from '../inbox/office-thread';
import type { Office } from '../offices/office';
import type {
  AccountBarangay,
  AccountRole,
  AppAccount,
  OfficeRoleChange,
} from '../accounts/app-account';
import type { DirectoryOffice, OfficeChanges, OfficeDraft } from '../directory/directory-office';
import type { Hotline, HotlineChanges, HotlineDraft } from '../directory/hotline';
import type { ServiceChanges, ServiceDraft, TulongService } from '../directory/tulong-service';
import type {
  BannerDraft,
  BannerImageChange,
  HomeBanner,
  HomePreview,
  LinkDraft,
  QuickLink,
} from '../home/home-screen';
import type { AppConfig, AppConfigChanges } from '../app-config/app-config';
import type { DigitalIdCard, DigitalIdHolder } from '../digital-ids/digital-id';
import type { PlatformAuditEntry } from '../platform-audit/platform-audit';
import type {
  BalitaArticle,
  BalitaCategory,
  BalitaChanges,
  BalitaDraft,
} from '../balita/balita-article';
import type {
  VerificationFilter,
  VerificationImageKind,
  VerificationRequest,
} from '../verification/verification-request';
import type {
  Family,
  FamilyDraft,
  FamilyFilter,
  FamilyRole,
  ResidentTransfer,
} from '../families/family';
import type { FamilyDetail, FamilySummary } from '../families/family-graph';
import type { CaseNoteSensitivity } from '../cases/case-note';
import type { CaseTaskDraft } from '../cases/case-task';
import type { CaseSummary, CaseWorkspace } from '../cases/case-workspace';
import type {
  CaseFilter,
  CaseOpenDraft,
  CaseQueueCount,
  CaseStatus,
} from '../cases/social-case';
import type { Relationship, RelationshipKind } from '../families/relationship';
import type { RelationshipEvent } from '../families/relationship-event';
import type { FactorState, VulnerabilityFactorCode } from '../households/household-vulnerability';
import type { ResidentView } from '../residents/resident-disclosure';
import type { ResidentProfile } from '../residents/resident-profile';
import type {
  Referral,
  ReferralDraft,
  ReferralFilter,
  ReferralStatus,
} from '../referrals/referral';
import type {
  DisclosureBasis,
  ReferralSummarySheet,
  SharedField,
} from '../referrals/referral-disclosure';
import type {
  FieldVisit,
  FieldVisitDraft,
  FieldVisitFilter,
  VisitOutcomeDraft,
  VisitChecklistSelection,
} from '../visits/field-visit';
import type { VisitObservationDraft } from '../visits/visit-observation';
import type {
  ServiceProvider,
  ServiceProviderFilter,
} from '../referrals/service-provider';
import type { SavedView, SavedViewDraft, SavedViewResource } from '../views/saved-view';
import type { CursorPage, CursorRequest, Page, PageRequest } from '../shared/pagination';
import type {
  AssistanceRequestId,
  AuditEntryId,
  PostId,
  CaseId,
  CaseTaskId,
  CommentId,
  ReleaseId,
  DocumentVersionId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  NotificationId,
  ProgramId,
  FamilyId,
  ReferralId,
  ReleaseBatchId,
  EventRegistrationId,
  LguEventId,
  RelationshipId,
  RequirementId,
  ResidentId,
  FieldVisitId,
  SavedViewId,
  ServiceProviderId,
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
  /**
   * One cursor page, alphabetical by surname then given name — the server's order, not one a
   * caller picks (`DL-174`). The Node API pages by cursor and sends no total, so this says "more
   * are available" and never "page 2 of 9" (`DL-161`).
   */
  list(filter: ResidentFilter, page: CursorRequest): Observable<CursorPage<ResidentView>>;
  getById(id: ResidentId): Observable<ResidentView | null>;
  /**
   * Resident, household, family and assistance history in one call — the
   * traceability guarantee of the registry. `null` for "not found *or* not
   * yours", which are deliberately indistinguishable (`DL-31`).
   */
  getProfile(id: ResidentId): Observable<ResidentProfile | null>;
  create(draft: ResidentDraft): Observable<Resident>;
  update(id: ResidentId, draft: ResidentDraft): Observable<Resident>;
  /**
   * Registry records are retired, never deleted: history must stay attributable. Retiring and
   * restoring each carry a reason, kept with the change on the server (`DL-174`): a record that
   * left the registry with no word as to why is one nobody can safely bring back.
   */
  setActive(id: ResidentId, isActive: boolean, reason: string): Observable<Resident>;

  /**
   * Records that a resident belongs to a statutory sector.
   *
   * **A recorded act with a reason, not a field on the draft.** Each sector rests on something
   * somebody checked — a Senior Citizen ID, a PWD card, a Solo Parent ID — and `create` carries no
   * way to say what that was or who saw it. So sectors are not part of `ResidentDraft`'s round
   * trip, and `toWireResidentDraft` deliberately drops them.
   *
   * `vawc-survivor` and `cicl` additionally need `request.view-sensitive`: recording somebody as a
   * VAWC survivor is a protection decision, not a checkbox, and the server refuses it without the
   * grant regardless of what this client offers.
   */
  recordSector(
    id: ResidentId,
    sector: VulnerabilitySector,
    reason: string,
  ): Observable<void>;

  /**
   * Ends a sectoral membership, with a reason.
   *
   * A solo parent whose child turns eighteen stops being one, and the office needs to say when and
   * why. Removing a safeguarding sector is gated identically to adding one — it is the act that
   * would hide a protection decision from everybody relying on it.
   */
  endSector(id: ResidentId, sector: VulnerabilitySector, reason: string): Observable<void>;
}

export const RESIDENT_REPOSITORY = new InjectionToken<ResidentRepository>('ResidentRepository');

/**
 * The household as a service-delivery unit.
 *
 * Two things this port deliberately does **not** offer: any method that returns
 * an eligibility, entitlement or grant decision, and any way to set a
 * vulnerability factor without a reason. Both absences are load-bearing
 * (`DL-42`) and `tools/check-vulnerability.mjs` fails the build if either
 * appears.
 */
export interface HouseholdRepository {
  /**
   * One cursor page, by reference number — the server's order, not one a caller picks. The API
   * sends no total, so a screen says "more are available" and never "page 2 of 9" (`DL-161`).
   */
  list(filter: HouseholdFilter, page: CursorRequest): Observable<CursorPage<HouseholdSummary>>;
  getById(id: HouseholdId): Observable<HouseholdDetail | null>;
  /**
   * Registers a household with its head as its one member. Everybody else joins through
   * `changeMembership`, each with a reason. A head already under another roof is refused as a
   * `HouseholdCompositionError`, never moved: one person, one household.
   */
  create(draft: HouseholdDraft): Observable<HouseholdDetail>;
  /**
   * Applies composition changes **transactionally**: either every change lands
   * and both sides of the household/resident link agree, or nothing moves and
   * the caller is told which invariant would have broken.
   */
  changeMembership(
    id: HouseholdId,
    changes: readonly MembershipChange[],
    reason: string,
  ): Observable<HouseholdDetail>;
  /** Overrides one computed factor. The reason is required, not decorative. */
  correctFactor(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    state: FactorState,
    reason: string,
  ): Observable<HouseholdDetail>;
  /** Withdraws an override and lets the computation speak again. */
  clearCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    reason: string,
  ): Observable<HouseholdDetail>;
}

export const HOUSEHOLD_REPOSITORY = new InjectionToken<HouseholdRepository>('HouseholdRepository');

/**
 * Families and the relationships between people.
 *
 * Separate from `HouseholdRepository` because the two answer different
 * questions: a household is an address and a family is a claim about people,
 * and one address routinely holds several families (`DL-47`).
 *
 * Every mutation takes a **reason** and appends an immutable event rather than
 * replacing what was there. Nothing in this port deletes history (`DL-48`).
 */
export interface FamilyRepository {
  /**
   * One cursor page, by reference number — the server's order, not one a caller picks. The API
   * sends no total, so a screen says "more are available" and never "page 2 of 9" (`DL-161`).
   */
  list(filter: FamilyFilter, page: CursorRequest): Observable<CursorPage<FamilySummary>>;
  getById(id: FamilyId): Observable<FamilyDetail | null>;
  /**
   * Records a family with its founding members, each with a role, and the household it lives in or
   * none. The reason is kept with the forming and with each member's joining (`DL-48`). A draft the
   * registry cannot hold is refused whole as a `FamilyDraftInvalidError`, and nothing is written.
   */
  create(draft: FamilyDraft, reason: string): Observable<FamilyDetail>;
  /** Every family a resident currently belongs to. Plural: people overlap. */
  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]>;

  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
  ): Observable<Relationship>;
  /**
   * Ends a relationship between two people, with a reason, without deleting it: a former guardian
   * still was one.
   *
   * Takes the **subject** as well as the relationship, because the API scopes relationships under
   * the resident they are about — the same shape as recording one. A relationship is recorded
   * resident-to-resident so it survives either person moving (`DL-47`), and the route says so.
   *
   * The standing ends and the event stays (`DL-48`). Nothing here removes what was true before.
   */
  endRelationship(
    residentId: ResidentId,
    id: RelationshipId,
    reason: string,
  ): Observable<Relationship>;

  /**
   * Moves a resident between families, and optionally the household with them.
   * Transactional and idempotent: re-submitting a transfer that already landed
   * returns the same state rather than recording it twice.
   */
  transferResident(transfer: ResidentTransfer): Observable<FamilyDetail>;
  changeMemberRole(
    familyId: FamilyId,
    residentId: ResidentId,
    role: FamilyRole,
    reason: string,
  ): Observable<Family>;

  /** The append-only history for one resident, newest first. */
  historyForResident(residentId: ResidentId): Observable<readonly RelationshipEvent[]>;
}

export const FAMILY_REPOSITORY = new InjectionToken<FamilyRepository>('FamilyRepository');

/**
 * The case workspace — the office's continuing file on a person.
 *
 * Three properties this port is shaped to guarantee:
 *
 *  - **Every mutation takes a `reason`.** Not one of them is optional, and
 *    `tools/check-case-audit.mjs` fails the build if a method appears without
 *    one. A change nobody had to justify is a change nobody can review.
 *  - **Every mutation appends an event** and returns the whole workspace, so a
 *    screen cannot show a status that its timeline does not explain (`DL-54`).
 *  - **Nothing here deletes or edits history.** There is no `deleteNote`, no
 *    `editNote` and no `reopen`; there must not be.
 *
 * Reads return `CaseWorkspace`/`CaseSummary`, whose notes are already
 * `CaseNoteView` — redacted by the data layer, so a screen cannot leak a
 * protected note it never received (`DL-38`).
 */
export interface CaseRepository {
  /**
   * One cursor page in the server's order — newest opened first — never a total and never "page 2
   * of 9" (`DL-161`). A caseload (`assigned-cases`) reads only the cases assigned to it (`DL-179`).
   */
  list(filter: CaseFilter, page: CursorRequest): Observable<CursorPage<CaseSummary>>;
  /** Counts for every queue, computed under the same scope as the list itself. */
  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]>;
  getById(id: CaseId): Observable<CaseWorkspace | null>;
  /** Every case opened about one resident, newest first. Whole, or an error — never part of it. */
  casesForResident(residentId: ResidentId): Observable<readonly CaseSummary[]>;
  /**
   * The open social-worker accounts a case can be given to, an id and a name (`DL-179`). Refused to
   * a caseload, as assigning is.
   */
  listAssignees(): Observable<readonly SocialWorker[]>;

  /**
   * Opens a case at intake, assigned to nobody, and answers with its workspace (`DL-179`). Refused
   * to a caseload. `continuesCaseId` must name a closed case; every linked request must be filed,
   * readable by the writer, about the subject or their household, and in no other case.
   */
  open(draft: CaseOpenDraft, reason: string): Observable<CaseWorkspace>;
  /**
   * Names one more request the case covers (`DL-52`, `DL-179`), under the rules of opening. A link
   * is never removed: it is ended with `endRequestLink`, and a request whose link was ended may be
   * named again, here or by another case.
   */
  linkRequest(id: CaseId, requestId: AssistanceRequestId, reason: string): Observable<CaseWorkspace>;
  /**
   * Ends a request's link to this case, with the reason (`DL-183`). The link and its end both stay in
   * the case's history; the request no longer counts as this case's. Only a request the writer can
   * read, linked here now.
   */
  endRequestLink(
    id: CaseId,
    requestId: AssistanceRequestId,
    reason: string,
  ): Observable<CaseWorkspace>;

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace>;
  /**
   * Gives the case to a named social worker, or to nobody with `null` — a recorded act either way.
   * Refused to a caseload: a social worker does not reassign their own case (`DL-179`). The open
   * tasks the previous holder owed go with the case, each its own recorded move under the same
   * reason; anybody else's stay where they are (`DL-183`).
   */
  assign(id: CaseId, staffUserId: StaffUserId | null, reason: string): Observable<CaseWorkspace>;

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
  ): Observable<CaseWorkspace>;

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string): Observable<CaseWorkspace>;
  /** The reason is the outcome: what actually happened when the task was done. */
  completeTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace>;
  /**
   * Ends a task that is no longer needed (`DL-183`). Kept, marked cancelled, the reason its outcome;
   * a case closes only when no task is open, so this is the honest way out of one nobody will do.
   */
  cancelTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace>;
  /**
   * Hands a task to somebody, or to nobody with `null`. Only the writer or whoever holds the case
   * may owe it (`DL-179`).
   *
   * Added in TAB 18 so a work queue can reassign without inventing a second
   * task store (`DL-55`). Like every other mutation here it takes a reason and
   * appends a case event in the same act (`DL-54`).
   */
  assignTask(
    id: CaseId,
    taskId: CaseTaskId,
    staffUserId: StaffUserId | null,
    reason: string,
  ): Observable<CaseWorkspace>;
  /**
   * Moves a task's due date.
   *
   * This is what "snooze" is here: a recorded change of date with a stated
   * reason, not a hidden timer. A task quietly pushed a week with nothing said
   * is how a household waits a month and the file shows nothing (`DL-99`).
   */
  rescheduleTask(
    id: CaseId,
    taskId: CaseTaskId,
    dueOn: IsoDate,
    reason: string,
  ): Observable<CaseWorkspace>;
}

export const CASE_REPOSITORY = new InjectionToken<CaseRepository>('CaseRepository');

/**
 * Named list parameters, an account's own or the office's. The API keeps them and decides who may
 * share one (`saved-view.share`, `DL-111`); a list of them is answered whole, never paged, because
 * the server caps how many each list may keep.
 */
export interface SavedViewRepository {
  listFor(resource: SavedViewResource): Observable<readonly SavedView[]>;
  create(draft: SavedViewDraft): Observable<SavedView>;
  remove(id: SavedViewId): Observable<void>;
}

export const SAVED_VIEW_REPOSITORY = new InjectionToken<SavedViewRepository>('SavedViewRepository');

/**
 * The programme catalog — the office's policy, held as data.
 *
 * Two absences are load-bearing. There is no method that takes a resident and a
 * programme and answers whether they qualify: eligibility guidance is read by a
 * person, and a port that returned a verdict would be the decision engine
 * `DL-66` exists to prevent. And there is no `delete`: a programme that is over
 * is `closed`, because requests filed under it still have to make sense.
 *
 * `save` refuses a draft whose responsibility record would misrepresent the
 * office (`DL-65`) — enforced here as well as on the screen, so a reachable form
 * cannot record a national programme as municipally owned.
 */
export interface ProgramRepository {
  /** One cursor page, by name, as the office record orders it (`DL-176`). */
  list(filter: ProgramFilter, page: CursorRequest): Observable<CursorPage<AssistanceProgram>>;
  getById(id: ProgramId): Observable<AssistanceProgram | null>;
  listActive(): Observable<readonly AssistanceProgram[]>;

  /**
   * The document sets this programme asks for.
   *
   * Programme-scoped rather than a global catalogue: the API serves them under the programme,
   * and every caller already has one in hand. A global list would also invite a screen to show a
   * template that this programme does not actually require.
   */
  listRequirementTemplates(id: ProgramId): Observable<readonly RequirementTemplate[]>;

  /**
   * Creates a programme, or updates the one at `id`. Idempotent on the
   * identifier the caller holds, like every other write in this application.
   *
   * The `reason` is required and kept beside the version it explains, in a history nothing
   * rewrites (`DL-177`): a request decided under last year's wording stays explicable, and so
   * does why the wording changed.
   */
  save(draft: ProgramDraft, id: ProgramId | null, reason: string): Observable<AssistanceProgram>;

  /**
   * Every requirement template the office keeps, retired ones included, read whole — the office
   * keeps at most `TEMPLATE_CAP`, so this is never a first page (`DL-161`). Retired ones are listed
   * because programmes may still name them.
   */
  listTemplates(): Observable<readonly RequirementTemplate[]>;

  /**
   * Records a template under `draft.code` when `code` is `null`; otherwise changes the one at
   * `code`, whose code never changes, and whose documents are replaced whole. A change reaches
   * every programme naming the template from that moment. A retired template is not changed.
   */
  saveTemplate(
    draft: RequirementTemplateDraft,
    code: string | null,
    reason: string,
  ): Observable<RequirementTemplate>;

  /**
   * One way: no new programme adopts it, and those already naming it keep asking for its
   * documents. Retiring a retired template answers it as it stands.
   */
  retireTemplate(code: string, reason: string): Observable<RequirementTemplate>;

  /**
   * How much a programme has been used. A description of the past (`DL-69`) — or, where releases
   * are not served, a statement that it could not be read, never a zero (`DL-176`).
   */
  utilizationFor(id: ProgramId): Observable<ProgramUtilizationReading>;
  utilizationSummary(): Observable<ProgramUtilizationSummary>;
}

export const PROGRAM_REPOSITORY = new InjectionToken<ProgramRepository>('ProgramRepository');

/**
 * Intake, assessment and the lifecycle of one intervention.
 *
 * Two shapes worth reading before changing anything here.
 *
 * `advisoryFor` returns **evidence, not a verdict** (`DL-60`). It has no
 * counterpart that approves, refuses, scores or ranks, and there must not be
 * one: TAB 11's third acceptance criterion is that no client is automatically
 * approved or denied by a simplistic frontend score, and the absence of that
 * method is where the criterion lives. `tools/check-intake.mjs` fails the build
 * if one appears.
 *
 * `saveDraft` is idempotent on the identifier it is given: passing `null`
 * creates a draft, passing an id updates that one. An encoder who taps save
 * twice on a slow connection gets one request, not two (`DL-63`).
 */
export interface AssistanceRequestRepository {
  /**
   * One cursor page in the server's order — filed requests newest filing first, or drafts newest
   * first when `status` is `'draft'` — never a total and never "page 2 of 9" (`DL-161`, `DL-177`).
   */
  list(
    filter: AssistanceRequestFilter,
    page: CursorRequest,
  ): Observable<CursorPage<AssistanceRequest>>;
  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null>;
  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]>;

  /**
   * Appends a note and answers with the whole list as this reader may see it (`DL-58`). Never
   * edited or removed. A `protected` note needs `case-note.view-protected`, and any note on a
   * protected request `request.view-sensitive` — nobody adds to what they may not read.
   */
  addNote(id: AssistanceRequestId, note: RequestNoteDraft): Observable<readonly RequestNote[]>;

  /**
   * The open social-worker accounts a request can be assigned to. Read from the office's whole
   * list, so a caseload (`assigned-cases`) is refused it, as it is refused assigning.
   */
  listSocialWorkers(): Observable<readonly SocialWorker[]>;

  /**
   * Assigns a filed request to a social worker for assessment, with a required reason (`DL-178`).
   * Appended to the request's assignments; assigning to whoever holds it answers as it stands.
   */
  assignForAssessment(
    id: AssistanceRequestId,
    assigneeId: StaffUserId,
    reason: string,
  ): Observable<AssistanceRequest>;

  /**
   * Any move but `approved`, which is its own act (`approve`). Cancelling or expiring is refused
   * while the request has an open release — anything not voided and not handed over — and the
   * refusal says to void the release first (`DL-183`).
   */
  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest>;

  /**
   * The move to `approved`, saying what was approved (`DL-183`): an amount in integer centavos, or
   * the goods described. Kept on the request's history, and the ceiling a money release is
   * prepared under.
   */
  approve(
    id: AssistanceRequestId,
    approval: RequestApproval,
    reason: string,
  ): Observable<AssistanceRequest>;

  /**
   * Duplicate and previous-assistance context for one applicant.
   *
   * `programId` may be `null`: the encoder has usually named the person before
   * the programme, and the household history is worth showing straight away.
   */
  advisoryFor(residentId: ResidentId, programId: ProgramId | null): Observable<IntakeAdvisory>;

  /**
   * The same advisory, for a case that already exists.
   *
   * Two methods rather than one because the API publishes the advisory **per case** and the intake
   * screen needs it **before a case exists** — an encoder picking a resident and a programme is
   * exactly who the advisory is for, and `DL-60` puts it in front of them before filing rather
   * than after. `IntakeDraft` carries no id, so there is nothing to address a case-scoped read
   * with.
   *
   * So a request already filed reads through here and actually works; intake keeps
   * `advisoryFor`, whose collection-level path the API does not serve. The gap is recorded rather
   * than papered over by sending a case id that does not exist (`DL-153`).
   */
  advisoryForCase(id: AssistanceRequestId): Observable<IntakeAdvisory>;

  /** Creates a `draft` request, or updates the draft already at `id`. */
  saveDraft(draft: IntakeDraft, id: AssistanceRequestId | null): Observable<AssistanceRequest>;

  /**
   * Files the draft. The acknowledgement is required exactly when the advisory
   * raised a caution, and it is stored — the office has to be able to say who
   * went ahead and why.
   */
  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest>;

  /**
   * The assessment forms the office publishes, with their versions.
   *
   * Read before opening one, because an assessment is opened *from* a template and pins its
   * version at that moment. The console cannot invent a code: an unknown one is refused.
   */
  listAssessmentTemplates(): Observable<readonly AssessmentTemplate[]>;

  /**
   * Opens an assessment against a case from a published template.
   *
   * **Idempotent per case**, and the server says why: two open assessments on one case are two
   * competing sets of findings, and nothing says which the approver should read. So an
   * in-progress assessment is returned rather than a second one opened, and a screen may call
   * this without first checking whether one exists.
   */
  openAssessment(
    id: AssistanceRequestId,
    templateCode: string,
  ): Observable<OpenAssessment>;

  /**
   * Records answers to the form's questions. Repeatable while the assessment is in progress.
   *
   * Only the codes passed are written — this is a patch, not the whole set — so a screen saving
   * one answer does not erase the others.
   */
  answerAssessment(
    id: AssistanceRequestId,
    answers: AssessmentAnswers,
  ): Observable<OpenAssessment>;

  /** Records or replaces the social worker's case study. */
  recordAssessment(
    id: AssistanceRequestId,
    assessment: AssessmentDraft,
  ): Observable<AssistanceRequest>;

  /** Marks one presented document verified, rejected or waived. */
  reviewRequirement(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    status: RequirementStatus,
    remarks: string | null,
  ): Observable<AssistanceRequest>;

  /**
   * Records a document against a requirement, or replaces the one already
   * there.
   *
   * **Always appends.** There is no `replaceDocument` and no `deleteDocument`,
   * and there must not be: the superseded version is the evidence of what the
   * office actually saw when it decided, and a request approved on a
   * certificate that was replaced two months later must still be explicable a
   * year on (`DL-77`). A replacement carries a required reason.
   */
  /**
   * Appends a version, reporting how far the upload has got.
   *
   * Emits `uploading` while bytes are in flight and `done` once the server has the file. A screen
   * that only wants the result takes the last emission; one showing a bar reads them all.
   */
  recordDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Observable<DocumentUpload<AssistanceRequest>>;

  /**
   * Rules on whether a conditional document applies to this applicant.
   *
   * The software states the condition and never evaluates it (`DL-76`). The
   * reason is required, because deciding that somebody does not need a document
   * is as consequential as deciding that they do.
   */
  decideApplicability(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    applicability: ConditionalApplicability,
    reason: string,
  ): Observable<AssistanceRequest>;

  /** Records that the office asked the applicant for a missing document. */
  requestDocument(
    id: AssistanceRequestId,
    draft: DocumentRequestDraft,
  ): Observable<readonly DocumentRequest[]>;

  listDocumentRequests(id: AssistanceRequestId): Observable<readonly DocumentRequest[]>;

  /**
   * Withdraws a request the office no longer needs, with a required reason.
   *
   * The domain has modelled a `withdrawn` state and a `withdrawnReason` since TAB 08 and nothing
   * could produce either, so a document asked for in error stayed open against the applicant
   * indefinitely — counted as outstanding, and shown to them as something they still owe.
   *
   * The reason is required by the server and by `DL-54`: a mutation carries why. The row is closed,
   * never removed — "we no longer need this" has to stay distinguishable from "we never asked".
   */
  withdrawDocumentRequest(
    id: AssistanceRequestId,
    documentRequestId: DocumentRequestId,
    reason: string,
  ): Observable<readonly DocumentRequest[]>;


  /**
   * Opens a document for viewing or saving.
   *
   * A **method rather than a URL on the model**, so that reading a file is an
   * act the data layer can refuse and the API can log. A screen holding a link
   * it may not follow is how an unauthorised download becomes a copy-paste
   * away.
   */
  openDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    versionId: DocumentVersionId,
  ): Observable<DocumentAccessGrant>;

  /**
   * Exchanges a grant for the file's bytes — once, within its life, by the account it was issued
   * to. The second half of opening a file: asked only after the reader has seen the grant's
   * warning and confirmed. The handle travels in a request body, never a URL a log keeps, and the
   * caller turns the bytes into an object URL it must revoke.
   */
  readDocumentFile(grant: DocumentAccessGrant): Observable<Blob>;
}

/**
 * Permission to read one file, once, with the disclosure it carries stated.
 *
 * `redactedForSharing` is the seam for the redaction-ready preview the master
 * command asks for: a copy shared outside the office is marked as such, and the
 * grant says so rather than leaving it to the screen to remember.
 */
export interface DocumentAccessGrant {
  readonly versionId: DocumentVersionId;
  readonly fileName: string;
  readonly mimeType: string;
  /** Opaque handle the API exchanges for the bytes. Never a durable public URL. */
  readonly handle: string;
  readonly expiresAt: IsoDateTime;
  readonly redactedForSharing: boolean;
  /** What the reader is about to see, for the warning shown before opening. */
  readonly warning: string;
}

export const ASSISTANCE_REQUEST_REPOSITORY = new InjectionToken<AssistanceRequestRepository>(
  'AssistanceRequestRepository',
);

/**
 * The beneficiary registry — one person's whole assistance history.
 *
 * A **projection over the resident registry**, not a second one. Every method
 * here is keyed on `ResidentId`; there is no beneficiary identifier, and the
 * absence is what makes "one person keeps one canonical identity across
 * programmes" true by construction rather than by care (`DL-71`).
 *
 * Two absences to preserve:
 *
 *  - **No merge.** `resolveIdentity` records a finding — the same person, or
 *    two different people — and never destroys a record. `same-person`
 *    designates a canonical id and supersedes the other; both survive, and so
 *    does everything attached to either (`DL-74`). There is no `merge`, no
 *    `deleteResident` and no automatic resolution above any threshold.
 *  - **No score.** `duplicatesFor` returns graded candidates whose signals each
 *    state their rule, on the same doctrine as the intake advisory (`DL-60`).
 *    Nothing in this port ranks people or resolves a pair on its own.
 *
 * Reads carry `ResidentView`, already redacted for the caller (`DL-38`), and a
 * caller without `beneficiary.review-duplicates` receives no candidates at all
 * rather than candidates it is expected to hide.
 */
export interface BeneficiaryRepository {
  list(
    filter: BeneficiaryFilter,
    page: PageRequest<BeneficiarySortField>,
  ): Observable<Page<BeneficiarySummary>>;
  /** `null` for "not found *or* not yours", deliberately indistinguishable (`DL-31`). */
  getByResidentId(id: ResidentId): Observable<BeneficiaryDetail | null>;


  /**
   * The duplicate-review queue. Candidates report *agreement between fields*,
   * never the field values, so a queue can be worked without disclosing one
   * person's details to somebody who came to look at another's (`DL-73`).
   */
  duplicateQueue(page: PageRequest): Observable<Page<DuplicateCandidate>>;
  duplicatesFor(id: ResidentId): Observable<readonly DuplicateCandidate[]>;

  /**
   * What a `same-person` finding would carry across, shown before it is
   * recorded. A preview only: calling it changes nothing.
   */
  previewResolution(
    pairId: DuplicatePairId,
    canonicalResidentId: ResidentId,
    supersededResidentId: ResidentId,
  ): Observable<MergePreview>;

  /**
   * Runs a detection pass and returns how many pairs are now open for review.
   *
   * **The queue does not fill itself.** A pair is a record the office is holding, created by a
   * detection run — not a resemblance recomputed on every read — so a console that never runs one
   * shows an empty queue on a registry full of duplicates and looks correct doing it (`DL-148`).
   *
   * It is a read of the registry followed by a write of what it found, so it takes the same grant
   * as the queue itself. It states a count and nothing else: what to do about each pair remains a
   * person's judgement, recorded one at a time (`DL-74`).
   */
  detectDuplicates(): Observable<number>;

  /**
   * Records the reviewer's finding. Idempotent on the pair: re-submitting the
   * same verdict returns the existing resolution rather than appending a second
   * one, so a double tap on a municipal connection cannot produce two findings
   * about one pair.
   */
  resolveIdentity(draft: IdentityResolutionDraft): Observable<IdentityResolution>;

  /** Findings already recorded about one record, newest first. */
  resolutionsFor(id: ResidentId): Observable<readonly IdentityResolution[]>;
}

export const BENEFICIARY_REPOSITORY = new InjectionToken<BeneficiaryRepository>(
  'BeneficiaryRepository',
);

/**
 * Field visits.
 *
 * Two absences are load-bearing and enforced by `tools/check-visits.mjs`.
 *
 * **No location.** There is no method that records or returns where a worker
 * was, no check-in, no route and no coordinate. The master command forbids
 * continuous tracking, covert tracking, geofencing and background surveillance;
 * those are easy to refuse as features and easy to acquire as an innocuous
 * field, so the absence is asserted rather than assumed.
 *
 * **No second task system.** A visit that needs following up produces a
 * `CaseTask` through `CaseRepository` (`DL-55`), so "what does this office owe
 * this family next?" has one answer rather than one per module.
 *
 * `recordObservations` takes drafts that each state **whose claim they are**
 * (`DL-85`), and appends. Nothing here edits or removes an observation: a
 * worker who wants to correct one records another saying so.
 */
export interface FieldVisitRepository {
  /**
   * One cursor page: what is still owed first, soonest first, then what is over, latest first. A
   * list somebody browses: the screen says more exist, never "page 1 of N" (`DL-161`, `DL-181`).
   */
  list(filter: FieldVisitFilter, page: CursorRequest): Observable<CursorPage<FieldVisit>>;
  getById(id: FieldVisitId): Observable<FieldVisit | null>;
  /** The signed-in worker's own visits, for the day-planning view. */
  mine(filter: FieldVisitFilter): Observable<readonly FieldVisit[]>;
  forResident(id: ResidentId): Observable<readonly FieldVisit[]>;

  schedule(draft: FieldVisitDraft): Observable<FieldVisit>;

  /** Appends observations. Never edits or removes one (`DL-85`). */
  recordObservations(
    id: FieldVisitId,
    observations: readonly VisitObservationDraft[],
  ): Observable<FieldVisit>;

  /**
   * The checklist as it should stand, line by line.
   *
   * Every item is sent with its state, not just the ticked ones: the API records one line per call,
   * so a list of ticks alone cannot express a line somebody cleared.
   */
  setChecklist(
    id: FieldVisitId,
    items: readonly VisitChecklistSelection[],
  ): Observable<FieldVisit>;

  /**
   * Closes the visit. Terminal in every outcome: a second attempt is a second
   * visit, so "how many times did we go?" keeps one answer.
   */
  close(id: FieldVisitId, outcome: VisitOutcomeDraft): Observable<FieldVisit>;
}

export const FIELD_VISIT_REPOSITORY = new InjectionToken<FieldVisitRepository>(
  'FieldVisitRepository',
);

/**
 * Release and distribution tracking.
 *
 * **This is not the treasury system**, and the port is shaped so it cannot
 * quietly become one. There is no ledger entry, no journal posting, no account
 * code, no bank instruction and no method that moves money — only records of
 * what the office scheduled, handed over and got acknowledged (`DL-89`).
 * `tools/check-releases.mjs` fails the build if any of that appears.
 *
 * The distinction matters beyond tidiness: a front end that appears to post
 * accounting entries invites an office to treat it as the book of record, and
 * the first reconciliation against the actual treasury system is where that
 * belief fails — publicly, and with somebody's grant in the middle of it.
 *
 * `markReleased` takes the releasing officer so the segregation-of-duties cue
 * can be computed against whoever approved (`DL-91`), and `deferRelease`
 * requires a reason from a fixed list of things the *office* got wrong — which
 * is what keeps "we could not pay you" from being recorded as "you did not
 * come".
 */
/**
 * Money.
 *
 * **Every write here takes a {@link WriteIntent}, and the type system is the enforcement.** The
 * API refuses a money write without an idempotency key, and the key must be minted where the
 * officer commits rather than inside the adapter — an adapter minting one per call would give a
 * retry a new key, and a new key is a new intent (`TAB 08` step 3).
 */
export interface ReleaseRepository {
  /**
   * One cursor page, newest prepared first. A list somebody browses: the screen says more exist,
   * never "page 1 of N" (`DL-161`).
   */
  list(filter: ReleaseFilter, page: CursorRequest): Observable<CursorPage<Release>>;
  getById(id: ReleaseId): Observable<Release | null>;
  listForRequest(id: AssistanceRequestId): Observable<readonly Release[]>;
  /** The release queue, ordered by what the office must act on first. */
  queue(filter: ReleaseFilter): Observable<readonly Release[]>;

  /** Who approved the request behind a release, for the self-release cue. */
  approverFor(id: ReleaseId): Observable<StaffUserId | null>;

  listBatches(): Observable<readonly ReleaseBatch[]>;
  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null>;
  /** Schedules releases into a payout session. Each stays individually tracked. */
  createBatch(draft: ReleaseBatchDraft, intent: WriteIntent): Observable<ReleaseBatch>;

  /**
   * What is to be handed over for an approved request: an amount or the goods, how, and the label
   * and reference the office was given. The request's person and approver are the data layer's to
   * read, never the screen's to state.
   */
  prepare(draft: ReleaseDraft, intent: WriteIntent): Observable<Release>;

  /**
   * The printable payout list. Composed by the data layer from the batch, so a
   * screen cannot assemble one from fuller records it happens to hold — the
   * same rule as the referral summary (`DL-82`, `DL-92`).
   */
  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null>;

  /** Records that something was handed over, by a named officer. */
  markReleased(
    id: ReleaseId,
    instrumentReference: string | null,
    remarks: string | null,
    intent: WriteIntent,
  ): Observable<Release>;

  /** Records the beneficiary's receipt, and how it was evidenced. */
  acknowledge(
    id: ReleaseId,
    acknowledgement: ReleaseAcknowledgementDraft,
    intent: WriteIntent,
  ): Observable<Release>;

  /**
   * The beneficiary attended and the office could not release. The reason comes
   * from a fixed list, every entry of which is the office's own failing
   * (`DL-94`).
   */
  deferRelease(
    id: ReleaseId,
    reason: DeferralReason,
    remarks: string,
    intent: WriteIntent,
  ): Observable<Release>;

  /** Moves the release along. Every move takes a reason, as everywhere else. */
  changeStatus(
    id: ReleaseId,
    to: ReleaseStatus,
    reason: string,
    intent: WriteIntent,
  ): Observable<Release>;
}

/** What the acknowledgement form submits. Time and actor are the store's. */
export interface ReleaseAcknowledgementDraft {
  readonly kind: AcknowledgementKind;
  readonly collectedBy: string | null;
  readonly authority: string | null;
}

export const RELEASE_REPOSITORY = new InjectionToken<ReleaseRepository>(
  'ReleaseRepository',
);

/**
 * Referrals out of the office, and the directory they go to.
 *
 * The shape here is governed by one fact that no other port has to deal with:
 * **a referral summary leaves the building.** Once it is printed or sent, the
 * MSWDO no longer controls who reads it.
 *
 * So the basis and the shared fields are **recorded as their own acts** before a referral can be
 * sent (`DL-81`): a lawful basis, and every field beyond the minimum chosen individually with a
 * stated need. `send` then takes no plan, because the server refuses the transition when the basis
 * is absent — checked inside the row lock rather than in a validator.
 *
 * `summaryFor` composes the sheet from what was authorised rather than from the whole record, so a
 * screen cannot print a field nobody chose.
 *
 * There is deliberately **no method that returns a client's full profile for a
 * referral**. The temptation would be to fetch it and let the template pick;
 * that is the failure this port is shaped to prevent.
 */
export interface ReferralRepository {
  /**
   * One cursor page, newest drafted first. A list somebody browses: the screen says more exist,
   * never "page 1 of N" (`DL-161`, `DL-181`).
   */
  list(filter: ReferralFilter, page: CursorRequest): Observable<CursorPage<Referral>>;
  getById(id: ReferralId): Observable<Referral | null>;
  /** Every referral for one person, newest first. */
  forResident(id: ResidentId): Observable<readonly Referral[]>;
  /** The work queue: overdue first, then most urgent (`DL-83`). */
  queue(filter: ReferralFilter): Observable<readonly Referral[]>;

  /** Creates a `draft`. Nothing is disclosed until it is sent. */
  createDraft(draft: ReferralDraft): Observable<Referral>;

  /**
   * Records the lawful basis for disclosing, with the sentence that explains it.
   *
   * Its own act, because the API records it as one — and because that is where the guarantee
   * actually lives. `send` used to take a whole `DisclosurePlan` so that this client could not
   * send without one; the server checks it **inside the row lock**, before the transition, with
   * its own note that *"a check that lives only in a request validator is a check the next write
   * path will not have."*
   *
   * That is stronger than a parameter shape, and it is why `DL-81`'s doctrine survives while its
   * mechanism changes: the window in which a sendable referral has no basis does not exist,
   * because the server will not perform the transition.
   */
  recordDisclosureBasis(
    id: ReferralId,
    basis: DisclosureBasis,
    note: string,
  ): Observable<Referral>;

  /**
   * Adds one field to what the summary will carry, with the need that justifies it.
   *
   * One call per field on purpose (`DL-82`): every field beyond the minimum is chosen individually
   * with a stated need, and a batch would let a screen submit six of them with one sentence
   * covering all six.
   */
  shareField(id: ReferralId, field: SharedField, because: string): Observable<Referral>;

  /**
   * Sends it. **The one irreversible act** — once it has left the building nothing brings it back.
   *
   * Takes no plan, because by this point the basis and the fields are already recorded against the
   * referral. The server refuses the transition if the basis is missing.
   */
  send(id: ReferralId): Observable<Referral>;

  /** The sheet that will be printed or transmitted, composed from the plan. */
  summaryFor(id: ReferralId): Observable<ReferralSummarySheet | null>;

  /** Moves the referral along. Every move takes a reason, as everywhere else. */
  changeStatus(id: ReferralId, to: ReferralStatus, reason: string): Observable<Referral>;

  /** Records what the receiving office actually did. */
  recordOutcome(id: ReferralId, outcome: string, status: ReferralStatus): Observable<Referral>;

  /** Moves the date this office intends to chase, with a reason. */
  reschedule(id: ReferralId, followUpOn: IsoDate, reason: string): Observable<Referral>;

  /** Appends an inter-office note. Never edits or removes one. */
  addNote(id: ReferralId, body: string): Observable<Referral>;

  listProviders(filter: ServiceProviderFilter): Observable<readonly ServiceProvider[]>;
  getProvider(id: ServiceProviderId): Observable<ServiceProvider | null>;
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
  signIn(credentials: SignInCredentials): Observable<SignInOutcome>;
  /**
   * The second step, when `signIn` answered `mfa-required`.
   *
   * A separate method rather than an overload of `signIn`: the challenge is a
   * server-issued single-use handle, not a credential the user holds, and
   * passing it alongside an email and password would invite a caller to send
   * all three.
   */
  completeMfa(credentials: MfaCredentials): Observable<AuthenticatedUser>;
  /**
   * Ends the session **server-side**, and then locally whatever the server said.
   *
   * Discarding a variable is not revocation, so the revocation is asked for
   * first, with the credential it revokes. The local credential is dropped once
   * the API has answered — including when it answered with a failure, which
   * still propagates so the screen can say the server did not confirm
   * (`DL-165`, superseding the rule that a failed sign-out keeps the token).
   */
  signOut(): Observable<void>;
}

export const STAFF_REPOSITORY = new InjectionToken<StaffRepository>('StaffRepository');

/**
 * The actor's inbox — **read-only**, plus marking read.
 *
 * `create()` was deleted in TAB 05. The API offers `GET notifications`,
 * `POST notifications/{id}/read` and `POST notifications/read`, and
 * nothing that mints one: a client creating its own notification asserts
 * something the server never agreed to, and the record would exist in exactly
 * one browser tab.
 *
 * Messages the console raises for itself — toasts, and errors that also belong
 * in the inbox — are built locally by `toLocalNotification` and never sent
 * anywhere.
 */
export interface NotificationRepository {
  listForCurrentUser(): Observable<readonly AppNotification[]>;
  markRead(id: NotificationId): Observable<AppNotification>;
  markAllRead(): Observable<readonly AppNotification[]>;
}

export const NOTIFICATION_REPOSITORY = new InjectionToken<NotificationRepository>(
  'NotificationRepository',
);

/**
 * Work queues.
 *
 * **This port is read-only, and that is the design.** A work queue is a *view*
 * assembled from case tasks and the live state of requests, visits, referrals,
 * releases and duplicate pairs. It owns nothing, so it must not offer a way to
 * change anything: a `WorkRepository.complete()` would be a second task system
 * with a different audit trail from the first, and "what does this office owe
 * this family?" would have two answers again (`DL-55`, `DL-97`).
 *
 * Acting on an item goes to the repository that owns the record — a case task
 * through `CaseRepository`, a referral through `ReferralRepository`, and so on.
 * `WorkItem.isManageable` tells a screen which items have a task record behind
 * them and which are simply the state of something.
 *
 * Everything is computed against an explicit `asOf` date rather than an
 * ambient clock, so a queue can be tested and cannot disagree with the heading
 * above it.
 */
export interface WorkRepository {
  /** What the signed-in user owes. */
  myQueue(asOf: IsoDate): Observable<WorkQueue>;
  /**
   * What the office owes, grouped by who is carrying it.
   *
   * Requires `staff.view`: seeing another officer's caseload is supervision,
   * not a default. Unassigned work is its own group rather than an omission.
   */
  teamQueue(asOf: IsoDate): Observable<TeamQueue>;
  /**
   * Conditions of the data worth somebody's attention.
   *
   * Derived on every read and never stored, so an alert cannot outlive the
   * problem that produced it.
   */
  alerts(): Observable<readonly OfficeAlert[]>;
}

export const WORK_REPOSITORY = new InjectionToken<WorkRepository>('WorkRepository');

/**
 * Reports.
 *
 * **The export is composed here, never by a screen.** Same reasoning as the
 * payout manifest (`DL-92`) and the referral summary (`DL-82`): a file that
 * leaves the office must carry its own conditions, and a template holding the
 * fuller result is one binding away from writing a name into a spreadsheet the
 * report was never meant to contain.
 *
 * `run` returns figures already suppressed for small cells (`DL-105`) and
 * already carrying the applied filter in words. A caller cannot ask for the
 * unsuppressed set: there is no parameter for it, because "just this once" is
 * how a threshold stops being one.
 */
export interface ReportRepository {
  /** The reports this user may open, in catalogue order. */
  catalogue(): Observable<readonly ReportDefinition[]>;
  run(id: ReportId, filter: ReportFilter): Observable<ReportResult | null>;
  /**
   * Composes a file.
   *
   * Requires `report.export`, and a person-level report requires that the
   * caller has already been warned — the screen shows the warning, the adapter
   * re-checks the permission (`DL-30`).
   */
  export(id: ReportId, filter: ReportFilter, format: ExportFormat): Observable<ReportExport>;
}

export const REPORT_REPOSITORY = new InjectionToken<ReportRepository>('ReportRepository');

/**
 * Global search.
 *
 * One method, and no way to widen it. There is no `includeNotes`, no
 * `fields` parameter and no raw-text search: the searchable fields and the
 * displayable fields are the **same closed set** (`DL-109`), so a caller
 * cannot ask search to read something a result may not show.
 *
 * Matching on a note body while showing no snippet would still disclose it —
 * typing a condition and getting back one resident says that word is in that
 * person's file. `DL-58` withholds a protected note in the data layer, and
 * search must not be the surface that reintroduces it.
 *
 * Results are grouped per record type and gated per record type, so a
 * release officer finds the resident behind a payout and no case file.
 */
export interface SearchRepository {
  search(term: string): Observable<SearchResults>;
}

export const SEARCH_REPOSITORY = new InjectionToken<SearchRepository>('SearchRepository');

/**
 * Governance: accounts, the audit trail, and what the office says about its
 * own data.
 *
 * **The audit split is enforced here, not by a screen** (`DL-114`). `auditRows`
 * returns rows that carry no recorded value — there is no parameter that could
 * ask it to inline them — and `auditDetail` is a separate read behind
 * `audit.view-detail`. A list designed to be scrolled and filtered by somebody
 * reviewing other people's work must not quote what changed.
 *
 * Note the absences. There is no `create`, no `invite` and no `resetAccess`:
 * accounts are provisioned by an administrator outside this console, and a
 * half-built invite flow is worse than none because an administrator who fills
 * one in reasonably believes an account now exists (`DL-32`, restated).
 */
export interface GovernanceRepository {
  /** The staff directory, assembled from the account and its profile. */
  accounts(): Observable<readonly StaffAccount[]>;
  accountById(id: StaffUserId): Observable<StaffAccount | null>;
  /**
   * Turns an account on or off, with a required reason.
   *
   * The only write in this port, and it appends to the trail like every other
   * mutation in this application (`DL-54`).
   */
  setAccountActive(
    id: StaffUserId,
    isActive: boolean,
    reason: string,
  ): Observable<StaffAccount>;

  auditRows(filter: AuditFilter): Observable<readonly AuditRow[]>;
  /** Recorded values for one entry. Refused without `audit.view-detail`. */
  auditDetail(id: AuditEntryId): Observable<AuditEntryDetail | null>;

  /** What the office holds, classified. Reference data, about nobody. */
  classifications(): Observable<readonly ClassifiedRecordType[]>;
  /** Retention rules — all of them awaiting an office schedule (`DL-113`). */
  retention(): Observable<readonly RetentionRule[]>;
  /** Correction requests on file. Read-only until the capture screen exists. */
  corrections(): Observable<readonly CorrectionRequest[]>;
}

export const GOVERNANCE_REPOSITORY = new InjectionToken<GovernanceRepository>(
  'GovernanceRepository',
);

/**
 * The newsfeed console.
 *
 * Two absences are load-bearing.
 *
 * **Nothing here reads who reacted.** `Post` carries counts, and this port has
 * no method that returns the residents behind them. An officer needs to know a
 * post reached people; they do not need to know which residents reacted to an
 * advisory about food assistance (`DL-126`).
 *
 * **Nothing here scores, ranks or classifies a comment.** The command is
 * explicit that no AI moderation and no sentiment analysis is to be built, and
 * the absence is enforced by `check:newsfeed` rather than merely intended — a
 * "toxicity" field is a decision about a resident dressed as a measurement.
 *
 * Every moderation act takes a **reason** and appends to the trail (`DL-127`),
 * on the same rule every other mutation in this application follows.
 */
export interface NewsfeedRepository {
  list(view: PostView, filter: PostFilter): Observable<readonly Post[]>;
  getById(id: PostId): Observable<Post | null>;

  /** Saves a draft. Refuses a draft the domain would refuse (`postProblems`). */
  saveDraft(draft: PostDraft, id: PostId | null): Observable<Post>;
  /** Publishes now. Separate permission from editing, and irreversible. */
  publish(id: PostId, reason: string): Observable<Post>;
  schedule(id: PostId, at: IsoDateTime, reason: string): Observable<Post>;
  archive(id: PostId, reason: string): Observable<Post>;
  setPinned(id: PostId, isPinned: boolean, reason: string): Observable<Post>;
  setCommentsEnabled(id: PostId, enabled: boolean, reason: string): Observable<Post>;

  comments(postId: PostId, filter: CommentFilter): Observable<readonly Comment[]>;
  /**
   * Hides, restores or removes a comment, or replies as the office.
   *
   * One method rather than four, because every one of them is the same act — a
   * decision about a resident's words, taken with a reason, recorded against a
   * name. Four methods would be four places for the reason to become optional.
   */
  moderate(
    commentId: CommentId,
    action: ModerationAction,
    text: string,
  ): Observable<Comment>;

  /** What the office did to this post, from the one audit trail. */
  history(id: PostId): Observable<readonly AuditRow[]>;
}

export const NEWSFEED_REPOSITORY = new InjectionToken<NewsfeedRepository>('NewsfeedRepository');

/**
 * Events, and the registrations residents make in the separate mobile app.
 *
 * Note what is **not** here: no `create registration`. Residents sign up on
 * their own phones; this office manages what arrives, and a method letting a
 * clerk register somebody would be an admin screen quietly acquiring the one
 * capability the resident contract reserves (`DL-123`).
 *
 * Note also what registrant reads return: `RegistrantView`, composed by the
 * adapter, never `EventRegistration` (`DL-130`).
 */
export interface EventRepository {
  list(view: EventView, filter: EventFilter): Observable<readonly LguEvent[]>;
  getById(id: LguEventId): Observable<LguEvent | null>;

  /** Saves a draft. Refuses what the domain refuses (`eventProblems`). */
  saveDraft(draft: EventDraft, id: LguEventId | null): Observable<LguEvent>;
  publish(id: LguEventId, reason: string): Observable<LguEvent>;
  /** Irreversible, and everybody registered is told (`DL-131`). */
  cancel(id: LguEventId, reason: string): Observable<LguEvent>;
  /** Declares attendance final. Nothing unmarked becomes a no-show. */
  complete(id: LguEventId, reason: string): Observable<LguEvent>;
  archive(id: LguEventId, reason: string): Observable<LguEvent>;

  registrants(id: LguEventId, filter: RegistrantFilter): Observable<readonly RegistrantView[]>;
  /**
   * How full it was **when asked**. Carries its own `asOf`, and offers no
   * `hasRoom`: whether a place exists is the backend's answer (`DL-129`).
   */
  capacity(id: LguEventId): Observable<EventCapacitySummary>;
  metrics(id: LguEventId): Observable<EventMetrics>;

  /**
   * Moves one registration, with a reason.
   *
   * Promotion from the waitlist goes through here like any other move and is
   * **attempted**, never predicted — the caller reads back what happened
   * rather than deciding in advance that a place was free.
   */
  actOnRegistration(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView>;

  markAttendance(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    attendance: AttendanceStatus,
  ): Observable<RegistrantView>;

  /**
   * The registrant list as a file.
   *
   * Composed by the data layer with its own conditions inside it (`DL-106`),
   * and holding the same closed set of fields the screen shows — an export is
   * not a wider read than the screen it came from.
   */
  exportRegistrants(id: LguEventId): Observable<RegistrantExport>;

  history(id: LguEventId): Observable<readonly AuditRow[]>;
}

export const EVENT_REPOSITORY = new InjectionToken<EventRepository>('EventRepository');

export interface DashboardRepository {
  /**
   * Every figure is computed under `filter`, and the summary echoes the filter
   * back. That is what lets the view hand the *same* filter to the list a
   * metric links to, so a number and the records behind it cannot disagree.
   */
  summary(filter: DashboardFilter): Observable<DashboardSummary>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');

/**
 * Residents' app identity reviews (`DL-167`) — the first port shaped like a Node API resource
 * rather than like casework.
 */
export interface VerificationRepository {
  /**
   * One cursor page of the queue, newest first as the server orders it. Browsable, so a page: the
   * screen says more are available, never "page 1 of N" — the server sends no total (`DL-161`).
   */
  list(filter: VerificationFilter, page: CursorRequest): Observable<CursorPage<VerificationRequest>>;

  /** Marks the account verified. The note is for the office; the resident never sees it. */
  approve(id: VerificationRequestId, note: string): Observable<VerificationRequest>;

  /** Refuses it. The resident reads `reason` in the app as what was wrong. */
  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest>;

  /**
   * One image of a request — a government ID or a face — as bytes.
   *
   * A **method rather than a URL on the model**, as with `openDocument`: reading one is an act the
   * data layer performs when a reviewer has asked and been warned, never something a template can
   * reach by binding an address. A URL to the API would also need the bearer token, which belongs
   * in no URL (rule 5).
   */
  openImage(request: VerificationRequest, kind: VerificationImageKind): Observable<Blob>;
}

export const VERIFICATION_REPOSITORY = new InjectionToken<VerificationRepository>(
  'VerificationRepository',
);

/* ── the office inbox (`DL-168`) ─────────────────────────────────────────── */

/**
 * Residents' conversations with an office, answered by its staff (`office-inbox.manage`).
 *
 * Whose conversations are listed is the **server's** decision: a staff account sees its own office's,
 * an administrator every office's. Nothing here filters by office, because a filter the console
 * applied would be a scope the server does not enforce (rule 4).
 */
export interface OfficeInboxRepository {
  /**
   * One cursor page, newest activity first as the server orders it — or `no-office` when an empty
   * answer means the account has no office rather than that nobody wrote (`InboxListing`).
   */
  list(page: CursorRequest): Observable<InboxListing>;

  /** One conversation, by id — the page a reload or a shared link must be able to answer. */
  thread(id: OfficeThreadId): Observable<OfficeThread>;

  /** One cursor page of its messages, newest first as the server orders them. */
  messages(id: OfficeThreadId, page: CursorRequest): Observable<CursorPage<ThreadMessage>>;

  /** Sends the office's reply. Refused by the server once the conversation is closed. */
  reply(id: OfficeThreadId, body: string): Observable<ThreadMessage>;

  /** Marks it read for **the whole office** — one mark, shared (`THREAD_READ_EFFECT`). */
  markRead(id: OfficeThreadId): Observable<OfficeThread>;

  /** Closes it for both sides. The server keeps who and when, and no reason (`THREAD_CLOSE_EFFECTS`). */
  close(id: OfficeThreadId): Observable<OfficeThread>;

  /**
   * One image a message carries, as bytes — a **method rather than an address**, as with
   * `VerificationRepository.openImage`: reading it is an act the data layer performs when somebody
   * has asked, and an address to the API would need the bearer token, which belongs in no URL.
   */
  openAttachment(message: ThreadMessage, media: MediaId): Observable<Blob>;
}

export const OFFICE_INBOX_REPOSITORY = new InjectionToken<OfficeInboxRepository>(
  'OfficeInboxRepository',
);

/* ── the office directory (`DL-168`) ─────────────────────────────────────── */

export interface OfficeRepository {
  /**
   * **Every** office, or an error — never the first page presented as the whole (`DL-161`). Read by
   * a picker and to name an office on screen, where a missing office reads as one that does not
   * exist.
   */
  list(): Observable<readonly Office[]>;
}

export const OFFICE_REPOSITORY = new InjectionToken<OfficeRepository>('OfficeRepository');

/* ── users and roles (`DL-168`) ──────────────────────────────────────────── */

/**
 * Every residents' app account, and the two changes an administrator makes to one: its role, and —
 * for staff — its office. `user.view`, `user.change-role`, `user.assign-office`: administrators
 * alone, on the server.
 */
export interface AppAccountRepository {
  /** One cursor page, newest first as the server orders it. No total (`DL-161`). */
  list(page: CursorRequest): Observable<CursorPage<AppAccount>>;

  /**
   * Changes the role. Refused by the server for the caller's own account. No reason is taken: the
   * server keeps none (`ROLE_CHANGE_ALWAYS`).
   */
  changeRole(id: AppAccountId, role: AccountRole): Observable<AppAccount>;

  /** Links a staff account to an office, or clears the link with `null`. Staff only, on the server. */
  assignOffice(id: AppAccountId, office: OfficeId | null): Observable<AppAccount>;

  /**
   * Gives a staff account an office role, or takes it away (`DL-173`). Unlike the two changes above,
   * this one takes a reason: the server keeps it with the change. Staff only, never the caller's own
   * account, never `system-administrator` — on the server.
   */
  assignOfficeRole(id: AppAccountId, change: OfficeRoleChange): Observable<AppAccount>;

  /** The barangays as the API lists them, whole, for choosing a barangay link's barangay. */
  barangays(): Observable<readonly AccountBarangay[]>;
}

export const APP_ACCOUNT_REPOSITORY = new InjectionToken<AppAccountRepository>(
  'AppAccountRepository',
);

/* ── the residents' app directory (`DL-170`) ─────────────────────────────── */

/**
 * The offices of the residents' app directory, as an administrator keeps them (`office.manage`).
 *
 * Separate from `OfficeRepository`, which reads the directory **in full** to name an office in a
 * picker: this one reads it **a page at a time**, as a list somebody browses, and changes it.
 */
export interface DirectoryOfficeRepository {
  /** One cursor page, newest first as the server orders it. No total (`DL-161`). */
  list(page: CursorRequest): Observable<CursorPage<DirectoryOffice>>;

  /** Creates it, with a banner if one is given. */
  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice>;

  /** Changes what the contract lets a change carry, and replaces the banner if one is given. */
  update(id: OfficeId, changes: OfficeChanges, banner: Blob | null): Observable<DirectoryOffice>;

  /** Deletes it. Refused by the server while anything names the office (`OFFICE_EFFECTS.remove`). */
  remove(id: OfficeId): Observable<void>;
}

export const DIRECTORY_OFFICE_REPOSITORY = new InjectionToken<DirectoryOfficeRepository>(
  'DirectoryOfficeRepository',
);

/**
 * Tulong pages (`service.manage`): what the app tells residents about a service. **Not** the
 * console's programmes, and never read through `ProgramRepository` (`DL-164`).
 */
export interface TulongServiceRepository {
  /**
   * One cursor page of the app's catalogue, newest first. A page hidden from the catalogue and not
   * featured is **not in it**: the API has no list for an administrator, only the residents' one.
   */
  list(page: CursorRequest): Observable<CursorPage<TulongService>>;

  /** One page by its address, hidden or not — or `null` when the server says there is none. */
  find(slug: string): Observable<TulongService | null>;

  create(draft: ServiceDraft): Observable<TulongService>;

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService>;

  /** Sets the page's picture, replacing any it had. A separate act, applied at once. */
  replaceImage(id: TulongServiceId, image: Blob): Observable<TulongService>;

  /** Deletes it, and its picture. Nothing refers to a page, so the server never refuses it. */
  remove(id: TulongServiceId): Observable<void>;
}

export const TULONG_SERVICE_REPOSITORY = new InjectionToken<TulongServiceRepository>(
  'TulongServiceRepository',
);

/** What `HotlineRepository.list` answers: the lines the API sent, and whether it held some back. */
export interface HotlineListing {
  readonly hotlines: readonly Hotline[];
  /** True when the answer is as long as the API's cap, so there may be lines it did not send. */
  readonly mayBeIncomplete: boolean;
}

/** The numbers the app lists for residents to call (`hotline.manage`). */
export interface HotlineRepository {
  /** Every line, shown and hidden, as the API orders them — at most `HOTLINE_LIST_CAP`. */
  list(): Observable<HotlineListing>;

  create(draft: HotlineDraft): Observable<Hotline>;

  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline>;

  remove(id: HotlineId): Observable<void>;
}

export const HOTLINE_REPOSITORY = new InjectionToken<HotlineRepository>('HotlineRepository');


/* ── the app's home screen (`DL-170`) ────────────────────────────────────── */

/**
 * The banners and links on the residents' app's home screen (`home.manage`), and the home screen as
 * the app is given it now.
 */
export interface HomeScreenRepository {
  /** Every banner, shown and hidden, answered whole. */
  banners(): Observable<readonly HomeBanner[]>;

  /** Stores the image first, if there is one, then the banner naming it (`HOME_EFFECTS.imageUpload`). */
  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner>;

  /** Saves the banner as the draft says, and its image as the change says. */
  updateBanner(id: HomeBannerId, draft: BannerDraft, image: BannerImageChange): Observable<HomeBanner>;

  /** Deletes it. Its image stays stored; the API removes none (`HOME_EFFECTS.bannerRemove`). */
  removeBanner(id: HomeBannerId): Observable<void>;

  /**
   * A banner's image, as bytes — a **method rather than an address**, as every image in the console
   * is read: an address to the API would need the bearer token, which belongs in no URL.
   */
  bannerImage(banner: HomeBanner): Observable<Blob>;

  /** Every link, answered whole. Every one is on the home screen; there is no hidden link. */
  links(): Observable<readonly QuickLink[]>;

  createLink(draft: LinkDraft): Observable<QuickLink>;

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink>;

  removeLink(id: QuickLinkId): Observable<void>;

  /** The home screen as the app is given it now (`GET home`). */
  preview(): Observable<HomePreview>;
}

export const HOME_SCREEN_REPOSITORY = new InjectionToken<HomeScreenRepository>(
  'HomeScreenRepository',
);

/* ── the app's settings (`DL-170`) ───────────────────────────────────────── */

/** The residents' app's settings (`app-config.manage`): read as every app reads them, and changed. */
export interface AppConfigRepository {
  /** The settings as every resident's app is given them now. */
  read(): Observable<AppConfig>;

  /** Changes only what `changes` names; `null` clears a setting or deletes a flag. */
  change(changes: AppConfigChanges): Observable<AppConfig>;
}

export const APP_CONFIG_REPOSITORY = new InjectionToken<AppConfigRepository>('AppConfigRepository');

/* ── digital IDs (`DL-171`) ──────────────────────────────────────────────── */

/**
 * Residents' digital IDs: checked by staff (`digital-id.verify`) and kept by an administrator
 * (`digital-id.manage`). There is no list of cards — the API reads one account's current card — so a
 * card is reached through the account that holds it.
 */
export interface DigitalIdRepository {
  /** What the API says about the card a QR code names. Recorded by the server under the checker. */
  check(payload: string): Observable<DigitalIdHolder>;

  /** The account's current card — active or suspended — or `null` when it has none. */
  cardOf(account: AppAccountId): Observable<DigitalIdCard | null>;

  /** A new card from the resident's latest approved verification selfie. */
  issue(account: AppAccountId): Observable<DigitalIdCard>;

  suspend(card: DigitalIdId): Observable<DigitalIdCard>;

  revoke(card: DigitalIdId): Observable<DigitalIdCard>;

  /** Revokes the card and issues its replacement in one act; answers with the new card. */
  reissue(card: DigitalIdId): Observable<DigitalIdCard>;

  /** The card's photo as bytes, through the data layer (`ApiClient.blob`), never as a URL. */
  openPhoto(photo: MediaId): Observable<Blob>;
}

export const DIGITAL_ID_REPOSITORY = new InjectionToken<DigitalIdRepository>('DigitalIdRepository');

/* ── Balita (`DL-171`) ──────────────────────────────────────────────────── */

/**
 * The news residents read in the app (`news.write`). **Not `NewsfeedRepository`**, which stays
 * unserved (`DL-164`). The list is the residents' own — published only; a draft is read by its id.
 */
export interface BalitaRepository {
  /** One cursor page of published articles, pinned first then newest. No total (`DL-161`). */
  list(page: CursorRequest): Observable<CursorPage<BalitaArticle>>;

  /** One article, a draft included where the API lets the reader see it; `null` when it does not. */
  get(id: BalitaArticleId): Observable<BalitaArticle | null>;

  categories(): Observable<readonly BalitaCategory[]>;

  create(draft: BalitaDraft, cover: Blob | null): Observable<BalitaArticle>;

  /** Changes what `changes` names, and replaces the cover if one is given. */
  update(id: BalitaArticleId, changes: BalitaChanges, cover: Blob | null): Observable<BalitaArticle>;

  pin(id: BalitaArticleId): Observable<BalitaArticle>;

  unpin(id: BalitaArticleId): Observable<BalitaArticle>;

  /** The cover as bytes, through the data layer, never as an address. */
  openCover(id: BalitaArticleId): Observable<Blob>;
}

export const BALITA_REPOSITORY = new InjectionToken<BalitaRepository>('BalitaRepository');

/* ── the app's audit trail (`DL-171`) ───────────────────────────────────── */

/**
 * The Node API's audit trail (`audit.view`): read-only, newest first. **Not `GovernanceRepository`**,
 * whose trail belongs to the unserved governance module (`DL-164`).
 */
export interface PlatformAuditRepository {
  /** One cursor page, newest first. No total (`DL-161`). */
  list(page: CursorRequest): Observable<CursorPage<PlatformAuditEntry>>;
}

export const PLATFORM_AUDIT_REPOSITORY = new InjectionToken<PlatformAuditRepository>(
  'PlatformAuditRepository',
);
