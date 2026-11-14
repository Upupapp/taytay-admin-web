import { EMPTY, mergeMap, of, type OperatorFunction } from 'rxjs';

import type { ChangeFeedEvent } from '@core/live/change-feed';

import type { SseFrame } from '../sse-parser';

/** The feed's frames as events, every frame the console does not use dropped. */
export function changeFeedEvents(): OperatorFunction<SseFrame, ChangeFeedEvent> {
  return mergeMap((frame) => {
    const event = toChangeFeedEvent(frame);
    return event === null ? EMPTY : of(event);
  });
}

/** A topic name as the API spells them: kebab-case, nothing else. */
const TOPIC = /^[a-z][a-z0-9-]*$/;

/**
 * One SSE frame of `GET changes` as the console's `ChangeFeedEvent`, or `null` for anything it does
 * not use (`DL-222`).
 *
 * **Only `topics` is kept.** The contract promises the hints carry no ids, counts or personal data,
 * and this mapper does not take the promise on trust: it reads one field off the payload, keeps
 * only the strings shaped like a topic name, and builds a new object. Should the server ever send
 * more, nothing more reaches a screen, a log or a signal. `check:live` holds this file to that.
 */
export function toChangeFeedEvent(frame: SseFrame): ChangeFeedEvent | null {
  if (frame.kind !== 'event') {
    return null;
  }

  switch (frame.event) {
    case 'ready': {
      const topics = topicsOf(frame.data);
      return topics === null ? null : { kind: 'ready', topics };
    }
    case 'change': {
      const topics = topicsOf(frame.data);
      return topics === null || topics.length === 0 ? null : { kind: 'change', topics };
    }
    case 'resync':
      return { kind: 'resync' };
    case 'expired':
      return { kind: 'expired' };
    default:
      return null;
  }
}

function topicsOf(data: string): readonly string[] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null || !('topics' in payload)) {
    return null;
  }

  const listed: unknown = payload.topics;
  if (!Array.isArray(listed)) {
    return null;
  }

  const entries: readonly unknown[] = listed;
  return entries.filter((topic): topic is string => typeof topic === 'string' && TOPIC.test(topic));
}
