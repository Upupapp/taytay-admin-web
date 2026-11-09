import { inject, Injectable } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  type Observable,
} from 'rxjs';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import type { SessionRefresher } from '@core/auth/session-refresher';
import { isNotFound } from '@core/http/api-failure';
import {
  fromServerIdentity,
  mediaFor,
  SignInError,
  type ConfirmedIdentity,
  type CursorPage,
  type CursorRequest,
  type AppNotification,
  type AuthenticatedUser,
  type MfaCredentials,
  type NotificationId,
  type NotificationRepository,
  type ServerIdentity,
  type SignInCredentials,
  type SignInOutcome,
  type StaffRepository,
  type VerificationFilter,
  type VerificationImageKind,
  type VerificationRepository,
  type VerificationRequest,
  type VerificationRequestId,
  type InboxListing,
  type MediaId,
  type Office,
  type OfficeInboxRepository,
  type OfficeRepository,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type AccountBarangay,
  type AccountRole,
  type AppAccount,
  type AppAccountFilter,
  type AppAccountId,
  type AppAccountRepository,
  type OfficeId,
  type OfficeRoleChange,
  HOTLINE_LIST_CAP,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineListing,
  type HotlineRepository,
  type OfficeChanges,
  type OfficeDraft,
  type ServiceChanges,
  type ServiceDraft,
  type TulongService,
  type TulongServiceId,
  type TulongServiceRepository,
  type BannerDraft,
  type BannerImageChange,
  type HomeBanner,
  type HomeBannerId,
  type HomePreview,
  type HomeScreenRepository,
  type LinkDraft,
  type QuickLink,
  type QuickLinkId,
  type AppConfig,
  type AppConfigChanges,
  type AppConfigRepository,
  type DigitalIdCard,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdRepository,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type BalitaChanges,
  type BalitaDraft,
  type BalitaRepository,
  type PlatformAuditEntry,
  type PlatformAuditRepository,
  ResidentDraftInvalidError,
  validateResidentDraft,
  type Resident,
  type ResidentDraft,
  type ResidentFilter,
  type ResidentId,
  type ResidentRepository,
  type ResidentView,
  type VulnerabilitySector,
  PROGRAMME_MEMBERSHIP_NOT_RECORDED,
  ResolutionInvalidError,
  buildAssistanceTimeline,
  isPeriodReversed,
  resolutionProblems,
  type AssistanceHistoryReading,
  type BeneficiaryDetail,
  type BeneficiaryFilter,
  type BeneficiaryRepository,
  type BeneficiarySummary,
  type DuplicateCandidate,
  type DuplicatePairId,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type MergePreview,
  STATUS_MOVE_NEEDS_REASON,
  APPROVAL_IS_ITS_OWN_ACT,
  APPROVAL_NEEDS_WHAT,
  approvalProblem,
  type RequestApproval,
  ASSIGNMENT_NEEDS_REASON,
  DocumentVersionInvalidError,
  REQUEST_NOTE_MAX_LENGTH,
  documentRequestProblems,
  documentVersionProblems,
  refusalFor,
  todayAsIsoDate,
  type AdvisoryAcknowledgement,
  type AssessmentAnswers,
  type AssessmentDraft,
  type AssessmentTemplate,
  type ConditionalApplicability,
  type DocumentAccessGrant,
  type DocumentRequest,
  type DocumentRequestDraft,
  type DocumentRequestId,
  type DocumentUpload,
  type DocumentVersionDraft,
  type DocumentVersionId,
  type OpenAssessment,
  type RequestNoteDraft,
  type RequirementId,
  type RequirementStatus,
  type SocialWorker,
  type StaffUserId,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestStatus,
  type IntakeAdvisory,
  type IntakeDraft,
  type RequestNote,
  type AssistanceProgram,
  type ProgramDraft,
  type ProgramFilter,
  type ProgramId,
  type ProgramRepository,
  type ProgramUtilizationReading,
  type ProgramUtilizationSummary,
  type RequirementTemplate,
  type RequirementTemplateDraft,
  isValidSavedViewName,
  SAVED_VIEW_NAME_MAX_LENGTH,
  type FactorState,
  type HouseholdDetail,
  type HouseholdDraft,
  type HouseholdFilter,
  type HouseholdId,
  type HouseholdRepository,
  type HouseholdSummary,
  type MembershipChange,
  type ResidentProfile,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewRepository,
  type SavedViewResource,
  type VulnerabilityFactorCode,
  FamilyDraftInvalidError,
  isValidTransferReason,
  RelationshipInvalidError,
  TransferRefusedError,
  validateFamilyDraft,
  type Family,
  type FamilyDetail,
  type FamilyDraft,
  type FamilyFilter,
  type FamilyId,
  type FamilyRepository,
  type FamilyRole,
  type FamilySummary,
  type Relationship,
  type RelationshipEvent,
  type RelationshipId,
  type RelationshipKind,
  type ResidentTransfer,
  CASE_SEARCH_MAX_LENGTH,
  CASE_SEARCH_MIN_LENGTH,
  caseOpenProblems,
  caseTimeline,
  headOf,
  isValidCaseReason,
  isValidNoteBody,
  presentFactors,
  type CaseFilter,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseOpenDraft,
  type CaseQueueCount,
  type CaseRepository,
  type CaseStatus,
  type CaseSummary,
  type CaseTaskDraft,
  type CaseTaskId,
  type CaseWorkspace,
  type IsoDate,
  type OfficeAlert,
  type SearchRepository,
  type SearchResults,
  type TeamQueue,
  type WorkQueue,
  type WorkRepository,
  type ExportFormat,
  type ReportDefinition,
  type ReportExport,
  type ReportFilter,
  type ReportId,
  type ReportRepository,
  type ReportResult,
  AUDIT_SENSITIVE_FILTER_UNAVAILABLE,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditFilter,
  type AuditRow,
  type ClassifiedRecordType,
  type CorrectionRequest,
  type GovernanceRepository,
  type RetentionRule,
  type StaffAccount,
  buildTeamQueue,
  isSearchable,
  type DeferralReason,
  type Release,
  type ReleaseAcknowledgementDraft,
  type ReleaseBatch,
  type ReleaseBatchDraft,
  type ReleaseBatchId,
  type ReleaseDraft,
  type ReleaseFilter,
  type ReleaseId,
  type ReleaseManifest,
  type ReleaseRepository,
  type ReleaseStatus,
  type WriteIntent,
  releaseDraftProblems,
  VisitInvalidError,
  observationProblems,
  referralDraftProblems,
  visitDraftProblems,
  visitOutcomeProblems,
  type DisclosureBasis,
  type FieldVisit,
  type FieldVisitDraft,
  type FieldVisitFilter,
  type FieldVisitId,
  type FieldVisitRepository,
  type DashboardFilter,
  type DashboardRepository,
  type DashboardSummary,
  type Referral,
  type ReferralDraft,
  type ReferralFilter,
  type ReferralId,
  type ReferralRepository,
  type ReferralStatus,
  type ReferralSummarySheet,
  type ServiceProvider,
  type ServiceProviderFilter,
  type ServiceProviderId,
  type SharedField,
  type VisitChecklistSelection,
  type VisitObservationDraft,
  type VisitOutcomeDraft,
  ISSUANCE_OPEN_STATUSES,
  type IssuanceAttachmentId,
  type IssuanceFileGrant,
  type IssuanceListFilter,
  type IssuanceMove,
  type IssuanceQueueFilter,
  type IssuanceRepository,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceRequestSummary,
  type IssuanceType,
  type IssuanceTypeChanges,
  type IssuanceTypeDraft,
  type IssuanceTypeId,
  ISSUANCE_REFERENCE_INCOMPLETE,
  wholeIssuanceReference,
  CHECK_IN_MIN_LENGTH,
  EVENT_PROBLEM_MESSAGES,
  asIsoDateTime,
  eventProblems,
  type AttendanceStatus,
  type CheckInLookup,
  type EventCapacitySummary,
  type EventCorrection,
  type EventCover,
  type EventDraft,
  type EventFilter,
  type EventMetrics,
  type EventRegistrationId,
  type EventRepository,
  type EventView,
  type LguEvent,
  type LguEventId,
  type RegistrantExport,
  type RegistrantFilter,
  type RegistrantView,
  type RegistrationAction,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import type { IdentityGrant, IdentityPort } from './identity/identity.model';
import { IdentityProvider } from './identity/identity.provider';
import { invalidCredentials, signInUnavailable } from './identity/sign-in-messages';
import { confinesToOneBarangay, toServerIdentity } from './mappers/me.mapper';
import { toDashboardSummary } from './mappers/dashboard.mapper';
import {
  toAssistanceHistoryReading,
  toBeneficiaryRecordParts,
  toBeneficiarySummary,
  toDuplicateCandidate,
  toIdentityResolution,
  toMergePreview,
  toOpenPairCount,
  toProgramUtilizationReading,
  toProgramUtilizationSummary,
  toWireIdentityDecision,
} from './mappers/beneficiary.mapper';
import {
  RELEASE_REASON_MIN_LENGTH,
  toRelease,
  toReleaseApprover,
  toReleaseBatch,
  toReleaseManifest,
  toWireReleaseAcknowledgement,
  toWireReleaseBatchOpen,
  toWireReleaseDeferral,
  toWireReleaseHandOver,
  toWireReleasePrepare,
  toWireReleaseStatus,
} from './mappers/release.mapper';
import {
  toReferral,
  toReferralSummary,
  toServiceProvider,
  toWireReferralBasis,
  toWireReferralDraft,
  toWireReferralFollowUp,
  toWireReferralMove,
  toWireReferralNote,
  toWireReferralOutcome,
  toWireReferralSharedField,
} from './mappers/referral.mapper';
import {
  toFieldVisit,
  toWireVisitChecklist,
  toWireVisitClose,
  toWireVisitObservations,
  toWireVisitSchedule,
} from './mappers/field-visit.mapper';
import { toNotification } from './mappers/notification.mapper';
import {
  toAccountBarangay,
  toAppAccount,
  toWireOfficeRoleChange,
} from './mappers/app-account.mapper';
import {
  toDigitalIdCard,
  toDigitalIdHolder,
  toWireDigitalIdVerify,
} from './mappers/digital-id.mapper';
import {
  toBalitaArticle,
  toBalitaCategory,
  toWireNewsPatch,
  toWireNewsWrite,
} from './mappers/balita.mapper';
import { toPlatformAuditEntry } from './mappers/platform-audit.mapper';
import {
  toBarangayIndex,
  toResident,
  toResidentView,
  toWireReason,
  toWireResidentDraft,
  toWireSectorRecord,
  type BarangayIndex,
} from './mappers/resident.mapper';
import { toOffice } from './mappers/office.mapper';
import {
  toDirectoryOffice,
  toWireOfficeChanges,
  toWireOfficeDraft,
} from './mappers/directory-office.mapper';
import { toHotline } from './mappers/hotline.mapper';
import { toAppConfig, toWireAppConfigChanges } from './mappers/app-config.mapper';
import {
  toHomeBanner,
  toHomePreview,
  toQuickLink,
  toStoredMedia,
  toWireMediaUpload,
} from './mappers/home.mapper';
import {
  toTulongService,
  toWireServiceChanges,
  toWireServiceDraft,
  toWireServiceImage,
} from './mappers/tulong-service.mapper';
import { toOfficeThread, toPostedMessage, toThreadMessage } from './mappers/office-thread.mapper';
import {
  toHouseholdDetail,
  toHouseholdRefusal,
  toHouseholdSummary,
  toWireCorrection,
  toWireHouseholdDraft,
  toWireMembership,
} from './mappers/household.mapper';
import {
  toFamilyDetail,
  toFamilyRefusal,
  toFamilySummary,
  toRelationship,
  toRelationshipEvent,
  toWireFamilyDraft,
  toWireRelationship,
  toWireRoleChange,
  toWireTransfer,
  type FamilyRefusalKind,
} from './mappers/family.mapper';
import {
  toAssistanceProgram,
  toRequirementTemplate,
  toWireProgramDraft,
  toWireRequirementTemplate,
  toWireRequirementTemplatePatch,
} from './mappers/program.mapper';
import {
  REVIEW_VERDICTS,
  toAssessmentTemplate,
  toAssistanceRequest,
  toDocumentAccessGrant,
  toDocumentRequest,
  toIntakeAdvisory,
  toOpenAssessment,
  toRequestNote,
  toSocialWorker,
  toWireApplicabilityRuling,
  toWireAssessment,
  toWireAssessmentAnswers,
  toWireAssessmentOpen,
  toWireAssignment,
  toWireDocumentFileRequest,
  toWireDocumentRequest,
  toWireDocumentRequestWithdrawal,
  toWireDocumentUpload,
  toWireNote,
  toWireRequestDraft,
  toWireRequestFiling,
  toWireApproval,
  toWireRequirementReview,
  toWireStatusMove,
} from './mappers/assistance-request.mapper';
import {
  toCaseAssignee,
  toCaseQueueCount,
  toCaseSummary,
  toCaseWorkspaceParts,
  toWireCaseAssignment,
  toWireCaseNote,
  toWireCaseOpen,
  toWireCaseRequestLink,
  toWireCaseRequestLinkEnd,
  toWireCaseStatus,
  toWireCaseTask,
  toWireCaseTaskAssignment,
  toWireCaseTaskCancellation,
  toWireCaseTaskCompletion,
  toWireCaseTaskReschedule,
  type CaseWorkspaceParts,
} from './mappers/case.mapper';
import { toSavedView, toWireSavedViewDraft } from './mappers/saved-view.mapper';
import { toVerificationRequest } from './mappers/verification.mapper';
import {
  toIssuanceFileGrant,
  toIssuanceRequest,
  toIssuanceRequestSummary,
  toIssuanceType,
  toWireIssuanceFileRequest,
  toWireIssuanceStatusChange,
  toWireIssuanceTypeCreate,
  toWireIssuanceTypeRetire,
  toWireIssuanceTypeUpdate,
} from './mappers/issuance.mapper';
import { toSearchResults } from './mappers/search.mapper';
import { toReportDefinitions, toReportExport, toReportResult } from './mappers/report.mapper';
import {
  toClassifiedRecordType,
  toCorrectionRequest,
  toGovernanceAuditDetail,
  toGovernanceAuditRow,
  toRetentionRule,
  toStaffAccount,
  toWireAccountSwitch,
} from './mappers/governance.mapper';
import {
  toCheckInLookup,
  toEventCapacity,
  toEventHistoryRow,
  toEventMetrics,
  toLguEvent,
  toRegistrantExport,
  toRegistrantView,
  toWireEventAttendance,
  toWireEventCorrection,
  toWireEventDraft,
  toWireEventReason,
} from './mappers/event.mapper';
import { toOfficeAlerts, toTeamWork, toWorkQueue } from './mappers/work.mapper';
import { list } from './mappers/wire';
import { unserved } from './unserved-repositories';

/**
 * The adapters the Node API actually serves.
 *
 * Three ports of twenty-one: the signed-in account and its inbox — and sign-in itself, through the
 * identity provider in `identity/` (`DL-166`) — and residents' ID verification review
 * (`DL-167`). Every other port is bound in the `http` configuration to an adapter that makes no request and says so (`unserved-repositories.ts`,
 * `DL-164`, `DL-165`). The Laravel adapters that stood here called forty paths of an API that was
 * retired on 2026-10-20; they are recoverable from git at `990edfa` and nowhere else, because code
 * kept "for later" against a server that no longer exists is a surface nothing is reading.
 *
 * Every read goes through a mapper: a generic on `ApiClient` is an assertion, not a conversion
 * (`check:mapper-adoption`).
 */

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(AuthTokenHolder);
  private readonly identity: IdentityPort = inject(IdentityProvider);
  // A barangay link's barangay arrives as the API's id; the console knows it by its own.
  private readonly barangayJoin = new BarangayJoin();

  /**
   * `GET me`, read — with the barangay a barangay link serves translated to the console's id.
   * `GET barangays` is asked only for that account: nobody else's answer names a barangay.
   */
  private identify(wire: unknown): Observable<ServerIdentity | null> {
    return confinesToOneBarangay(wire)
      ? this.barangayJoin.read().pipe(map((barangays) => toServerIdentity(wire, barangays)))
      : of(toServerIdentity(wire, null));
  }

  /**
   * `GET admin/users` lists every account in the residents' app, not the office's staff, and only
   * an administrator may read it — the same word on a different population (`DL-164`). A staff
   * directory built on it would list residents as colleagues.
   */
  list(): Observable<never> {
    return unserved('the staff directory');
  }

  getById(): Observable<never> {
    return unserved('the staff directory');
  }

  /**
   * Who the server says the caller is — or `null`, which is also the answer for an account that
   * may not hold a console session (a resident, or a closed account).
   *
   * Refusing such an account drops the token **locally only**. Revoking it would sign that person
   * out of the residents' app on their phone, for having opened the wrong website.
   */
  currentUser(): Observable<AuthenticatedUser | null> {
    if (!this.tokens.hasToken()) {
      // Without a token there is nothing to ask about, and an unauthenticated GET would answer 401
      // and bounce the user to sign-in through the error interceptor on every reload.
      return of(null);
    }

    return this.api.item(API_ENDPOINTS.me).pipe(
      switchMap((wire) => this.identify(wire)),
      map((identity) => {
        if (identity === null) {
          this.tokens.clear();
          return null;
        }

        return fromServerIdentity(identity);
      }),
    );
  }

  /**
   * Firebase sign-in, then the API's own answer about who that is (`DL-166`).
   *
   * The identity provider proves the password; only `GET me` says whether the account may hold a
   * console session. The ID token is held **before** that request, because the request is how it is
   * presented — and dropped, locally, if the answer is no.
   */
  signIn(credentials: SignInCredentials): Observable<SignInOutcome> {
    return this.identity.signIn(credentials).pipe(
      switchMap((first) =>
        first.kind === 'second-factor'
          ? of<SignInOutcome>({ kind: 'mfa-required', challenge: first.challenge })
          : this.establish(first.grant).pipe(
              map((user): SignInOutcome => ({ kind: 'authenticated', user })),
            ),
      ),
    );
  }

  completeMfa(credentials: MfaCredentials): Observable<AuthenticatedUser> {
    return this.identity.finalizeMfa(credentials).pipe(switchMap((grant) => this.establish(grant)));
  }

  /**
   * `POST auth/sign-out` revokes every refresh token the account holds, and the token here is
   * dropped once the API has answered — **whatever it answered**.
   *
   * The request goes first, so it is sent with the credential it is revoking; clearing before it
   * would send it unauthenticated and revoke nothing. But the token is not kept on a failure. The
   * Laravel console did keep it, because a personal access token lived until somebody revoked it;
   * a Firebase ID token expires within the hour on its own, and keeping it in memory after the
   * person asked to leave — on a shared office computer — protects nobody. The failure still
   * propagates, so the screen can say the server did not confirm (`DL-165`).
   */
  signOut(): Observable<void> {
    if (!this.tokens.hasToken()) {
      this.identity.forget();
      return of(undefined);
    }

    return this.api.post(API_ENDPOINTS.signOut, {}).pipe(
      map(() => undefined),
      finalize(() => {
        this.tokens.clear();
        // The refresh token too: revoked by the request above, and of no use to anybody after it.
        this.identity.forget();
      }),
    );
  }

  /**
   * Holds the grant, asks the API who it belongs to, and refuses an account that may not hold a
   * console session.
   *
   * A resident's account or a closed one gets the **same** message as a wrong password, and its
   * credentials are dropped **locally only**. Revoking them would sign that resident out of the
   * app on their phone for having typed their password into the wrong website — and would tell
   * whoever typed it that the address has an account.
   */
  private establish(grant: IdentityGrant): Observable<AuthenticatedUser> {
    return defer(() => {
      this.tokens.hold(grant.idToken, grant.expiresAt);

      return this.api.item(API_ENDPOINTS.me);
    }).pipe(
      switchMap((wire) => this.identify(wire)),
      map((identity) => {
        if (identity === null) {
          throw invalidCredentials();
        }

        return fromServerIdentity(identity);
      }),
      catchError((error: unknown) => {
        this.tokens.clear();
        this.identity.forget();
        // The API's own failure was already reported by the error interceptor; the form says only
        // that sign-in did not complete.
        return throwError(() => (error instanceof SignInError ? error : signInUnavailable()));
      }),
    );
  }
}

