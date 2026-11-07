import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  isOpen,
  replyProblem,
  type AppAccountId,
  type CursorPage,
  type CursorRequest,
  type InboxListing,
  type MediaId,
  type OfficeInboxRepository,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type ThreadMessageId,
  type WriteIntent,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import {
  MOCK_OFFICE_THREADS,
  MOCK_THREAD_MESSAGES,
  sampleAttachment,
} from './seed/office-threads.seed';

/** The API's own ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

const KEY = 'office-inbox.manage';

function pageOf<T>(rows: readonly T[], page: CursorRequest): CursorPage<T> {
  const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
  const limit = Math.min(Math.max(1, page.limit), LARGEST_PAGE);
  const end = start + limit;
  const hasMore = end < rows.length;
  return { items: rows.slice(start, end), hasMore, nextCursor: hasMore ? String(end) : null };
}

/**
 * The office inbox, in memory (`DL-168`), paging and refusing the way the API does.
 *
 * - Cursor-paged, newest activity first, with no total — the shape `HttpOfficeInboxRepository`
 *   answers, so a screen built here meets no surprise against the server.
 * - A reply to, or a second close of, a closed conversation is refused, as the API refuses it with
 *   `409`: two officers on one inbox is the ordinary case.
 * - Every act re-checks `office-inbox.manage`. Hiding the screen is not protection (rule 4).
 * - **Offices are not modelled**: the mock has no office to assign an account to, so every holder of
 *   the key sees every seeded conversation, as an administrator does on the server. The server's
 *   other answer — an empty page for a staff account with no office — is the `no-office` listing,
 *   and the screen's handling of it is tested against a stand-in rather than staged here.
 */
@Injectable()
export class MockOfficeInboxRepository implements OfficeInboxRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private threads: readonly OfficeThread[] = MOCK_OFFICE_THREADS;
  private messageList: readonly ThreadMessage[] = MOCK_THREAD_MESSAGES;
  /** Each reply by the key it was sent under, so a retry is answered as the API answers it. */
  private readonly sentUnder = new Map<string, ThreadMessage>();

  list(page: CursorRequest): Observable<InboxListing> {
    const denied = denyUnless<InboxListing>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }

    const ordered = this.threads
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));

    return this.latency.respond<InboxListing>({ kind: 'threads', page: pageOf(ordered, page) });
  }

  thread(id: OfficeThreadId): Observable<OfficeThread> {
    const denied = denyUnless<OfficeThread>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }
    const thread = this.threads.find((candidate) => candidate.id === id);
    return thread === undefined
      ? throwError(() => new Error('That conversation was not found.'))
      : this.latency.respond(thread);
  }

  messages(id: OfficeThreadId, page: CursorRequest): Observable<CursorPage<ThreadMessage>> {
    const denied = denyUnless<CursorPage<ThreadMessage>>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }
    if (!this.threads.some((thread) => thread.id === id)) {
      return throwError(() => new Error('That conversation was not found.'));
    }

    const newestFirst = this.messageList
      .filter((message) => message.threadId === id)
      .slice()
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id));

    return this.latency.respond(pageOf(newestFirst, page));
  }

  reply(id: OfficeThreadId, body: string, intent: WriteIntent): Observable<ThreadMessage> {
    const user = this.access.currentUser();
    const denied = denyUnless<ThreadMessage>(user, KEY);
    if (denied) {
      return denied;
    }
    // As the API does (0040): the same key with the same words is the same send, answered with the
    // message it made — even after the conversation closed; with other words it is refused.
    const earlier = this.sentUnder.get(intent.key);
    if (earlier !== undefined) {
      return earlier.threadId === id && earlier.body === body.trim()
        ? this.latency.respond(earlier)
        : throwError(
            () => new Error('That idempotency key was already used for a different message.'),
          );
    }
    if (user === null || replyProblem(body) !== null) {
      return throwError(() => new Error('A reply needs words, up to 4,000 characters.'));
    }
    const thread = this.threads.find((candidate) => candidate.id === id);
    if (thread === undefined) {
      return throwError(() => new Error('That conversation was not found.'));
    }
    if (!isOpen(thread)) {
      return throwError(() => new Error('That thread is closed.'));
    }

    const now = asIsoDateTime(new Date());
    const message: ThreadMessage = {
      id: asId<ThreadMessageId>(`message-${id}-${this.messageList.length + 1}`),
      threadId: id,
      senderId: asId<AppAccountId>(String(user.id)),
      body: body.trim(),
      attachments: [],
      sentAt: now,
    };
    this.messageList = [...this.messageList, message];
    this.sentUnder.set(intent.key, message);
    this.replace({ ...thread, lastMessageAt: now, updatedAt: now });

    return this.latency.respond(message);
  }

  markRead(id: OfficeThreadId): Observable<OfficeThread> {
    const denied = denyUnless<OfficeThread>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }
    const thread = this.threads.find((candidate) => candidate.id === id);
    if (thread === undefined) {
      return throwError(() => new Error('That conversation was not found.'));
    }
    const read: OfficeThread = { ...thread, unreadCount: 0 };
    this.replace(read);
    return this.latency.respond(read);
  }

  close(id: OfficeThreadId): Observable<OfficeThread> {
    const denied = denyUnless<OfficeThread>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }
    const thread = this.threads.find((candidate) => candidate.id === id);
    if (thread === undefined) {
      return throwError(() => new Error('That conversation was not found.'));
    }
    if (!isOpen(thread)) {
      return throwError(() => new Error('That thread is already closed.'));
    }
    const closed: OfficeThread = {
      ...thread,
      status: 'closed',
      updatedAt: asIsoDateTime(new Date()),
    };
    this.replace(closed);
    return this.latency.respond(closed);
  }

  openAttachment(message: ThreadMessage, media: MediaId): Observable<Blob> {
    const denied = denyUnless<Blob>(this.access.currentUser(), KEY);
    if (denied) {
      return denied;
    }
    return message.attachments.includes(media)
      ? this.latency.respond(sampleAttachment())
      : throwError(() => new Error('This message carries no such image.'));
  }

  private replace(thread: OfficeThread): void {
    this.threads = this.threads.map((candidate) => (candidate.id === thread.id ? thread : candidate));
  }
}
