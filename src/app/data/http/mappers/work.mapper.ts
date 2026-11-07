import {
  ALERT_KIND_LABELS,
  ALERT_SEVERITY_CATALOG,
  PERMISSIONS,
  WORK_KIND_LABELS,
  WORK_PRIORITY_CATALOG,
  WORK_SOURCE_LABELS,
  type AlertKind,
  type AlertSeverity,
  type OfficeAlert,
  type StaffUserId,
  type WorkItem,
  type WorkKind,
  type WorkLink,
  type WorkPriority,
  type WorkQueue,
  type WorkSource,
} from '@domain/index';

import { bool, date, field, id, int, oneOf, str } from './wire';

/**
 * Work queues and office alerts, from the Node API (`DL-189`).
 *
 * | Wire                                                   | Domain                          | Absent or wrong means |
 * | ------------------------------------------------------ | ------------------------------- | --------------------- |
 * | `as_of`, `owner_id`, `owner_name`, `items[]`           | `WorkQueue`                     | the queue refused     |
 * | `items[]{source,source_id,kind,priority,title,…}`      | `WorkItem`, its link composed   | the queue refused     |
 * | `due_on` / `waiting_since`                             | a date a person set / the wait  | kept `null`           |
 * | `case_id`                                              | a task's link to its case       | the queue refused     |
 * | `[]{id,kind,severity,summary,basis,permission,count}`  | `OfficeAlert`, its link by kind | the list refused      |
 *
 * **A queue is read whole or not at all.** An item that cannot be read is not dropped: a queue one
 * row short is a late item nobody saw, and nothing on screen would say so. The same holds for the
 * alerts.
 *
 * **Only a case task is manageable** (`DL-97`), and that is the console's rule as much as the
 * server's: `isManageable` is derived from the source here, and a case task without its case is
 * refused, because the screen acts on a task through `CaseRepository` and needs the case to do it.
 *
 * The router links are composed here, from the source and its id: the server names records, the
 * console decides where they are opened.
 */

const WORK_KINDS = Object.keys(WORK_KIND_LABELS) as WorkKind[];
const WORK_SOURCES = Object.keys(WORK_SOURCE_LABELS) as WorkSource[];
const WORK_PRIORITIES = Object.keys(WORK_PRIORITY_CATALOG) as WorkPriority[];
const ALERT_KINDS = Object.keys(ALERT_KIND_LABELS) as AlertKind[];
const ALERT_SEVERITIES = Object.keys(ALERT_SEVERITY_CATALOG) as AlertSeverity[];

/** Where each source's record is opened, in the mock adapter's words. A task opens its case. */
const SOURCE_LINKS: Readonly<
  Record<WorkSource, { readonly path: string; readonly label: string }>
> = {
  'case-task': { path: '/cases', label: 'Open the case' },
  'assistance-request': { path: '/assistance-requests', label: 'Open the request' },
  'field-visit': { path: '/visits', label: 'Open the visit' },
  referral: { path: '/referrals', label: 'Open the referral' },
  release: { path: '/releases', label: 'Open the release' },
};

/** Where each alert is fixed: the list it concerns, never a button that clears it. */
const ALERT_LINKS: Readonly<Record<AlertKind, WorkLink>> = {
  'possible-duplicate': {
    routerLink: ['/beneficiaries', 'duplicates'],
    label: 'Open the review queue',
  },
  'missing-requirement': {
    routerLink: ['/assistance-requests'],
    label: 'Open assistance requests',
  },
  'unscheduled-approval': { routerLink: ['/releases'], label: 'Open the release queue' },
  'voucher-mismatch': { routerLink: ['/releases'], label: 'Open the release queue' },
  'stalled-request': { routerLink: ['/assistance-requests'], label: 'Open assistance requests' },
  'unanswered-referral': { routerLink: ['/referrals'], label: 'Open referrals' },
};

/** Every element mapped, or `null` when any one of them could not be. */
function whole<T>(value: unknown, map: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const mapped: T[] = [];
  for (const raw of value) {
    const item = map(raw);
    if (item === null) {
      return null;
    }
    mapped.push(item);
  }
  return mapped;
}

