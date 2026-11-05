import { DatePipe } from '@angular/common';
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
import { filter, switchMap, tap, type Observable } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
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
} from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { failureReason } from '@shared/state/failure-reason';
import {
  failed,
  LOADING,
  ready,
  toViewState,
  valueOf,
  type ViewState,
} from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { INBOX_COPY } from './inbox.copy';
import { officeNamer } from './office-names';

/** Messages a page; the API's own default. */
const PAGE_SIZE = 20;

/** A re-read that keeps the last answer on screen until the next arrives, rather than a skeleton. */
function quietly<T>(source: Observable<ViewState<T>>, quiet: boolean): Observable<ViewState<T>> {
  return quiet ? source.pipe(filter((state) => state.kind !== 'loading')) : source;
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
  imports: [AsyncContent, DatePipe, Modal, PageHeader, RouterLink, StatusBadge],
  templateUrl: './thread-page.html',
  styleUrl: './thread-page.scss',
})
export class ThreadPage {
  private readonly repository = inject(OFFICE_INBOX_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
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

  protected readonly thread = toSignal(
    toObservable(this.query).pipe(
      switchMap(({ id, quiet }) => quietly(toViewState(this.repository.thread(id)), quiet)),
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
        quietly(toViewState(this.repository.messages(id, { limit: PAGE_SIZE, cursor: null })), quiet),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<ThreadMessage>> },
  );

  private readonly directory = officeNamer(inject(OFFICE_REPOSITORY).list());

  protected readonly current = computed(() => valueOf(this.thread()));
  protected readonly open = computed(() => {
    const thread = this.current();
    return thread !== null && isOpen(thread);
  });
  protected readonly officeName = computed(() => {
    const thread = this.current();
    return thread === null ? '' : this.directory.name(thread);
  });

  /** Oldest first — a conversation is read in the order it was written. */
  protected readonly messages = computed<readonly ThreadMessage[]>(() =>
    [
      ...(valueOf(this.newest())?.items ?? []),
      ...this.earlierPages().flatMap((page) => page.items),
    ]
      .slice()
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id)),
  );

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
    this.act(this.repository.reply(this.id(), this.draft()), this.copy.sent, () => {
      this.draft.set('');
      this.attempted.set(false);
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
