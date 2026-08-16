import type { Permission } from '../access/permission';
import { daysUntil } from '../cases/case-task';
import { DUE_SOON_DAYS } from '../cases/social-case';
import type { IsoDate, StaffUserId } from '../shared/ids';
import type { StatusCatalog } from '../shared/status';

/**
 * Three different things, deliberately not one.
 *
 * The master command's first acceptance criterion is that a user can tell "FYI"
 * from "action required". That is a modelling problem before it is a styling
 * one, so this application keeps three separate concepts and never lets a
 * screen blur them:
 *
 *  - **A work item** is something a named person must *do*. It has somebody who
 *    owes it, a date it is owed by, and a completion.
 *  - **A notification** (`domain/notifications`) is something that *happened*.
 *    Read or unread. No due date, no completion, nobody owes it.
 *  - **An office alert** (`office-alert.ts`) is a *condition of the data* that
 *    persists until the data changes. Nobody completes it; somebody fixes the
 *    record and it goes away.
 *
 * Collapsing these is how a notification centre becomes noise: an office that
 * has to read every item to find out whether it is owed anything stops reading
 * any of them.
 */

/**
 * What kind of work this is.
 *
 * These are the task types the master command names. They are **not** a second
 * task entity — see `WorkSource` below. A work item is a normalised view of
 * something that already exists somewhere in the record model.
 */
export type WorkKind =
  | 'review-intake'
  | 'verify-household'
  | 'request-requirements'
  | 'complete-assessment'
  | 'follow-up-referral'
  | 'conduct-visit'
  | 'review-recommendation'
  | 'prepare-release'
  | 'confirm-release'
  | 'close-case'
  | 'resolve-data-quality';

export const WORK_KIND_LABELS: Readonly<Record<WorkKind, string>> = {
  'review-intake': 'Review an intake',
  'verify-household': 'Verify a resident or household',
  'request-requirements': 'Ask for missing requirements',
  'complete-assessment': 'Complete an assessment',
  'follow-up-referral': 'Follow up a referral',
  'conduct-visit': 'Conduct a field visit',
  'review-recommendation': 'Review a recommendation',
  'prepare-release': 'Prepare a release',
  'confirm-release': 'Confirm a release',
  'close-case': 'Close a case',
  'resolve-data-quality': 'Resolve a data-quality issue',
};

/**
 * Where the item actually lives.
 *
 * **There is no second task system** (`DL-55`, restated). A `case-task` item is
 * a `CaseTask` record; everything else is *derived* from the state of a request,
 * a visit, a referral, a release or a duplicate pair, and is resolved by acting
 * on that record rather than by ticking anything here.
 *
 * The distinction is load-bearing for what a user may do to an item, and the
 * screens say which is which rather than pretending they are alike.
 *
 * **A possible duplicate is deliberately not on this list** (`DL-103`). It has
 * no assignee and no date, and the first build of this module put one work item
 * on the queue per candidate pair — 182 of them on a social worker's list,
 * burying seven genuinely late items. A duplicate pair is a *condition of the
 * data*, which is what `OfficeAlert` is for, and it appears there as one line
 * with a count. `resolve-data-quality` survives as a `WorkKind` because a
 * person can still raise a case task to deal with one.
 */
export type WorkSource =
  | 'case-task'
  | 'assistance-request'
  | 'field-visit'
  | 'referral'
  | 'release';

export const WORK_SOURCE_LABELS: Readonly<Record<WorkSource, string>> = {
  'case-task': 'Task',
  'assistance-request': 'Assistance request',
  'field-visit': 'Field visit',
  referral: 'Referral',
  release: 'Release',
};

/**
 * How much it matters.
 *
 * Three levels, and the highest is spent sparingly: the master command asks for
 * high-urgency styling **only** on genuinely urgent items, because an office
 * where everything is urgent reads nothing as urgent.
 */
export type WorkPriority = 'routine' | 'important' | 'urgent';

export const WORK_PRIORITY_CATALOG: StatusCatalog<WorkPriority> = {
  routine: {
    value: 'routine',
    label: 'Routine',
    tone: 'neutral',
    description: 'Ordinary casework. Do it in turn.',
  },
  important: {
    value: 'important',
    label: 'Important',
    tone: 'info',
    description: 'Somebody is waiting on this, but nothing fails today.',
  },
  urgent: {
    value: 'urgent',
    label: 'Urgent',
    tone: 'danger',
    description: 'A person goes without, or a protection concern waits, if this slips.',
  },
};

/**
 * When it is owed, relative to today.
 *
 * **Derived, never stored.** A stored `isOverdue` needs a nightly job to stay
 * true and is wrong every morning until it runs (`DL-83`, `DL-88`).
 */
export type WorkUrgency = 'overdue' | 'due-today' | 'due-soon' | 'later' | 'undated';

export const WORK_URGENCY_LABELS: Readonly<Record<WorkUrgency, string>> = {
  overdue: 'Late',
  'due-today': 'Due today',
  'due-soon': 'Due this week',
  later: 'Later',
  undated: 'No date set',
};

/**
 * What a work item points at, so a screen can deep-link without knowing the
 * shape of every module.
 */
