import { Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  type ResidentRepository,
  type HouseholdRepository,
  type FamilyRepository,
  type CaseRepository,
  type SavedViewRepository,
  type ProgramRepository,
  type AssistanceRequestRepository,
  type BeneficiaryRepository,
  type FieldVisitRepository,
  type ReleaseRepository,
  type ReferralRepository,
  type WorkRepository,
  type ReportRepository,
  type SearchRepository,
  type GovernanceRepository,
  type NewsfeedRepository,
  type EventRepository,
  type DashboardRepository,
} from '@domain/index';

/**
 * THE PORTS THE API DOES NOT SERVE, AND WHAT THEY SAY INSTEAD.
 *
 * The Node API that replaced the Laravel one on 2026-10-20 is the back office of the residents'
 * app. It has no route for cases, assistance requests, releases, referrals, visits, programmes,
 * reports, events or most of what this console was built to do (`DL-164`,
 * `docs/integration/node-api-gap-map.md`). In the `http` configuration each of those ports is
 * bound to a class here.
 *
 * ## What an unserved adapter does
 *
 * Every method fails at once with a sentence a person can read, and **makes no request**. It does
 * not inject `ApiClient` or `HttpClient`, so it cannot: there is no route to call, and a request to
 * a path that does not exist would come back as a 404 the screen reads as "not found" — an absence
 * of records, when the truth is an absence of a server.
 *
 * ## What it must never do
 *
 * - **Answer with an empty list.** An officer who sees no cases concludes none was ever opened
 *   (`DL-112`). An error is the only answer that does not assert something about the office.
 * - **Fall back to the mock.** Sample data in a configuration that claims to be a real API is the
 *   misconfiguration `check:environments` and `check:bundle` exist to stop (`DL-136`).
 *
 * ## Why every method takes no parameters
 *
 * A method that declares fewer parameters than its port's is assignable to it, and one that ignores
 * everything it is given has nothing to declare. `Observable<never>` is assignable to every
 * `Observable<T>` the ports return, so the classes implement their ports with no cast — and a port
 * that gains a method fails to compile here until somebody decides what it says.
 */

/**
 * The refusal every unserved method answers with. An `Error`, so `toViewState` shows its message
 * rather than a generic failure.
 */
export class UnservedError extends Error {
  /** Which part of the console, in the words the sentence uses. */
  readonly module: string;

  constructor(module: string) {
    super(
      `This part of the console has no server yet: the API it is connected to does not serve ` +
        `${module}. Nothing was sent, and nothing shown here is a record of the office.`,
    );
    this.name = 'UnservedError';
    this.module = module;
  }
}

export function unserved(module: string): Observable<never> {
  return throwError(() => new UnservedError(module));
}

@Injectable()
export class UnservedResidentRepository implements ResidentRepository {
  list(): Observable<never> {
    return unserved('the resident registry');
  }

  getById(): Observable<never> {
    return unserved('the resident registry');
  }

  getProfile(): Observable<never> {
    return unserved('the resident registry');
  }

  create(): Observable<never> {
    return unserved('the resident registry');
  }

  update(): Observable<never> {
    return unserved('the resident registry');
  }

  setActive(): Observable<never> {
    return unserved('the resident registry');
  }

  recordSector(): Observable<never> {
    return unserved('the resident registry');
  }

  endSector(): Observable<never> {
    return unserved('the resident registry');
  }
}

@Injectable()
export class UnservedHouseholdRepository implements HouseholdRepository {
  list(): Observable<never> {
    return unserved('households');
  }

  getById(): Observable<never> {
    return unserved('households');
  }

  changeMembership(): Observable<never> {
    return unserved('households');
  }

  correctFactor(): Observable<never> {
    return unserved('households');
  }

  clearCorrection(): Observable<never> {
    return unserved('households');
  }
}

@Injectable()
export class UnservedFamilyRepository implements FamilyRepository {
  list(): Observable<never> {
    return unserved('families and relationships');
  }

  getById(): Observable<never> {
    return unserved('families and relationships');
  }

  familiesOf(): Observable<never> {
    return unserved('families and relationships');
  }

  recordRelationship(): Observable<never> {
    return unserved('families and relationships');
  }

  endRelationship(): Observable<never> {
    return unserved('families and relationships');
  }

  transferResident(): Observable<never> {
    return unserved('families and relationships');
  }

  changeMemberRole(): Observable<never> {
    return unserved('families and relationships');
  }

  historyForResident(): Observable<never> {
    return unserved('families and relationships');
  }
}

@Injectable()
export class UnservedCaseRepository implements CaseRepository {
  list(): Observable<never> {
    return unserved('cases');
  }

  queueCounts(): Observable<never> {
    return unserved('cases');
  }

  getById(): Observable<never> {
    return unserved('cases');
  }

