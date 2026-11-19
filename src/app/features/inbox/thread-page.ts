import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, scan, switchMap, tap, type Observable } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  asId,
  authorOf,
  isOpen,
  OFFICE_INBOX_REPOSITORY,
  OFFICE_REPOSITORY,
  REPLY_LIMITS,
  replyProblem,
  THREAD_CLOSE_EFFECTS,
  THREAD_READ_EFFECT,
  THREAD_STATUS_CATALOG,
  type CursorPage,
  type MediaId,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  WriteIntent,
} from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { officeDirectory } from '@shared/offices/office-directory';
import { DisplayDatePipe } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { failed, LOADING, ready, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { INBOX_COPY } from './inbox.copy';

/** Messages a page; the API's own default. */
const PAGE_SIZE = 20;

/** A conversation and its messages both feed `threads` (`DL-222`). */
export const THREAD_TOPICS: readonly LiveTopic[] = ['threads'];

/** A re-read that keeps the last answer on screen until the next arrives, rather than a skeleton. */
function quietly<T>(source: Observable<ViewState<T>>, quiet: boolean): Observable<ViewState<T>> {
  return quiet ? source.pipe(filter((state) => state.kind !== 'loading')) : source;
}

/**
 * A live re-read of the newest page **adds to** what the reader has, never takes away (`DL-222`).
 * New messages push the oldest of the newest page out of it, and the page that held them is not
 * among the earlier pages the reader loaded; replacing the page would make those messages vanish
 * from the middle of the conversation. Messages are appended, never edited or removed, so keeping
 * every one this read has shown is the conversation as it stands.
 */
function keepShown(
  shown: ViewState<CursorPage<ThreadMessage>>,
  next: ViewState<CursorPage<ThreadMessage>>,
): ViewState<CursorPage<ThreadMessage>> {
  if (shown.kind !== 'ready' || next.kind !== 'ready') {
    return next;
  }
  const fresh = new Set(next.value.items.map((message) => message.id));
  const kept = shown.value.items.filter((message) => !fresh.has(message.id));
  return ready({ ...next.value, items: [...next.value.items, ...kept] });
}

/** The image a reader asked to see, held while the warning is open. */
interface ImageRequest {
  readonly message: ThreadMessage;
  readonly media: MediaId;
}

/**
 * One conversation between a resident and an office (`DL-168`).
 *
 * ## A record by address
 *
 * Unlike an ID review, a conversation can be read by id, so it has a route: a reload or a link from a
 * colleague answers with the same conversation. After every act it is **read again** from the
 * server, never patched — a colleague may have replied or closed it meanwhile.
 *
 * ## The images are the resident's
 *
 * An attached image is **not loaded until somebody asks**, and asking opens a warning first — the
 * precedent of the ID review (`DL-167`) and `openDocument` (`DL-77`). Only "Show it" fetches the
 * bytes, through the data layer with the bearer token in a header. They become object URLs made by
 * this page's own `ObjectUrls`, revoked when hidden, when another conversation takes this page's
 * place, and when the page is destroyed. Nothing is stored, logged or put in a notification.
 *
 * ## Acts say what they do before they are done
 *
 * Marking read says it is the **office's** mark, not the reader's. Closing opens a confirmation that
 * lists what the server does, and asks for no reason, because the server keeps none.
 */
@Component({
  selector: 'app-thread-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DisplayDatePipe, Modal, PageHeader, RouterLink, StatusBadge],
  templateUrl: './thread-page.html',
  styleUrl: './thread-page.scss',
})
export class ThreadPage {
  private readonly repository = inject(OFFICE_INBOX_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(LiveUpdates);
  private readonly objectUrls = new ObjectUrls();

  /** The `:threadId` route parameter. */
  readonly threadId = input.required<string>();

  protected readonly copy = INBOX_COPY.thread;
  protected readonly listCopy = INBOX_COPY.list;
  protected readonly catalog = THREAD_STATUS_CATALOG;
  protected readonly closeEffects = THREAD_CLOSE_EFFECTS;
  protected readonly readEffect = THREAD_READ_EFFECT;
  protected readonly limits = REPLY_LIMITS;

  private readonly id = computed(() => asId<OfficeThreadId>(this.threadId()));

  /** Bumped to read the conversation again — after every act, and on "Try again". */
  private readonly generation = signal(0);
  /**
   * The conversation an act just changed. Reading it again then keeps what is on screen until the
   * answer arrives, so the reader's place, focus and the outcome they are being told are not wiped
   * by a skeleton. Any other read — a new conversation, "Try again" — shows that it is loading.
   */
  private readonly quietFor = signal<OfficeThreadId | null>(null);
  private readonly query = computed(() => ({
    id: this.id(),
    generation: this.generation(),
    quiet: this.quietFor() === this.id(),
  }));

  /**
   * The conversation and its newest messages are read again quietly when the server says threads
   * changed (`DL-222`). A re-read is a read: nothing here marks the conversation read — that stays
   * the reader's own act, from its button below the effect it states (`THREAD_READ_EFFECT`).
   */
  protected readonly thread = toSignal(
    toObservable(this.query).pipe(
      switchMap(({ id, quiet }) =>
        quietly(
          liveViewState(
            () => this.repository.thread(id),
            this.live.changes(THREAD_TOPICS),
            this.live,
          ),
          quiet,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<OfficeThread> },
  );

  /** Pages of older messages, appended by "Show earlier messages"; emptied on every re-read. */
  private readonly earlierPages = signal<readonly CursorPage<ThreadMessage>[]>([]);
  protected readonly loadingEarlier = signal(false);
  protected readonly earlierFailed = signal(false);

  protected readonly newest = toSignal(
    toObservable(this.query).pipe(
      tap(() => {
        this.earlierPages.set([]);
        this.earlierFailed.set(false);
        this.loadingEarlier.set(false);
      }),
      switchMap(({ id, quiet }) =>
        quietly(
          liveViewState(
            () => this.repository.messages(id, { limit: PAGE_SIZE, cursor: null }),
            this.live.changes(THREAD_TOPICS),
            this.live,
          ),
          quiet,
        ).pipe(scan(keepShown, LOADING as ViewState<CursorPage<ThreadMessage>>)),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<ThreadMessage>> },
  );

  private readonly directory = officeDirectory(inject(OFFICE_REPOSITORY).list());

  protected readonly current = computed(() => valueOf(this.thread()));
  protected readonly open = computed(() => {
    const thread = this.current();
    return thread !== null && isOpen(thread);
  });
  protected readonly officeName = computed(() => {
    const thread = this.current();
    return thread === null ? '' : this.directory.name(thread.officeId, thread.officeSlug);
  });

  /**
   * Oldest first — a conversation is read in the order it was written. Each message once: after a
   * live re-read the cursor the earlier pages follow has moved, so a page may repeat a message the
   * newest page already holds. New messages arrive at the end, below the reader's place, so a
   * reader further up the conversation is not moved (the browser's scroll anchoring holds the
   * reply box where it was).
   */
  protected readonly messages = computed<readonly ThreadMessage[]>(() => {
    const byId = new Map<string, ThreadMessage>();
    for (const message of [
      ...(valueOf(this.newest())?.items ?? []),
      ...this.earlierPages().flatMap((page) => page.items),
    ]) {
      if (!byId.has(message.id)) byId.set(message.id, message);
    }
    return [...byId.values()].sort(
      (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
    );
  });

  private readonly oldestPage = computed(
    () => this.earlierPages().at(-1) ?? valueOf(this.newest()) ?? null,
  );

  protected readonly hasEarlier = computed(() => {
    const page = this.oldestPage();
    return page !== null && page.hasMore && page.nextCursor !== null;
  });

  protected readonly busy = signal(false);
  /** The live region's text: what the last act did, or why it was not done. */
  protected readonly outcome = signal('');
  protected readonly confirmingClose = signal(false);

  protected readonly draft = signal('');
  protected readonly attempted = signal(false);
  /**
   * The press of Send, held while the same words are sent again (`WriteIntent`): a retry after a
   * timeout carries the same key, so the server answers with the reply already posted instead of
   * posting it twice. Changed words are a new send, with a new key.
   */
  private sending: { readonly words: string; readonly intent: WriteIntent } | null = null;
  protected readonly draftProblem = computed(() => replyProblem(this.draft()));
  protected readonly draftLength = computed(() => this.draft().trim().length);

  /** Images by media id: loading, shown from an object URL, or failed. Absent means not asked. */
  protected readonly images = signal<ReadonlyMap<MediaId, ViewState<string>>>(new Map());
  protected readonly warningFor = signal<ImageRequest | null>(null);

  constructor() {
    // Another conversation opened in this page must never show the previous one's images or words.
    effect(() => {
      this.id();
      untracked(() => {
        this.discardImages();
        this.warningFor.set(null);
        this.confirmingClose.set(false);
        this.outcome.set('');
        this.draft.set('');
        this.attempted.set(false);
        this.sending = null;
      });
    });
    this.destroyRef.onDestroy(() => this.discardImages());
  }

  protected reload(): void {
    this.quietFor.set(null);
    this.generation.update((n) => n + 1);
  }

  protected authorLabel(thread: OfficeThread, message: ThreadMessage): string {
    return this.copy.author[authorOf(thread, message, this.readerId())];
  }

  protected fromResident(thread: OfficeThread, message: ThreadMessage): boolean {
    return authorOf(thread, message, this.readerId()) === 'resident';
  }

  protected imageState(media: MediaId): ViewState<string> | null {
    return this.images().get(media) ?? null;
  }

  protected showEarlier(): void {
    const cursor = this.oldestPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingEarlier()) {
      return;
    }
    const query = this.query();
    this.loadingEarlier.set(true);
    this.earlierFailed.set(false);

    this.repository
      .messages(query.id, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // Read again meanwhile: these continue a conversation nobody is looking at.
          if (query === this.query()) {
            this.earlierPages.update((pages) => [...pages, page]);
          }
          this.loadingEarlier.set(false);
        },
        error: () => {
          this.loadingEarlier.set(false);
          this.earlierFailed.set(true);
        },
      });
  }

  protected onDraft(event: Event): void {
    this.draft.set(event.target instanceof HTMLTextAreaElement ? event.target.value : '');
  }

  protected send(): void {
    this.attempted.set(true);
    if (this.draftProblem() !== null || this.busy()) {
      return;
    }
    const words = this.draft();
    const intent = this.sending?.words === words ? this.sending.intent : new WriteIntent();
    this.sending = { words, intent };
    this.act(this.repository.reply(this.id(), words, intent), this.copy.sent, () => {
      this.draft.set('');
      this.attempted.set(false);
      this.sending = null;
    });
  }

  protected markRead(): void {
    this.act(this.repository.markRead(this.id()), this.copy.markedRead);
  }

  protected askToClose(): void {
    this.confirmingClose.set(true);
  }

  protected cancelClose(): void {
    this.confirmingClose.set(false);
  }

  /** The only path that closes: the confirmation's own button. */
  protected confirmClose(): void {
    this.confirmingClose.set(false);
    this.act(this.repository.close(this.id()), this.copy.closed);
  }

  protected askToOpen(message: ThreadMessage, media: MediaId): void {
    this.warningFor.set({ message, media });
  }

  protected cancelOpen(): void {
    this.warningFor.set(null);
  }

  /** The only path that fetches an image: from the warning's own button. */
  protected confirmOpen(): void {
    const request = this.warningFor();
    this.warningFor.set(null);
    if (request === null) {
      return;
    }
    const id = this.id();
    this.setImage(request.media, LOADING);

    this.repository
      .openAttachment(request.message, request.media)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          // Answered after the reader moved to another conversation: not this one's.
          if (id !== this.id()) {
            return;
          }
          this.setImage(request.media, ready(this.objectUrls.make(blob)));
        },
        error: () => this.setImage(request.media, failed(this.copy.imageFailed)),
      });
  }

  protected hideImage(media: MediaId): void {
    const state = this.images().get(media);
    if (state?.kind === 'ready') {
      this.objectUrls.revoke(state.value);
    }
    const next = new Map(this.images());
    next.delete(media);
    this.images.set(next);
  }

  private readerId(): string | null {
    const user = this.session.user();
    return user === null ? null : String(user.id);
  }

  private setImage(media: MediaId, state: ViewState<string>): void {
    const next = new Map(this.images());
    next.set(media, state);
    this.images.set(next);
  }

  /** Revokes every object URL this page made. Idempotent. */
  private discardImages(): void {
    this.objectUrls.revokeAll();
    this.images.set(new Map());
  }

  private act(work: Observable<unknown>, done: string, after?: () => void): void {
    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.outcome.set(done);
        after?.();
        this.quietFor.set(this.id());
        this.generation.update((n) => n + 1);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
      },
    });
  }
}
