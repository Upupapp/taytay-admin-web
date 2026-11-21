import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  ID_LAST_FOUR_PATTERN,
  IN_PERSON_NAME_MAX,
  InPersonRefusedError,
  awaitsReview,
  identityToConfirm,
  mediaFor,
  reviewNoteProblem,
  selfieErased,
  type AccountLinkDecision,
  type AccountLinkOutcome,
  type AppAccountId,
  type ConfirmedIdentity,
  type RegistryMatch,
  type RegistryMatches,
  type ResidentId,
  type InPersonCheck,
  type InPersonVerification,
  type InPersonVerificationId,
  type CursorRequest,
  type VerificationDecision,
  type VerificationFilter,
  type VerificationImageKind,
  type VerificationRepository,
  type VerificationListPage,
  type VerificationQueueStats,
  type VerificationRequest,
  type VerificationRequestId,
  type WriteIntent,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockAppAccountStore } from './mock-app-account.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { countByDay, demoDays, demoNow } from './mock-time-series';
import { MOCK_VERIFICATION_REQUESTS, samplePlaceholder } from './seed/verification-requests.seed';

/** The API's own ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

/** The staff note the API writes on a request it supersedes (`SUPERSEDED_NOTE`, `5209f75`). */
const SUPERSEDED_NOTE =
  'Closed without a decision: the office verified this account in person, against a government ID shown at the counter.';

/**
 * In-memory ID verification review (`DL-167`), paging and refusing the way the API does.
 *
 * - Cursor-paged, newest first, with no total — the same shape `HttpVerificationRepository`
 *   answers, so a screen built here meets no surprise against the server.
 * - A decision on a request that is no longer pending is refused, as the API refuses it with
 *   `CONFLICT`: two reviewers on one queue is the ordinary case, not the exotic one.
 * - Every act re-checks `verification.review`. Hiding the screen is not protection (rule 4).
 */