/**
 * Renews the ID token from the identity provider's refresh token, once per renewal however many
 * requests are waiting for it (`SESSION_REFRESHER`, `DL-166`).
 *
 * Here rather than in the provider because holding a token is the staff adapters' act alone
 * (`check:auth` rule 4). On failure the credential is dropped — a session that cannot be renewed
 * is over — and the interceptor ends it and sends nobody's request.
 */
@Injectable()
export class HttpSessionRefresher implements SessionRefresher {
  private readonly tokens = inject(AuthTokenHolder);
  private readonly identity: IdentityPort = inject(IdentityProvider);
  private inFlight: Observable<void> | null = null;

  refresh(): Observable<void> {
    this.inFlight ??= this.identity.refresh().pipe(
      tap((grant) => this.tokens.hold(grant.idToken, grant.expiresAt)),
      map((): void => undefined),
      catchError((error: unknown) => {
        this.tokens.clear();
        this.identity.forget();
        return throwError(() => error);
      }),
      finalize(() => {
        this.inFlight = null;
      }),
      // Shared, and replayed to a caller that arrives as it finishes: one refresh token spent once.
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.inFlight;
  }
}

@Injectable()
export class HttpNotificationRepository implements NotificationRepository {
  private readonly api = inject(ApiClient);

  /**
   * The whole inbox, or an error — never the first page of it shown as all of it.
   *
   * The route is cursor-paged and the port answers with one list, so every page is read
   * (`everyPage` refuses past a thousand rows rather than truncating, `DL-161`). An inbox that long
   * is a port that should become paged, not a list to cut short.
   */
  listForCurrentUser(): Observable<readonly AppNotification[]> {
    return this.api
      .everyPage(API_ENDPOINTS.notifications)
      .pipe(map((rows) => list(rows, toNotification)));
  }

  markRead(id: NotificationId): Observable<AppNotification> {
    return this.api.post(`${API_ENDPOINTS.notifications}/${id}/read`, {}).pipe(
      map((wire) => {
        const notification = toNotification(wire);

        if (notification === null) {
          throw new Error('The server marked that message read, and its answer could not be read.');
        }

        return notification;
      }),
    );
  }

  /**
   * `POST notifications/read` answers with how many it changed, not with the inbox, so the inbox is
   * read again rather than assumed: a count says nothing about which rows a screen still shows.
   */
  markAllRead(): Observable<readonly AppNotification[]> {
    return this.api
      .post(`${API_ENDPOINTS.notifications}/read`, {})
      .pipe(switchMap(() => this.listForCurrentUser()));
  }
}

/**
 * Residents' ID verification review (`DL-167`) — the first port the Node API serves because the
 * resource *is* the thing the port names, not something with the same word on it.
 *
 * Admin only on the server (`verification.review`); the route guard mirrors it, and the API refuses
 * anybody else whatever this console shows.
 */
@Injectable()
export class HttpVerificationRepository implements VerificationRepository {
  private readonly api = inject(ApiClient);

  /**
   * One cursor page, read **whole or not at all**: a request the mapper cannot read refuses the
   * page. Dropping it would show one fewer resident waiting for an answer, with no error anywhere —
   * and that resident would wait indefinitely for a review nobody can see is owed.
   */
  list(
    filter: VerificationFilter,
    page: CursorRequest,
  ): Observable<CursorPage<VerificationRequest>> {
    return this.api
      .cursorPage(API_ENDPOINTS.verificationRequests, page, { status: filter.status ?? undefined })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readVerification) })));
  }

  /** `confirmed_…` go back exactly as `account_…` came, and the server compares them (`DL-197`). */
  approve(
    id: VerificationRequestId,
    note: string,
    confirmed: ConfirmedIdentity,
  ): Observable<VerificationRequest> {
    return this.api
      .post(`${API_ENDPOINTS.verificationRequests}/${id}/approve`, {
        notes: note,
        confirmed_name: confirmed.name,
        confirmed_birthdate: confirmed.birthDate,
      })
      .pipe(map(readVerification));
  }

  /** `notes` is the reason the resident reads in the app (`issues` on their copy). */
  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest> {
    return this.api
      .post(`${API_ENDPOINTS.verificationRequests}/${id}/reject`, { notes: reason })
      .pipe(map(readVerification));
  }

  /**
   * The bytes, with the bearer token in a header (`ApiClient.blob`). An image the request does not
   * carry is refused here, without a request, rather than asked for by a missing id.
   */
  openImage(request: VerificationRequest, kind: VerificationImageKind): Observable<Blob> {
    const media = mediaFor(request, kind);

    return media === null
      ? throwError(() => new Error('This request carries no such image.'))
      : this.api.blob(`${API_ENDPOINTS.media}/${media}/content`);
  }
}

function readVerification(wire: unknown): VerificationRequest {
  const request = toVerificationRequest(wire);

  if (request === null) {
    throw new Error(
      'A verification request from the server could not be read, so none is shown rather than ' +
        'some: a request left out of this list would wait for a review nobody knows is owed.',
    );
  }

  return request;
}

/**
 * The office inbox (`DL-168`): residents writing to an office, answered by its staff.
 *
 * `office-inbox.manage` on the server — staff while assigned to an office, and administrators. Which
 * conversations come back is the server's decision; nothing here filters by office.
 */
@Injectable()
export class HttpOfficeInboxRepository implements OfficeInboxRepository {
  private readonly api = inject(ApiClient);

  /**
   * One page, read whole or not at all — and an empty first page **asked about** before it is
   * believed.
   *
   * `GET threads` answers a staff account with no office with an empty page, which is also what an
   * office nobody has written to receives. So when the first page is empty the adapter asks `GET me`
   * whether this account has an office, and answers `no-office` if it has none: an officer told "no
   * conversations" concludes residents are quiet, when the truth is that this account cannot see
   * them. A later empty page needs no question — the first page already answered it.
   */
  list(page: CursorRequest): Observable<InboxListing> {
    return this.api.cursorPage(API_ENDPOINTS.threads, page).pipe(
      map((answer): CursorPage<OfficeThread> => ({ ...answer, items: answer.items.map(readThread) })),
      switchMap((answer) => {
        const listing: InboxListing = { kind: 'threads', page: answer };
        if (answer.items.length > 0 || (page.cursor ?? null) !== null) {
          return of(listing);
        }
        return this.api
          .item(API_ENDPOINTS.me)
          .pipe(
            map((me): InboxListing =>
              // Only whether an office is named is read here, so no barangay needs translating.
              toServerIdentity(me, null)?.awaitingOffice === true ? { kind: 'no-office' } : listing,
            ),
          );
      }),
    );
  }

  thread(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.item(`${API_ENDPOINTS.threads}/${id}`).pipe(map(readThread));
  }

  /** Newest first, as the server orders them. A message it cannot read refuses the page. */
  messages(id: OfficeThreadId, page: CursorRequest): Observable<CursorPage<ThreadMessage>> {
    return this.api
      .cursorPage(`${API_ENDPOINTS.threads}/${id}/messages`, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readMessage) })));
  }

  /**
   * The words as typed; the server trims them and refuses a closed conversation with `409`. The key
   * is the screen's, in the body (the CORS policy is not widened for a header): a retry under it is
   * answered with the message already sent, never a second one.
   */
  reply(id: OfficeThreadId, body: string, intent: WriteIntent): Observable<ThreadMessage> {
    return this.api
      .post(`${API_ENDPOINTS.threads}/${id}/messages`, { body, idempotency_key: intent.key })
      .pipe(map(readPosted));
  }

  markRead(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.post(`${API_ENDPOINTS.threads}/${id}/read`, {}).pipe(map(readThread));
  }

  /** No body: the server accepts none, so there is no reason to send (`THREAD_CLOSE_EFFECTS`). */
  close(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.post(`${API_ENDPOINTS.threads}/${id}/close`, {}).pipe(map(readThread));
  }

  /**
   * The bytes, with the bearer token in a header (`ApiClient.blob`). An image the message does not
   * carry is refused here, without a request, rather than fetched by an id from somewhere else.
   */
  openAttachment(message: ThreadMessage, media: MediaId): Observable<Blob> {
    return message.attachments.includes(media)
      ? this.api.blob(`${API_ENDPOINTS.media}/${media}/content`)
      : throwError(() => new Error('This message carries no such image.'));
  }
}

/** The office directory, read in full (`DL-161`): a picker missing an office says it does not exist. */
@Injectable()
export class HttpOfficeRepository implements OfficeRepository {
  private readonly api = inject(ApiClient);

  list(): Observable<readonly Office[]> {
    return this.api.everyPage(API_ENDPOINTS.offices).pipe(map((items) => items.map(readOffice)));
  }
}

/**
 * Users and roles (`DL-168`): every residents' app account, and who among them is staff.
 *
 * Admin only on the server (`user.view`, `user.change-role`, `user.assign-office`). The role is sent
 * as the domain holds it — the domain's four roles are the API's own `RoleChange` values.
 */
@Injectable()
export class HttpAppAccountRepository implements AppAccountRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an account the mapper cannot read refuses the page. */
  list(page: CursorRequest, filter: AppAccountFilter = {}): Observable<CursorPage<AppAccount>> {
    return this.api
      .cursorPage(API_ENDPOINTS.adminUsers, page, {
        // The open residents' accounts with this status, as the dashboard counts them (`DL-186`).
        verification_status: filter.verificationStatus,
      })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readAccount) })));
  }

  changeRole(id: AppAccountId, role: AccountRole): Observable<AppAccount> {
    return this.api.patch(`${API_ENDPOINTS.adminUsers}/${id}/role`, { role }).pipe(map(readAccount));
  }

  assignOffice(id: AppAccountId, office: OfficeId | null): Observable<AppAccount> {
    return this.api
      .patch(`${API_ENDPOINTS.adminUsers}/${id}/office`, { office_id: office })
      .pipe(map(readAccount));
  }

  /** The reason travels with the change; the server keeps it in the office-role history (`DL-173`). */
  assignOfficeRole(id: AppAccountId, change: OfficeRoleChange): Observable<AppAccount> {
    return this.api
      .patch(`${API_ENDPOINTS.adminUsers}/${id}/office-role`, toWireOfficeRoleChange(change))
      .pipe(map(readAccount));
  }

  /**
   * Whole or not at all: a barangay missing from the picker is one nobody can confine a barangay
   * link to, and the absence would read as the municipality not having it.
   */
  barangays(): Observable<readonly AccountBarangay[]> {
    return this.api.list(API_ENDPOINTS.barangays).pipe(
      map((rows) =>
        rows.map((row) => {
          const barangay = toAccountBarangay(row);
          if (barangay === null) {
            throw new Error('A barangay from the server could not be read, so none is offered.');
          }
          return barangay;
        }),
      ),
    );
  }
}

function readAccount(wire: unknown): AppAccount {
  const account = toAppAccount(wire);

  if (account === null) {
    throw new Error(
      'An account from the server could not be read, so none is shown rather than some: an ' +
        'account left out of this list is one nobody can see is staff.',
    );
  }

  return account;
}

function readThread(wire: unknown): OfficeThread {
  const thread = toOfficeThread(wire);

  if (thread === null) {
    throw new Error(
      'A conversation from the server could not be read, so none is shown rather than some: a ' +
        'conversation left out of this inbox is a resident nobody knows is waiting.',
    );
  }

  return thread;
}

function readMessage(wire: unknown): ThreadMessage {
  const message = toThreadMessage(wire);

  if (message === null) {
    throw new Error(
      'A message from the server could not be read, so the conversation is not shown rather than ' +
        'shown with a gap in it.',
    );
  }

  return message;
}

function readPosted(wire: unknown): ThreadMessage {
  const message = toPostedMessage(wire);

  if (message === null) {
    throw new Error(
      'The server accepted the reply, but its answer could not be read. Open the conversation ' +
        'again to see it before sending anything twice.',
    );
  }

  return message;
}

function readOffice(wire: unknown): Office {
  const office = toOffice(wire);

  if (office === null) {
    throw new Error(
      'An office from the server could not be read, so the list is not shown rather than shown ' +
        'without it: an office missing from a list reads as one that does not exist.',
    );
  }

  return office;
}

/* ── the residents' app directory (`DL-170`) ─────────────────────────────── */

/**
 * The office directory, written. Admin only on the server (`office.manage`); read through the public
 * `GET offices`, a page at a time. A create or a change is a **form**, because it may carry the
 * banner — and the server refuses a form whose banner is too large or not an image, as
 * `APP_IMAGE_POLICY` says before anything is sent.
 */
@Injectable()
export class HttpDirectoryOfficeRepository implements DirectoryOfficeRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an office the mapper cannot read refuses the page. */
  list(page: CursorRequest): Observable<CursorPage<DirectoryOffice>> {
    return this.api
      .cursorPage(API_ENDPOINTS.offices, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readDirectoryOffice) })));
  }

  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice> {
    return this.api
      .postForm(API_ENDPOINTS.adminOffices, toWireOfficeDraft(draft, banner))
      .pipe(map(readDirectoryOffice));
  }

  update(id: OfficeId, changes: OfficeChanges, banner: Blob | null): Observable<DirectoryOffice> {
    return this.api
      .patchForm(`${API_ENDPOINTS.adminOffices}/${id}`, toWireOfficeChanges(changes, banner))
      .pipe(map(readDirectoryOffice));
  }

  remove(id: OfficeId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminOffices}/${id}`).pipe(map(() => undefined));
  }
}

/**
 * Tulong pages (`service.manage`). The list is the residents' own — `GET services`, which leaves out
 * a page hidden from the catalogue — because the API has no other; one page is read by its address,
 * which answers hidden ones too.
 */
@Injectable()
export class HttpTulongServiceRepository implements TulongServiceRepository {
  private readonly api = inject(ApiClient);

  list(page: CursorRequest): Observable<CursorPage<TulongService>> {
    return this.api
      .cursorPage(API_ENDPOINTS.services, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readTulongService) })));
  }

  /** A `404` is "no page at that address"; anything else is a failure, never an absence. */
  find(slug: string): Observable<TulongService | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.services}/${encodeURIComponent(slug)}`)
      .pipe(map((wire) => (wire === null ? null : readTulongService(wire))));
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    return this.api
      .post(API_ENDPOINTS.adminServices, toWireServiceDraft(draft))
      .pipe(map(readTulongService));
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    return this.api
      .patch(`${API_ENDPOINTS.adminServices}/${id}`, toWireServiceChanges(changes))
      .pipe(map(readTulongService));
  }

  replaceImage(id: TulongServiceId, image: Blob): Observable<TulongService> {
    return this.api
      .postForm(`${API_ENDPOINTS.adminServices}/${id}/media`, toWireServiceImage(image))
      .pipe(map(readTulongService));
  }

  remove(id: TulongServiceId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminServices}/${id}`).pipe(map(() => undefined));
  }
}

/**
 * Hotlines (`hotline.manage`). The admin list is every line, shown and hidden, answered whole and
 * capped by the server at `HOTLINE_LIST_CAP` with no word of more — so an answer that long says it
 * may be incomplete rather than presenting itself as the whole.
 */
@Injectable()
export class HttpHotlineRepository implements HotlineRepository {
  private readonly api = inject(ApiClient);

  list(): Observable<HotlineListing> {
    return this.api.list(API_ENDPOINTS.adminHotlines).pipe(
      map((items) => ({
        hotlines: items.map(readHotline),
        mayBeIncomplete: items.length >= HOTLINE_LIST_CAP,
      })),
    );
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    return this.api
      .post(API_ENDPOINTS.adminHotlines, {
        name: draft.name,
        number: draft.number,
        category: draft.category,
        sort_order: draft.sortOrder,
        active: draft.active,
      })
      .pipe(map(readHotline));
  }

  /** A field left `undefined` is not serialised, so only what changed is sent. */
  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline> {
    return this.api
      .patch(`${API_ENDPOINTS.adminHotlines}/${id}`, {
        name: changes.name,
        number: changes.number,
        category: changes.category,
        sort_order: changes.sortOrder,
        active: changes.active,
      })
      .pipe(map(readHotline));
  }

  remove(id: HotlineId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminHotlines}/${id}`).pipe(map(() => undefined));
  }
}

function readDirectoryOffice(wire: unknown): DirectoryOffice {
  const office = toDirectoryOffice(wire);

  if (office === null) {
    throw new Error(
      'An office from the server could not be read, so the list is not shown rather than shown ' +
        'without it: an office missing here reads as one the app does not list.',
    );
  }

  return office;
}

function readTulongService(wire: unknown): TulongService {
  const service = toTulongService(wire);

  if (service === null) {
    throw new Error(
      'A Tulong page from the server could not be read — one of its contacts, places or lists is ' +
        'in a form this console does not know — so none is shown rather than one that a save ' +
        'would quietly cut short.',
    );
  }

  return service;
}

function readHotline(wire: unknown): Hotline {
  const hotline = toHotline(wire);

  if (hotline === null) {
    throw new Error(
      'A hotline from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a number missing here is one nobody checks.',
    );
  }

  return hotline;
}

/* ── the app's home screen (`DL-170`) ────────────────────────────────────── */

/**
 * The home screen's banners and links (`home.manage`), and what the app is given now (`GET home`).
 *
 * A banner's image is stored first, through `POST media`, and the banner then names it — two
 * requests, because that is how the API takes an image for a banner. If the second is refused, the
 * first has already stored the image; nothing in the API removes it, and the effects say so before
 * the button (`HOME_EFFECTS.imageUpload`).
 */
@Injectable()
export class HttpHomeScreenRepository implements HomeScreenRepository {
  private readonly api = inject(ApiClient);

  /** Every banner, shown and hidden, answered whole; one the mapper cannot read refuses the list. */
  banners(): Observable<readonly HomeBanner[]> {
    return this.api.list(API_ENDPOINTS.adminBanners).pipe(map((items) => items.map(readBanner)));
  }

  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner> {
    return this.storedImage(image).pipe(
      switchMap((media) =>
        this.api.post(API_ENDPOINTS.adminBanners, {
          title: draft.title,
          media_id: media,
          href: draft.href,
          sort_order: draft.sortOrder,
          active: draft.active,
        }),
      ),
      map(readBanner),
    );
  }

  /**
   * The spec's `PATCH` body is `BannerWrite`, which requires `title`, so the title is always sent.
   * The image is named only when it changes: `undefined` leaves it, `null` removes it.
   */
  updateBanner(id: HomeBannerId, draft: BannerDraft, image: BannerImageChange): Observable<HomeBanner> {
    const media: Observable<MediaId | null | undefined> =
      image.kind === 'replace'
        ? this.storedImage(image.image)
        : of(image.kind === 'remove' ? null : undefined);
    return media.pipe(
      switchMap((mediaId) =>
        this.api.patch(`${API_ENDPOINTS.adminBanners}/${id}`, {
          title: draft.title,
          media_id: mediaId,
          href: draft.href,
          sort_order: draft.sortOrder,
          active: draft.active,
        }),
      ),
      map(readBanner),
    );
  }

