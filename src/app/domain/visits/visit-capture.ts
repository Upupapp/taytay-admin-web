import type { FieldVisitId, IsoDateTime } from '../shared/ids';
import type { VisitObservationDraft } from './visit-observation';
import type { VisitOutcomeDraft } from './field-visit';

/**
 * A visit written up away from the office, before it has reached the server.
 *
 * Field work happens where the signal does not. A worker fills this in at a
 * kitchen table and it may be minutes or hours before it lands.
 *
 * **The state is honest about that.** The master command is explicit: do not
 * promise full offline transactional integrity without a backend strategy, and
 * never silently queue sensitive submissions without the user's knowledge. So
 * this carries an explicit `sync` state, and the screens say which one it is in
 * (`DL-87`). There is no state that means "probably saved".
 *
 * What is deliberately *not* here: any suggestion that an unsent write will be
 * retried in the background. Nothing in this application queues a submission a
 * worker cannot see. A worker who believes a visit was filed and returns to the
 * office to find it was not has been failed twice — once by the network and once
 * by the interface.
 */

export type CaptureState = 'held-locally' | 'sending' | 'sent' | 'send-failed';

export const CAPTURE_STATE_LABELS: Readonly<Record<CaptureState, string>> = {
  'held-locally': 'On this device only',
  sending: 'Sending…',
  sent: 'Saved to the office record',
  'send-failed': 'Not saved — still on this device',
};

export const CAPTURE_STATE_DESCRIPTIONS: Readonly<Record<CaptureState, string>> = {
  'held-locally':
    'Written up but not yet sent. It will be lost if this device is cleared, and nobody else can see it.',
  sending: 'Being sent to the office record now.',
  sent: 'In the office record. Everyone with access to the case can see it.',
  'send-failed':
    'The office record does not have this yet. Nothing was queued in the background — send it again when you have a connection.',
};

/** True while the office record does not have it. The screen must say so. */
export function isUnsent(state: CaptureState): boolean {
  return state !== 'sent';
}

/**
 * Whether the worker should be warned before leaving the screen.
 *
 * `sending` is included: navigating away mid-send leaves the worker unable to
 * find out whether it landed.
 */
export function warnsOnLeaving(state: CaptureState): boolean {
  return state === 'held-locally' || state === 'send-failed' || state === 'sending';
}

export interface VisitCapture {
  readonly visitId: FieldVisitId;
  readonly state: CaptureState;
  readonly observations: readonly VisitObservationDraft[];
  readonly outcome: VisitOutcomeDraft | null;
  /** Checklist ticks made in the field, by item code. */
  readonly checkedCodes: readonly string[];
  readonly capturedAt: IsoDateTime;
  /** Why the last attempt failed, in plain language. `null` unless failed. */
  readonly lastError: string | null;
}

export function emptyCapture(visitId: FieldVisitId, at: IsoDateTime): VisitCapture {
  return {
    visitId,
    state: 'held-locally',
    observations: [],
    outcome: null,
    checkedCodes: [],
    capturedAt: at,
    lastError: null,
  };
}

/**
 * A capture worth sending. An empty one is not an error — a worker may open a
 * visit and close it again — but it is not something to offer to send either.
 */
export function hasSomethingToSend(capture: VisitCapture): boolean {
  return (
    capture.observations.length > 0 ||
    capture.outcome !== null ||
    capture.checkedCodes.length > 0
  );
}

/**
 * The sentence shown when a worker tries to leave with unsent work.
 *
 * Returned from the domain rather than written in a template so it says the
 * same thing everywhere, and so it cannot be softened into "you have unsaved
 * changes" — which reads as a browser nuisance rather than a warning that a
 * family's visit record is about to be lost.
 */
export function unsentWarning(capture: VisitCapture): string | null {
  if (!warnsOnLeaving(capture.state) || !hasSomethingToSend(capture)) {
    return null;
  }
  return 'This visit is on this device only. Leaving now loses what you wrote — nothing has been sent to the office record.';
}