  casesForResident(): Observable<never> {
    return unserved('cases');
  }

  changeStatus(): Observable<never> {
    return unserved('cases');
  }

  assign(): Observable<never> {
    return unserved('cases');
  }

  addNote(): Observable<never> {
    return unserved('cases');
  }

  addTask(): Observable<never> {
    return unserved('cases');
  }

  completeTask(): Observable<never> {
    return unserved('cases');
  }

  assignTask(): Observable<never> {
    return unserved('cases');
  }

  rescheduleTask(): Observable<never> {
    return unserved('cases');
  }
}

@Injectable()
export class UnservedSavedViewRepository implements SavedViewRepository {
  listFor(): Observable<never> {
    return unserved('saved views');
  }

  create(): Observable<never> {
    return unserved('saved views');
  }

  remove(): Observable<never> {
    return unserved('saved views');
  }
}

@Injectable()
export class UnservedProgramRepository implements ProgramRepository {
  list(): Observable<never> {
    return unserved('programmes');
  }

  getById(): Observable<never> {
    return unserved('programmes');
  }

  listActive(): Observable<never> {
    return unserved('programmes');
  }

  listRequirementTemplates(): Observable<never> {
    return unserved('programmes');
  }

  save(): Observable<never> {
    return unserved('programmes');
  }

  utilizationFor(): Observable<never> {
    return unserved('programmes');
  }

  utilizationSummary(): Observable<never> {
    return unserved('programmes');
  }
}

@Injectable()
export class UnservedAssistanceRequestRepository implements AssistanceRequestRepository {
  list(): Observable<never> {
    return unserved('assistance requests');
  }

  getById(): Observable<never> {
    return unserved('assistance requests');
  }

  listNotes(): Observable<never> {
    return unserved('assistance requests');
  }

  changeStatus(): Observable<never> {
    return unserved('assistance requests');
  }

  advisoryFor(): Observable<never> {
    return unserved('assistance requests');
  }

  advisoryForCase(): Observable<never> {
    return unserved('assistance requests');
  }

  saveDraft(): Observable<never> {
    return unserved('assistance requests');
  }

  submitIntake(): Observable<never> {
    return unserved('assistance requests');
  }

  listAssessmentTemplates(): Observable<never> {
    return unserved('assistance requests');
  }

  openAssessment(): Observable<never> {
    return unserved('assistance requests');
  }

  answerAssessment(): Observable<never> {
    return unserved('assistance requests');
  }

  recordAssessment(): Observable<never> {
    return unserved('assistance requests');
  }

  reviewRequirement(): Observable<never> {
    return unserved('assistance requests');
  }

  recordDocument(): Observable<never> {
    return unserved('assistance requests');
  }

  decideApplicability(): Observable<never> {
    return unserved('assistance requests');
  }

  requestDocument(): Observable<never> {
    return unserved('assistance requests');
  }

  listDocumentRequests(): Observable<never> {
    return unserved('assistance requests');
  }

  withdrawDocumentRequest(): Observable<never> {
    return unserved('assistance requests');
  }

  openDocument(): Observable<never> {
    return unserved('assistance requests');
  }
}