export interface WorkLink {
  /** Router segments. The queue navigates; the domain never does. */
  readonly routerLink: readonly string[];
  /** What the link opens, in words, for the preview line. */
  readonly label: string;
}

export interface WorkItem {
  /**
   * `source:sourceId`. Composed rather than stored, because the item itself is
   * not a record — the thing it points at is.
   */
  readonly id: string;
  readonly source: WorkSource;
  readonly sourceId: string;
  readonly kind: WorkKind;
  readonly priority: WorkPriority;
  readonly title: string;
  /**
   * Who it concerns, already disclosed for the reading user (`DL-38`).
   * `null` when the item is not about one person.
   */
  readonly subject: string | null;
  /** One line of context, so the queue does not need to be left to triage it. */
  readonly preview: string | null;
  /**
   * The date this is owed by, where one exists.
   *
   * `null` for most derived items, and that is not an omission. A case task and
   * a scheduled visit have real dates because a person set one. An assistance
   * request sitting in assessment has **no deadline**, because the LGU supplied
   * no service standards and inventing "five working days" would be fabricating
   * policy the office never adopted (`DL-101`, same line as `DL-89`).
   */
  readonly dueOn: IsoDate | null;
  /**
   * When the clock started — filed, sent, approved.
   *
   * This is what an undated item reports instead of a deadline. "Waiting 9
   * days" is a fact the office has; "3 days overdue" would be a claim about a
   * target nobody set.
   */
  readonly waitingSince: IsoDate | null;
  readonly assignedTo: StaffUserId | null;
  readonly assignedToName: string | null;
  /** What a user needs in order to act. The queue is filtered by it. */
  readonly permission: Permission;
  readonly link: WorkLink;
  /**
   * Whether this item can be assigned, rescheduled or completed.
   *
   * True only for `case-task`. Everything else is a *state of a record*: an
   * unanswered referral is not something you can snooze, it is something you
   * chase or record an answer for. Saying so is more honest than offering a
   * snooze that quietly does nothing.
   */
  readonly isManageable: boolean;
}

export function workUrgency(item: WorkItem, today: IsoDate): WorkUrgency {
  if (item.dueOn === null) {
    return 'undated';
  }
  const days = daysUntil(item.dueOn, today);
  if (days < 0) {
    return 'overdue';
  }
  if (days === 0) {
    return 'due-today';
  }
  // The case module's window, imported rather than restated. Two constants
  // meaning "due soon" is precisely how the two screens come to disagree.
  return days <= DUE_SOON_DAYS ? 'due-soon' : 'later';
}

export function isWorkOverdue(item: WorkItem, today: IsoDate): boolean {
  return workUrgency(item, today) === 'overdue';
}

/**
 * How late, in words.
 *
 * The master command asks that overdue work be obvious **without red-only
 * signalling**. Colour is not information: it fails for a colour-blind officer,
 * it fails in print, and it fails a screen reader entirely. So lateness is
 * always available as a **sentence**, and the screens render it.
 */
export function describeLateness(item: WorkItem, today: IsoDate): string | null {
  if (item.dueOn === null) {
    return null;
  }
  const days = daysUntil(item.dueOn, today);
  if (days > 1) {
    return `Due in ${days} days`;
  }
  if (days === 1) {
    return 'Due tomorrow';
  }
  if (days === 0) {
    return 'Due today';
  }
  const late = Math.abs(days);
  return late === 1 ? 'Late by 1 day' : `Late by ${late} days`;
}

/**
 * How long somebody has been waiting, in words.
 *
 * Reported for items with no due date, so an undated queue is still ordered by
 * something real. It never says "late": nothing can be late against a target
 * that was never set.
 */
export function describeWaiting(item: WorkItem, today: IsoDate): string | null {
  if (item.waitingSince === null) {
    return null;
  }
  const days = Math.abs(daysUntil(item.waitingSince, today));
  if (days === 0) {
    return 'Since today';
  }
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`;
}

const URGENCY_ORDER: Readonly<Record<WorkUrgency, number>> = {
  overdue: 0,
  'due-today': 1,
  'due-soon': 2,
  later: 3,
  undated: 4,
};

const PRIORITY_ORDER: Readonly<Record<WorkPriority, number>> = {
  urgent: 0,
  important: 1,
  routine: 2,
};

/**
 * Late first, then by priority, then by date, then by identifier.
 *
 * The identifier tie-break matters: two officers opening the same queue in the
 * same second are shown the same order, so "the one at the top" means one
 * thing when they talk to each other.
 */
export function compareWork(a: WorkItem, b: WorkItem, today: IsoDate): number {
  const urgency = URGENCY_ORDER[workUrgency(a, today)] - URGENCY_ORDER[workUrgency(b, today)];
  if (urgency !== 0) {
    return urgency;
  }
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priority !== 0) {
    return priority;
  }
  if (a.dueOn !== b.dueOn) {
    if (a.dueOn === null) return 1;
    if (b.dueOn === null) return -1;
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  // Both undated: whoever has waited longest comes first. Without this an
  // undated bucket is alphabetical by identifier, which is no order at all.
  if (a.waitingSince !== b.waitingSince) {
    if (a.waitingSince === null) return 1;
    if (b.waitingSince === null) return -1;
    return a.waitingSince < b.waitingSince ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}
