import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

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
  AssistanceRequestSortField,
  AssistanceRequestStatus,
  RequestNote,
  RequirementStatus,
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
import type { ProgramEnrollment } from '../beneficiaries/program-enrollment';
import type {
  DocumentRequest,
  DocumentRequestDraft,
} from '../requirements/document-request';
import type { DocumentVersionDraft } from '../requirements/requirement-document';
import type { ConditionalApplicability } from '../requirements/requirement-obligation';
import type { AssessmentDraft } from '../intake/assessment';
import type { AdvisoryAcknowledgement, IntakeAdvisory } from '../intake/intake-advisory';
import type { IntakeDraft } from '../intake/intake-draft';
import type { AuthenticatedUser, StaffFilter, StaffUser } from '../access/staff-user';
import type { MfaCredentials, SignInCredentials, SignInOutcome } from '../access/credentials';
import type { AppNotification } from '../notifications/notification';
import type { AssistanceProgram, ProgramDraft, ProgramFilter } from '../programs/program';
import type { ProgramUtilization } from '../programs/program-utilization';
import type { RequirementTemplate } from '../programs/requirement-template';
import type { DashboardFilter, DashboardSummary } from '../dashboard/dashboard-summary';
import type {
  AcknowledgementKind,
  DeferralReason,
  Release,
  ReleaseFilter,
  ReleaseSortField,
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
  ResidentSortField,
} from '../residents/resident';
import type {
  Household,
  HouseholdFilter,
  HouseholdSortField,
  MembershipChange,
} from '../households/household';
import type { HouseholdDetail, HouseholdSummary } from '../households/household-profile';
import type {
  Family,
  FamilyFilter,
  FamilyRole,
  FamilySortField,
  ResidentTransfer,
} from '../families/family';
import type { FamilyDetail, FamilySummary } from '../families/family-graph';
import type { CaseNoteSensitivity } from '../cases/case-note';
import type { CaseTaskDraft } from '../cases/case-task';
import type { CaseSummary, CaseWorkspace } from '../cases/case-workspace';
import type { CaseFilter, CaseQueueCount, CaseSortField, CaseStatus } from '../cases/social-case';
import type { Relationship, RelationshipKind } from '../families/relationship';
import type { RelationshipEvent } from '../families/relationship-event';
import type { FactorState, VulnerabilityFactorCode } from '../households/household-vulnerability';
import type { ResidentView } from '../residents/resident-disclosure';
import type { ResidentProfile } from '../residents/resident-profile';
import type {
  Referral,
  ReferralDraft,
  ReferralFilter,
  ReferralSortField,
  ReferralStatus,
} from '../referrals/referral';
import type { DisclosurePlan, ReferralSummarySheet } from '../referrals/referral-disclosure';
import type {
  FieldVisit,
  FieldVisitDraft,
  FieldVisitFilter,
  FieldVisitSortField,
  VisitOutcomeDraft,
} from '../visits/field-visit';
import type { VisitObservationDraft } from '../visits/visit-observation';
import type {
  ServiceProvider,
  ServiceProviderFilter,
} from '../referrals/service-provider';
import type { SavedView, SavedViewDraft, SavedViewResource } from '../views/saved-view';
import type { Page, PageRequest } from '../shared/pagination';
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
 * The household as a service-delivery unit.
 *
 * Two things this port deliberately does **not** offer: any method that returns
 * an eligibility, entitlement or grant decision, and any way to set a
 * vulnerability factor without a reason. Both absences are load-bearing
 * (`DL-42`) and `tools/check-vulnerability.mjs` fails the build if either
 * appears.
 */