  removeBanner(id: HomeBannerId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminBanners}/${id}`).pipe(map(() => undefined));
  }

  /**
   * A banner's image, as bytes, with the bearer token in a header (`ApiClient.blob`) — for a banner
   * hidden from the app as well, which the public image route would not answer.
   */
  bannerImage(banner: HomeBanner): Observable<Blob> {
    return banner.mediaId === null
      ? throwError(() => new Error('This banner has no image.'))
      : this.api.blob(`${API_ENDPOINTS.media}/${banner.mediaId}/content`);
  }

  links(): Observable<readonly QuickLink[]> {
    return this.api.list(API_ENDPOINTS.adminLinks).pipe(map((items) => items.map(readLink)));
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    return this.api
      .post(API_ENDPOINTS.adminLinks, {
        label: draft.label,
        href: draft.href,
        sort_order: draft.sortOrder,
      })
      .pipe(map(readLink));
  }

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    return this.api
      .patch(`${API_ENDPOINTS.adminLinks}/${id}`, {
        label: draft.label,
        href: draft.href,
        sort_order: draft.sortOrder,
      })
      .pipe(map(readLink));
  }

  removeLink(id: QuickLinkId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminLinks}/${id}`).pipe(map(() => undefined));
  }

  preview(): Observable<HomePreview> {
    return this.api.item(API_ENDPOINTS.home).pipe(
      map((wire) => {
        const preview = toHomePreview(wire);
        if (preview === null) {
          throw new Error(
            'The home screen from the server could not be read, so no preview is shown rather than ' +
              'one that differs from what residents see.',
          );
        }
        return preview;
      }),
    );
  }

  /** Stores the image and answers its id, or answers `null` at once when there is none. */
  private storedImage(image: Blob | null): Observable<MediaId | null> {
    if (image === null) {
      return of(null);
    }
    return this.api.postForm(API_ENDPOINTS.media, toWireMediaUpload(image)).pipe(
      map((wire) => {
        const media = toStoredMedia(wire);
        if (media === null) {
          throw new Error(
            'The image was stored, but the server’s answer could not be read, so the banner was not ' +
              'saved. The image stays stored, unused.',
          );
        }
        return media;
      }),
    );
  }
}

function readBanner(wire: unknown): HomeBanner {
  const banner = toHomeBanner(wire);

  if (banner === null) {
    throw new Error(
      'A banner from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a banner missing here may still be on every resident’s home screen.',
    );
  }

  return banner;
}

function readLink(wire: unknown): QuickLink {
  const link = toQuickLink(wire);

  if (link === null) {
    throw new Error(
      'A link from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a link missing here is still on every resident’s home screen.',
    );
  }

  return link;
}

/* ── the app's settings (`DL-170`) ───────────────────────────────────────── */

/**
 * The residents' app's settings: read where every app reads them (`GET app/config`, public), changed
 * through `PATCH admin/app/config` (`app-config.manage`) with only what changed.
 */
@Injectable()
export class HttpAppConfigRepository implements AppConfigRepository {
  private readonly api = inject(ApiClient);

  read(): Observable<AppConfig> {
    return this.api.item(API_ENDPOINTS.appConfig).pipe(map(readAppConfig));
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    return this.api
      .patch(API_ENDPOINTS.adminAppConfig, toWireAppConfigChanges(changes))
      .pipe(map(readAppConfig));
  }
}

function readAppConfig(wire: unknown): AppConfig {
  const config = toAppConfig(wire);

  if (config === null) {
    throw new Error(
      'The app’s settings from the server could not be read, so none are shown rather than some: a ' +
        'setting shown as not set would be saved as not set by the next change.',
    );
  }

  return config;
}

/**
 * Residents' digital IDs (`DL-171`). A check is `digital-id.verify` — staff and administrators on the
 * server; the rest is `digital-id.manage`, administrators alone.
 *
 * **Nothing about a check is kept here.** The code goes in the body of one request and the answer is
 * returned to the screen that asked; no field, cache or log in this adapter holds either.
 */
@Injectable()
export class HttpDigitalIdRepository implements DigitalIdRepository {
  private readonly api = inject(ApiClient);

  check(payload: string): Observable<DigitalIdHolder> {
    return this.api
      .post(API_ENDPOINTS.digitalIdVerify, toWireDigitalIdVerify(payload))
      .pipe(map(readHolder));
  }

  /** A `404` is "no current card" — the API's answer for none and for one only revoked. */
  cardOf(account: AppAccountId): Observable<DigitalIdCard | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.adminUsers}/${account}/digital-id`)
      .pipe(map((wire) => (wire === null ? null : readCard(wire))));
  }

  /** No photo is named, so the API uses the resident's latest approved verification selfie. */
  issue(account: AppAccountId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminUsers}/${account}/digital-id`, {})
      .pipe(map(readCard));
  }

  suspend(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminDigitalIds}/${card}/suspend`, {})
      .pipe(map(readCard));
  }

  revoke(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api.post(`${API_ENDPOINTS.adminDigitalIds}/${card}/revoke`, {}).pipe(map(readCard));
  }

  reissue(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminDigitalIds}/${card}/reissue`, {})
      .pipe(map(readCard));
  }

  openPhoto(photo: MediaId): Observable<Blob> {
    return this.api.blob(`${API_ENDPOINTS.media}/${photo}/content`);
  }
}

function readCard(wire: unknown): DigitalIdCard {
  const card = toDigitalIdCard(wire);

  if (card === null) {
    throw new Error(
      'The card from the server could not be read, so it is not shown: a card with a guessed status ' +
        'or expiry is one somebody acts on wrongly.',
    );
  }

  return card;
}

function readHolder(wire: unknown): DigitalIdHolder {
  const holder = toDigitalIdHolder(wire);

  if (holder === null) {
    throw new Error(
      'The answer about this card could not be read, so nothing is shown rather than part of it.',
    );
  }

  return holder;
}

/**
 * Balita (`news.write`, `DL-171`). The list is the residents' own — `GET news`, published only —
 * because the API has no other; a draft is read by its address, which answers one to its office's
 * staff and to administrators. Writes are forms, because the cover travels with the words.
 */
@Injectable()
export class HttpBalitaRepository implements BalitaRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an article the mapper cannot read refuses the page. */
  list(page: CursorRequest): Observable<CursorPage<BalitaArticle>> {
    return this.api
      .cursorPage(API_ENDPOINTS.news, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readArticle) })));
  }

  /** A `404` — no such article, or a draft the reader may not see — is `null`. */
  get(id: BalitaArticleId): Observable<BalitaArticle | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.news}/${encodeURIComponent(id)}`)
      .pipe(map((wire) => (wire === null ? null : readArticle(wire))));
  }

  categories(): Observable<readonly BalitaCategory[]> {
    return this.api.list(API_ENDPOINTS.newsCategories).pipe(
      map((items) =>
        items.map(toBalitaCategory).filter((item): item is BalitaCategory => item !== null),
      ),
    );
  }

  create(draft: BalitaDraft, cover: Blob | null): Observable<BalitaArticle> {
    return this.api
      .postForm(API_ENDPOINTS.news, toWireNewsWrite(draft, cover))
      .pipe(map(readArticle));
  }

  update(id: BalitaArticleId, changes: BalitaChanges, cover: Blob | null): Observable<BalitaArticle> {
    return this.api
      .patchForm(`${API_ENDPOINTS.news}/${id}`, toWireNewsPatch(changes, cover))
      .pipe(map(readArticle));
  }

  pin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.api.post(`${API_ENDPOINTS.news}/${id}/pin`, {}).pipe(map(readArticle));
  }

  unpin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.api.delete(`${API_ENDPOINTS.news}/${id}/pin`).pipe(map(readArticle));
  }

  openCover(id: BalitaArticleId): Observable<Blob> {
    return this.api.blob(`${API_ENDPOINTS.news}/${id}/cover`);
  }
}

function readArticle(wire: unknown): BalitaArticle {
  const article = toBalitaArticle(wire);

  if (article === null) {
    throw new Error(
      'An article from the server could not be read, so none is shown rather than some: an ' +
        'article left out of this list is one nobody here knows residents are reading.',
    );
  }

  return article;
}

/**
 * The API's audit trail (`audit.view`, `DL-171`) — administrators alone on the server. Read-only:
 * this adapter has no write, because the trail has none.
 */
@Injectable()
export class HttpPlatformAuditRepository implements PlatformAuditRepository {
  private readonly api = inject(ApiClient);

  /**
   * One page, read whole or not at all: a row the mapper cannot read refuses the page. A trail with a
   * row quietly missing is one that cannot be trusted about any row.
   */
  list(page: CursorRequest): Observable<CursorPage<PlatformAuditEntry>> {
    return this.api
      .cursorPage(API_ENDPOINTS.adminAudit, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readAuditEntry) })));
  }
}

function readAuditEntry(wire: unknown): PlatformAuditEntry {
  const entry = toPlatformAuditEntry(wire);

  if (entry === null) {
    throw new Error(
      'A row of the audit trail could not be read, so the page is not shown rather than shown ' +
        'without it: a trail with a row missing cannot be trusted about the others.',
    );
  }

  return entry;
}

/* ── the office's resident registry (`DL-174`) ───────────────────────────── */

/**
 * The registry, served by the Node API since casework phase 1b: people the MSWDO serves, recorded
 * by staff — not app accounts.
 *
 * **Redaction is the server's.** Every answer arrives already redacted for the signed-in account
 * (`DL-38`); the mapper says what the server said and applies no rule of its own. A screen here
 * cannot leak a field the server never sent.
 *
 * **Barangays are joined by name.** The API keys a barangay by its own id and these screens by
 * `TAYTAY_BARANGAYS`; `GET barangays` is read once per adapter to join the two, and a failed read is
 * not kept, so the next call asks again.
 *
 * `getProfile` reads the resident **with** their household and assistance history: the record,
 * the household register, and the history the server assembles once (`DL-187`).
 */
@Injectable()
export class HttpResidentRepository implements ResidentRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: ResidentFilter, page: CursorRequest): Observable<CursorPage<ResidentView>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(() => new Error('Type at least two letters of a name to search the registry.'));
    }
    if (filter.householdId !== undefined) {
      return throwError(
        () =>
          new Error(
            'The registry list cannot be filtered by household. Open the household record to ' +
              'see who lives there.',
          ),
      );
    }
    return this.barangays().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeResidents, page, {
            q: search === '' ? undefined : search,
            barangay_id: barangayId,
            sector: filter.sector,
            age_group: filter.ageGroup,
            include_inactive: filter.includeInactive === true ? 'true' : undefined,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) => readResidentView(wire, barangays)),
            })),
          );
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getById(id: ResidentId): Observable<ResidentView | null> {
    return this.barangays().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeResidents}/${id}`)
          .pipe(map((wire) => (wire === null ? null : readResidentView(wire, barangays)))),
      ),
    );
  }

  /**
   * The resident and the household they live in, read from the API's two registers: the record,
   * then `office/households?resident_id=` (a person is in one household at most) and that
   * household. `null` for "not found **or** not yours", as `getById` answers.
   *
   * The assistance history is read from `office/residents/{id}/assistance-history`, the server's
   * one assembly (`DL-187`). A reader without the beneficiary registry is answered with a sentence,
   * kept as `unavailable` — never an empty history, which would say the office never helped this
   * person (`DL-112`).
   */
  getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    return this.barangays().pipe(
      switchMap((barangays) =>
        this.api.optionalItem(`${API_ENDPOINTS.officeResidents}/${id}`).pipe(
          switchMap((wire) => {
            if (wire === null) {
              return of(null);
            }
            const view = readResidentView(wire, barangays);
            return forkJoin([this.householdOf(id, barangays), this.historyOf(id)]).pipe(
              map(
                ([detail, history]): ResidentProfile => ({
                  view:
                    detail === null
                      ? view
                      : { ...view, resident: { ...view.resident, householdId: detail.household.id } },
                  household: detail === null ? null : detail.household,
                  householdMembers: {
                    kind: 'read',
                    // Everyone else under the roof, head first — the server's order.
                    members:
                      detail === null
                        ? []
                        : detail.members.filter((member) => member.view.resident.id !== id),
                  },
                  history,
                }),
              ),
            );
          }),
        ),
      ),
    );
  }

  /** The person's assistance history, or the server's sentence for a reader not shown it. */
  private historyOf(id: ResidentId): Observable<AssistanceHistoryReading> {
    return this.api
      .item(`${API_ENDPOINTS.officeResidents}/${id}/assistance-history`)
      .pipe(map((wire) => readHistoryReading(wire)));
  }

  /** The one household this person is in, or `null` when the register places them in none. */
  private householdOf(id: ResidentId, barangays: BarangayIndex): Observable<HouseholdDetail | null> {
    return this.api
      .cursorPage(API_ENDPOINTS.officeHouseholds, { limit: 1, cursor: null }, { resident_id: id })
      .pipe(
        switchMap((answer) => {
          const [row] = answer.items.map((wire) => readHouseholdSummary(wire, barangays));
          if (row === undefined) {
            return of(null);
          }
          return this.api
            .optionalItem(`${API_ENDPOINTS.officeHouseholds}/${row.household.id}`)
            .pipe(map((wire) => (wire === null ? null : readHouseholdDetail(wire, barangays))));
        }),
      );
  }

  create(draft: ResidentDraft): Observable<Resident> {
    return this.write(draft, (barangayId) =>
      this.api.post(API_ENDPOINTS.officeResidents, toWireResidentDraft(draft, barangayId)),
    );
  }

  update(id: ResidentId, draft: ResidentDraft): Observable<Resident> {
    return this.write(draft, (barangayId) =>
      this.api.patch(`${API_ENDPOINTS.officeResidents}/${id}`, toWireResidentDraft(draft, barangayId)),
    );
  }

  /** Retiring and restoring are two routes, each with the reason the server keeps. */
  setActive(id: ResidentId, isActive: boolean, reason: string): Observable<Resident> {
    const saved = isActive
      ? this.api.post(`${API_ENDPOINTS.officeResidents}/${id}/reactivate`, toWireReason(reason))
      : this.api.post(`${API_ENDPOINTS.officeResidents}/${id}/deactivate`, toWireReason(reason));
    return this.barangays().pipe(
      switchMap((barangays) => saved.pipe(map((wire) => readResident(wire, barangays)))),
    );
  }

  recordSector(id: ResidentId, sector: VulnerabilitySector, reason: string): Observable<void> {
    return this.api
      .post(`${API_ENDPOINTS.officeResidents}/${id}/sectors`, toWireSectorRecord(sector, reason))
      .pipe(map((): void => undefined));
  }

  endSector(id: ResidentId, sector: VulnerabilitySector, reason: string): Observable<void> {
    return this.api
      .post(`${API_ENDPOINTS.officeResidents}/${id}/sectors/${sector}/end`, toWireReason(reason))
      .pipe(map((): void => undefined));
  }

  /**
   * The same rules as the form and the mock, before anything is sent, so a person is told what is
   * wrong beside the field rather than by a round trip. The server validates on its own.
   */
  private write(
    draft: ResidentDraft,
    send: (barangayId: string) => Observable<unknown>,
  ): Observable<Resident> {
    const problems = validateResidentDraft(draft);
    if (problems.length > 0) {
      return throwError(() => new ResidentDraftInvalidError(problems));
    }
    return this.barangays().pipe(
      switchMap((barangays) => {
        const barangayId = barangays.toApi(draft.address.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return send(barangayId).pipe(map((wire) => readResident(wire, barangays)));
      }),
    );
  }

  private barangays(): Observable<BarangayIndex> {
    return this.barangayJoin.read();
  }
}

/**
 * `GET barangays`, joined to `TAYTAY_BARANGAYS` by name — one join for the resident and household
 * adapters, so a barangay reads the same on both.
 *
 * Whole or not at all, and read once per adapter: a barangay missing from the join is one whose
 * records the console could not place, and it refuses them rather than guessing. A failed read is
 * not kept, so the next call asks again. Created in an adapter's field initialiser, where `inject`
 * is allowed.
 */
class BarangayJoin {
  private readonly api = inject(ApiClient);
  private index$: Observable<BarangayIndex> | null = null;