@Injectable()
export class MockVerificationRepository implements VerificationRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private readonly accounts = inject(MockAppAccountStore);
  private readonly residents = inject(MockResidentStore);
  /** Account → the registry record it is linked to, as the API's link rows hold it (`DL-228`). */
  private readonly links = new Map<string, ResidentId>();

  private requests: readonly VerificationRequest[] = MOCK_VERIFICATION_REQUESTS;
  /** Each counter check by its key, with the body it was sent with, as the API keeps them. */
  private readonly checks = new Map<
    string,
    { readonly body: string; readonly record: InPersonVerification }
  >();

  list(
    filter: VerificationFilter,
    page: CursorRequest,
  ): Observable<VerificationListPage> {
    const denied = denyUnless<VerificationListPage>(
      this.access.currentUser(),
      'verification.review',
    );
    if (denied) {
      return denied;
    }

    const matching = this.requests
      .filter((request) => filter.status === null || request.status === filter.status)
      .slice()
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const limit = Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const end = start + limit;
    const hasMore = end < matching.length;

    return this.latency.respond({
      items: matching.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
      stats: this.stats(),
    });
  }

  /**
   * The queue's figures as the API counts them beside every page (`DL-232`), over the whole sample
   * queue and ended on the demo's today (see mock-time-series).
   */
  private stats(): VerificationQueueStats {
    const now = demoNow().getTime();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const pending = this.requests.filter((request) => request.status === 'pending');
    const decided = this.requests.filter(
      (request) =>
        request.reviewedAt !== null && Date.parse(request.reviewedAt) >= weekAgo,
    );
    return {
      pending: pending.length,
      oldestPendingAt: pending.map((request) => request.submittedAt).sort()[0] ?? null,
      decided7d: {
        approved: decided.filter((request) => request.status === 'approved').length,
        rejected: decided.filter((request) => request.status === 'rejected').length,
      },
      sentByDay: countByDay(
        demoDays(7),
        this.requests.map((request) => request.submittedAt),
      ),
    };
  }

  approve(
    id: VerificationRequestId,
    note: string,
    confirmed: ConfirmedIdentity,
    accountLink: AccountLinkDecision | null,
  ): Observable<VerificationRequest> {
    return this.decide(id, 'approved', note, confirmed, accountLink);
  }

  /**
   * The registry's proposals, as the API makes them (`DL-228`): records whose whole name is among
   * the account's words, at most ten, each with signals and no value (`DL-73`). The mock compares
   * names only, so every proposal is `weak` unless the barangay is known to agree.
   */
  registryMatches(accountId: AppAccountId): Observable<RegistryMatches> {
    const denied = denyUnless<RegistryMatches>(this.access.currentUser(), 'verification.review');
    if (denied) {
      return denied;
    }
    const name =
      this.accounts.find(accountId)?.name ??
      this.requests.find((request) => request.accountId === accountId)?.account?.name ??
      null;
    const words = new Set(
      (name ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word !== ''),
    );
    const linkedResidentId = this.links.get(String(accountId)) ?? null;
    const heldBy = new Set([...this.links.values()].map(String));
    const has = (part: string): boolean =>
      part
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word !== '')
        .every((word) => words.has(word));
    const matches: RegistryMatch[] = this.residents
      .all()
      .filter(
        (resident) =>
          resident.isActive &&
          resident.id !== linkedResidentId &&
          has(resident.name.last) &&
          has(resident.name.first),
      )
      .slice(0, 10)
      .map((resident) => ({
        residentId: resident.id,
        label: `${resident.name.last}, ${resident.name.first.charAt(0)}.`,
        strength: 'weak' as const,
        signals: [
          {
            attribute: 'surname',
            outcome: 'same',
            rule: 'Every word of the surname is in the account’s name.',
          },
          {
            attribute: 'given-name',
            outcome: 'same',
            rule: 'Every word of the given name is in the account’s name.',
          },
          {
            attribute: 'barangay',
            outcome: 'not-comparable',
            rule: 'The sample data compares names only.',
          },
        ] as const,
        linkedToOtherAccount: heldBy.has(String(resident.id)),
      }));
    return this.latency.respond({ accountId, linkedResidentId, matches });
  }

  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest> {
    return this.decide(id, 'rejected', reason);
  }

  openImage(request: VerificationRequest, kind: VerificationImageKind): Observable<Blob> {
    const denied = denyUnless<Blob>(this.access.currentUser(), 'verification.review');
    if (denied) {
      return denied;
    }
    if (mediaFor(request, kind) === null) {
      return throwError(() => new Error('This request carries no such image.'));
    }
    // An erased selfie's bytes are gone; the API answers 404 for them (`DL-218`).
    const stored = this.requests.find((candidate) => candidate.id === request.id) ?? request;
    if (kind === 'selfie' && selfieErased(stored)) {
      return throwError(() => new Error('That image was not found.'));
    }

    return this.latency.respond(samplePlaceholder(kind));
  }

  /**
   * A counter check, refused and recorded the way the API does it (`5209f75`): the body is
   * validated first, then the key is looked up — the same body replays the first record, another is
   * refused — then the account is checked as it stands, and a waiting selfie request is superseded,
   * its selfie erased, in the same act as the account is verified.
   */
  verifyInPerson(
    accountId: AppAccountId,
    check: InPersonCheck,
    intent: WriteIntent,
  ): Observable<InPersonVerification> {
    const user = this.access.currentUser();
    const denied = denyUnless<InPersonVerification>(user, 'verification.review');
    if (denied) {
      return denied;
    }
    const refuse = (message: string, kind: 'forbidden' | 'conflict') =>
      throwError(() => new InPersonRefusedError(message, kind));

    const lastFour = check.idLastFour.trim();
    const corrected = check.correctedName?.trim() ?? null;
    if (!ID_LAST_FOUR_PATTERN.test(lastFour)) {
      return throwError(
        () =>
          new InPersonRefusedError('The request could not be validated.', 'invalid', {
            idLastFour: 'Only the last four characters of the ID number.',
          }),
      );
    }
    if (corrected !== null && (corrected === '' || corrected.length > IN_PERSON_NAME_MAX)) {
      return throwError(
        () =>
          new InPersonRefusedError('The request could not be validated.', 'invalid', {
            correctedName: `A name is 1 to ${IN_PERSON_NAME_MAX} characters.`,
          }),
      );
    }

    if (user !== null && String(user.id) === String(accountId)) {
      return refuse('You cannot verify your own account.', 'forbidden');
    }

    const body = JSON.stringify([
      accountId,
      check.idType,
      lastFour,
      check.confirmedName,
      corrected,
      check.accountLink,
    ]);
    const prior = this.checks.get(intent.key);
    if (prior !== undefined) {
      return prior.body === body
        ? this.latency.respond(prior.record)
        : refuse(
            'That idempotency key was already used for a different verification. A retry carries the same key and the same body.',
            'conflict',
          );
    }

    const account = this.accounts.find(accountId);
    if (account === undefined) {
      return refuse('That user was not found.', 'conflict');
    }
    if (account.role === 'verified') {
      return refuse('This account is already verified.', 'conflict');
    }
    if (account.role !== 'registered') {
      return refuse(
        'Only a resident’s account is verified here. Staff and admin accounts are not.',
        'conflict',
      );
    }
    if (account.name === null) {
      return refuse(
        'The account gives no name to check against the ID. The resident adds it in the app first.',
        'conflict',
      );
    }
    if (check.confirmedName.trim() !== account.name.trim()) {
      return refuse(
        'The account’s name is not the one confirmed. Read the account again and check it against the ID.',
        'conflict',
      );
    }

    // One act, as on the server: a refused link verifies nothing (`DL-228`).
    const linked = check.accountLink === null ? null : this.link(accountId, check.accountLink);
    if (typeof linked === 'string') {
      return refuse(linked, 'conflict');
    }
    const now = asIsoDateTime(new Date());
    const renamed = corrected !== null && corrected !== account.name.trim() ? corrected : null;
    const waiting = this.requests.find(
      (request) => request.accountId === accountId && request.status === 'pending',
    );
    if (waiting !== undefined) {
      const superseded: VerificationRequest = {
        ...waiting,
        status: 'superseded',
        account: null,
        reviewedAt: now,
        reviewNote: SUPERSEDED_NOTE,
        selfieErasedAt: waiting.selfieErasedAt ?? now,
      };
      this.requests = this.requests.map((request) =>
        request.id === waiting.id ? superseded : request,
      );
    }
    this.accounts.save({ ...account, role: 'verified', name: renamed ?? account.name });

    const record: InPersonVerification = {
      id: asId<InPersonVerificationId>(`in-person-${this.checks.size + 1}`),
      accountId,
      idType: check.idType,
      nameCorrected: renamed !== null,
      supersededRequestId: waiting?.id ?? null,
      verifiedAt: now,
      registryOutcome: linked,
    };
    this.checks.set(intent.key, { body, record });
    return this.latency.respond(record);
  }

  private decide(
    id: VerificationRequestId,
    decision: VerificationDecision,
    note: string,
    confirmed: ConfirmedIdentity | null = null,
    accountLink: AccountLinkDecision | null = null,
  ): Observable<VerificationRequest> {
    const denied = denyUnless<VerificationRequest>(
      this.access.currentUser(),
      'verification.review',
    );
    if (denied) {
      return denied;
    }
    if (reviewNoteProblem(note) !== null) {
      return throwError(() => new Error('A decision needs a sentence saying why.'));
    }

    const current = this.requests.find((request) => request.id === id);
    if (current === undefined) {
      return throwError(() => new Error('That verification request was not found.'));
    }
    if (!awaitsReview(current)) {
      return throwError(() => new Error('That verification request is no longer pending.'));
    }
    // The API's 409 for an approval whose selfie is gone (`44cae1b`, `DL-218`).
    if (decision === 'approved' && selfieErased(current)) {
      return throwError(
        () =>
          new Error(
            'The resident withdrew their consent to the selfie, so it was erased. Reject the request and say a new selfie is needed.',
          ),
      );
    }
    // The API's two refusals, in its words (`DL-197`): nothing to check, or not what was checked.
    if (decision === 'approved') {
      const expected = identityToConfirm(current);
      if (expected === null) {
        return throwError(
          () =>
            new Error(
              'The account gives no name to check against the ID. Reject the request and say what is missing.',
            ),
        );
      }
      if (
        confirmed === null ||
        confirmed.name.trim() !== expected.name ||
        confirmed.birthDate !== expected.birthDate
      ) {
        return throwError(
          () =>
            new Error(
              'The name or birth date on the account is not the one confirmed. Read the request again and check it against the ID.',
            ),
        );
      }
    }

    let outcome: AccountLinkOutcome | null = null;
    if (decision === 'approved' && accountLink !== null) {
      const linked = this.link(current.accountId, accountLink);
      if (typeof linked === 'string') {
        return throwError(() => new Error(linked));
      }
      outcome = linked;
    }

    const decided: VerificationRequest = {
      ...current,
      account: null,
      status: decision,
      reviewedAt: asIsoDateTime(new Date()),
      reviewNote: note.trim(),
      registryOutcome: outcome,
    };
    this.requests = this.requests.map((request) => (request.id === id ? decided : request));

    return this.latency.respond(decided);
  }

  /**
   * The API's link rules and refusals, in its words (`DL-228`): a refusal is a sentence and nothing
   * is linked. `create` makes no record here — the sample registry is not written from this port —
   * so it answers as linked to nothing new.
   */
  private link(
    accountId: AppAccountId,
    decision: AccountLinkDecision,
  ): AccountLinkOutcome | string {
    if (this.links.has(String(accountId))) {
      return 'This account is already linked to a registry record. Approve without a link.';
    }
    if (decision.decision === 'leave-unlinked') {
      return { decision: 'leave-unlinked', residentId: null };
    }
    if (decision.decision === 'create') {
      return { decision: 'create', residentId: null };
    }
    if ([...this.links.values()].some((held) => held === decision.residentId)) {
      return 'That record is already linked to another app account.';
    }
    if (this.residents.find(decision.residentId) === undefined) {
      return 'That registry record was not found.';
    }
    this.links.set(String(accountId), decision.residentId);
    return { decision: 'link', residentId: decision.residentId };
  }
}