/** One work item, or `null` when it cannot be read. */
function toWorkItem(wire: unknown): WorkItem | null {
  const source = oneOf(field(wire, 'source'), WORK_SOURCES);
  const sourceId = str(field(wire, 'source_id'));
  const kind = oneOf(field(wire, 'kind'), WORK_KINDS);
  const priority = oneOf(field(wire, 'priority'), WORK_PRIORITIES);
  const title = str(field(wire, 'title'));
  const permission = oneOf(field(wire, 'permission'), PERMISSIONS);
  if (
    source === null ||
    sourceId === null ||
    kind === null ||
    priority === null ||
    title === null ||
    permission === null
  ) {
    return null;
  }
  const caseId = str(field(wire, 'case_id'));
  // A task is acted on through its case: without the case there is nothing the screen could do.
  if (source === 'case-task' && caseId === null) {
    return null;
  }
  const target = SOURCE_LINKS[source];
  return {
    id: `${source}:${sourceId}`,
    source,
    sourceId,
    kind,
    priority,
    title,
    subject: str(field(wire, 'subject')),
    preview: str(field(wire, 'preview')),
    // A date somebody set, or none — never a deadline invented for an undated request (`DL-101`).
    dueOn: date(field(wire, 'due_on')),
    waitingSince: date(field(wire, 'waiting_since')),
    assignedTo: id<StaffUserId>(field(wire, 'assigned_to')),
    assignedToName: str(field(wire, 'assigned_to_name')),
    permission,
    link: {
      routerLink: [target.path, source === 'case-task' && caseId !== null ? caseId : sourceId],
      label: target.label,
    },
    isManageable: source === 'case-task' && bool(field(wire, 'is_manageable')),
  };
}

/**
 * `GET office/work/mine` → `WorkQueue`, or `null` when any item cannot be read.
 *
 * @consumes GET office/work/mine
 */
export function toWorkQueue(wire: unknown): WorkQueue | null {
  const asOf = date(field(wire, 'as_of'));
  const ownerId = id<StaffUserId>(field(wire, 'owner_id'));
  const items = whole(field(wire, 'items'), toWorkItem);
  if (asOf === null || ownerId === null || items === null) {
    return null;
  }
  return { ownerId, ownerName: str(field(wire, 'owner_name')), items, asOf };
}

/**
 * `GET office/work/team` → every item the reader could act on, for `buildTeamQueue` to group by
 * person; `null` when any item cannot be read.
 *
 * @consumes GET office/work/team
 */
export function toTeamWork(
  wire: unknown,
): { asOf: WorkQueue['asOf']; items: readonly WorkItem[] } | null {
  const asOf = date(field(wire, 'as_of'));
  const items = whole(field(wire, 'items'), toWorkItem);
  if (asOf === null || items === null) {
    return null;
  }
  return { asOf, items };
}

/**
 * One alert of `GET office/work/alerts`, or `null` when it cannot be read.
 *
 * @consumes GET office/work/alerts
 */
export function toOfficeAlert(wire: unknown): OfficeAlert | null {
  const alertId = str(field(wire, 'id'));
  const kind = oneOf(field(wire, 'kind'), ALERT_KINDS);
  const severity = oneOf(field(wire, 'severity'), ALERT_SEVERITIES);
  const summary = str(field(wire, 'summary'));
  const basis = str(field(wire, 'basis'));
  const permission = oneOf(field(wire, 'permission'), PERMISSIONS);
  const count = int(field(wire, 'count'));
  // An alert that cannot say what rule produced it is one an office learns to dismiss (`DL-98`).
  if (
    alertId === null ||
    kind === null ||
    severity === null ||
    summary === null ||
    basis === null ||
    permission === null ||
    count === null
  ) {
    return null;
  }
  if (basis.trim() === '') {
    return null;
  }
  return {
    id: alertId,
    kind,
    severity,
    summary,
    basis,
    permission,
    link: ALERT_LINKS[kind],
    detectedFrom: count,
  };
}

/** The alert list read whole, or `null` when any alert in it cannot be read. */
export function toOfficeAlerts(rows: readonly unknown[]): readonly OfficeAlert[] | null {
  return whole(rows, toOfficeAlert);
}
