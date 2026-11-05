import type {
  AppAccountId,
  IsoDateTime,
  MediaId,
  OfficeId,
  OfficeThreadId,
  ThreadMessageId,
} from '../shared/ids';
import type { CursorPage } from '../shared/pagination';
import { nextStatuses, type StatusCatalog, type StatusTransitions } from '../shared/status';

/**
 * A conversation a resident started, from the residents' app, with one LGU office (`DL-168`).
 *
 * Shaped like the API's `Thread` and nothing more. It is **not** a case, a request or a registry
 * record: the resident is an app account, and the office answers in the office's name.
 *
 * ## What it deliberately does not carry
 *
 * - **No preview of what was written.** The API sends the first 140 characters of the latest
 *   message with every row. A list is the screen left open on a desk and scrolled past by whoever
 *   stands behind it, so the words a resident wrote to their government are read by opening the
 *   conversation, never in a column. Not mapped, so no template can reach it; `check:inbox` fails
 *   the build if it appears.
 * - **No resident name.** The API sends the resident's account id and nothing else about them, and
 *   this console has no read that names an account by id. An identifier on screen would look like
 *   knowing who wrote and provide nothing.
 */
export interface OfficeThread {
  readonly id: OfficeThreadId;
  /** The residents' app account that started it. Never a `ResidentId` (`DL-164`). */
  readonly residentAccountId: AppAccountId;
  readonly officeId: OfficeId;
  /** The office's slug, said on screen only when the office directory could not name it. */
  readonly officeSlug: string;
  /** The resident's own words, stored when the conversation began. */
  readonly subject: string;
  readonly status: ThreadStatus;
  /**
   * Messages from anybody but the reader, since **the office** last marked it read. One mark for the
   * whole office (`office_last_read_at`), so it is the office's count, not this reader's.
   */
  readonly unreadCount: number;
  readonly lastMessageAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface ThreadMessage {
  readonly id: ThreadMessageId;
  readonly threadId: OfficeThreadId;
  /** The resident, or a member of staff — told apart by comparing with the thread's resident. */
  readonly senderId: AppAccountId;
  readonly body: string;
  /** Images, read as bytes on request through `OfficeInboxRepository.openAttachment`. */
  readonly attachments: readonly MediaId[];
  readonly sentAt: IsoDateTime;
}

/**
 * Whose message it is. The API names a sender by account id only, and staff accounts are not the
 * resident, so a message is either the resident's or the office's — and, when the reader sent it,
 * the reader's own.
 */
export type MessageAuthor = 'resident' | 'office' | 'you';

export function authorOf(
  thread: OfficeThread,
  message: ThreadMessage,
  readerAccountId: string | null,
): MessageAuthor {
  if (message.senderId === thread.residentAccountId) {
    return 'resident';
  }
  return readerAccountId !== null && String(message.senderId) === readerAccountId ? 'you' : 'office';
}

/* ── the lifecycle, defined once (rule 7) ────────────────────────────────── */

export const THREAD_STATUSES = ['open', 'closed'] as const;

export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_STATUS_CATALOG: StatusCatalog<ThreadStatus> = {
  open: {
    value: 'open',
    label: 'Open',
    tone: 'info',
    description: 'Either side may write. The resident’s next message to this office lands here.',
  },
  closed: {
    value: 'closed',
    label: 'Closed',
    tone: 'neutral',
    description:
      'Nobody can write in it again. The resident’s next message to this office starts a new ' +
      'conversation.',
  },
};

/**
 * `closed` is terminal: the API has no route that reopens a conversation, and a resident who writes
 * again starts a new one. Closing is the resident's move as well as the office's.
 */
export const THREAD_STATUS_TRANSITIONS: StatusTransitions<ThreadStatus> = {
  open: ['closed'],
  closed: [],
};

/** True when somebody can still write in it — and so when the office may close it. */
export function isOpen(thread: OfficeThread): boolean {
  return nextStatuses(THREAD_STATUS_TRANSITIONS, thread.status).length > 0;
}

/* ── what an act does, as the API says ───────────────────────────────────── */

/**
 * What closing does, shown **before** the button (`DL-168`).
 *
 * Read from the backend, not assumed: `taytay-backend` `2736e28` — `closeThread` in
 * `openapi/openapi.json` ("A closed thread lets the resident start a new one."), and the handler in
 * `src/modules/messaging/routes.ts`, which records `thread.closed` in the audit trail against the
 * account that closed it and accepts no body. **No reason is asked for**, because the server has
 * nowhere to keep one: a reason typed into a box that goes nowhere is a record somebody believes
 * exists.
 */
export const THREAD_CLOSE_EFFECTS: readonly string[] = [
  'Nobody can write in this conversation again — not the resident, not the office. The server ' +
    'refuses a reply to a closed conversation.',
  'If the resident writes to this office again, the app starts a new conversation.',
  'The resident is not sent a message saying it was closed. If they are owed an answer, reply first.',
  'The server records that you closed it, and when. It keeps no reason, so none is asked for here.',
  'Nothing in this console can reopen it.',
];

/**
 * What marking read does. One mark for the office, not one per person: the API keeps a single
 * `office_last_read_at` per conversation, so a colleague's unread count clears too.
 */
export const THREAD_READ_EFFECT =
  'Marks it read for the whole office, not only for you: the unread count is one count, shared by ' +
  'everybody who answers this office’s conversations.';

/**
 * How long a reply may be. Both ends are the API's (`replySchema`: trimmed, 1 to 4,000 characters):
 * a reply is a message to a resident, not a recorded decision, so no floor of this console's own.
 */
export const REPLY_LIMITS = { minimum: 1, maximum: 4000 } as const;

/** Why a reply would be refused, or `null` when it would not. */
export function replyProblem(body: string): 'empty' | 'too-long' | null {
  const length = body.trim().length;
  if (length < REPLY_LIMITS.minimum) {
    return 'empty';
  }
  return length > REPLY_LIMITS.maximum ? 'too-long' : null;
}

/* ── reading the inbox ───────────────────────────────────────────────────── */

/**
 * One page of the inbox, or the server's other meaning for an empty one.
 *
 * `GET threads` answers a staff account that is not assigned to an office with an empty page — the
 * same answer as an office nobody has written to. The two are opposite conclusions for an officer:
 * one says residents are quiet, the other that this account cannot see them. So the data layer finds
 * out which before it answers (`DL-168`), and a screen never says "no conversations" to an account
 * that has no office.
 */
export type InboxListing =
  | { readonly kind: 'threads'; readonly page: CursorPage<OfficeThread> }
  | { readonly kind: 'no-office' };
