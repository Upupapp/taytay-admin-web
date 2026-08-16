import type { AuditAction, AuditEntry } from '../shared/audit';
import type { AuditEntryId, IsoDate, IsoDateTime, StaffUserId } from '../shared/ids';
import type { DataClassification } from './data-classification';

/**
 * The audit trail, split in two on purpose.
 *
 * The master command asks for a searchable event stream with actor, action,
 * entity, a before/after summary, timestamp and source — and, in the same
 * breath, that generic list rows must not dump full sensitive record values.
 *
 * Those two asks pull against each other unless the split is **structural**.
 * A rendering rule ("do not show values in the list") lasts until the first
 * person who wants to see what changed without clicking through. So the values
 * are not on the row at all:
 *
 *  - **`AuditEntry`** — the row. Actor, action, entity, a summary *in words*,
 *    a timestamp, a source. It says **which fields changed** and how sensitive
 *    they are. It carries no old value and no new value.
 *  - **`AuditEntryDetail`** — fetched separately, by id, behind
 *    `audit.view-detail`. This is where before and after live.
 *
 * The failure this prevents is specific and ugly. An audit list is the one
 * screen designed to be scrolled, filtered and exported by someone reviewing
 * *other people's* work. A row reading `monthlyIncome: 3,200 → 18,000` on
 * Rosalinda Peña discloses her income to every auditor who filters by date —
 * and it does so in the name of accountability, which is what makes it hard to
 * argue with afterwards (`DL-114`).
 */

/** Where the action came from, for the "source/context" the master command asks for. */
export type AuditSource = 'web' | 'api' | 'system';

export const AUDIT_SOURCE_LABELS: Readonly<Record<AuditSource, string>> = {
  web: 'Staff console',
  api: 'API',
  system: 'Automatic',
};

export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  created: 'Created',
  updated: 'Updated',
  'status-changed': 'Status changed',
  viewed: 'Opened',
  exported: 'Exported',
  deleted: 'Removed',
  'membership-changed': 'Membership changed',
  'factor-corrected': 'Indicator corrected',
  // Newsfeed and Events. Worded like the rest: what a person did, in the words
  // an officer reading the trail would use.
  published: 'Published',
  scheduled: 'Scheduled',
  archived: 'Archived',
  pinned: 'Pinned',
  unpinned: 'Unpinned',
  'comment-hidden': 'Comment hidden',
  'comment-restored': 'Comment restored',
  'comment-replied': 'Replied to a comment',
  cancelled: 'Cancelled',
  'registration-changed': 'Registration changed',
  'attendance-changed': 'Attendance changed',
};

/**
 * A field that changed, **named but not quoted**.
 *
 * This is what lets a row say "monthly income and contact number changed"
 * without saying what they changed to. The classification travels with the
 * field name so a reviewer can see at a glance that something sensitive moved,
 * which is the thing an audit list is genuinely for.
 */
export interface AuditFieldChange {
  readonly field: string;
  readonly label: string;
  readonly classification: DataClassification;
}

/** One row of the stream. No values, by construction. */
export interface AuditRow {
  readonly id: AuditEntryId;
  readonly entityType: string;
  readonly entityLabel: string;
  readonly entityId: string;
  readonly action: AuditAction;
  /** What happened, in words. Never a value. */
  readonly summary: string;
  readonly reason: string | null;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
  readonly source: AuditSource;
  /** Which fields moved, and how sensitive each is. */
  readonly changedFields: readonly AuditFieldChange[];
  /** True when any changed field is sensitive personal information. */
  readonly touchesSensitive: boolean;
  /** True when there is a detail record to open, for a reader who may. */
  readonly hasDetail: boolean;
}

/**
 * Before and after, for one entry.
 *
 * Fetched by id, gated by `audit.view-detail`, and never included in a list
 * response. A caller cannot ask `list()` to inline these.
 */
export interface AuditValueChange {
  readonly field: string;
  readonly label: string;
  readonly classification: DataClassification;
  readonly before: string | null;
  readonly after: string | null;
}

export interface AuditEntryDetail {
  readonly id: AuditEntryId;
  readonly changes: readonly AuditValueChange[];
  /** Why the reader is allowed to see this, restated where they see it. */
  readonly accessRationale: string;
}

export const AUDIT_DETAIL_RATIONALE =
  'You are seeing the recorded values because your account holds the audit detail permission. ' +
  'This view is itself auditable, and opening it is recorded against your name.';

/* ── Filtering ────────────────────────────────────────────────────────────── */

export interface AuditFilter {
  readonly search?: string;
  readonly actorId?: StaffUserId;
  readonly action?: AuditAction;
  readonly entityType?: string;
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  /** Narrow to entries that moved sensitive personal information. */
  readonly sensitiveOnly?: boolean;
}

export const EMPTY_AUDIT_FILTER: AuditFilter = {};

export function isAuditFilterActive(filter: AuditFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.actorId !== undefined ||
    filter.action !== undefined ||
    filter.entityType !== undefined ||
    filter.from !== undefined ||
    filter.to !== undefined ||
    filter.sensitiveOnly === true
  );
}

/**
 * The filter in words, for the heading above the stream.
 *
 * Same reasoning as a report's applied filter (`DL-106`): a list of events
 * that does not say what it covers reads as covering everything, and an
 * auditor will conclude an action never happened.
 */
export function describeAuditFilter(filter: AuditFilter, actorName?: string): string {
  const parts: string[] = [];
  if (filter.from !== undefined || filter.to !== undefined) {
    parts.push(`${filter.from ?? 'the beginning'} to ${filter.to ?? 'now'}`);
  }
  if (filter.actorId !== undefined) {
    parts.push(`by ${actorName ?? filter.actorId}`);
  }
  if (filter.action !== undefined) {
    parts.push(AUDIT_ACTION_LABELS[filter.action].toLowerCase());
  }
  if (filter.entityType !== undefined) {
    parts.push(`on ${filter.entityType}`);
  }
  if (filter.sensitiveOnly === true) {
    parts.push('touching sensitive information');
  }
  return parts.length === 0 ? 'Everything recorded' : `Showing ${parts.join(', ')}`;
}

/**
 * Turns a stored entry into a row.
 *
 * The one place the conversion happens, so a screen cannot build a row with a
 * value on it: there is no parameter here that could carry one.
 */
export function toAuditRow(
  entry: AuditEntry,
  entityLabel: string,
  source: AuditSource,
  changedFields: readonly AuditFieldChange[],
  hasDetail: boolean,
): AuditRow {
  return {
    id: entry.id,
    entityType: entry.entityType,
    entityLabel,
    entityId: entry.entityId,
    action: entry.action,
    summary: entry.summary,
    reason: entry.reason,
    actorId: entry.actorId,
    actorName: entry.actorName,
    occurredAt: entry.occurredAt,
    source,
    changedFields,
    touchesSensitive: changedFields.some(
      (change) => change.classification === 'sensitive-personal',
    ),
    hasDetail,
  };
}

/** What the stream amounts to, in counts. Never a verdict (`DL-90` restated). */
export function describeAuditRows(rows: readonly AuditRow[]): string {
  if (rows.length === 0) {
    return 'Nothing recorded under this filter.';
  }
  const sensitive = rows.filter((row) => row.touchesSensitive).length;
  const base = rows.length === 1 ? '1 event' : `${rows.length} events`;
  return sensitive === 0
    ? `${base}.`
    : `${base}, ${sensitive} touching sensitive information.`;
}