  read(): Observable<BarangayIndex> {
    this.index$ ??= this.api.list(API_ENDPOINTS.barangays).pipe(
      map((rows) => toBarangayIndex(rows)),
      catchError((error: unknown) => {
        this.index$ = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.index$;
  }
}

function unknownBarangay(): Error {
  return new Error(
    'That barangay is not one the API knows by the same name, so nothing was sent. The barangay ' +
      'list on the server and this console\'s list need to agree first.',
  );
}

function readResidentView(wire: unknown, barangays: BarangayIndex): ResidentView {
  const view = toResidentView(wire, barangays);

  if (view === null) {
    throw new Error(
      'A resident from the server could not be read, so none is shown rather than some: a person ' +
        'left out of the registry is one an officer concludes was never registered.',
    );
  }

  return view;
}

function readResident(wire: unknown, barangays: BarangayIndex): Resident {
  const resident = toResident(wire, barangays);

  if (resident === null) {
    throw new Error(
      'The server saved the record, but its answer could not be read. Open the registry again ' +
        'to see it before saving anything twice.',
    );
  }

  return resident;
}

/* ── the office's household register (casework phase 1c) ─────────────────── */

/**
 * The household register, served by the Node API since casework phase 1c: an address and who lives
 * there, recorded by staff. Not the residents' app households, which are a different table.
 *
 * **Redaction is the server's**, the vulnerability snapshot included: it is computed there from the
 * unredacted members and disclosed for the reader, so every role reads the same band (`DL-44`).
 * The mapper says what the server said.
 *
 * **A refused composition is the domain's error.** The API's 409 names each problem by the
 * console's own codes; `toHouseholdRefusal` turns them into the `HouseholdCompositionError` the
 * screens already word, and a conflict it has no words for into the server's own sentence.
 */
@Injectable()
export class HttpHouseholdRepository implements HouseholdRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: HouseholdFilter, page: CursorRequest): Observable<CursorPage<HouseholdSummary>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(
        () =>
          new Error(
            'Type at least two characters of a household number, a surname or a street to search.',
          ),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeHouseholds, page, {
            q: search === '' ? undefined : search,
            barangay_id: barangayId,
            indigent: filter.indigentOnly === true ? 'true' : undefined,
            minimum_band: filter.minimumBand,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) => readHouseholdSummary(wire, barangays)),
            })),
          );
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getById(id: HouseholdId): Observable<HouseholdDetail | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeHouseholds}/${id}`)
          .pipe(map((wire) => (wire === null ? null : readHouseholdDetail(wire, barangays)))),
      ),
    );
  }

  create(draft: HouseholdDraft): Observable<HouseholdDetail> {
    if (draft.streetAddress.trim().length === 0) {
      return throwError(() => new Error('A household needs a street address.'));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId = barangays.toApi(draft.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.answer(
          this.api.post(API_ENDPOINTS.officeHouseholds, toWireHouseholdDraft(draft, barangayId)),
          barangays,
        );
      }),
    );
  }

  changeMembership(
    id: HouseholdId,
    changes: readonly MembershipChange[],
    reason: string,
  ): Observable<HouseholdDetail> {
    // Nothing to change is not a request: the API refuses an empty list, the mock answers the record.
    if (changes.length === 0) {
      return this.getById(id).pipe(
        switchMap((detail) => (detail === null ? throwError(() => householdGone()) : of(detail))),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.answer(
          this.api.post(
            `${API_ENDPOINTS.officeHouseholds}/${id}/membership`,
            toWireMembership(changes, reason),
          ),
          barangays,
        ),
      ),
    );
  }

  correctFactor(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    state: FactorState,
    reason: string,
  ): Observable<HouseholdDetail> {
    // `withheld` is a reading, never a recorded state; the API would refuse it as invalid.
    if (state === 'withheld') {
      return throwError(
        () => new Error('An indicator can be corrected to present, absent or unknown.'),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.answer(
          this.api.post(
            `${API_ENDPOINTS.officeHouseholds}/${id}/corrections`,
            toWireCorrection(code, state, reason),
          ),
          barangays,
        ),
      ),
    );
  }

  clearCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    reason: string,
  ): Observable<HouseholdDetail> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.answer(
          this.api.post(
            `${API_ENDPOINTS.officeHouseholds}/${id}/corrections/${code}/withdraw`,
            toWireReason(reason),
          ),
          barangays,
        ),
      ),
    );
  }

  /** A write's answer is the household as it now stands — or the refusal, in the domain's terms. */
  private answer(sent: Observable<unknown>, barangays: BarangayIndex): Observable<HouseholdDetail> {
    return sent.pipe(
      catchError((failure: unknown) => throwError(() => toHouseholdRefusal(failure) ?? failure)),
      map((wire) => readWrittenHousehold(wire, barangays)),
    );
  }
}

function householdGone(): Error {
  return new Error('That household was not found. It may be outside the area you cover.');
}

function readHouseholdSummary(wire: unknown, barangays: BarangayIndex): HouseholdSummary {
  const summary = toHouseholdSummary(wire, barangays);
  if (summary === null) {
    throw new Error(
      'A household from the server could not be read, so none is shown rather than some: a ' +
        'household left out of the register is one an officer concludes was never recorded.',
    );
  }
  return summary;
}

function readHouseholdDetail(wire: unknown, barangays: BarangayIndex): HouseholdDetail {
  const detail = toHouseholdDetail(wire, barangays);
  if (detail === null) {
    throw new Error(
      'The household record could not be read, so none of it is shown: a member, an indicator or ' +
        'a line of its history left out would read as not being there.',
    );
  }
  return detail;
}

function readWrittenHousehold(wire: unknown, barangays: BarangayIndex): HouseholdDetail {
  const detail = toHouseholdDetail(wire, barangays);
  if (detail === null) {
    throw new Error(
      'The server saved the change, but its answer could not be read. Open the household again ' +
        'to see it before changing anything twice.',
    );
  }
  return detail;
}

/* ── families and relationships (casework phase 1c) ──────────────────────── */

/**
 * Families and the relationships between people, served by the Node API since casework phase 1c:
 * who belongs to whom, which is not who lives where (`DL-47`). Every change is an act with a reason,
 * appended and never rewritten (`DL-48`).
 *
 * **Redaction is the server's.** Members arrive disclosed for the reader — a protected member
 * masked and, beside one, everyone's own street withheld — and the mapper says what the server said.
 *
 * **The graph is drawn as the mock draws it.** `toFamilyDetail` assembles it with the domain's own
 * `assignGenerations` and `fromPerspectiveOf`, so the family record reads the same over either
 * adapter.
 *
 * **A refusal is the domain's error.** The API's 409 names each problem by the console's own codes;
 * `toFamilyRefusal` reads them as the `TransferRefusedError`, `RelationshipInvalidError` or
 * `FamilyDraftInvalidError` the screens already word, and a conflict outside that vocabulary as the
 * server's own sentence.
 *
 * **Recording a relationship already on file is not a failure** (`DL-51`): the API answers 201 for
 * a new one and 200 with the one already standing, and both are the relationship asked for.
 */
@Injectable()
export class HttpFamilyRepository implements FamilyRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: FamilyFilter, page: CursorRequest): Observable<CursorPage<FamilySummary>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(
        () => new Error('Type at least two characters of a family number, a name or a surname.'),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeFamilies, page, {
            q: search === '' ? undefined : search,
            barangay_id: barangayId,
            household_id: filter.householdId,
            unhoused: filter.unhousedOnly === true ? 'true' : undefined,
            include_dissolved: filter.includeDissolved === true ? 'true' : undefined,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) => readFamilySummary(wire, barangays)),
            })),
          );
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getById(id: FamilyId): Observable<FamilyDetail | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeFamilies}/${id}`)
          .pipe(map((wire) => (wire === null ? null : readFamilyDetail(wire, barangays)))),
      ),
    );
  }

  create(draft: FamilyDraft, reason: string): Observable<FamilyDetail> {
    // The same rules as the form and the mock, before anything is sent.
    const problems = validateFamilyDraft(draft, reason);
    if (problems.length > 0) {
      return throwError(() => new FamilyDraftInvalidError(problems));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.refused(
          this.api.post(API_ENDPOINTS.officeFamilies, toWireFamilyDraft(draft, reason)),
          'family',
        ).pipe(map((wire) => readWrittenFamily(wire, barangays))),
      ),
    );
  }

  /** Whole: a person belongs to a handful of families at most, and the API sends them all. */
  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .list(`${API_ENDPOINTS.officeResidents}/${residentId}/families`)
          .pipe(map((rows) => rows.map((wire) => readFamilySummary(wire, barangays)))),
      ),
    );
  }

  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
  ): Observable<Relationship> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why this relationship is being recorded.'));
    }
    // The API refuses this as invalid input; the domain names it, as the mock does.
    if (fromResidentId === toResidentId) {
      return throwError(
        () => new RelationshipInvalidError([{ code: 'same-person', residentId: fromResidentId }]),
      );
    }
    return this.refused(
      this.api.post(
        `${API_ENDPOINTS.officeResidents}/${fromResidentId}/relationships`,
        toWireRelationship(toResidentId, kind, reason),
      ),
      'relationship',
    ).pipe(map(readRelationship));
  }

  endRelationship(
    residentId: ResidentId,
    id: RelationshipId,
    reason: string,
  ): Observable<Relationship> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why this relationship has ended.'));
    }
    return this.refused(
      this.api.post(
        `${API_ENDPOINTS.officeResidents}/${residentId}/relationships/${id}/end`,
        toWireReason(reason),
      ),
      'relationship',
    ).pipe(map(readRelationship));
  }

  transferResident(transfer: ResidentTransfer): Observable<FamilyDetail> {
    if (!isValidTransferReason(transfer.reason)) {
      return throwError(
        () => new TransferRefusedError([{ code: 'no-reason', residentId: transfer.residentId }]),
      );
    }
    // A move from nowhere to nowhere describes no change; the API refuses it as invalid.
    if (transfer.fromFamilyId === null && transfer.toFamilyId === null) {
      return throwError(
        () =>
          new TransferRefusedError([{ code: 'family-not-found', residentId: transfer.residentId }]),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.refused(
          this.api.post(`${API_ENDPOINTS.officeFamilies}/transfers`, toWireTransfer(transfer)),
          'transfer',
        ).pipe(map((wire) => readWrittenFamily(wire, barangays))),
      ),
    );
  }

  /** The API answers the family as it now stands; the port asks for the family itself. */
  changeMemberRole(
    familyId: FamilyId,
    residentId: ResidentId,
    role: FamilyRole,
    reason: string,
  ): Observable<Family> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the role is changing.'));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.refused(
          this.api.post(
            `${API_ENDPOINTS.officeFamilies}/${familyId}/members/${residentId}/role`,
            toWireRoleChange(role, reason),
          ),
          'transfer',
        ).pipe(map((wire) => readWrittenFamily(wire, barangays).family)),
      ),
    );
  }

  /** Whole and newest first, as the API keeps it. */
  historyForResident(residentId: ResidentId): Observable<readonly RelationshipEvent[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeResidents}/${residentId}/relationship-history`)
      .pipe(map((rows) => rows.map(readRelationshipEvent)));
  }

  /** A refused write, read in the domain's terms; anything else passed on untouched. */
  private refused(sent: Observable<unknown>, kind: FamilyRefusalKind): Observable<unknown> {
    return sent.pipe(
      catchError((failure: unknown) => throwError(() => toFamilyRefusal(failure, kind) ?? failure)),
    );
  }
}

function readFamilySummary(wire: unknown, barangays: BarangayIndex): FamilySummary {
  const summary = toFamilySummary(wire, barangays);
  if (summary === null) {
    throw new Error(
      'A family from the server could not be read, so none is shown rather than some: a family ' +
        'left out of the registry is one an officer concludes was never recorded.',
    );
  }
  return summary;
}

function readFamilyDetail(wire: unknown, barangays: BarangayIndex): FamilyDetail {
  const detail = toFamilyDetail(wire, barangays);
  if (detail === null) {
    throw new Error(
      'The family record could not be read, so none of it is shown: a member, a relationship or ' +
        'a line of its history left out would read as not being there.',
    );
  }
  return detail;
}

function readWrittenFamily(wire: unknown, barangays: BarangayIndex): FamilyDetail {
  const detail = toFamilyDetail(wire, barangays);
  if (detail === null) {
    throw new Error(
      'The server saved the change, but its answer could not be read. Open the family again to ' +
        'see it before changing anything twice.',
    );
  }
  return detail;
}

function readRelationship(wire: unknown): Relationship {
  const relationship = toRelationship(wire);
  if (relationship === null) {
    throw new Error(
      'The server saved the relationship, but its answer could not be read. Open the family again ' +
        'to see it before recording anything twice.',
    );
  }
  return relationship;
}

function readRelationshipEvent(wire: unknown): RelationshipEvent {
  const event = toRelationshipEvent(wire);
  if (event === null) {
    throw new Error(
      'A line of this person’s family history could not be read, so none of it is shown: a ' +
        'history with a gap reads as one where nothing happened.',
    );
  }
  return event;
}

/* ── saved views (casework phase 1c, `DL-111`) ───────────────────────────── */

/**
 * Saved views, kept by the API: a name over a list's query parameters, an account's own or the
 * office's. The server decides whose a view is, who may share one and how many each list keeps; a
 * list of them is answered whole, never paged, because those caps bound it.
 */
@Injectable()
export class HttpSavedViewRepository implements SavedViewRepository {
  private readonly api = inject(ApiClient);

  listFor(resource: SavedViewResource): Observable<readonly SavedView[]> {
    return this.api
      .list(API_ENDPOINTS.officeSavedViews, { resource })
      .pipe(map((rows) => rows.map(readSavedView)));
  }

  create(draft: SavedViewDraft): Observable<SavedView> {
    // The same rule as the mock and the bar, before anything is sent.
    if (!isValidSavedViewName(draft.name)) {
      return throwError(
        () =>
          new Error(`A saved view needs a name of 1 to ${SAVED_VIEW_NAME_MAX_LENGTH} characters.`),
      );
    }
    return this.api
      .post(API_ENDPOINTS.officeSavedViews, toWireSavedViewDraft(draft))
      .pipe(map(readSavedView));
  }

  remove(id: SavedViewId): Observable<void> {
    return this.api
      .delete(`${API_ENDPOINTS.officeSavedViews}/${id}`)
      .pipe(map((): void => undefined));
  }
}

function readSavedView(wire: unknown): SavedView {
  const view = toSavedView(wire);
  if (view === null) {
    throw new Error(
      'A saved view from the server could not be read, so none is shown: whose a view is decides ' +
        'whether it may be taken away, and this one could not say.',
    );
  }
  return view;
}

/**
 * The programme catalogue over the API (casework phase 1d, `DL-176`).
 *
 * The office's policy, held as records. Nothing here discloses or withholds anything — the
 * catalogue holds no personal data — and nothing here decides anything: the server refuses a record
 * that would misdescribe the office (`DL-65`) with the console's own rule names, and this adapter
 * neither repeats nor second-guesses that refusal.
 *
 * Utilization is counted by the server from releases handed over (`DL-187`). A reader who does not
 * read payouts is answered with a sentence, kept as `unavailable` — never a zero, which would say
 * the programme delivered nothing (`DL-105`, `DL-112`).
 */
@Injectable()
export class HttpProgramRepository implements ProgramRepository {
  private readonly api = inject(ApiClient);

  list(filter: ProgramFilter, page: CursorRequest): Observable<CursorPage<AssistanceProgram>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(() => new Error('Type at least two letters to search the programmes.'));
    }
    return this.api
      .cursorPage(API_ENDPOINTS.officePrograms, page, {
        q: search === '' ? undefined : search,
        category: filter.category,
        status: filter.status,
      })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readProgram) })));
  }

  getById(id: ProgramId): Observable<AssistanceProgram | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officePrograms}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readProgram(wire))));
  }

  /** Read in full: a picker missing a programme tells an intake officer the office does not run it (`DL-161`). */
  listActive(): Observable<readonly AssistanceProgram[]> {
    return this.api
      .everyPage(API_ENDPOINTS.officePrograms, { status: 'active' })
      .pipe(map((rows) => rows.map(readProgram)));
  }

  listRequirementTemplates(id: ProgramId): Observable<readonly RequirementTemplate[]> {
    return this.api
      .list(`${API_ENDPOINTS.officePrograms}/${id}/requirement-templates`)
      .pipe(map((rows) => rows.map(readRequirementTemplate)));
  }

  /**
   * The whole draft every time, with the reason: the server checks its rules against exactly what
   * the form showed, and keeps the reason beside the version (`DL-177`).
   */
  save(draft: ProgramDraft, id: ProgramId | null, reason: string): Observable<AssistanceProgram> {
    const saved =
      id === null
        ? this.api.post(API_ENDPOINTS.officePrograms, toWireProgramDraft(draft, reason))
        : this.api.patch(
            `${API_ENDPOINTS.officePrograms}/${id}`,
            toWireProgramDraft(draft, reason),
          );
    return saved.pipe(map(readProgram));
  }

  /** Whole: the office keeps at most two hundred, so the answer is never a first page. */
  listTemplates(): Observable<readonly RequirementTemplate[]> {
    return this.api
      .list(API_ENDPOINTS.officeRequirementTemplates)
      .pipe(map((rows) => rows.map(readRequirementTemplate)));
  }

  /** A change sends the documents whole, because the server replaces them whole. */
  saveTemplate(
    draft: RequirementTemplateDraft,
    code: string | null,
    reason: string,
  ): Observable<RequirementTemplate> {
    const saved =
      code === null
        ? this.api.post(
            API_ENDPOINTS.officeRequirementTemplates,
            toWireRequirementTemplate(draft, reason),
          )
        : this.api.patch(
            `${API_ENDPOINTS.officeRequirementTemplates}/${encodeURIComponent(code)}`,
            toWireRequirementTemplatePatch(draft, reason),
          );
    return saved.pipe(map(readRequirementTemplate));
  }

  retireTemplate(code: string, reason: string): Observable<RequirementTemplate> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeRequirementTemplates}/${encodeURIComponent(code)}/retire`,
        toWireReason(reason),
      )
      .pipe(map(readRequirementTemplate));
  }

  utilizationFor(id: ProgramId): Observable<ProgramUtilizationReading> {
    return this.api
      .item(`${API_ENDPOINTS.officeProgramUtilization}/${id}`)
      .pipe(map((wire) => readOrRefuse(toProgramUtilizationReading(wire), UTILIZATION_UNREADABLE)));
  }

  utilizationSummary(): Observable<ProgramUtilizationSummary> {
    return this.api
      .item(API_ENDPOINTS.officeProgramUtilization)
      .pipe(map((wire) => readOrRefuse(toProgramUtilizationSummary(wire), UTILIZATION_UNREADABLE)));
  }
}

const UTILIZATION_UNREADABLE =
  'How much the programmes have been used could not be read, so no figure is shown rather than ' +
  'some: a programme missing from the figures would read as one nobody used.';

/** The mapped answer, or an error in words: never a partial figure standing in for the whole. */
function readOrRefuse<T>(value: T | null, because: string): T {
  if (value === null) {
    throw new Error(because);
  }
  return value;
}

function readHistoryReading(wire: unknown): AssistanceHistoryReading {
  return readOrRefuse(
    toAssistanceHistoryReading(wire),
    'This person’s assistance history could not be read, so none of it is shown: a request or a ' +
      'payout left out would read as one the office never made.',
  );
}

function readProgram(wire: unknown): AssistanceProgram {
  const program = toAssistanceProgram(wire);
  if (program === null) {
    throw new Error(
      'A programme from the server could not be read, so none is shown: whose programme it is ' +
        'decides what an applicant is told, and this one could not say.',
    );
  }
  return program;
}

function readRequirementTemplate(wire: unknown): RequirementTemplate {
  const template = toRequirementTemplate(wire);
  if (template === null) {
    throw new Error(
      'A programme’s document set from the server could not be read, so none is shown: a list ' +
        'missing a document would ask an applicant for less than the office does.',
    );
  }
  return template;
}

/* ── assistance requests (casework phase 2a) ─────────────────────────────── */

/**
 * Assistance requests over the API (casework phase 2a, `DL-177`, and 2b, `DL-178`): intake, filing,
 * the lifecycle, notes, assignment for assessment, the assessment, the document review, the files
 * presented and what the applicant was asked to bring.
 *
 * **Redaction is the server's.** A request whose person is under a protected sector arrives with its
 * words withheld from a reader without `request.view-sensitive`, and `withheld` saying which; the
 * mapper says what the server said (`DL-38`). The server also refuses a save over such a draft, and
 * the intake screen says so before offering a form.
 *
 * **The lifecycle is the server's**, held in the console's own transition table there and compared
 * by its tests. Every move needs a reason, refused here in words before anything is sent; a move to
 * `scheduled` or `released` is refused there with a sentence, because payouts are phase 4.
 *
 * **Barangays are joined by name**, as the registry's are (`DL-174`).
 *
 * **A caseload is served** (`DL-178`). A social worker reads and works the filed requests assigned
 * to them; the server answers anything else as not found, and refuses them the office-wide reads —
 * drafts, filing, the duplicate check, the list of social workers — with a sentence.
 *
 * **Opening a file is two acts.** A grant with the server's warning, then — only after the reader
 * confirms — the bytes for that grant, through `ApiClient.postBlob` with the handle in a body.
 */
