import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  asIsoDateTime,
  guidanceProblems,
  PermissionDeniedError,
  responsibilityProblems,
  reviewWindowProblems,
  summariseUtilization,
  type AssistanceProgram,
  type CursorPage,
  type CursorRequest,
  type Money,
  type ProgramDraft,
  type ProgramFilter,
  type ProgramId,
  type ProgramRepository,
  type ProgramUtilization,
  type ProgramUtilizationReading,
  type ProgramUtilizationSummary,
  type RequirementTemplate,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { matchesSearch } from './mock-query';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_REQUIREMENT_TEMPLATES } from './seed/requirement-templates.seed';

/**
 * The programme catalog adapter.
 *
 * The one rule it enforces rather than assumes: **a programme cannot be saved
 * with a responsibility record that misrepresents the office** (`DL-65`). The
 * form hides the impossible combination; this refuses it, so a reachable
 * control cannot record a DSWD programme as municipally owned.
 *
 * Reads are open to `program.view` — the catalog is policy, not personal data,
 * and every role that files a request needs to see what a programme asks for.
 * Writes need `program.manage`, because a wrong entry here misdescribes the
 * office to every applicant at once.
 */
@Injectable()
export class MockProgramRepository implements ProgramRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private programs: readonly AssistanceProgram[] = [...MOCK_PROGRAMS];
  private sequence = 0;

  list(filter: ProgramFilter, page: CursorRequest): Observable<CursorPage<AssistanceProgram>> {
    const filtered = this.programs.filter((program) => {
      if (filter.category && program.category !== filter.category) {
        return false;
      }
      if (filter.status && program.status !== filter.status) {
        return false;
      }
      return matchesSearch([program.name, program.code, program.description], filter.search);
    });

    // The office record's order — name, then id — and its cursor: the id of the last row read.
    const sorted = [...filtered].sort(
      (a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id),
    );
    const after = page.cursor ? sorted.findIndex((program) => program.id === page.cursor) : -1;
    const rest = sorted.slice(after + 1);
    const items = rest.slice(0, Math.max(1, page.limit));
    const hasMore = rest.length > items.length;
    const last = items[items.length - 1];
    return this.latency.respond({
      items,
      hasMore,
      nextCursor: hasMore && last !== undefined ? last.id : null,
    });
  }

  getById(id: ProgramId): Observable<AssistanceProgram | null> {
    return this.latency.respond(this.programs.find((program) => program.id === id) ?? null);
  }

  listActive(): Observable<readonly AssistanceProgram[]> {
    return this.latency.respond(this.programs.filter((program) => program.status === 'active'));
  }

  listRequirementTemplates(): Observable<readonly RequirementTemplate[]> {
    return this.latency.respond(MOCK_REQUIREMENT_TEMPLATES);
  }

  /**
   * Creates or updates a programme. Idempotent on the identifier the caller
   * holds: `null` creates, an id updates.
   */
  save(draft: ProgramDraft, id: ProgramId | null): Observable<AssistanceProgram> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceProgram>(user, 'program.manage');
    if (denied) {
      return denied;
    }

    // The criterion-3 refusal, enforced in the data layer rather than trusted
    // to the form that hid the option.
    const problems = [
      ...responsibilityProblems(draft.responsibility),
      ...guidanceProblems(draft.guidance),
      ...(draft.reviewWindow === null ? [] : reviewWindowProblems(draft.reviewWindow)),
    ];
    if (problems.length > 0) {
      return throwError(() => new ProgramRejectedError(problems.map((problem) => problem.code)));
    }
    if (draft.name.trim().length === 0) {
      return throwError(() => new Error('A programme needs a name.'));
    }

    const now = asIsoDateTime(new Date());
    const existing = id === null ? undefined : this.programs.find((program) => program.id === id);

    if (existing !== undefined) {
      const updated: AssistanceProgram = {
        ...existing,
        ...draft,
        audit: { ...existing.audit, updatedAt: now, updatedBy: user?.id ?? null },
      };
      this.programs = this.programs.map((program) =>
        program.id === existing.id ? updated : program,
      );
      return this.latency.respond(updated);
    }

    this.sequence += 1;
    const created: AssistanceProgram = {
      id: asId<ProgramId>(`prog-new-${String(this.sequence).padStart(3, '0')}`),
      code: `LOC-${String(100 + this.sequence)}`,
      ...draft,
      effectiveFrom: dayOf(now),
      effectiveTo: null,
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };
    this.programs = [...this.programs, created];
    return this.latency.respond(created);
  }

  utilizationFor(id: ProgramId): Observable<ProgramUtilizationReading> {
    const user = this.access.currentUser();
    const denied = denyUnless<ProgramUtilizationReading>(user, 'program.view');
    if (denied) {
      return denied;
    }
    if (!this.programs.some((program) => program.id === id)) {
      return throwError(() => new PermissionDeniedError('program.view'));
    }
    return this.latency.respond<ProgramUtilizationReading>({
      kind: 'read',
      utilization: this.utilization(id),
    });
  }

  utilizationSummary(): Observable<ProgramUtilizationSummary> {
    const user = this.access.currentUser();
    const denied = denyUnless<ProgramUtilizationSummary>(user, 'program.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond<ProgramUtilizationSummary>({
      kind: 'read',
      rows: this.programs.map((program) => this.utilization(program.id)),
    });
  }

  private utilization(programId: ProgramId): ProgramUtilization {
    const byRequest = new Map(MOCK_ASSISTANCE_REQUESTS.map((request) => [request.id, request]));
    return summariseUtilization({
      programId,
      requests: MOCK_ASSISTANCE_REQUESTS.map((request) => ({
        id: request.id,
        programId: request.programId,
        status: request.status,
        requestedAmount: request.requestedAmount,
        approvedAmount: request.approvedAmount,
        submittedAt: request.submittedAt,
      })),
      releases: MOCK_DISBURSEMENTS.filter(
        (payout) =>
          payout.releasedAt !== null && payout.status !== 'voided' && payout.amount !== null,
      ).map((payout) => ({
        requestId: payout.requestId,
        // The payout does not carry a programme; the request it belongs to does.
        programId: byRequest.get(payout.requestId)?.programId ?? asId<ProgramId>(''),
        amount: payout.amount as Money,
        releasedAt: payout.releasedAt ?? payout.audit.updatedAt,
      })),
      now: asIsoDateTime(new Date()),
    });
  }
}

/** Refusal carrying every reason at once, so a form can show them together. */
export class ProgramRejectedError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super('That programme entry cannot be saved as it stands.');
    this.name = 'ProgramRejectedError';
    this.problems = problems;
  }
}

function dayOf(moment: string): AssistanceProgram['effectiveFrom'] {
  return asIsoDate(moment.slice(0, 10));
}
