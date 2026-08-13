/**
 * Visual tone vocabulary shared by every status in the system. Features never
 * pick colours; they declare a tone and the `StatusBadge` primitive renders it.
 */
export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

export interface StatusDescriptor<TStatus extends string> {
  readonly value: TStatus;
  readonly label: string;
  readonly tone: StatusTone;
  /** Plain-language explanation surfaced in tooltips and audit views. */
  readonly description: string;
}

export type StatusCatalog<TStatus extends string> = Readonly<
  Record<TStatus, StatusDescriptor<TStatus>>
>;

/** A workflow's legal moves: `transitions[current]` lists the reachable states. */
export type StatusTransitions<TStatus extends string> = Readonly<
  Record<TStatus, readonly TStatus[]>
>;

export function describeStatus<TStatus extends string>(
  catalog: StatusCatalog<TStatus>,
  status: TStatus,
): StatusDescriptor<TStatus> {
  return catalog[status];
}

export function canTransition<TStatus extends string>(
  transitions: StatusTransitions<TStatus>,
  from: TStatus,
  to: TStatus,
): boolean {
  return transitions[from].includes(to);
}

export function nextStatuses<TStatus extends string>(
  transitions: StatusTransitions<TStatus>,
  from: TStatus,
): readonly TStatus[] {
  return transitions[from];
}