export interface HouseholdRepository {
  list(
    filter: HouseholdFilter,
    page: PageRequest<HouseholdSortField>,
  ): Observable<Page<HouseholdSummary>>;
  getById(id: HouseholdId): Observable<HouseholdDetail | null>;
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
  list(filter: FamilyFilter, page: PageRequest<FamilySortField>): Observable<Page<FamilySummary>>;
  getById(id: FamilyId): Observable<FamilyDetail | null>;
  /** Every family a resident currently belongs to. Plural: people overlap. */
  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]>;

  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
  ): Observable<Relationship>;
  /** Ends a relationship without deleting it: a former guardian still was one. */
  endRelationship(id: RelationshipId, reason: string): Observable<Relationship>;

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
  list(filter: CaseFilter, page: PageRequest<CaseSortField>): Observable<Page<CaseSummary>>;
  /** Counts for every queue, computed under the same scope as the list itself. */
  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]>;
  getById(id: CaseId): Observable<CaseWorkspace | null>;
  /** Every case opened about one resident, newest first. */
  casesForResident(residentId: ResidentId): Observable<readonly CaseSummary[]>;

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace>;
  /** `null` returns the case to the unassigned pool, which is also a recorded act. */
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
   * Hands a task to somebody, or back to the unassigned pool with `null`.
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
 * Named list parameters. A hook rather than a product surface: the API will own
 * persistence and sharing, and this port is the shape it has to honour.
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
  list(filter: ProgramFilter, page: PageRequest): Observable<Page<AssistanceProgram>>;
  getById(id: ProgramId): Observable<AssistanceProgram | null>;
  listActive(): Observable<readonly AssistanceProgram[]>;

  /** The shared document sets a programme may start from. */
  listRequirementTemplates(): Observable<readonly RequirementTemplate[]>;

  /**
   * Creates a programme, or updates the one at `id`. Idempotent on the
   * identifier the caller holds, like every other write in this application.
   */
  save(draft: ProgramDraft, id: ProgramId | null): Observable<AssistanceProgram>;

  /** How much a programme has been used. A description of the past (`DL-69`). */
  utilizationFor(id: ProgramId): Observable<ProgramUtilization>;
  utilizationSummary(): Observable<readonly ProgramUtilization[]>;
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
  list(
    filter: AssistanceRequestFilter,
    page: PageRequest<AssistanceRequestSortField>,
  ): Observable<Page<AssistanceRequest>>;
  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null>;
  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]>;
  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest>;

  /**
   * Duplicate and previous-assistance context for one applicant.
   *
   * `programId` may be `null`: the encoder has usually named the person before
   * the programme, and the household history is worth showing straight away.
   */
  advisoryFor(residentId: ResidentId, programId: ProgramId | null): Observable<IntakeAdvisory>;

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
  recordDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Observable<AssistanceRequest>;

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

  /** Every enrollment, standing and past. Exits are history, not deletions. */
  enrollmentsFor(id: ResidentId): Observable<readonly ProgramEnrollment[]>;

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
    canonicalResidentId: ResidentId,
    supersededResidentId: ResidentId,
  ): Observable<MergePreview>;

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
  list(
    filter: FieldVisitFilter,
    page: PageRequest<FieldVisitSortField>,
  ): Observable<Page<FieldVisit>>;
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

  setChecklist(id: FieldVisitId, checkedCodes: readonly string[]): Observable<FieldVisit>;

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
  list(
    filter: ReleaseFilter,
    page: PageRequest<ReleaseSortField>,
  ): Observable<Page<Release>>;
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
 * So `send` takes a `DisclosurePlan` and refuses without one (`DL-81`): a
 * lawful basis, and every field beyond the minimum chosen individually with a
 * stated need. `summaryFor` composes the sheet from that plan rather than from
 * the whole record, so a screen cannot print a field nobody authorised.
 *
 * There is deliberately **no method that returns a client's full profile for a
 * referral**. The temptation would be to fetch it and let the template pick;
 * that is the failure this port is shaped to prevent.
 */
export interface ReferralRepository {
  list(
    filter: ReferralFilter,
    page: PageRequest<ReferralSortField>,
  ): Observable<Page<Referral>>;
  getById(id: ReferralId): Observable<Referral | null>;
  /** Every referral for one person, newest first. */
  forResident(id: ResidentId): Observable<readonly Referral[]>;
  /** The work queue: overdue first, then most urgent (`DL-83`). */
  queue(filter: ReferralFilter): Observable<readonly Referral[]>;

  /** Creates a `draft`. Nothing is disclosed until it is sent. */
  createDraft(draft: ReferralDraft): Observable<Referral>;

  /**
   * Sends it. **The only method that discloses anything**, and the reason the
   * disclosure plan is a parameter rather than a field set earlier: the basis
   * and the chosen fields are recorded in the same act as the sending, so there
   * is no window in which a referral is sendable without them.
   */
  send(id: ReferralId, plan: DisclosurePlan): Observable<Referral>;

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
   * Ends the session **server-side**.
   *
   * Discarding a variable is not revocation. The token is only dropped once the
   * API confirms, so a failed sign-out leaves the user signed in and says so,
   * rather than showing a signed-out screen while the token stays valid.
   */
  signOut(): Observable<void>;
}

export const STAFF_REPOSITORY = new InjectionToken<StaffRepository>('StaffRepository');

/**
 * The actor's inbox — **read-only**, plus marking read.
 *
 * `create()` was deleted in TAB 05. The API offers `GET me/notifications`,
 * `POST me/notifications/{id}/read` and `POST me/notifications/read-all`, and
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
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView>;

  markAttendance(
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