@Injectable()
export class HttpAssistanceRequestRepository implements AssistanceRequestRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: AssistanceRequestFilter, page: CursorRequest): Observable<CursorPage<AssistanceRequest>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(
        () => new Error('Type at least two characters of a control number to search the requests.'),
      );
    }
    return this.barangays().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeAssistanceRequests, page, {
            q: search === '' ? undefined : search,
            status: filter.status,
            program_id: filter.programId,
            barangay_id: barangayId,
            // The requests about one person — what a case may name (`DL-179`).
            resident_id: filter.residentId,
            // A caseload always reads its own assignments, whatever is sent here (`DL-178`).
            assigned_to: filter.assignedTo,
            open_only: filter.openOnly === true ? 'true' : undefined,
            // The dashboard's own narrowings, counted by the server with the same SQL (`DL-186`).
            category: filter.category,
            owing_document: filter.owingDocument === true ? 'true' : undefined,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) => readAssistanceRequest(wire, barangays)),
            })),
          );
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null> {
    return this.barangays().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeAssistanceRequests}/${id}`)
          .pipe(map((wire) => (wire === null ? null : readAssistanceRequest(wire, barangays)))),
      ),
    );
  }

  /** Whole, newest first, a withheld body `null` and the entry still listed (`DL-58`). */
  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeAssistanceRequests}/${id}/notes`)
      .pipe(map((rows) => rows.map(readRequestNote)));
  }

  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest> {
    const words = reason?.trim() ?? '';
    if (words === '') {
      return throwError(() => new Error(STATUS_MOVE_NEEDS_REASON));
    }
    // Approving says what was approved (DL-183); the API refuses a bare move to it.
    if (to === 'approved') {
      return throwError(() => new Error(APPROVAL_IS_ITS_OWN_ACT));
    }
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/status`,
        toWireStatusMove(to, words),
      ),
    );
  }

  /**
   * The move to `approved` with what was approved (DL-183), refused in words before anything is
   * sent when it says neither an amount nor the goods. A cancel or expiry the API refuses under an
   * open release is said in the API's words by the HTTP layer.
   */
  approve(
    id: AssistanceRequestId,
    approval: RequestApproval,
    reason: string,
  ): Observable<AssistanceRequest> {
    const words = reason.trim();
    if (words === '') {
      return throwError(() => new Error(STATUS_MOVE_NEEDS_REASON));
    }
    if (approvalProblem(approval) !== null) {
      return throwError(() => new Error(APPROVAL_NEEDS_WHAT));
    }
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/status`,
        toWireApproval(approval, words),
      ),
    );
  }

  /** Before a request exists: the person, and the programme once one is chosen (`DL-60`). */
  advisoryFor(residentId: ResidentId, programId: ProgramId | null): Observable<IntakeAdvisory> {
    const read =
      programId === null
        ? this.api.item(`${API_ENDPOINTS.officeAssistanceRequests}/advisory`, {
            resident_id: residentId,
          })
        : this.api.item(`${API_ENDPOINTS.officeAssistanceRequests}/advisory`, {
            resident_id: residentId,
            program_id: programId,
          });
    return read.pipe(map(readAdvisory));
  }

  /** A filed request names its own person and programme, and is not counted against itself. */
  advisoryForCase(id: AssistanceRequestId): Observable<IntakeAdvisory> {
    return this.api
      .item(`${API_ENDPOINTS.officeAssistanceRequests}/${id}/advisory`)
      .pipe(map(readAdvisory));
  }

  /** The whole draft every time: `PATCH` replaces it whole, and the server builds the checklist. */
  saveDraft(draft: IntakeDraft, id: AssistanceRequestId | null): Observable<AssistanceRequest> {
    const residentId = draft.residentId;
    if (residentId === null) {
      return throwError(() => new Error('A draft needs to name the person it is for.'));
    }
    return this.saved(
      id === null
        ? this.api.post(API_ENDPOINTS.officeAssistanceRequests, toWireRequestDraft(draft, residentId))
        : this.api.patch(
            `${API_ENDPOINTS.officeAssistanceRequests}/${id}`,
            toWireRequestDraft(draft, residentId),
          ),
    );
  }

  /** Files the draft and issues its control number; the server reads the duplicate check again. */
  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> {
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/file`,
        toWireRequestFiling(acknowledgement),
      ),
    );
  }

  /* ── phase 2b (DL-178) ─────────────────────────────────────────────────── */

  /** Appended, then the whole list as this reader may see it — the server answers with it. */
  addNote(id: AssistanceRequestId, note: RequestNoteDraft): Observable<readonly RequestNote[]> {
    const body = note.body.trim();
    if (body === '' || body.length > REQUEST_NOTE_MAX_LENGTH) {
      return throwError(
        () =>
          new Error(
            `Write the note — between 1 and ${REQUEST_NOTE_MAX_LENGTH} characters. Nothing was sent.`,
          ),
      );
    }
    return this.api
      .post(`${API_ENDPOINTS.officeAssistanceRequests}/${id}/notes`, toWireNote(note))
      .pipe(map(readNotes));
  }

  /** Whole, as the server answers it. Refused to a caseload by the server, as assigning is. */
  listSocialWorkers(): Observable<readonly SocialWorker[]> {
    return this.api
      .list(API_ENDPOINTS.officeSocialWorkers)
      .pipe(map((rows) => rows.map(readSocialWorker)));
  }

  assignForAssessment(
    id: AssistanceRequestId,
    assigneeId: StaffUserId,
    reason: string,
  ): Observable<AssistanceRequest> {
    const words = reason.trim();
    if (words === '') {
      return throwError(() => new Error(ASSIGNMENT_NEEDS_REASON));
    }
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/assignment`,
        toWireAssignment(assigneeId, words),
      ),
    );
  }

  /** The current version of each published form, whole. A form it cannot read refuses the list. */
  listAssessmentTemplates(): Observable<readonly AssessmentTemplate[]> {
    return this.api
      .list(API_ENDPOINTS.officeAssessmentTemplates)
      .pipe(map((rows) => rows.map(readAssessmentTemplate)));
  }

  /** `201` opened, or `200` the one already open — whichever form it was opened from. */
  openAssessment(id: AssistanceRequestId, templateCode: string): Observable<OpenAssessment> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/assessment`,
        toWireAssessmentOpen(templateCode),
      )
      .pipe(map(readOpenAssessment));
  }

  /** A patch: only the codes sent are written. The server takes between one and sixty. */
  answerAssessment(id: AssistanceRequestId, answers: AssessmentAnswers): Observable<OpenAssessment> {
    if (Object.keys(answers).length === 0) {
      return throwError(() => new Error('Answer a question before saving. Nothing was sent.'));
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/assessment/answers`,
        toWireAssessmentAnswers(answers),
      )
      .pipe(map(readOpenAssessment));
  }

  /**
   * Completes the open assessment with the findings, the recommendation the assessor chose, the
   * recommended amount and whether a home visit was made — all four kept by the server. Completing
   * moves the request nowhere; endorsing is the status move.
   */
  recordAssessment(id: AssistanceRequestId, assessment: AssessmentDraft): Observable<AssistanceRequest> {
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/assessment/complete`,
        toWireAssessment(assessment),
      ),
    );
  }

  /** A person's verdict on one document. `pending` and `submitted` are states, never a verdict. */
  reviewRequirement(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    status: RequirementStatus,
    remarks: string | null,
  ): Observable<AssistanceRequest> {
    const verdict = REVIEW_VERDICTS.find((candidate) => candidate === status);
    if (verdict === undefined) {
      return throwError(
        () =>
          new Error(
            'A review records a verdict — verified, rejected, waived, expired or needs replacement. Nothing was sent.',
          ),
      );
    }
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/requirements/${requirementId}/review`,
        toWireRequirementReview(verdict, remarks),
      ),
    );
  }

  /**
   * Appends a version as a form. The office's rules — a file for a source that holds one and none
   * for one that does not, an expiry after the issue, the type and size the office accepts — are
   * applied before anything is sent; the server applies them again by the bytes.
   *
   * **No upload progress is reported.** `HttpClient` reports upload events only to a request asked
   * to, and `ApiClient` does not ask; an `uploading` figure made up here would be a bar that moves
   * for a reason other than the bytes. So the one emission is `done` (`DL-178`).
   */
  recordDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Observable<DocumentUpload<AssistanceRequest>> {
    // Whether this replaces a version is the server's to know; the reason is checked there.
    const problems = documentVersionProblems(draft, false);
    if (problems.length > 0) {
      return throwError(() => new DocumentVersionInvalidError(problems));
    }
    const refusal = draft.file === null ? null : refusalFor(draft.file);
    if (refusal !== null) {
      return throwError(
        () =>
          new Error(
            refusal.reason === 'too-large'
              ? 'That file is larger than the office accepts. Nothing was sent.'
              : 'The file must be a PDF, a JPEG or a PNG. Nothing was sent.',
          ),
      );
    }
    return this.saved(
      this.api.postForm(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/requirements/${requirementId}/documents`,
        toWireDocumentUpload(draft),
      ),
    ).pipe(map((result): DocumentUpload<AssistanceRequest> => ({ kind: 'done', result })));
  }

  /** A person's ruling on a conditional document, with its reason. `undecided` is not a ruling. */
  decideApplicability(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    applicability: ConditionalApplicability,
    reason: string,
  ): Observable<AssistanceRequest> {
    const words = reason.trim();
    if (applicability === 'undecided' || words === '') {
      return throwError(
        () =>
          new Error(
            'A ruling says whether the document applies, and why. Nothing was sent.',
          ),
      );
    }
    return this.saved(
      this.api.post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/requirements/${requirementId}/applicability`,
        toWireApplicabilityRuling(applicability, words),
      ),
    );
  }

  /** Records what the applicant was told to bring; answers with the whole list. */
  requestDocument(
    id: AssistanceRequestId,
    draft: DocumentRequestDraft,
  ): Observable<readonly DocumentRequest[]> {
    if (documentRequestProblems(draft, todayAsIsoDate()).length > 0) {
      return throwError(
        () =>
          new Error(
            'Say what the applicant was told, and a date that has not passed. Nothing was sent.',
          ),
      );
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/document-requests`,
        toWireDocumentRequest(draft),
      )
      .pipe(map(readDocumentRequests));
  }

  /** Whole: open first, then the most recently asked, the words withheld where the request's are. */
  listDocumentRequests(id: AssistanceRequestId): Observable<readonly DocumentRequest[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeAssistanceRequests}/${id}/document-requests`)
      .pipe(map(readDocumentRequests));
  }

  withdrawDocumentRequest(
    id: AssistanceRequestId,
    documentRequestId: DocumentRequestId,
    reason: string,
  ): Observable<readonly DocumentRequest[]> {
    const words = reason.trim();
    if (words === '') {
      return throwError(
        () => new Error('Withdrawing a request needs a reason. Nothing was sent.'),
      );
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/document-requests/${documentRequestId}/withdraw`,
        toWireDocumentRequestWithdrawal(words),
      )
      .pipe(map(readDocumentRequests));
  }

  /** A grant with the server's warning. Nothing opens until the reader has seen it and confirmed. */
  openDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    versionId: DocumentVersionId,
  ): Observable<DocumentAccessGrant> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceRequests}/${id}/requirements/${requirementId}/documents/${versionId}/access`,
        {},
      )
      .pipe(map(readGrant));
  }

  /** The bytes, for a grant: once, within five minutes, by this account. */
  readDocumentFile(grant: DocumentAccessGrant): Observable<Blob> {
    return this.api.postBlob(API_ENDPOINTS.officeDocumentFiles, toWireDocumentFileRequest(grant));
  }

  /** A write's answer, read with the barangay join — read first, so a failed join sends nothing. */
  private saved(call: Observable<unknown>): Observable<AssistanceRequest> {
    return this.barangays().pipe(
      switchMap((barangays) => call.pipe(map((wire) => readSavedRequest(wire, barangays)))),
    );
  }

  private barangays(): Observable<BarangayIndex> {
    return this.barangayJoin.read();
  }
}

function readAssistanceRequest(wire: unknown, barangays: BarangayIndex): AssistanceRequest {
  const request = toAssistanceRequest(wire, barangays);
  if (request === null) {
    throw new Error(
      'An assistance request from the server could not be read, so none is shown rather than ' +
        'some: a request left out of the list is one an officer concludes was never filed.',
    );
  }
  return request;
}

function readSavedRequest(wire: unknown, barangays: BarangayIndex): AssistanceRequest {
  const request = toAssistanceRequest(wire, barangays);
  if (request === null) {
    throw new Error(
      'The server kept the request, but its answer could not be read. Open the request list ' +
        'again to see it before saving anything twice.',
    );
  }
  return request;
}

function readRequestNote(wire: unknown): RequestNote {
  const note = toRequestNote(wire);
  if (note === null) {
    throw new Error(
      'A note from the server could not be read, so none is shown: a file missing an entry reads ' +
        'as complete (DL-58).',
    );
  }
  return note;
}

function readAdvisory(wire: unknown): IntakeAdvisory {
  const advisory = toIntakeAdvisory(wire);
  if (advisory === null) {
    throw new Error(
      'The duplicate check from the server could not be read, so none is shown: a check that says ' +
        'less than it found reads as "nothing found".',
    );
  }
  return advisory;
}

function readNotes(wire: unknown): readonly RequestNote[] {
  if (!Array.isArray(wire)) {
    throw new Error(
      'The server kept the note, but its answer could not be read. Open the request again to see ' +
        'it before adding it twice.',
    );
  }
  return wire.map(readRequestNote);
}

function readSocialWorker(wire: unknown): SocialWorker {
  const worker = toSocialWorker(wire);
  if (worker === null) {
    throw new Error(
      'The list of social workers could not be read, so none is offered: a list missing a name ' +
        'reads as that person not working here.',
    );
  }
  return worker;
}

function readAssessmentTemplate(wire: unknown): AssessmentTemplate {
  const template = toAssessmentTemplate(wire);
  if (template === null) {
    throw new Error(
      'An assessment form from the server could not be read, so none is offered: a form shown ' +
        'without one of its questions is answered by somebody who believes they answered it all.',
    );
  }
  return template;
}

function readOpenAssessment(wire: unknown): OpenAssessment {
  const assessment = toOpenAssessment(wire);
  if (assessment === null) {
    throw new Error(
      'The open assessment could not be read, so it is not shown: an answer shown blank that was ' +
        'recorded is one an assessor types over. Open the request again.',
    );
  }
  return assessment;
}

function readDocumentRequests(wire: unknown): readonly DocumentRequest[] {
  if (!Array.isArray(wire)) {
    throw new Error('What the applicant was asked to bring could not be read, so none is shown.');
  }
  return wire.map((entry) => {
    const asked = toDocumentRequest(entry);
    if (asked === null) {
      throw new Error(
        'What the applicant was asked to bring could not be read, so none is shown rather than ' +
          'some: an entry left out reads as the office never having asked.',
      );
    }
    return asked;
  });
}

function readGrant(wire: unknown): DocumentAccessGrant {
  const grant = toDocumentAccessGrant(wire);
  if (grant === null) {
    throw new Error(
      'The server’s permission to open the file could not be read, so nothing was opened: the ' +
        'warning it carries is the server’s to give, and none is written here.',
    );
  }
  return grant;
}

/* ── cases (casework phase 3, DL-179) ─────────────────────────────────────── */

/** What the workspace reads around a case: the subject's household and families today. */
interface CaseContext {
  readonly household: HouseholdDetail | null;
  readonly families: readonly FamilySummary[];
  readonly unread: boolean;
}

const NO_CONTEXT: CaseContext = { household: null, families: [], unread: false };

/**
 * The office's continuing file on a person, served by the Node API since casework phase 3
 * (`DL-179`).
 *
 * **Redaction is the server's.** A protected subject's words arrive `null` for a reader without
 * `request.view-sensitive`, a protected note's body for a reader without
 * `case-note.view-protected`, and the mapper says what the server said.
 *
 * **The household and family are read beside the case**, from the routes that serve them — the
 * household register and the subject's families — for every reader the case admits. A caseload
 * (`assigned-cases`) reads them for its own client like anybody else (`DL-183`, superseding
 * `DL-179`'s `household_context`). A context that cannot be read is said to be unread rather than
 * shown as "no household".
 *
 * **The timeline is the domain's one assembly** (`caseTimeline`), from the events, notes, tasks and
 * the linked requests' histories, exactly as the mock builds it.
 */