@Injectable()
export class UnservedBeneficiaryRepository implements BeneficiaryRepository {
  list(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  getByResidentId(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  duplicateQueue(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  duplicatesFor(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  previewResolution(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  detectDuplicates(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  resolveIdentity(): Observable<never> {
    return unserved('the beneficiary registry');
  }

  resolutionsFor(): Observable<never> {
    return unserved('the beneficiary registry');
  }
}

@Injectable()
export class UnservedFieldVisitRepository implements FieldVisitRepository {
  list(): Observable<never> {
    return unserved('field visits');
  }

  getById(): Observable<never> {
    return unserved('field visits');
  }

  mine(): Observable<never> {
    return unserved('field visits');
  }

  forResident(): Observable<never> {
    return unserved('field visits');
  }

  schedule(): Observable<never> {
    return unserved('field visits');
  }

  recordObservations(): Observable<never> {
    return unserved('field visits');
  }

  setChecklist(): Observable<never> {
    return unserved('field visits');
  }

  close(): Observable<never> {
    return unserved('field visits');
  }
}

@Injectable()
export class UnservedReleaseRepository implements ReleaseRepository {
  list(): Observable<never> {
    return unserved('releases and payouts');
  }

  getById(): Observable<never> {
    return unserved('releases and payouts');
  }

  listForRequest(): Observable<never> {
    return unserved('releases and payouts');
  }

  queue(): Observable<never> {
    return unserved('releases and payouts');
  }

  approverFor(): Observable<never> {
    return unserved('releases and payouts');
  }

  listBatches(): Observable<never> {
    return unserved('releases and payouts');
  }

  getBatch(): Observable<never> {
    return unserved('releases and payouts');
  }

  createBatch(): Observable<never> {
    return unserved('releases and payouts');
  }

  manifestFor(): Observable<never> {
    return unserved('releases and payouts');
  }

  markReleased(): Observable<never> {
    return unserved('releases and payouts');
  }

  acknowledge(): Observable<never> {
    return unserved('releases and payouts');
  }

  deferRelease(): Observable<never> {
    return unserved('releases and payouts');
  }

  changeStatus(): Observable<never> {
    return unserved('releases and payouts');
  }
}

@Injectable()
export class UnservedReferralRepository implements ReferralRepository {
  list(): Observable<never> {
    return unserved('referrals');
  }

  getById(): Observable<never> {
    return unserved('referrals');
  }

  forResident(): Observable<never> {
    return unserved('referrals');
  }

  queue(): Observable<never> {
    return unserved('referrals');
  }

  createDraft(): Observable<never> {
    return unserved('referrals');
  }

  recordDisclosureBasis(): Observable<never> {
    return unserved('referrals');
  }

  shareField(): Observable<never> {
    return unserved('referrals');
  }

  send(): Observable<never> {
    return unserved('referrals');
  }

  summaryFor(): Observable<never> {
    return unserved('referrals');
  }

  changeStatus(): Observable<never> {
    return unserved('referrals');
  }

  recordOutcome(): Observable<never> {
    return unserved('referrals');
  }

  reschedule(): Observable<never> {
    return unserved('referrals');
  }

  addNote(): Observable<never> {
    return unserved('referrals');
  }

  listProviders(): Observable<never> {
    return unserved('referrals');
  }

  getProvider(): Observable<never> {
    return unserved('referrals');
  }
}

@Injectable()
export class UnservedWorkRepository implements WorkRepository {
  myQueue(): Observable<never> {
    return unserved('work queues');
  }

  teamQueue(): Observable<never> {
    return unserved('work queues');
  }

  alerts(): Observable<never> {
    return unserved('work queues');
  }
}

@Injectable()
export class UnservedReportRepository implements ReportRepository {
  catalogue(): Observable<never> {
    return unserved('reports');
  }

  run(): Observable<never> {
    return unserved('reports');
  }

  export(): Observable<never> {
    return unserved('reports');
  }
}

@Injectable()
export class UnservedSearchRepository implements SearchRepository {
  search(): Observable<never> {
    return unserved('search');
  }
}

@Injectable()
export class UnservedGovernanceRepository implements GovernanceRepository {
  accounts(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  accountById(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  setAccountActive(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  auditRows(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  auditDetail(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  classifications(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  retention(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }

  corrections(): Observable<never> {
    return unserved('staff accounts, the audit trail and privacy governance');
  }
}

@Injectable()
export class UnservedNewsfeedRepository implements NewsfeedRepository {
  list(): Observable<never> {
    return unserved('the newsfeed');
  }

  getById(): Observable<never> {
    return unserved('the newsfeed');
  }

  saveDraft(): Observable<never> {
    return unserved('the newsfeed');
  }

  publish(): Observable<never> {
    return unserved('the newsfeed');
  }

  schedule(): Observable<never> {
    return unserved('the newsfeed');
  }

  archive(): Observable<never> {
    return unserved('the newsfeed');
  }

  setPinned(): Observable<never> {
    return unserved('the newsfeed');
  }

  setCommentsEnabled(): Observable<never> {
    return unserved('the newsfeed');
  }

  comments(): Observable<never> {
    return unserved('the newsfeed');
  }

  moderate(): Observable<never> {
    return unserved('the newsfeed');
  }

  history(): Observable<never> {
    return unserved('the newsfeed');
  }
}

@Injectable()
export class UnservedEventRepository implements EventRepository {
  list(): Observable<never> {
    return unserved('events');
  }

  getById(): Observable<never> {
    return unserved('events');
  }

  saveDraft(): Observable<never> {
    return unserved('events');
  }

  publish(): Observable<never> {
    return unserved('events');
  }

  cancel(): Observable<never> {
    return unserved('events');
  }

  complete(): Observable<never> {
    return unserved('events');
  }

  archive(): Observable<never> {
    return unserved('events');
  }

  registrants(): Observable<never> {
    return unserved('events');
  }

  capacity(): Observable<never> {
    return unserved('events');
  }

  metrics(): Observable<never> {
    return unserved('events');
  }

  actOnRegistration(): Observable<never> {
    return unserved('events');
  }

  markAttendance(): Observable<never> {
    return unserved('events');
  }

  exportRegistrants(): Observable<never> {
    return unserved('events');
  }

  history(): Observable<never> {
    return unserved('events');
  }
}

@Injectable()
export class UnservedDashboardRepository implements DashboardRepository {
  summary(): Observable<never> {
    return unserved('the dashboard');
  }
}
