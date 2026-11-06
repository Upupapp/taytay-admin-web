import type { AssistanceRequest } from '../assistance/assistance-request';
import type { FamilySummary } from '../families/family-graph';
import type { HouseholdSummary } from '../households/household-profile';
import type { VulnerabilitySnapshot } from '../households/household-vulnerability';
import type { ResidentView } from '../residents/resident-disclosure';
import type { IsoDateTime } from '../shared/ids';
import type { CaseTimelineEntry } from './case-event';
import type { CaseNoteView } from './case-note';
import type { CaseTask } from './case-task';
import type { CaseQueueFacts, SocialCase } from './social-case';

/**
 * A case as it appears in a list or a queue.
 *
 * Carries the next action and how late it is, because a work queue whose rows
 * do not say what is owed is a list of links, not a queue.
 */
export interface CaseSummary {
  readonly record: SocialCase;
  /** Already disclosed — a protected subject is masked here as everywhere else. */
  readonly subject: ResidentView;
  readonly assignedToName: string | null;
  readonly openTaskCount: number;
  readonly nextAction: CaseTask | null;
  readonly facts: CaseQueueFacts;
  readonly lastActivityAt: IsoDateTime | null;
  readonly openRequestCount: number;
}

/**
 * Everything a caseworker needs to act, in one read.
 *
 * The first acceptance criterion of TAB 10 is that a caseworker can understand
 * the context and the next action **without opening multiple modules**. That is
 * a property of this type: the person, the address, the family, the money, the
 * running record and the next task arrive together, read from one moment, so
 * the screen cannot show a household that has since moved beside a plan that
 * assumed it had not.
 */
export interface CaseWorkspace {
  readonly record: SocialCase;
  readonly subject: ResidentView;
  /**
   * Where they live, and why the household looks exposed. Advisory only (`DL-42`). `null` both
   * when there is no household and when it is withheld — `householdContextWithheld` tells the two
   * apart, and a screen must never say "no household" for the second.
   */
  readonly household: HouseholdSummary | null;
  readonly vulnerability: VulnerabilitySnapshot | null;
  /**
   * The families the subject belongs to today. A household is not a family (`DL-47`), and a person
   * may be in more than one. Empty when withheld, as the household is.
   */
  readonly families: readonly FamilySummary[];
  readonly householdMembers: readonly ResidentView[];
  /**
   * The household and families could not be read beside the case. Said on screen, so a failed read
   * is never shown as "no household" or "no family".
   */
  readonly householdContextUnread: boolean;
  /**
   * The linked requests this reader may read, as the request's own scope admits them (`DL-179`).
   * `record.linkedRequestIds` names every one; `unreadLinkedRequestCount` says how many are not
   * shown, so a short list is never read as the whole of it.
   */
  readonly requests: readonly AssistanceRequest[];
  readonly notes: readonly CaseNoteView[];
  readonly tasks: readonly CaseTask[];
  /** Case events and request moves, merged and newest first. */
  readonly timeline: readonly CaseTimelineEntry[];
  readonly nextAction: CaseTask | null;
  readonly assignedToName: string | null;
}

/**
 * The subject's household and family are not named to this reader (`DL-179`): an account that works
 * only its assigned cases is admitted to the case, not to the registry around it.
 */
export function householdContextWithheld(workspace: {
  readonly record: Pick<SocialCase, 'withheld'>;
}): boolean {
  return workspace.record.withheld.includes('householdContext');
}

/** How many requests the case names that this reader is not shown (`DL-179`). */
export function unreadLinkedRequestCount(workspace: {
  readonly record: Pick<SocialCase, 'linkedRequestIds'>;
  readonly requests: readonly Pick<AssistanceRequest, 'id'>[];
}): number {
  const shown = new Set<string>(workspace.requests.map((request) => request.id));
  return workspace.record.linkedRequestIds.filter((id) => !shown.has(id)).length;
}