@Injectable()
export class HttpCaseRepository implements CaseRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: CaseFilter, page: CursorRequest): Observable<CursorPage<CaseSummary>> {
    const refusal = caseSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeCases, page, {
            q: caseSearchOf(filter),
            queue: filter.queue,
            status: filter.status,
            category: filter.category,
            barangay_id: barangayId,
            // A caseload always reads its own, whatever is sent here (`DL-179`).
            assigned_to: filter.assignedTo,
            resident_id: filter.residentId,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) => readCaseSummary(wire, barangays)),
            })),
          );
      }),
    );
  }

  /** Every queue, counted under the list's own filters — the queue itself left out. */
  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]> {
    const refusal = caseSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .list(`${API_ENDPOINTS.officeCases}/queue-counts`, {
            q: caseSearchOf(filter),
            status: filter.status,
            category: filter.category,
            barangay_id: barangayId,
            assigned_to: filter.assignedTo,
            resident_id: filter.residentId,
          })
          .pipe(map((rows) => rows.map(readCaseQueueCount)));
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getById(id: CaseId): Observable<CaseWorkspace | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeCases}/${id}`)
          .pipe(
            switchMap((wire) =>
              wire === null ? of(null) : this.compose(readCaseWorkspace(wire, barangays), barangays),
            ),
          ),
      ),
    );
  }

  /** Every case about one person, newest opened first — whole, or an error (`DL-161`). */
  casesForResident(residentId: ResidentId): Observable<readonly CaseSummary[]> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .everyPage(API_ENDPOINTS.officeCases, { resident_id: residentId })
          .pipe(map((rows) => rows.map((wire) => readCaseSummary(wire, barangays)))),
      ),
    );
  }

  /** Whole, as the server answers it. Refused to a caseload by the server, as assigning is. */
  listAssignees(): Observable<readonly SocialWorker[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeCases}/assignees`)
      .pipe(map((rows) => rows.map(readCaseAssignee)));
  }

  open(draft: CaseOpenDraft, reason: string): Observable<CaseWorkspace> {
    if (caseOpenProblems(draft).length > 0) {
      return throwError(
        () =>
          new Error('Say what the presenting problem is, in 8 to 500 characters. Nothing was sent.'),
      );
    }
    return this.written(reason, () =>
      this.api.post(API_ENDPOINTS.officeCases, toWireCaseOpen(draft, reason)),
    );
  }

  linkRequest(id: CaseId, requestId: AssistanceRequestId, reason: string): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/requests`,
        toWireCaseRequestLink(requestId, reason),
      ),
    );
  }

  /** Ends a request's link to the case, with the reason; the link stays in the history (`DL-183`). */
  endRequestLink(
    id: CaseId,
    requestId: AssistanceRequestId,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/requests/${requestId}/end`,
        toWireCaseRequestLinkEnd(reason),
      ),
    );
  }

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(`${API_ENDPOINTS.officeCases}/${id}/status`, toWireCaseStatus(to, reason)),
    );
  }

  assign(id: CaseId, staffUserId: StaffUserId | null, reason: string): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/assignment`,
        toWireCaseAssignment(staffUserId, reason),
      ),
    );
  }

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
  ): Observable<CaseWorkspace> {
    if (!isValidNoteBody(body)) {
      return throwError(
        () => new Error('A note needs enough words to be worth keeping. Nothing was sent.'),
      );
    }
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/notes`,
        toWireCaseNote(body, sensitivity, reason),
      ),
    );
  }

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string): Observable<CaseWorkspace> {
    if (draft.title.trim().length === 0) {
      return throwError(() => new Error('Say what has to be done. Nothing was sent.'));
    }
    return this.written(reason, () =>
      this.api.post(`${API_ENDPOINTS.officeCases}/${id}/tasks`, toWireCaseTask(draft, reason)),
    );
  }

  /** The reason is the outcome: what actually happened when the task was done. */
  completeTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/tasks/${taskId}/complete`,
        toWireCaseTaskCompletion(reason),
      ),
    );
  }

  /** A task no longer needed, ended with the reason as its outcome (`DL-183`). */
  cancelTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/tasks/${taskId}/cancel`,
        toWireCaseTaskCancellation(reason),
      ),
    );
  }

  assignTask(
    id: CaseId,
    taskId: CaseTaskId,
    staffUserId: StaffUserId | null,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/tasks/${taskId}/assignment`,
        toWireCaseTaskAssignment(staffUserId, reason),
      ),
    );
  }

  rescheduleTask(
    id: CaseId,
    taskId: CaseTaskId,
    dueOn: IsoDate,
    reason: string,
  ): Observable<CaseWorkspace> {
    return this.written(reason, () =>
      this.api.post(
        `${API_ENDPOINTS.officeCases}/${id}/tasks/${taskId}/reschedule`,
        toWireCaseTaskReschedule(dueOn, reason),
      ),
    );
  }

  /**
   * A write: refused in words before anything is sent when the reason is too short, then the
   * barangay join read first — so a failed join sends nothing — and the answer composed into the
   * whole workspace, read after the change.
   */
  private written(reason: string, send: () => Observable<unknown>): Observable<CaseWorkspace> {
    if (!isValidCaseReason(reason)) {
      return throwError(
        () =>
          new Error(
            'Say why, in enough words that a colleague reading this can follow it. Nothing was sent.',
          ),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        send().pipe(
          switchMap((wire) => this.compose(readWrittenCaseWorkspace(wire, barangays), barangays)),
        ),
      ),
    );
  }

  /**
   * The household and the families around the case, read from the routes that serve them — for a
   * caseload too, which reads its own client's (`DL-183`) — and said to be unread when they fail.
   */
  private compose(parts: CaseWorkspaceParts, barangays: BarangayIndex): Observable<CaseWorkspace> {
    const record = parts.summary.record;
    const householdId = record.householdId;
    const household: Observable<HouseholdDetail | null> =
      householdId === null
        ? of(null)
        : this.api
            .optionalItem(`${API_ENDPOINTS.officeHouseholds}/${householdId}`)
            .pipe(map((wire) => (wire === null ? null : readHouseholdDetail(wire, barangays))));
    const families: Observable<readonly FamilySummary[]> = this.api
      .list(`${API_ENDPOINTS.officeResidents}/${record.subjectResidentId}/families`)
      .pipe(map((rows) => rows.map((wire) => readFamilySummary(wire, barangays))));

    return forkJoin({ household, families }).pipe(
      map((context) => assembleWorkspace(parts, { ...context, unread: false })),
      catchError(() => of(assembleWorkspace(parts, { ...NO_CONTEXT, unread: true }))),
    );
  }
}

/** The domain's workspace from the server's file and the context read beside it. */
function assembleWorkspace(parts: CaseWorkspaceParts, context: CaseContext): CaseWorkspace {
  const record = parts.summary.record;
  const detail = context.household;
  return {
    record,
    subject: parts.summary.subject,
    household:
      detail === null
        ? null
        : {
            household: detail.household,
            withheld: detail.withheld,
            isProtected: detail.isProtected,
            headName: headOf(detail)?.view.listedName ?? 'No head recorded',
            memberCount: detail.members.length,
            band: detail.snapshot.band,
            presentFactorCount: presentFactors(detail.snapshot).length,
          },
    vulnerability: detail?.snapshot ?? null,
    families: context.families,
    householdMembers: detail?.members.map((member) => member.view) ?? [],
    householdContextUnread: context.unread,
    requests: parts.requests,
    notes: parts.notes,
    tasks: parts.tasks,
    timeline: caseTimeline({
      events: parts.events,
      notes: parts.notes,
      tasks: parts.tasks,
      requests: parts.requests,
      withheld: record.withheld,
    }),
    nextAction: parts.summary.nextAction,
    assignedToName: parts.summary.assignedToName,
  };
}

/** The search the server takes: part of a case reference, 2 to 40 characters, or none. */
function caseSearchOf(filter: CaseFilter): string | undefined {
  const search = filter.search?.trim() ?? '';
  return search === '' ? undefined : search;
}

function caseSearchProblem(filter: CaseFilter): Error | null {
  const search = caseSearchOf(filter);
  return search !== undefined &&
    (search.length < CASE_SEARCH_MIN_LENGTH || search.length > CASE_SEARCH_MAX_LENGTH)
    ? new Error('Type between 2 and 40 characters of a case number to search the cases.')
    : null;
}

function readCaseSummary(wire: unknown, barangays: BarangayIndex): CaseSummary {
  const summary = toCaseSummary(wire, barangays);
  if (summary === null) {
    throw new Error(
      'A case from the server could not be read, so none is shown rather than some: a case left ' +
        'out of the list is one a supervisor concludes was never opened.',
    );
  }
  return summary;
}

function readCaseWorkspace(wire: unknown, barangays: BarangayIndex): CaseWorkspaceParts {
  const parts = toCaseWorkspaceParts(wire, barangays);
  if (parts === null) {
    throw new Error(
      'The case could not be read, so none of it is shown: a note, a task or a line of its history ' +
        'left out would read as not having happened.',
    );
  }
  return parts;
}

function readWrittenCaseWorkspace(wire: unknown, barangays: BarangayIndex): CaseWorkspaceParts {
  const parts = toCaseWorkspaceParts(wire, barangays);
  if (parts === null) {
    throw new Error(
      'The server recorded the change, but its answer could not be read. Open the case again to ' +
        'see it before recording anything twice.',
    );
  }
  return parts;
}

function readCaseQueueCount(wire: unknown): CaseQueueCount {
  const count = toCaseQueueCount(wire);
  if (count === null) {
    throw new Error(
      'The queue counts could not be read, so none is shown: a wrong count is worse than none.',
    );
  }
  return count;
}

function readCaseAssignee(wire: unknown): SocialWorker {
  const worker = toCaseAssignee(wire);
  if (worker === null) {
    throw new Error(
      'The list of social workers could not be read, so none is offered: a list missing a name ' +
        'reads as that person not working here.',
    );
  }
  return worker;
}

/* ── releases (casework phase 4, `DL-180`) ───────────────────────────────────────────────────── */

/**
 * Releases and payout sessions against `office/releases` and `office/release-batches`.
 *
 * **This is not the treasury system** (`DL-89`): it reads and writes what the office scheduled,
 * handed over and got acknowledged, and nothing here posts anywhere. Every money write forwards the
 * intent the screen holds, as `idempotency_key` in its body, so a retry of the same act replays the
 * first answer rather than paying a second time (`check:money`). The payout list is composed by the
 * server (`DL-92`), and who approved is read from the server's record of the request (`DL-91`).
 */
@Injectable()
export class HttpReleaseRepository implements ReleaseRepository {
  private readonly api = inject(ApiClient);

  /** The barangay join, read only when a barangay is asked for (`DL-186`). */
  private readonly barangayJoin = new BarangayJoin();

  list(filter: ReleaseFilter, page: CursorRequest): Observable<CursorPage<Release>> {
    const refusal = releaseSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.barangayOf(filter).pipe(
      switchMap((barangayId) =>
        this.api.cursorPage(API_ENDPOINTS.officeReleases, page, {
          q: releaseSearchOf(filter),
          status: filter.status,
          kind: filter.kind,
          method: filter.method,
          batch_id: filter.batchId,
          resident_id: filter.residentId,
          scheduled_from: filter.scheduledFrom,
          scheduled_to: filter.scheduledTo,
          open_only: filter.openOnly === true ? 'true' : undefined,
          // The dashboard's payout narrowings, so a figure opens what it counted (`DL-186`).
          barangay_id: barangayId,
          category: filter.category,
          status_group: filter.statusGroup,
          period: periodOf(filter),
        }),
      ),
      map((answer) => ({ ...answer, items: answer.items.map(readRelease) })),
    );
  }

  /** `null` for "not found **or** not yours": the server answers both with a 404 (`DL-31`). */
  getById(id: ReleaseId): Observable<Release | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReleases}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readRelease(wire))));
  }

  /** Every release for one request, whole, or an error (`DL-161`). */
  listForRequest(id: AssistanceRequestId): Observable<readonly Release[]> {
    return this.api
      .everyPage(API_ENDPOINTS.officeReleases, { request_id: id })
      .pipe(map((rows) => rows.map(readRelease)));
  }

  /** Every open release, whole, in the order the server says the office acts on them. */
  queue(filter: ReleaseFilter): Observable<readonly Release[]> {
    const refusal = releaseSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.barangayOf(filter).pipe(
      switchMap((barangayId) =>
        this.api.list(`${API_ENDPOINTS.officeReleases}/queue`, {
          q: releaseSearchOf(filter),
          status: filter.status,
          kind: filter.kind,
          method: filter.method,
          batch_id: filter.batchId,
          resident_id: filter.residentId,
          scheduled_from: filter.scheduledFrom,
          scheduled_to: filter.scheduledTo,
          barangay_id: barangayId,
          category: filter.category,
          status_group: filter.statusGroup,
          period: periodOf(filter),
        }),
      ),
      map((rows) => rows.map(readRelease)),
    );
  }

  /**
   * The API's id for the barangay asked for, or `undefined` when none is — without reading the
   * barangay list at all, so an unnarrowed read is still one request. A barangay the API does not
   * know by the same name sends nothing (`DL-186`).
   */
  private barangayOf(filter: ReleaseFilter): Observable<string | undefined> {
    const wanted = filter.barangayId;
    if (wanted === undefined) {
      return of(undefined);
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const id = barangays.toApi(wanted);
        return id === null ? throwError(() => unknownBarangay()) : of(id);
      }),
    );
  }

  /** Read from the server's record of the request's approval, kept on the release (`DL-91`). */
  approverFor(id: ReleaseId): Observable<StaffUserId | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReleases}/${id}`)
      .pipe(map((wire) => (wire === null ? null : toReleaseApprover(wire))));
  }

  listBatches(): Observable<readonly ReleaseBatch[]> {
    return this.api
      .list(API_ENDPOINTS.officeReleaseBatches)
      .pipe(map((rows) => rows.map(readReleaseBatch)));
  }

  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReleaseBatches}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readReleaseBatch(wire))));
  }

  createBatch(draft: ReleaseBatchDraft, intent: WriteIntent): Observable<ReleaseBatch> {
    return this.api
      .post(API_ENDPOINTS.officeReleaseBatches, toWireReleaseBatchOpen(draft, intent))
      .pipe(map(readWrittenBatch));
  }

  prepare(draft: ReleaseDraft, intent: WriteIntent): Observable<Release> {
    if (releaseDraftProblems(draft).length > 0) {
      return throwError(
        () =>
          new Error(
            'Money needs an amount and no goods; goods need a description and no amount. Nothing was sent.',
          ),
      );
    }
    return this.api
      .post(API_ENDPOINTS.officeReleases, toWireReleasePrepare(draft, intent))
      .pipe(map(readWrittenRelease));
  }

  /** Composed by the server from the session; a screen never assembles one (`DL-92`). */
  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReleaseBatches}/${id}/manifest`)
      .pipe(map((wire) => (wire === null ? null : readManifest(wire))));
  }

  markReleased(
    id: ReleaseId,
    instrumentReference: string | null,
    remarks: string | null,
    intent: WriteIntent,
  ): Observable<Release> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeReleases}/${id}/release`,
        toWireReleaseHandOver(instrumentReference, remarks, intent),
      )
      .pipe(map(readWrittenRelease));
  }

  acknowledge(
    id: ReleaseId,
    acknowledgement: ReleaseAcknowledgementDraft,
    intent: WriteIntent,
  ): Observable<Release> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeReleases}/${id}/acknowledgement`,
        toWireReleaseAcknowledgement(acknowledgement, intent),
      )
      .pipe(map(readWrittenRelease));
  }

  deferRelease(
    id: ReleaseId,
    reason: DeferralReason,
    remarks: string,
    intent: WriteIntent,
  ): Observable<Release> {
    if (remarks.trim().length === 0) {
      return throwError(() => new Error('Say what happened when they came. Nothing was sent.'));
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeReleases}/${id}/deferral`,
        toWireReleaseDeferral(reason, remarks, intent),
      )
      .pipe(map(readWrittenRelease));
  }

  changeStatus(
    id: ReleaseId,
    to: ReleaseStatus,
    reason: string,
    intent: WriteIntent,
  ): Observable<Release> {
    if (reason.trim().length < RELEASE_REASON_MIN_LENGTH) {
      return throwError(
        () =>
          new Error(`Say why, in ${RELEASE_REASON_MIN_LENGTH} characters or more. Nothing was sent.`),
      );
    }
    return this.api
      .post(`${API_ENDPOINTS.officeReleases}/${id}/status`, toWireReleaseStatus(to, reason, intent))
      .pipe(map(readWrittenRelease));
  }
}

/** The search the server takes: part of a release or request number, or none (`DL-109`). */
function releaseSearchOf(filter: ReleaseFilter): string | undefined {
  const search = filter.search?.trim() ?? '';
  return search === '' ? undefined : search;
}

/** `all-time` narrows nothing, so it is not sent (`DL-186`). */
function periodOf(filter: ReleaseFilter): string | undefined {
  return filter.period === undefined || filter.period === 'all-time' ? undefined : filter.period;
}

function releaseSearchProblem(filter: ReleaseFilter): Error | null {
  const search = filter.search?.trim() ?? '';
  return search !== '' && (search.length < 2 || search.length > 40)
    ? new Error('Type between 2 and 40 characters of a release or request number to search.')
    : null;
}

function readRelease(wire: unknown): Release {
  const release = toRelease(wire);
  if (release === null) {
    throw new Error(
      'A release from the server could not be read, so none is shown rather than some: a payout ' +
        'left out of the list is one nobody follows up.',
    );
  }
  return release;
}

function readWrittenRelease(wire: unknown): Release {
  const release = toRelease(wire);
  if (release === null) {
    throw new Error(
      'The server recorded the act, but its answer could not be read. Open the release again to ' +
        'see it before recording anything twice.',
    );
  }
  return release;
}

function readReleaseBatch(wire: unknown): ReleaseBatch {
  const batch = toReleaseBatch(wire);
  if (batch === null) {
    throw new Error(
      'A payout session could not be read, so none is shown: a session missing from the list is ' +
        'one a family was told to attend.',
    );
  }
  return batch;
}

function readWrittenBatch(wire: unknown): ReleaseBatch {
  const batch = toReleaseBatch(wire);
  if (batch === null) {
    throw new Error(
      'The server opened the session, but its answer could not be read. Read the sessions again ' +
        'before opening another.',
    );
  }
  return batch;
}

function readManifest(wire: unknown): ReleaseManifest {
  const manifest = toReleaseManifest(wire);
  if (manifest === null) {
    throw new Error(
      'The payout list could not be read whole, so none is shown: a list with somebody missing is ' +
        'one a person is turned away from.',
    );
  }
  return manifest;
}

/**
 * Referrals out of the office and the directory they go to (casework phase 5, `DL-181`).
 *
 * The guarantees are the server's: the basis is its own act, each field beyond the minimum is shared
 * one call at a time with its need, `send` takes only the id and is refused under the row lock
 * without a basis (`DL-140`), and the sheet is composed by the server from what was authorised —
 * this adapter carries the words there and back, and composes nothing.
 */
@Injectable()
export class HttpReferralRepository implements ReferralRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: ReferralFilter, page: CursorRequest): Observable<CursorPage<Referral>> {
    const refusal = referralSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.api
      .cursorPage(API_ENDPOINTS.officeReferrals, page, {
        q: searchOf(filter.search),
        status: filter.status,
        destination: filter.destination,
        urgency: filter.urgency,
        resident_id: filter.residentId,
        case_id: filter.caseId,
        overdue_only: filter.overdueOnly === true ? 'true' : undefined,
        open_only: filter.openOnly === true ? 'true' : undefined,
      })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readReferral) })));
  }

  /** `null` for "not found **or** not yours": the server answers both with a 404 (`DL-31`). */
  getById(id: ReferralId): Observable<Referral | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReferrals}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readReferral(wire))));
  }

  /** Every referral for one person, whole, or an error (`DL-161`). */
  forResident(id: ResidentId): Observable<readonly Referral[]> {
    return this.api
      .everyPage(API_ENDPOINTS.officeReferrals, { resident_id: id })
      .pipe(map((rows) => rows.map(readReferral)));
  }

  /** Every open referral, whole, in the order the server says the work is done (`DL-83`). */
  queue(filter: ReferralFilter): Observable<readonly Referral[]> {
    const refusal = referralSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.api
      .list(`${API_ENDPOINTS.officeReferrals}/queue`, {
        q: searchOf(filter.search),
        status: filter.status,
        destination: filter.destination,
        urgency: filter.urgency,
        resident_id: filter.residentId,
        case_id: filter.caseId,
        overdue_only: filter.overdueOnly === true ? 'true' : undefined,
        open_only: filter.openOnly === true ? 'true' : undefined,
      })
      .pipe(map((rows) => rows.map(readReferral)));
  }

  createDraft(draft: ReferralDraft): Observable<Referral> {
    if (referralDraftProblems(draft, todayAsIsoDate()).length > 0) {
      return throwError(
        () =>
          new Error(
            'Say what is asked for, why, and where it goes, with a follow-up date today or later. Nothing was sent.',
          ),
      );
    }
    return this.api
      .post(API_ENDPOINTS.officeReferrals, toWireReferralDraft(draft))
      .pipe(map(readWrittenReferral));
  }

  recordDisclosureBasis(id: ReferralId, basis: DisclosureBasis, note: string): Observable<Referral> {
    if (note.trim().length === 0) {
      return throwError(() => new Error('A lawful basis needs the sentence that explains it. Nothing was sent.'));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeReferrals}/${id}/basis`, toWireReferralBasis(basis, note))
      .pipe(map(readWrittenReferral));
  }

  shareField(id: ReferralId, shared: SharedField, because: string): Observable<Referral> {
    if (because.trim().length === 0) {
      return throwError(() => new Error('Every field beyond the minimum needs a stated need. Nothing was sent.'));
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeReferrals}/${id}/shared-fields`,
        toWireReferralSharedField(shared, because),
      )
      .pipe(map(readWrittenReferral));
  }

  /** No body: the basis and the fields are on the record, and the server checks them (`DL-140`). */
  send(id: ReferralId): Observable<Referral> {
    return this.api
      .post(`${API_ENDPOINTS.officeReferrals}/${id}/send`, {})
      .pipe(map(readWrittenReferral));
  }

  /** Composed by the server; `null` while no basis is recorded or when its words are withheld. */
  summaryFor(id: ReferralId): Observable<ReferralSummarySheet | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeReferrals}/${id}/summary`)
      .pipe(map((wire) => (wire === null ? null : readReferralSummary(wire))));
  }

  changeStatus(id: ReferralId, to: ReferralStatus, reason: string): Observable<Referral> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the referral is moving. Nothing was sent.'));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeReferrals}/${id}/status`, toWireReferralMove(to, reason))
      .pipe(map(readWrittenReferral));
  }

  recordOutcome(id: ReferralId, outcome: string, status: ReferralStatus): Observable<Referral> {
    if (outcome.trim().length === 0) {
      return throwError(() => new Error('Say what the receiving office did. Nothing was sent.'));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeReferrals}/${id}/outcome`, toWireReferralOutcome(outcome, status))
      .pipe(map(readWrittenReferral));
  }

  reschedule(id: ReferralId, followUpOn: IsoDate, reason: string): Observable<Referral> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the follow-up is moving. Nothing was sent.'));
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeReferrals}/${id}/follow-up`,
        toWireReferralFollowUp(followUpOn, reason),
      )
      .pipe(map(readWrittenReferral));
  }

  addNote(id: ReferralId, body: string): Observable<Referral> {
    if (body.trim().length === 0) {
      return throwError(() => new Error('A note needs something in it. Nothing was sent.'));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeReferrals}/${id}/notes`, toWireReferralNote(body))
      .pipe(map(readWrittenReferral));
  }

  /** The whole directory under the filter, by name — the server answers it unpaged. */
  listProviders(filter: ServiceProviderFilter): Observable<readonly ServiceProvider[]> {
    const search = filter.search?.trim() ?? '';
    if (search !== '' && (search.length < 2 || search.length > 40)) {
      return throwError(
        () => new Error('Type between 2 and 40 characters of a provider’s name or a service to search.'),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .list(API_ENDPOINTS.officeServiceProviders, {
            q: search === '' ? undefined : search,
            destination: filter.destination,
            status: filter.status,
          })
          .pipe(map((rows) => rows.map((wire) => readProvider(wire, barangays)))),
      ),
    );
  }

  getProvider(id: ServiceProviderId): Observable<ServiceProvider | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeServiceProviders}/${id}`)
          .pipe(map((wire) => (wire === null ? null : readProvider(wire, barangays)))),
      ),
    );
  }
}

/**
 * The search as the server takes it, or none. It reads a reference number (and, for a referral, the
 * receiving office's name) and nothing written about a person (`DL-109`).
 */
