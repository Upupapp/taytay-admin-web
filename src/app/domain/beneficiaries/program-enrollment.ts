import type { AuditStamp } from '../shared/audit';
import type {
  IsoDate,
  IsoDateTime,
  ProgramEnrollmentId,
  ProgramId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * Standing membership of a continuing programme.
 *
 * Distinct from an assistance request, and the distinction is the point. A
 * request is one intervention with a beginning and an end; an enrollment is a
 * continuing relationship that produces interventions over years. A senior
 * citizen on the monthly pension list is enrolled once and paid many times.
 *
 * Not every programme has enrollment. One-off crisis assistance does not: the
 * request *is* the whole relationship. `AssistanceProgram.category` decides,
 * and the catalog says so rather than this module guessing.
 */

export type EnrollmentStatus = 'active' | 'suspended' | 'exited';

export const ENROLLMENT_STATUS_CATALOG: StatusCatalog<EnrollmentStatus> = {
  active: {
    value: 'active',
    label: 'Enrolled',
    tone: 'success',
    description: 'Currently on the programme list.',
  },
  suspended: {
    value: 'suspended',
    label: 'Suspended',
    tone: 'warning',
    description: 'Temporarily held — membership stands, but nothing is being issued.',
  },
  exited: {
    value: 'exited',
    label: 'Exited',
    tone: 'neutral',
    description: 'No longer on the programme. The record of having been on it remains.',
  },
};

/**
 * `exited` is terminal, on the same reasoning as case closure (`DL-53`): the
 * exit states what the office concluded and when. Somebody who comes back is
 * enrolled afresh, and the new enrollment names the old one through
 * `continuesEnrollmentId` — so "how long were they on it?" keeps one answer.
 */
export const ENROLLMENT_STATUS_TRANSITIONS: StatusTransitions<EnrollmentStatus> = {
  active: ['suspended', 'exited'],
  suspended: ['active', 'exited'],
  exited: [],
};

/**
 * Why somebody left. Recorded because the reasons are not interchangeable:
 * ageing out of a youth programme and being removed for a false declaration are
 * different facts about a person, and only one of them should ever colour how
 * the next application is read.
 */
export type EnrollmentExitReason =
  | 'completed'
  | 'no-longer-qualified'
  | 'moved-out'
  | 'withdrew'
  | 'deceased'
  | 'programme-ended'
  | 'removed-for-cause';

export const ENROLLMENT_EXIT_REASON_LABELS: Readonly<Record<EnrollmentExitReason, string>> = {
  completed: 'Completed the programme',
  'no-longer-qualified': 'No longer meets the programme conditions',
  'moved-out': 'Moved out of Taytay',
  withdrew: 'Withdrew voluntarily',
  deceased: 'Deceased',
  'programme-ended': 'Programme closed',
  'removed-for-cause': 'Removed for cause',
};

export interface EnrollmentExit {
  readonly reason: EnrollmentExitReason;
  readonly exitedOn: IsoDate;
  readonly recordedBy: StaffUserId;
  /** Required. An exit nobody had to explain is an exit nobody can review. */
  readonly note: string;
}

export interface ProgramEnrollment {
  readonly id: ProgramEnrollmentId;
  readonly residentId: ResidentId;
  readonly programId: ProgramId;
  readonly programName: string;
  readonly status: EnrollmentStatus;
  readonly enrolledOn: IsoDate;
  /** Set exactly when `status` is `exited`; `null` otherwise. */
  readonly exit: EnrollmentExit | null;
  /** The earlier enrollment this one resumes, if the person returned. */
  readonly continuesEnrollmentId: ProgramEnrollmentId | null;
  readonly audit: AuditStamp;
}

export function isCurrentEnrollment(enrollment: ProgramEnrollment): boolean {
  return enrollment.status !== 'exited';
}

/**
 * An enrollment record is internally consistent when its exit and its status
 * agree. Asserted rather than assumed: a screen that trusts `status` and a
 * report that trusts `exit` must never be able to disagree about whether
 * somebody is on a programme.
 */
export function enrollmentProblems(enrollment: ProgramEnrollment): readonly string[] {
  const problems: string[] = [];

  if (enrollment.status === 'exited' && enrollment.exit === null) {
    problems.push('exited-without-exit-record');
  }
  if (enrollment.status !== 'exited' && enrollment.exit !== null) {
    problems.push('exit-record-on-a-standing-enrollment');
  }
  if (enrollment.exit !== null && enrollment.exit.note.trim().length === 0) {
    problems.push('exit-without-a-note');
  }
  if (enrollment.exit !== null && enrollment.exit.exitedOn < enrollment.enrolledOn) {
    problems.push('exit-before-enrollment');
  }
  if (enrollment.continuesEnrollmentId === enrollment.id) {
    problems.push('enrollment-continues-itself');
  }

  return problems;
}

/** Standing enrollments first, then most recently enrolled. */
export function byEnrollmentRecency(a: ProgramEnrollment, b: ProgramEnrollment): number {
  const aCurrent = isCurrentEnrollment(a);
  const bCurrent = isCurrentEnrollment(b);
  if (aCurrent !== bCurrent) {
    return aCurrent ? -1 : 1;
  }
  return a.enrolledOn < b.enrolledOn ? 1 : a.enrolledOn > b.enrolledOn ? -1 : 0;
}

export function enrollmentTimestamp(enrollment: ProgramEnrollment): IsoDateTime {
  return enrollment.audit.updatedAt;
}
