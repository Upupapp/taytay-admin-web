import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  asIsoDateTime,
  CATALOGUE_REASON_MAX_LENGTH,
  isAdoptable,
  isCatalogueReason,
  PermissionDeniedError,
  programProblems,
  summariseUtilization,
  TEMPLATE_CAP,
  CATALOGUE_CODE_PATTERN,
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_DOCUMENTS_MAX,
  TEMPLATE_NAME_MAX_LENGTH,
  TEMPLATE_NAME_MIN_LENGTH,
  templateProblems,
  type AssistanceProgram,
  type CursorPage,
  type CursorRequest,
  type IsoDateTime,
  type Money,
  type ProgramDraft,
  type ProgramFilter,
  type ProgramId,
  type ProgramRepository,
  type ProgramUtilization,
  type ProgramUtilizationReading,
  type ProgramUtilizationSummary,
  type RequirementTemplate,
  type RequirementTemplateDraft,
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
 *
 * Brought to the server's rules (`DL-177`): every write carries a reason, kept beside the version it
 * explains; a template is retired one way, a retired one is adopted by no programme that does not
 * already name it, and a template's documents are held to the same rules as a programme's own.
 */
@Injectable()
export class MockProgramRepository implements ProgramRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private programs: readonly AssistanceProgram[] = [...MOCK_PROGRAMS];
  private templates: readonly RequirementTemplate[] = [...MOCK_REQUIREMENT_TEMPLATES];
  /** Every version and why, appended in the same act as the change; nothing here rewrites it. */
  private readonly revisions: CatalogueRevision[] = [];
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

  /** The programme's template, whole — a list of one, or empty — as the server answers it. */
  listRequirementTemplates(id: ProgramId): Observable<readonly RequirementTemplate[]> {
    const code = this.programs.find((program) => program.id === id)?.requirementTemplateCode;
    return this.latency.respond(
      this.templates.filter((template) => template.code === code).map((t) => this.counted(t)),
    );
  }

  listTemplates(): Observable<readonly RequirementTemplate[]> {
    const denied = denyUnless<readonly RequirementTemplate[]>(
      this.access.currentUser(),
      'program.view',
    );
    if (denied) {
      return denied;
    }
    const byName = [...this.templates].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    return this.latency.respond(byName.map((template) => this.counted(template)));
  }

  /**
   * Creates or updates a programme. Idempotent on the identifier the caller
   * holds: `null` creates, an id updates.
   */
  save(draft: ProgramDraft, id: ProgramId | null, reason: string): Observable<AssistanceProgram> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceProgram>(user, 'program.manage');
    if (denied) {
      return denied;
    }
    if (!isCatalogueReason(reason)) {
      return throwError(() => new Error(REASON_REFUSAL));
    }

    // The criterion-3 refusal, enforced in the data layer rather than trusted
    // to the form that hid the option.
    const problems = programProblems(draft);
    if (problems.length > 0) {
      return throwError(() => new ProgramRejectedError(problems.map((problem) => problem.code)));
    }
    if (draft.name.trim().length === 0) {
      return throwError(() => new Error('A programme needs a name.'));
    }

    const existing = id === null ? undefined : this.programs.find((program) => program.id === id);

    // A retired template is adopted by nobody new; a programme that already names it keeps it.
    const templateCode = draft.requirementTemplateCode;
    if (templateCode !== null) {
      const template = this.templates.find((entry) => entry.code === templateCode);
      if (template === undefined) {
        return throwError(() => new Error('That requirement template is not in the catalogue.'));
      }
      if (!isAdoptable(template) && existing?.requirementTemplateCode !== templateCode) {
        return throwError(
          () =>
            new Error(
              'That requirement template is retired, so no programme may adopt it now. A programme ' +
                'that already names it keeps it.',
            ),
        );
      }
    }

    const now = asIsoDateTime(new Date());

    if (existing !== undefined) {
      const updated: AssistanceProgram = {
        ...existing,
        ...draft,
        effectiveTo: closedOn(existing, draft, now),
        audit: { ...existing.audit, updatedAt: now, updatedBy: user?.id ?? null },
      };
      this.programs = this.programs.map((program) =>
        program.id === existing.id ? updated : program,
      );
      this.revisions.push({ subject: updated.id, reason: reason.trim(), at: now });
      return this.latency.respond(updated);
    }

    this.sequence += 1;
    const created: AssistanceProgram = {
      id: asId<ProgramId>(`prog-new-${String(this.sequence).padStart(3, '0')}`),
      code: `LOC-${String(100 + this.sequence)}`,
      ...draft,
      effectiveFrom: dayOf(now),
      effectiveTo: draft.status === 'closed' ? dayOf(now) : null,
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };
    this.programs = [...this.programs, created];
    this.revisions.push({ subject: created.id, reason: reason.trim(), at: now });
    return this.latency.respond(created);
  }

  saveTemplate(
    draft: RequirementTemplateDraft,
    code: string | null,
    reason: string,
  ): Observable<RequirementTemplate> {
    const user = this.access.currentUser();
    const denied = denyUnless<RequirementTemplate>(user, 'program.manage');
    if (denied) {
      return denied;
    }
    if (!isCatalogueReason(reason)) {
      return throwError(() => new Error(REASON_REFUSAL));
    }
    const refused = templateDraftRefusal(draft);
    if (refused !== null) {
      return throwError(() => refused);
    }

    const now = asIsoDateTime(new Date());

    if (code === null) {
      const taken = this.creationRefusal(draft.code);
      if (taken !== null) {
        return throwError(() => taken);
      }
      const created: RequirementTemplate = {
        code: draft.code,
        name: draft.name.trim(),
        description: draft.description.trim(),
        requirements: draft.requirements,
        status: 'active',
        retiredAt: null,
        programCount: 0,
        audit: {
          createdAt: now,
          createdBy: user?.id ?? null,
          updatedAt: now,
          updatedBy: user?.id ?? null,
        },
      };
      this.templates = [...this.templates, created];
      this.revisions.push({ subject: created.code, reason: reason.trim(), at: now });
      return this.latency.respond(this.counted(created));
    }

    const existing = this.templates.find((template) => template.code === code);
    if (existing === undefined) {
      return throwError(() => new Error('That requirement template is not in the catalogue.'));
    }
    if (!isAdoptable(existing)) {
      return throwError(
        () =>
          new Error('That requirement template is retired, and a retired template is not changed.'),
      );
    }
    const updated: RequirementTemplate = {
      ...existing,
      name: draft.name.trim(),
      description: draft.description.trim(),
      requirements: draft.requirements,
      audit: { ...existing.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.templates = this.templates.map((template) =>
      template.code === existing.code ? updated : template,
    );
    this.revisions.push({ subject: updated.code, reason: reason.trim(), at: now });
    return this.latency.respond(this.counted(updated));
  }

  retireTemplate(code: string, reason: string): Observable<RequirementTemplate> {
    const user = this.access.currentUser();
    const denied = denyUnless<RequirementTemplate>(user, 'program.manage');
    if (denied) {
      return denied;
    }
    if (!isCatalogueReason(reason)) {
      return throwError(() => new Error(REASON_REFUSAL));
    }
    const existing = this.templates.find((template) => template.code === code);
    if (existing === undefined) {
      return throwError(() => new Error('That requirement template is not in the catalogue.'));
    }
    // Already retired answers as it stands: retiring is one way, and twice is still once.
    if (!isAdoptable(existing)) {
      return this.latency.respond(this.counted(existing));
    }
    const now = asIsoDateTime(new Date());
    const retired: RequirementTemplate = {
      ...existing,
      status: 'retired',
      retiredAt: now,
      audit: { ...existing.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.templates = this.templates.map((template) =>
      template.code === existing.code ? retired : template,
    );
    this.revisions.push({ subject: retired.code, reason: reason.trim(), at: now });
    return this.latency.respond(this.counted(retired));
  }

  /** A code is never reused, retired or not; the office keeps a bounded number of templates. */
  private creationRefusal(code: string): Error | null {
    if (!CATALOGUE_CODE_PATTERN.test(code)) {
      return new Error('A template’s code is lower-case words and hyphens, 2 to 60 characters.');
    }
    if (this.templates.some((template) => template.code === code)) {
      return new Error(
        'That code is already used by a template. A code is never reused, retired or not.',
      );
    }
    if (this.templates.length >= TEMPLATE_CAP) {
      return new Error(`The office keeps at most ${TEMPLATE_CAP} requirement templates.`);
    }
    return null;
  }

  /** Programmes not closed that name the template, counted now, as the server counts them. */
  private counted(template: RequirementTemplate): RequirementTemplate {
    const programCount = this.programs.filter(
      (program) => program.status !== 'closed' && program.requirementTemplateCode === template.code,
    ).length;
    return { ...template, programCount };
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

  constructor(
    problems: readonly string[],
    message = 'That programme entry cannot be saved as it stands.',
  ) {
    super(message);
    this.name = 'ProgramRejectedError';
    this.problems = problems;
  }
}

interface CatalogueRevision {
  readonly subject: string;
  readonly reason: string;
  readonly at: IsoDateTime;
}

const REASON_REFUSAL =
  `Say why, in words of up to ${CATALOGUE_REASON_MAX_LENGTH} characters. The reason is kept ` +
  'beside the version it explains.';

/** Moving to closed dates the end; moving away clears it, as the server does. */
function closedOn(
  existing: AssistanceProgram,
  draft: ProgramDraft,
  now: IsoDateTime,
): AssistanceProgram['effectiveTo'] {
  if (draft.status !== 'closed') {
    return null;
  }
  return existing.status === 'closed' ? existing.effectiveTo : dayOf(now);
}

/** What the server's body rules refuse in a template, before its documents are read. */
function templateDraftRefusal(draft: RequirementTemplateDraft): Error | null {
  const name = draft.name.trim().length;
  if (name < TEMPLATE_NAME_MIN_LENGTH || name > TEMPLATE_NAME_MAX_LENGTH) {
    return new Error(
      `A template’s name is ${TEMPLATE_NAME_MIN_LENGTH} to ${TEMPLATE_NAME_MAX_LENGTH} characters.`,
    );
  }
  if (draft.description.trim().length > TEMPLATE_DESCRIPTION_MAX_LENGTH) {
    return new Error(
      `A template’s description is at most ${TEMPLATE_DESCRIPTION_MAX_LENGTH} characters.`,
    );
  }
  if (draft.requirements.length > TEMPLATE_DOCUMENTS_MAX) {
    return new Error(`A template names at most ${TEMPLATE_DOCUMENTS_MAX} documents.`);
  }
  const problems = templateProblems(draft);
  return problems.length === 0
    ? null
    : new ProgramRejectedError(
        problems.map((problem) => problem.code),
        'That requirement template cannot be saved as it stands.',
      );
}

function dayOf(moment: string): AssistanceProgram['effectiveFrom'] {
  return asIsoDate(moment.slice(0, 10));
}