function searchOf(search: string | undefined): string | undefined {
  const trimmed = search?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function referralSearchProblem(filter: ReferralFilter): Error | null {
  const search = filter.search?.trim() ?? '';
  return search !== '' && (search.length < 2 || search.length > 40)
    ? new Error('Type between 2 and 40 characters of a referral number or an office’s name to search.')
    : null;
}

function readReferral(wire: unknown): Referral {
  const referral = toReferral(wire);
  if (referral === null) {
    throw new Error(
      'A referral from the server could not be read, so none is shown rather than some: a referral ' +
        'left out of the list is one nobody chases.',
    );
  }
  return referral;
}

function readWrittenReferral(wire: unknown): Referral {
  const referral = toReferral(wire);
  if (referral === null) {
    throw new Error(
      'The server recorded the act, but its answer could not be read. Open the referral again to ' +
        'see it before recording anything twice.',
    );
  }
  return referral;
}

function readReferralSummary(wire: unknown): ReferralSummarySheet {
  const sheet = toReferralSummary(wire);
  if (sheet === null) {
    throw new Error(
      'The referral summary could not be read whole, so none is shown: a sheet with a line missing ' +
        'is not the sheet that was authorised.',
    );
  }
  return sheet;
}

function readProvider(wire: unknown, barangays: BarangayIndex): ServiceProvider {
  const provider = toServiceProvider(wire, barangays);
  if (provider === null) {
    throw new Error(
      'A provider in the directory could not be read, so none is shown: a directory missing an ' +
        'office reads as one the office does not refer to.',
    );
  }
  return provider;
}

/**
 * Home and field visits (casework phase 5, `DL-181`).
 *
 * Nothing here reads, sends or keeps where anybody was (`DL-86`). Every write answers with the visit
 * as the office record now holds it, or fails — and a failure is reported as nothing saved: there is
 * no queue, no background retry and no "probably sent" (`DL-87`).
 */
@Injectable()
export class HttpFieldVisitRepository implements FieldVisitRepository {
  private readonly api = inject(ApiClient);

  list(filter: FieldVisitFilter, page: CursorRequest): Observable<CursorPage<FieldVisit>> {
    const refusal = visitSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.api
      .cursorPage(API_ENDPOINTS.officeVisits, page, {
        q: searchOf(filter.search),
        status: filter.status,
        purpose: filter.purpose,
        assigned_to: filter.assignedTo,
        resident_id: filter.residentId,
        case_id: filter.caseId,
        from: filter.from,
        to: filter.to,
        overdue_only: filter.overdueOnly === true ? 'true' : undefined,
      })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readVisit) })));
  }

  getById(id: FieldVisitId): Observable<FieldVisit | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeVisits}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readVisit(wire))));
  }

  /** The signed-in worker's own visits, whole, or an error rather than part of them (`DL-161`). */
  mine(filter: FieldVisitFilter): Observable<readonly FieldVisit[]> {
    const refusal = visitSearchProblem(filter);
    if (refusal !== null) {
      return throwError(() => refusal);
    }
    return this.api
      .everyPage(API_ENDPOINTS.officeVisits, {
        q: searchOf(filter.search),
        status: filter.status,
        purpose: filter.purpose,
        assigned_to: filter.assignedTo,
        resident_id: filter.residentId,
        case_id: filter.caseId,
        from: filter.from,
        to: filter.to,
        overdue_only: filter.overdueOnly === true ? 'true' : undefined,
        mine: 'true',
      })
      .pipe(map((rows) => rows.map(readVisit)));
  }

  forResident(id: ResidentId): Observable<readonly FieldVisit[]> {
    return this.api
      .everyPage(API_ENDPOINTS.officeVisits, { resident_id: id })
      .pipe(map((rows) => rows.map(readVisit)));
  }

  schedule(draft: FieldVisitDraft): Observable<FieldVisit> {
    const problems = visitDraftProblems(draft, todayAsIsoDate());
    if (problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }
    return this.api
      .post(API_ENDPOINTS.officeVisits, toWireVisitSchedule(draft))
      .pipe(map(readWrittenVisit));
  }

  /** Appended, each line with its kind; a third party's account names who gave it (`DL-85`). */
  recordObservations(
    id: FieldVisitId,
    observations: readonly VisitObservationDraft[],
  ): Observable<FieldVisit> {
    const problems = observations.flatMap((entry) => observationProblems(entry));
    if (observations.length === 0 || problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeVisits}/${id}/observations`, toWireVisitObservations(observations))
      .pipe(map(readWrittenVisit));
  }

  setChecklist(id: FieldVisitId, items: readonly VisitChecklistSelection[]): Observable<FieldVisit> {
    if (items.length === 0) {
      return throwError(() => new Error('There is no checklist line to record. Nothing was sent.'));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeVisits}/${id}/checklist`, toWireVisitChecklist(items))
      .pipe(map(readWrittenVisit));
  }

  close(id: FieldVisitId, outcome: VisitOutcomeDraft): Observable<FieldVisit> {
    const problems = visitOutcomeProblems(outcome);
    if (problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }
    return this.api
      .post(`${API_ENDPOINTS.officeVisits}/${id}/close`, toWireVisitClose(outcome))
      .pipe(map(readWrittenVisit));
  }
}

function visitSearchProblem(filter: FieldVisitFilter): Error | null {
  const search = filter.search?.trim() ?? '';
  return search !== '' && (search.length < 2 || search.length > 40)
    ? new Error('Type between 2 and 40 characters of a visit number to search.')
    : null;
}

function readVisit(wire: unknown): FieldVisit {
  const visit = toFieldVisit(wire);
  if (visit === null) {
    throw new Error(
      'A visit from the server could not be read, so none is shown rather than some: a visit left ' +
        'out of the plan is one nobody makes.',
    );
  }
  return visit;
}

function readWrittenVisit(wire: unknown): FieldVisit {
  const visit = toFieldVisit(wire);
  if (visit === null) {
    throw new Error(
      'The office record has it, but its answer could not be read. Open the visit again to see ' +
        'what it holds before sending anything twice.',
    );
  }
  return visit;
}

/**
 * The dashboard (`DL-182`): one read, every figure counted by the server under the scope of the
 * list it opens.
 *
 * The barangay is joined to the API's id before it is sent and back again on the way in, as on every
 * other served list; a barangay the two lists do not share is refused before anything is sent,
 * because a filter that cannot be applied would answer with the municipality's figures under a
 * heading naming one barangay.
 */
@Injectable()
export class HttpDashboardRepository implements DashboardRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  summary(filter: DashboardFilter): Observable<DashboardSummary> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .item(API_ENDPOINTS.officeDashboard, {
            barangay_id: barangayId,
            category: filter.category,
            period: filter.period,
          })
          .pipe(map((wire) => readDashboard(wire, barangays)));
      }),
    );
  }
}

function readDashboard(wire: unknown, barangays: BarangayIndex): DashboardSummary {
  const summary = toDashboardSummary(wire, barangays);
  if (summary === null) {
    throw new Error(
      'The dashboard figures could not be read, so none is shown: a total that leaves out what it ' +
        'could not read is a wrong total.',
    );
  }
  return summary;
}

/**
 * Global search (`DL-189`): one term to `GET office/search`, and nothing else (`DL-109`).
 *
 * The server searches each record type through its own list's scope and names every type it did
 * not search (`DL-112`); the answer is read whole or refused. A term too short to search is answered
 * here without a request, as the mock adapter answers it: two characters against a registry is a
 * directory dump, and the screen asks for a search on its first render with an empty term.
 *
 * The term goes in the request's query string, where every registry list's `q` already goes. It is
 * never put in the address bar (`DL-137`), and the API's request log records the path without it.
 */
@Injectable()
export class HttpSearchRepository implements SearchRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  search(term: string): Observable<SearchResults> {
    const trimmed = term.trim();
    if (!isSearchable(trimmed)) {
      return of({ term: trimmed, groups: [], total: 0, withheldTypes: [] });
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .item(API_ENDPOINTS.officeSearch, { q: trimmed })
          .pipe(map((wire) => readSearch(wire, barangays))),
      ),
    );
  }
}

function readSearch(wire: unknown, barangays: BarangayIndex): SearchResults {
  const results = toSearchResults(wire, barangays);
  if (results === null) {
    throw new Error(
      'The search results could not be read, so none is shown rather than some: a search that ' +
        'quietly loses a group says nothing matched, and an officer believes it.',
    );
  }
  return results;
}

/**
 * Work queues and office alerts (`DL-189`). **Read-only, and that is the design** (`DL-97`): three
 * reads and no write. Acting on a case task goes to `CaseRepository`, with a reason; every other
 * item is the state of a record, acted on where it lives.
 *
 * The server assembles each queue from case tasks and the live state of requests, visits, referrals
 * and releases under each list's own scope, and lists only what this reader could act on. A queue
 * is read whole or refused: one row short is a late item nobody saw.
 */
@Injectable()
export class HttpWorkRepository implements WorkRepository {
  private readonly api = inject(ApiClient);

  myQueue(asOf: IsoDate): Observable<WorkQueue> {
    return this.api
      .item(API_ENDPOINTS.officeWorkMine, { as_of: asOf })
      .pipe(map((wire) => readWork(toWorkQueue(wire))));
  }

  /** Everybody's and nobody's, grouped by person here exactly as the mock adapter groups it. */
  teamQueue(asOf: IsoDate): Observable<TeamQueue> {
    return this.api.item(API_ENDPOINTS.officeWorkTeam, { as_of: asOf }).pipe(
      map((wire) => {
        const team = readWork(toTeamWork(wire));
        const names = new Map<string, string>();
        for (const item of team.items) {
          if (item.assignedTo !== null && item.assignedToName !== null) {
            names.set(item.assignedTo, item.assignedToName);
          }
        }
        return buildTeamQueue(team.items, names, team.asOf, 'Nobody yet');
      }),
    );
  }

  alerts(): Observable<readonly OfficeAlert[]> {
    return this.api
      .list(API_ENDPOINTS.officeWorkAlerts)
      .pipe(map((rows) => readWork(toOfficeAlerts(rows))));
  }
}

/**
 * Reports (`DL-190`). Three reads and no write: the catalogue this account opens, one report's
 * figures, and a file.
 *
 * **The server counts, suppresses and composes; this adapter asks and checks.** The figures arrive
 * already suppressed (`DL-105`) and there is no parameter that could ask for them otherwise — the
 * filter is sent as four named keys and nothing else. The mapper refuses an answer that shows what
 * it should have withheld. The file is the server's (`DL-106`), refused if it does not carry its own
 * conditions; the warning before a person-level file is the screen's, shown before this is called.
 *
 * Not found and not yours are one answer, a `404`, read as `null` (`DL-31`). A caseworker filter is
 * refused here: no report counts by caseworker, and sending one would be refused anyway.
 */
@Injectable()
export class HttpReportRepository implements ReportRepository {
  private readonly api = inject(ApiClient);
  // The filter's barangay is the console's id; the API knows it by its own (`GET barangays`).
  private readonly barangayJoin = new BarangayJoin();

  catalogue(): Observable<readonly ReportDefinition[]> {
    return this.api
      .list(API_ENDPOINTS.officeReports)
      .pipe(map((rows) => readReport(toReportDefinitions(rows))));
  }

  run(id: ReportId, filter: ReportFilter): Observable<ReportResult | null> {
    if (filter.caseworkerId !== undefined) {
      return throwError(() => new Error(NO_CASEWORKER_FILTER));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .item(`${API_ENDPOINTS.officeReports}/${encodeURIComponent(id)}`, {
            period: filter.period,
            barangay_id: barangayId,
            program_id: filter.programId,
            status: filter.status,
          })
          .pipe(
            map((wire): ReportResult | null => readReport(toReportResult(wire, barangays))),
            catchError((error: unknown) =>
              isNotFound(error) ? of(null) : throwError(() => error),
            ),
          );
      }),
    );
  }

  export(id: ReportId, filter: ReportFilter, format: ExportFormat): Observable<ReportExport> {
    if (filter.caseworkerId !== undefined) {
      return throwError(() => new Error(NO_CASEWORKER_FILTER));
    }
    // The server composes a spreadsheet and nothing else; a printable view is not a file it makes.
    if (format !== 'csv') {
      return throwError(() => new Error('The API composes a report as a CSV file only.'));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .item(`${API_ENDPOINTS.officeReports}/${encodeURIComponent(id)}/export`, {
            period: filter.period,
            barangay_id: barangayId,
            program_id: filter.programId,
            status: filter.status,
            format: 'csv',
          })
          .pipe(map((wire) => readReport(toReportExport(wire))));
      }),
    );
  }
}

const NO_CASEWORKER_FILTER = 'No report counts by caseworker, so a caseworker filter is not sent.';

function readReport<T>(read: T | null): T {
  if (read === null) {
    throw new Error(
      'The report could not be read, so none of it is shown rather than some: a figure that ' +
        'should have been withheld, or a file without its conditions, is refused whole.',
    );
  }
  return read;
}

function readWork<T>(read: T | null): T {
  if (read === null) {
    throw new Error(
      'The work list could not be read, so none of it is shown rather than some: a queue one row ' +
        'short is a late item nobody saw.',
    );
  }
  return read;
}

/**
 * Residents' document requests (`DL-184`) — "issuance" on the wire. The office's side: its
 * catalogue (`issuance-type.manage`) and the requests residents file against it
 * (`issuance-request.manage`), each office's own on the server, every office's for an
 * administrator. Nothing here filters by office.
 *
 * **The queue is read whole.** The server pages newest filed first; the queue is ordered oldest
 * waiting first, which only the whole list can give. So each open status is read through
 * `everyPage`, which refuses past its ceiling rather than truncating (`DL-161`): a queue missing its
 * oldest page would hide exactly the request that has waited longest. Ended requests only grow, and
 * are browsed a page at a time.
 *
 * **Opening a file is two acts**, as for an assistance request's documents (`DL-178`): a grant with
 * the server's warning, then — only after the reader confirms — the bytes, with the handle in a body.
 */
/**
 * The beneficiary registry, served by the Node API (`DL-187`): a projection over the resident
 * registry, keyed on the resident's id — there is no beneficiary id to send (`DL-71`).
 *
 * **The server decides and the adapter says.** Scope, redaction, the standing and whether a reader
 * sees duplicate candidates are all the server's; the mappers keep what it sent. The household and
 * the families on a record are read from their own registers, so their redaction stays theirs.
 *
 * **What the API cannot answer is refused in words, without a request.** Programme membership is
 * not recorded by it, so a programme filter or the `enrollee` standing would come back with nobody
 * every time — the absence of a record read as the absence of a person (`DL-112`).
 *
 * **There is no merge** (`DL-74`). `resolveIdentity` records a finding about a pair the office is
 * holding; the same finding again answers with the one recorded, and a different one is refused by
 * the server.
 */
@Injectable()
export class HttpBeneficiaryRepository implements BeneficiaryRepository {
  private readonly api = inject(ApiClient);
  private readonly barangayJoin = new BarangayJoin();

  list(filter: BeneficiaryFilter, page: CursorRequest): Observable<CursorPage<BeneficiarySummary>> {
    const search = filter.search?.trim() ?? '';
    if (search.length === 1) {
      return throwError(() => new Error('Type at least two letters of a name to search the registry.'));
    }
    if (filter.programId !== undefined || filter.role === 'enrollee') {
      return throwError(() => new Error(PROGRAMME_MEMBERSHIP_NOT_RECORDED));
    }
    if (isPeriodReversed(filter)) {
      return throwError(
        () => new Error('The "from" date is after the "to" date, so nothing can match. Swap them.'),
      );
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const barangayId =
          filter.barangayId === undefined ? undefined : barangays.toApi(filter.barangayId);
        if (barangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.api
          .cursorPage(API_ENDPOINTS.officeBeneficiaries, page, {
            q: search === '' ? undefined : search,
            barangay_id: barangayId,
            role: filter.role,
            received_from: filter.receivedFrom,
            received_to: filter.receivedTo,
            with_open_duplicate_review: filter.withOpenDuplicateReview === true ? 'true' : undefined,
          })
          .pipe(
            map((answer) => ({
              ...answer,
              items: answer.items.map((wire) =>
                readOrRefuse(toBeneficiarySummary(wire, barangays), PERSON_UNREADABLE),
              ),
            })),
          );
      }),
    );
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404 (`DL-31`). */
  getByResidentId(id: ResidentId): Observable<BeneficiaryDetail | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api.optionalItem(`${API_ENDPOINTS.officeBeneficiaries}/${id}`).pipe(
          switchMap((wire) => {
            if (wire === null) {
              return of(null);
            }
            const parts = readOrRefuse(toBeneficiaryRecordParts(wire, barangays), RECORD_UNREADABLE);
            const household =
              parts.householdId === null
                ? of(null)
                : this.api
                    .optionalItem(`${API_ENDPOINTS.officeHouseholds}/${parts.householdId}`)
                    .pipe(
                      map((detail) => (detail === null ? null : readHouseholdDetail(detail, barangays))),
                    );
            const families = this.api
              .list(`${API_ENDPOINTS.officeResidents}/${id}/families`)
              .pipe(map((rows) => rows.map((row) => readFamilySummary(row, barangays).family)));
            return forkJoin([household, families]).pipe(
              map(([detail, familyList]): BeneficiaryDetail => {
                const history = parts.history;
                const head = detail?.members.find((member) => member.isHead) ?? null;
                return {
                  residentId: parts.residentId,
                  resident: parts.resident,
                  household: detail?.household ?? null,
                  householdHeadName: head === null ? null : head.view.fullName,
                  families: familyList,
                  standing: parts.standing,
                  // Programme membership is not recorded by the API: `null`, never `[]` (DL-187).
                  enrollments: null,
                  timeline: buildAssistanceTimeline({
                    requests: history.cases,
                    payouts: history.payouts,
                    referrals: history.referrals,
                    enrollments: [],
                  }),
                  requests: history.cases,
                  payouts: history.payouts,
                  referrals: history.referrals,
                  totalReleased: history.totalReleased,
                  goodsReceivedCount: history.goodsReceivedCount,
                  duplicateCandidates: parts.duplicateCandidates,
                };
              }),
            );
          }),
        ),
      ),
    );
  }

  duplicateQueue(page: CursorRequest): Observable<CursorPage<DuplicateCandidate>> {
    return this.api.cursorPage(API_ENDPOINTS.officeDuplicatePairs, page).pipe(
      map((answer) => ({
        ...answer,
        items: answer.items.map((wire) => readOrRefuse(toDuplicateCandidate(wire), PAIR_UNREADABLE)),
      })),
    );
  }

  duplicatesFor(id: ResidentId): Observable<readonly DuplicateCandidate[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeBeneficiaries}/${id}/duplicates`)
      .pipe(
        map((rows) => rows.map((wire) => readOrRefuse(toDuplicateCandidate(wire), PAIR_UNREADABLE))),
      );
  }

  previewResolution(
    pairId: DuplicatePairId,
    canonicalResidentId: ResidentId,
    supersededResidentId: ResidentId,
  ): Observable<MergePreview> {
    return this.api
      .item(`${API_ENDPOINTS.officeDuplicatePairs}/${pairId}/preview`, {
        canonical_resident_id: canonicalResidentId,
      })
      .pipe(
        map((wire) => {
          const preview = readOrRefuse(toMergePreview(wire), PREVIEW_UNREADABLE);
          // The server names the other record of the pair; a different one means the screen and the
          // pair disagree, and a preview of the wrong record is worse than none.
          if (preview.supersededResidentId !== supersededResidentId) {
            throw new Error('That record is not the other one of this pair. Open the pair again.');
          }
          return preview;
        }),
      );
  }

  detectDuplicates(): Observable<number> {
    return this.api
      // The route takes no body, and the server reads none: `{}`, as `send` on a referral is.
      .post(`${API_ENDPOINTS.officeDuplicatePairs}/detect`, {})
      .pipe(map((wire) => readOrRefuse(toOpenPairCount(wire), DETECTION_UNREADABLE)));
  }

  resolveIdentity(draft: IdentityResolutionDraft): Observable<IdentityResolution> {
    const problems = resolutionProblems(draft);
    if (problems.length > 0) {
      return throwError(() => new ResolutionInvalidError(problems));
    }
    return this.api
      .post(
        `${API_ENDPOINTS.officeDuplicatePairs}/${draft.pairId}/decide`,
        toWireIdentityDecision(draft),
      )
      .pipe(map((wire) => readOrRefuse(toIdentityResolution(wire), FINDING_ANSWER_UNREADABLE)));
  }

  resolutionsFor(id: ResidentId): Observable<readonly IdentityResolution[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeBeneficiaries}/${id}/findings`)
      .pipe(
        map((rows) => rows.map((wire) => readOrRefuse(toIdentityResolution(wire), FINDING_UNREADABLE))),
      );
  }
}

const PERSON_UNREADABLE =
  'A person from the registry could not be read, so none is shown rather than some: a person left ' +
  'out is one an officer concludes the office never served.';

const RECORD_UNREADABLE =
  'This record could not be read, so none of it is shown: a request, a payout or a candidate left ' +
  'out would read as not being there.';

const PAIR_UNREADABLE =
  'A pair from the duplicate queue could not be read, so none is shown rather than some: a reviewer ' +
  'shown part of the queue would clear it believing it was all.';

const PREVIEW_UNREADABLE =
  'What this finding would carry across could not be read, so nothing is shown.';

const DETECTION_UNREADABLE =
  'The detection ran, but its answer could not be read. Open the queue to see the pairs.';

const FINDING_ANSWER_UNREADABLE =
  'The finding was recorded, but its answer could not be read. Open the record to see it before ' +
  'recording anything twice.';

const FINDING_UNREADABLE =
  'A finding about this record could not be read, so none is shown rather than some.';

@Injectable()
export class HttpIssuanceRepository implements IssuanceRepository {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<readonly IssuanceType[]> {
    return this.api
      .list(API_ENDPOINTS.issuanceTypes)
      .pipe(map((items) => items.map(readIssuanceType)));
  }

  officeTypes(): Observable<readonly IssuanceType[]> {
    return this.api
      .list(API_ENDPOINTS.officeIssuanceTypes)
      .pipe(map((items) => items.map(readIssuanceType)));
  }

