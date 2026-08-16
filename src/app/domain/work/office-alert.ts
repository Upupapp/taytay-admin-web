import type { Permission } from '../access/permission';
import type { StatusCatalog } from '../shared/status';
import type { WorkLink } from './work-item';

/**
 * A condition of the data, not a job and not an announcement.
 *
 * The third of the three things this module keeps apart (see `work-item.ts`).
 * An alert says **something about the records is wrong or risky right now**:
 * two people who may be the same person, a release whose voucher does not match
 * the registry, an approved request nobody has scheduled.
 *
 * Nobody completes an alert. Somebody fixes the record and it stops being true.
 * That is why it has no due date, no assignee and no done state — giving it any
 * of those would turn "the data is wrong" into "somebody ticked a box", which
 * is how a data-quality problem gets closed without being fixed.
 *
 * **An alert gates nothing.** Same line as `DL-42` (vulnerability), `DL-60`
 * (intake advisories) and `DL-78` (requirement completion): it surfaces
 * evidence, states the rule it applied, and refuses nobody. This is the fifth
 * surface where a signal could quietly become a decision engine, and the
 * checker refuses a decision-shaped field on it.
 */

export type AlertKind =
  | 'possible-duplicate'
  | 'missing-requirement'
  | 'unscheduled-approval'
  | 'voucher-mismatch'
  | 'stalled-request'
  | 'unanswered-referral';

export const ALERT_KIND_LABELS: Readonly<Record<AlertKind, string>> = {
  'possible-duplicate': 'Two records may be the same person',
  'missing-requirement': 'A required document is still outstanding',
  'unscheduled-approval': 'An approved request has no payout date',
  'voucher-mismatch': 'A voucher does not match the registry',
  'stalled-request': 'A request has not moved in some time',
  'unanswered-referral': 'A referral has had no answer',
};

/**
 * How loudly to say it.
 *
 * `risk` is spent sparingly and deliberately: the master command asks for
 * high-urgency styling only on genuinely urgent items, because an office where
 * everything is loud reads nothing as loud.
 */
export type AlertSeverity = 'notice' | 'attention' | 'risk';

export const ALERT_SEVERITY_CATALOG: StatusCatalog<AlertSeverity> = {
  notice: {
    value: 'notice',
    label: 'Notice',
    tone: 'neutral',
    description: 'Worth knowing. Nothing is failing.',
  },
  attention: {
    value: 'attention',
    label: 'Needs attention',
    tone: 'warning',
    description: 'A record is inconsistent or stalled and somebody should look.',
  },
  risk: {
    value: 'risk',
    label: 'Risk',
    tone: 'danger',
    description: 'A person may go without, or be paid twice, while this stands.',
  },
};

export interface OfficeAlert {
  readonly id: string;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  /** What is wrong, in a sentence a caseworker can act on. */
  readonly summary: string;
  /**
   * The rule that produced it, and what it read.
   *
   * Stated for the same reason every advisory in this system states its basis:
   * an alert nobody can check is one an office learns to dismiss.
   */
  readonly basis: string;
  readonly permission: Permission;
  readonly link: WorkLink;
  readonly detectedFrom: number;
}

const SEVERITY_ORDER: Readonly<Record<AlertSeverity, number>> = {
  risk: 0,
  attention: 1,
  notice: 2,
};

export function compareAlerts(a: OfficeAlert, b: OfficeAlert): number {
  const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  return severity !== 0 ? severity : a.id.localeCompare(b.id);
}

/**
 * What the alert list amounts to, in counts.
 *
 * Counts, never a verdict — `DL-90` again. "2 risks, 4 needing attention" tells
 * an office head where to look; "data quality: poor" tells them nothing and
 * invites them to stop reading.
 */
export function describeAlerts(alerts: readonly OfficeAlert[]): string {
  const risk = alerts.filter((alert) => alert.severity === 'risk').length;
  const attention = alerts.filter((alert) => alert.severity === 'attention').length;
  const notice = alerts.filter((alert) => alert.severity === 'notice').length;
  const parts: string[] = [];
  if (risk > 0) parts.push(`${risk} ${risk === 1 ? 'risk' : 'risks'}`);
  if (attention > 0) parts.push(`${attention} needing attention`);
  if (notice > 0) parts.push(`${notice} ${notice === 1 ? 'notice' : 'notices'}`);
  return parts.length === 0 ? 'Nothing flagged.' : `${parts.join(', ')}.`;
}
