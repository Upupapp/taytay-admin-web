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
  /** Where they live, and why the household looks exposed. Advisory only (`DL-42`). */
  readonly household: HouseholdSummary | null;
  readonly vulnerability: VulnerabilitySnapshot | null;
  /** Who they belong to. A household is not a family (`DL-47`). */
  readonly family: FamilySummary | null;
  readonly householdMembers: readonly ResidentView[];
  /** Interventions attached to this case, newest first. */
  readonly requests: readonly AssistanceRequest[];
  readonly notes: readonly CaseNoteView[];
  readonly tasks: readonly CaseTask[];
  /** Case events and request moves, merged and newest first. */
  readonly timeline: readonly CaseTimelineEntry[];
  readonly nextAction: CaseTask | null;
  readonly assignedToName: string | null;
}