  createType(draft: IssuanceTypeDraft): Observable<IssuanceType> {
    return this.api
      .post(API_ENDPOINTS.officeIssuanceTypes, toWireIssuanceTypeCreate(draft))
      .pipe(map(readIssuanceType));
  }

  updateType(id: IssuanceTypeId, changes: IssuanceTypeChanges): Observable<IssuanceType> {
    return this.api
      .patch(`${API_ENDPOINTS.officeIssuanceTypes}/${id}`, toWireIssuanceTypeUpdate(changes))
      .pipe(map(readIssuanceType));
  }

  retireType(id: IssuanceTypeId, reason: string): Observable<IssuanceType> {
    return this.api
      .post(`${API_ENDPOINTS.officeIssuanceTypes}/${id}/retire`, toWireIssuanceTypeRetire(reason))
      .pipe(map(readIssuanceType));
  }

  waiting(filter: IssuanceQueueFilter): Observable<readonly IssuanceRequestSummary[]> {
    const statuses = filter.status === null ? ISSUANCE_OPEN_STATUSES : [filter.status];
    return forkJoin(
      statuses.map((status) =>
        this.api
          .everyPage(API_ENDPOINTS.officeIssuanceRequests, {
            status,
            type_id: filter.typeId ?? undefined,
            resident_id: filter.residentAccountId,
          })
          .pipe(map((items) => items.map(readIssuanceSummary))),
      ),
    ).pipe(map((lists) => lists.flat()));
  }

  list(
    filter: IssuanceListFilter,
    page: CursorRequest,
  ): Observable<CursorPage<IssuanceRequestSummary>> {
    if (filter.reference !== undefined && wholeIssuanceReference(filter.reference) === null) {
      return throwError(() => new Error(ISSUANCE_REFERENCE_INCOMPLETE));
    }
    return this.api
      .cursorPage(API_ENDPOINTS.officeIssuanceRequests, page, {
        // `null` is every status: how a request is found by its whole reference (`DL-186`).
        status: filter.status ?? undefined,
        type_id: filter.typeId ?? undefined,
        reference: filter.reference,
        resident_id: filter.residentAccountId,
      })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readIssuanceSummary) })));
  }

  request(id: IssuanceRequestId): Observable<IssuanceRequest> {
    return this.api
      .item(`${API_ENDPOINTS.officeIssuanceRequests}/${id}`)
      .pipe(map(readIssuanceRequest));
  }

  move(id: IssuanceRequestId, move: IssuanceMove): Observable<IssuanceRequest> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeIssuanceRequests}/${id}/status`,
        toWireIssuanceStatusChange(move),
      )
      .pipe(map(readIssuanceRequest));
  }

  /** A grant with the server's warning. Nothing opens until the reader has seen it and confirmed. */
  grantAttachment(
    id: IssuanceRequestId,
    attachmentId: IssuanceAttachmentId,
  ): Observable<IssuanceFileGrant> {
    return this.api
      .post(`${API_ENDPOINTS.officeIssuanceRequests}/${id}/attachments/${attachmentId}/access`, {})
      .pipe(map(readIssuanceGrant));
  }

  /** The bytes, for a grant: once, within five minutes, by this account. */
  readAttachment(grant: IssuanceFileGrant): Observable<Blob> {
    return this.api.postBlob(API_ENDPOINTS.officeIssuanceFiles, toWireIssuanceFileRequest(grant));
  }
}

function readIssuanceType(wire: unknown): IssuanceType {
  const type = toIssuanceType(wire);
  if (type === null) {
    throw new Error(
      'A document type from the server could not be read, so the catalogue is not shown rather ' +
        'than shown without it.',
    );
  }
  return type;
}

function readIssuanceSummary(wire: unknown): IssuanceRequestSummary {
  const request = toIssuanceRequestSummary(wire);
  if (request === null) {
    throw new Error(
      'A document request from the server could not be read, so none is shown rather than some: ' +
        'a request left out of this list would wait for an office that does not know it is owed.',
    );
  }
  return request;
}

function readIssuanceRequest(wire: unknown): IssuanceRequest {
  const request = toIssuanceRequest(wire);
  if (request === null) {
    throw new Error(
      'The document request from the server could not be read in full, so it is not shown: part ' +
        'of its history would tell the office something untrue.',
    );
  }
  return request;
}

function readIssuanceGrant(wire: unknown): IssuanceFileGrant {
  const grant = toIssuanceFileGrant(wire);
  if (grant === null) {
    throw new Error(
      'The server’s permission to open that file could not be read. Nothing was opened.',
    );
  }
  return grant;
}

/* ── governance (`DL-191`) ───────────────────────────────────────────────── */

/**
 * Staff accounts, the office's audit trail and what the office says about its own data, served by
 * the Node API since phase 6e.
 *
 * **One account store.** The directory is the `users` table that Users and roles reads, narrowed to
 * staff and admin accounts; what the API does not hold about a member of staff is said by the mapper
 * as not recorded (`DL-115`). **Switching an account off ends its session on the server** at its
 * next request, and the server refuses the caller's own account (`DL-116`).
 *
 * **The trail is the server's six things.** No field, value or reason was recorded, so a row says
 * so, the detail says so, and "only sensitive" is refused here without a request: an empty answer
 * would read as "nothing sensitive was touched" (`DL-114`).
 *
 * Every read is whole or refused: a row the mapper cannot read refuses the answer rather than being
 * left out of it, because an audit trail or a staff list with a row quietly missing cannot be
 * trusted about the others.
 */
@Injectable()
export class HttpGovernanceRepository implements GovernanceRepository {
  private readonly api = inject(ApiClient);
  // A barangay link's barangay is the API's id; the console knows it by its own (`GET barangays`).
  private readonly barangayJoin = new BarangayJoin();

  accounts(): Observable<readonly StaffAccount[]> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .list(API_ENDPOINTS.officeStaff)
          .pipe(map((rows) => rows.map((row) => readGovernance(toStaffAccount(row, barangays))))),
      ),
    );
  }

  accountById(staffId: StaffUserId): Observable<StaffAccount | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeStaff}/${encodeURIComponent(staffId)}`)
          .pipe(
            map((wire) =>
              wire === null ? null : readGovernance(toStaffAccount(wire, barangays)),
            ),
          ),
      ),
    );
  }

  setAccountActive(
    staffId: StaffUserId,
    isActive: boolean,
    reason: string,
  ): Observable<StaffAccount> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Turning an account on or off needs a reason.'));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        (isActive
          ? this.api.post(
              `${API_ENDPOINTS.officeStaff}/${encodeURIComponent(staffId)}/reactivate`,
              toWireAccountSwitch(reason.trim()),
            )
          : this.api.post(
              `${API_ENDPOINTS.officeStaff}/${encodeURIComponent(staffId)}/deactivate`,
              toWireAccountSwitch(reason.trim()),
            )
        ).pipe(map((wire) => readGovernance(toStaffAccount(wire, barangays)))),
      ),
    );
  }

  auditRows(filter: AuditFilter, page: CursorRequest): Observable<CursorPage<AuditRow>> {
    if (filter.sensitiveOnly === true) {
      return throwError(() => new Error(AUDIT_SENSITIVE_FILTER_UNAVAILABLE));
    }
    return this.api
      .cursorPage(API_ENDPOINTS.officeAudit, page, {
        q: filter.search,
        action: filter.action,
        record_type: filter.entityType,
        actor_id: filter.actorId,
        from: filter.from,
        to: filter.to,
      })
      .pipe(
        map((answer) => ({
          ...answer,
          items: answer.items.map((row) => readGovernance(toGovernanceAuditRow(row))),
        })),
      );
  }

  auditDetail(entryId: AuditEntryId): Observable<AuditEntryDetail | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeAudit}/${encodeURIComponent(entryId)}`)
      .pipe(map((wire) => (wire === null ? null : readGovernance(toGovernanceAuditDetail(wire)))));
  }

  classifications(): Observable<readonly ClassifiedRecordType[]> {
    return this.api
      .list(API_ENDPOINTS.officeGovernanceClassifications)
      .pipe(map((rows) => rows.map((row) => readGovernance(toClassifiedRecordType(row)))));
  }

  retention(): Observable<readonly RetentionRule[]> {
    return this.api
      .list(API_ENDPOINTS.officeGovernanceRetention)
      .pipe(map((rows) => rows.map((row) => readGovernance(toRetentionRule(row)))));
  }

  corrections(): Observable<readonly CorrectionRequest[]> {
    return this.api
      .list(API_ENDPOINTS.officeGovernanceCorrections)
      .pipe(map((rows) => rows.map((row) => readGovernance(toCorrectionRequest(row)))));
  }
}

function readGovernance<T>(read: T | null): T {
  if (read === null) {
    throw new Error(
      'An answer from the server could not be read whole, so none of it is shown: a staff list ' +
        'or an audit trail with a row quietly missing cannot be trusted about the others.',
    );
  }
  return read;
}

/**
 * Events, served by the Node API (`DL-192`): the office's side of somebody else's workflow.
 *
 * **Residents register in their own app.** This adapter creates and runs events and manages what
 * arrives; it has no method that signs anybody up, and calls none of the residents' routes
 * (`DL-123`).
 *
 * **The client counts; the server decides** (`DL-129`). A capacity summary is the server's counts
 * with the server's moment on them. A promotion from the waitlist is sent and its answer read back:
 * the server takes it (the office's own figure is the office's to exceed, after the screen's
 * warning), and a resident's own registration is capped there, inside the event's row lock.
 *
 * **A registrant list is the closed set** (`DL-130`): composed by the server and refused here if a
 * row carries more. The name is the one on the resident's app account; the API holds no link from it
 * to the office's resident registry, so the registry's protected-sector rule has nothing to apply to,
 * and no office notes exist to withhold.
 *
 * **Every list is read whole or refused**, never cut short (`DL-161`): an events list missing an
 * event reads as no event, and a registrant list missing a family is a meal short at the door.
 */
@Injectable()
export class HttpEventRepository implements EventRepository {
  private readonly api = inject(ApiClient);
  // A venue's and a registrant's barangay are the API's ids; the console knows them by its own.
  private readonly barangayJoin = new BarangayJoin();

  list(view: EventView, filter: EventFilter): Observable<readonly LguEvent[]> {
    const search = filter.search?.trim();
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .list(API_ENDPOINTS.officeEvents, {
            view,
            q: search === undefined || search === '' ? undefined : search,
            category: filter.category,
            from: filter.from,
            to: filter.to,
          })
          .pipe(map((rows) => rows.map((row) => readEvents(toLguEvent(row, barangays))))),
      ),
    );
  }

  getById(id: LguEventId): Observable<LguEvent | null> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .optionalItem(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}`)
          .pipe(map((wire) => (wire === null ? null : readEvents(toLguEvent(wire, barangays))))),
      ),
    );
  }

  /**
   * A new draft, or a draft replaced whole. Refused here, with no request, on what the domain refuses
   * to save — the server would refuse it too, in words this screen would not show.
   *
   * A cover chosen in the composer is stored through `POST media` only after every refusal this side
   * can make, and the draft then names it (`DL-193`). If the server refuses the draft after that, the
   * image stays stored, unused, as a home banner's does (`DL-170`); the composer says so before its
   * button.
   */
  saveDraft(draft: EventDraft, id: LguEventId | null): Observable<LguEvent> {
    const problems = eventProblems(draft, asIsoDateTime(new Date()), 'save');
    const { startsAt, endsAt } = draft;
    if (problems.length > 0 || startsAt === null || endsAt === null) {
      const said = problems.map((problem) => EVENT_PROBLEM_MESSAGES[problem]);
      return throwError(() => new Error(said.length > 0 ? said.join(' ') : EVENT_PROBLEM_MESSAGES['starts-required']));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const venue = draft.venue.barangayId;
        const venueBarangayId = venue === null ? null : barangays.toApi(venue);
        if (venue !== null && venueBarangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.storedCover(draft).pipe(
          switchMap((cover) =>
            id === null
              ? this.api.post(
                  API_ENDPOINTS.officeEvents,
                  toWireEventDraft(draft, { startsAt, endsAt }, venueBarangayId, cover),
                )
              : this.api.patch(
                  `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}`,
                  toWireEventDraft(draft, { startsAt, endsAt }, venueBarangayId, cover),
                ),
          ),
          map((wire) => readEvents(toLguEvent(wire, barangays))),
        );
      }),
    );
  }

  /**
   * A cover's bytes, with the bearer token in a header (`ApiClient.blob`) — a draft's too, which the
   * public `GET events/{id}/cover` would not answer (`DL-193`).
   */
  coverImage(event: LguEvent): Observable<Blob> {
    return event.image === null
      ? throwError(() => new Error('This event has no cover image.'))
      : this.api.blob(`${API_ENDPOINTS.media}/${encodeURIComponent(event.image.mediaId)}/content`);
  }

  /**
   * A published event corrected (`DL-195`). Refused here, with no request, on what the domain
   * refuses to publish and without a reason: the server would refuse both. A chosen cover is stored
   * first, as for a draft; what is material, and who is told, is the server's to decide on what it
   * holds inside the event's row lock.
   */
  correct(id: LguEventId, draft: EventDraft, correction: EventCorrection): Observable<LguEvent> {
    const problems = eventProblems(draft, asIsoDateTime(new Date()), 'publish');
    const { startsAt, endsAt } = draft;
    if (problems.length > 0 || startsAt === null || endsAt === null) {
      const said = problems.map((problem) => EVENT_PROBLEM_MESSAGES[problem]);
      return throwError(() => new Error(said.length > 0 ? said.join(' ') : EVENT_PROBLEM_MESSAGES['starts-required']));
    }
    if (correction.reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => {
        const venue = draft.venue.barangayId;
        const venueBarangayId = venue === null ? null : barangays.toApi(venue);
        if (venue !== null && venueBarangayId === null) {
          return throwError(() => unknownBarangay());
        }
        return this.storedCover(draft).pipe(
          switchMap((cover) =>
            this.api.post(
              `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/correct`,
              toWireEventCorrection(draft, { startsAt, endsAt }, venueBarangayId, cover, correction),
            ),
          ),
          map((wire) => readEvents(toLguEvent(wire, barangays))),
        );
      }),
    );
  }

  publish(id: LguEventId, reason: string): Observable<LguEvent> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    return this.moved(
      this.api.post(
        `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/publish`,
        toWireEventReason(reason),
      ),
    );
  }

  cancel(id: LguEventId, reason: string): Observable<LguEvent> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    return this.moved(
      this.api.post(
        `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/cancel`,
        toWireEventReason(reason),
      ),
    );
  }

  /** Declares attendance final on the server, which sweeps nobody into a no-show (`DL-131`). */
  complete(id: LguEventId, reason: string): Observable<LguEvent> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    return this.moved(
      this.api.post(
        `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/complete`,
        toWireEventReason(reason),
      ),
    );
  }

  archive(id: LguEventId, reason: string): Observable<LguEvent> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    return this.moved(
      this.api.post(
        `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/archive`,
        toWireEventReason(reason),
      ),
    );
  }

  registrants(id: LguEventId, filter: RegistrantFilter): Observable<readonly RegistrantView[]> {
    const search = filter.search?.trim();
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .list(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/registrants`, {
            q: search === undefined || search === '' ? undefined : search,
            status: filter.status,
            attendance: filter.attendance,
          })
          .pipe(map((rows) => rows.map((row) => readEvents(toRegistrantView(row, barangays))))),
      ),
    );
  }

  /** Check-in mode: a handful of matches and whether there were more, never the list (`DL-195`). */
  checkIn(id: LguEventId, term: string): Observable<CheckInLookup> {
    const q = term.trim();
    if (q.length < CHECK_IN_MIN_LENGTH) {
      return throwError(() => new Error(CHECK_IN_TOO_SHORT));
    }
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        this.api
          .item(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/check-in`, { q })
          .pipe(map((wire) => readEvents(toCheckInLookup(wire, barangays)))),
      ),
    );
  }

  capacity(id: LguEventId): Observable<EventCapacitySummary> {
    return this.api
      .item(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/capacity`)
      .pipe(map((wire) => readEvents(toEventCapacity(wire))));
  }

  metrics(id: LguEventId): Observable<EventMetrics> {
    return this.api
      .item(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/metrics`)
      .pipe(map((wire) => readEvents(toEventMetrics(wire))));
  }

  /**
   * One registration moved, with a reason, and what the server made of it read back — a promotion
   * is attempted, never predicted (`DL-129`).
   */
  actOnRegistration(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView> {
    if (reason.trim().length === 0) {
      return throwError(() => new Error(EVENT_REASON_REQUIRED));
    }
    const event = encodeURIComponent(eventId);
    const registration = encodeURIComponent(registrationId);
    const sent = (() => {
      switch (action) {
        case 'cancel':
          return this.api.post(
            `${API_ENDPOINTS.officeEvents}/${event}/registrations/${registration}/cancel`,
            toWireEventReason(reason),
          );
        case 'restore':
          return this.api.post(
            `${API_ENDPOINTS.officeEvents}/${event}/registrations/${registration}/restore`,
            toWireEventReason(reason),
          );
        case 'promote':
          return this.api.post(
            `${API_ENDPOINTS.officeEvents}/${event}/registrations/${registration}/promote`,
            toWireEventReason(reason),
          );
        case 'waitlist':
          return this.api.post(
            `${API_ENDPOINTS.officeEvents}/${event}/registrations/${registration}/waitlist`,
            toWireEventReason(reason),
          );
      }
    })();
    return this.registrant(sent);
  }

  markAttendance(
    eventId: LguEventId,
    registrationId: EventRegistrationId,
    attendance: AttendanceStatus,
  ): Observable<RegistrantView> {
    return this.registrant(
      this.api.post(
        `${API_ENDPOINTS.officeEvents}/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/attendance`,
        toWireEventAttendance(attendance),
      ),
    );
  }

  /** Composed by the server with its conditions inside it (`DL-106`); refused here without them. */
  exportRegistrants(id: LguEventId): Observable<RegistrantExport> {
    return this.api
      .item(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/registrants/export`)
      .pipe(map((wire) => readEvents(toRegistrantExport(wire))));
  }

  history(id: LguEventId): Observable<readonly AuditRow[]> {
    return this.api
      .list(`${API_ENDPOINTS.officeEvents}/${encodeURIComponent(id)}/history`)
      .pipe(map((rows) => rows.map((row) => readEvents(toEventHistoryRow(row)))));
  }

  /** The cover the draft will name: kept as stored, or stored now; `null` for none. */
  private storedCover(draft: EventDraft): Observable<EventCover | null> {
    const cover = draft.image;
    if (cover === null) {
      return of(null);
    }
    if (cover.kind === 'stored') {
      return of({ mediaId: cover.mediaId, altText: cover.altText });
    }
    return this.api.postForm(API_ENDPOINTS.media, toWireMediaUpload(cover.file)).pipe(
      map((wire) => {
        const mediaId = toStoredMedia(wire);
        if (mediaId === null) {
          throw new Error(
            'The cover image was stored, but the server’s answer could not be read, so the event was ' +
              'not saved. The image stays stored, unused.',
          );
        }
        return { mediaId, altText: cover.altText };
      }),
    );
  }

  private moved(sent: Observable<unknown>): Observable<LguEvent> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) => sent.pipe(map((wire) => readEvents(toLguEvent(wire, barangays))))),
    );
  }

  private registrant(sent: Observable<unknown>): Observable<RegistrantView> {
    return this.barangayJoin.read().pipe(
      switchMap((barangays) =>
        sent.pipe(map((wire) => readEvents(toRegistrantView(wire, barangays)))),
      ),
    );
  }
}

const EVENT_REASON_REQUIRED =
  'That needs a reason. It is recorded against your name, and the resident can ask.';

const CHECK_IN_TOO_SHORT = 'Type at least two letters of the name, or the reference.';

function readEvents<T>(read: T | null): T {
  if (read === null) {
    throw new Error(
      'An answer from the server could not be read whole, so none of it is shown: an events list ' +
        'or a registrant list with a row quietly missing cannot be trusted about the others.',
    );
  }
  return read;
}
