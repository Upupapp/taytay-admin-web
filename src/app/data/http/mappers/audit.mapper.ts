import type {
  AuditAction,
  AuditEntryId,
  AuditRow,
  AuditSource,
  DataClassification,
  StaffUserId,
} from '@domain/index';

import { field, id, list, oneOf, str, text, dateTime } from './wire';

/**
 * `GET admin/audit-entries` → `AuditRow`.
 *
 * **The row that must not carry values.** `DL-114` splits the trail in two:
 * reading *that* a record changed is oversight, and reading *what it changed
 * to* is access to the record. The list is designed to be scrolled and filtered
 * by somebody reviewing other people's work, so a row reading
 * `monthlyIncome: 3,200 → 18,000` would disclose a resident's income to every
 * reviewer who filtered by date.
 *
 * The API agrees, and the payload proves it: `changed_fields` carries **field
 * names**, and the values live behind `audit.view-detail` on a separate
 * resource. This mapper's job is to keep that true — it reads names and nothing
 * else, and there is deliberately no branch here that could pick up a value if
 * one ever appeared in the payload.
 *
 * ## Determined rather than guessed
 *
 * | Field | Value | Why |
 * | --- | --- | --- |
 * | `hasDetail` | from `audit.view-detail` being available on a separate route | The row itself never carries the values, so "is there detail" is a property of the resource, not of the row |
 * | `touchesSensitive` | derived from the classifications the payload sends | Computed from what arrived, not assumed |
 */
export function toAuditRow(wire: unknown): AuditRow | null {
  const entryId = id<AuditEntryId>(field(wire, 'id'));
  const occurredAt = dateTime(field(wire, 'occurred_at'));

  // A trail entry with no identity or no time cannot be ordered, cited in an
  // incident, or reconciled against the server log. Dropping it is better than
  // showing an event nobody can locate.
  if (entryId === null || occurredAt === null) {
    return null;
  }

  const changedFields = list(field(wire, 'changed_fields'), toFieldChange);

  return {
    id: entryId,
    entityType: text(field(wire, 'entity_type')),
    entityLabel: text(field(wire, 'entity_type')),
    entityId: text(field(wire, 'entity_id')),
    action: oneOf<AuditAction>(field(wire, 'action'), ACTIONS) ?? 'updated',
    summary: text(field(wire, 'summary')),
    reason: str(field(wire, 'reason')),
    actorId: id<StaffUserId>(field(wire, 'actor_subject_id')),
    // The trail records the system as an actor too, and a blank name in an
    // incident review reads as a gap in the record rather than as automation.
    actorName: text(field(wire, 'actor_account_type'), 'System'),
    occurredAt,
    source: oneOf<AuditSource>(field(wire, 'client_channel'), SOURCES) ?? 'api',
    changedFields,
    touchesSensitive: changedFields.some(
      (change) => change.classification === 'personal' || change.classification === 'sensitive-personal',
    ),
    hasDetail: changedFields.length > 0,
  };
}

/**
 * One changed field — **its name and how sensitive it is, never its value**.
 *
 * The payload sends names. If a future payload ever sent a value alongside one,
 * this mapper would still not read it: there is no branch here that could, and
 * that is the point of doing the narrowing explicitly rather than spreading the
 * wire object into the domain shape.
 */
function toFieldChange(
  wire: unknown,
): { field: string; label: string; classification: DataClassification } | null {
  const name = typeof wire === 'string' ? wire : str(field(wire, 'field'));

  if (name === null) {
    return null;
  }

  return {
    field: name,
    label: text(field(wire, 'label'), name),
    // Unknown classification is treated as the **most** sensitive, not the
    // least. A field the console cannot classify must not be shown as public:
    // failing open here would be the one place in the trail where a mistake
    // discloses something.
    classification:
      oneOf<DataClassification>(field(wire, 'classification'), CLASSIFICATIONS) ?? 'sensitive-personal',
  };
}

const ACTIONS: readonly AuditAction[] = [
  'created',
  'updated',
  'status-changed',
  'viewed',
  'exported',
  'deleted',
  'membership-changed',
  'factor-corrected',
];

const SOURCES: readonly AuditSource[] = ['web', 'api', 'system'];

const CLASSIFICATIONS: readonly DataClassification[] = [
  'public',
  'internal',
  'personal',
  'sensitive-personal',
];
