import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import {
  asId,
  asIsoDateTime,
  OFFICE_INBOX_REPOSITORY,
  OFFICE_REPOSITORY,
  THREAD_CLOSE_EFFECTS,
  type AppAccountId,
  type CursorPage,
  type CursorRequest,
  type InboxListing,
  type MediaId,
  type Office,
  type OfficeId,
  type OfficeInboxRepository,
  type OfficeRepository,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type ThreadMessageId,
} from '@domain/index';

import { InboxPage } from './inbox-page';
import { INBOX_COPY } from './inbox.copy';
import { ThreadPage } from './thread-page';

const MSWDO = asId<OfficeId>('office-mswdo');
const RESIDENT = asId<AppAccountId>('resident-1');
const READER = 'staff-reader';

function thread(n: number, overrides: Partial<OfficeThread> = {}): OfficeThread {
  return {
    id: asId<OfficeThreadId>(`thread-${n}`),
    residentAccountId: RESIDENT,
    officeId: MSWDO,
    officeSlug: 'mswdo',
    subject: `Subject ${n}`,
    status: 'open',
    unreadCount: n === 1 ? 2 : 0,
    lastMessageAt: asIsoDateTime(`2026-11-0${n}T01:00:00.000Z`),
    createdAt: asIsoDateTime(`2026-11-0${n}T00:00:00.000Z`),
    updatedAt: asIsoDateTime(`2026-11-0${n}T01:00:00.000Z`),
    ...overrides,
  };
}

function message(n: number, sender: string, attachments: readonly string[] = []): ThreadMessage {
  return {
    id: asId<ThreadMessageId>(`message-${n}`),
    threadId: asId<OfficeThreadId>('thread-1'),
    senderId: asId<AppAccountId>(sender),
    body: `Words of message ${n}`,
    attachments: attachments.map((media) => asId<MediaId>(media)),
    sentAt: asIsoDateTime(`2026-11-01T0${n}:00:00.000Z`),
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingInbox implements OfficeInboxRepository {
  readonly listed: CursorRequest[] = [];
  readonly opened: MediaId[] = [];
  readonly replies: string[] = [];
  readonly acts: string[] = [];
  answer: 'threads' | 'no-office' | 'empty' = 'threads';
  current: OfficeThread = thread(1);
  failWith: unknown = null;

  list(page: CursorRequest): Observable<InboxListing> {
    this.listed.push(page);
    if (this.answer === 'no-office') {
      return of({ kind: 'no-office' });
    }
    if (this.answer === 'empty') {
      return of({ kind: 'threads', page: { items: [], hasMore: false, nextCursor: null } });
    }
    return of({
      kind: 'threads',
      page: page.cursor
        ? { items: [thread(3)], hasMore: false, nextCursor: null }
        : { items: [thread(1), thread(2)], hasMore: true, nextCursor: 'cursor-2' },
    });
  }

  thread(): Observable<OfficeThread> {
    return of(this.current);
  }

  messages(_id: OfficeThreadId, page: CursorRequest): Observable<CursorPage<ThreadMessage>> {
    // Newest first, as the server sends them.
    return of(
      page.cursor
        ? { items: [message(1, 'resident-1')], hasMore: false, nextCursor: null }
        : {
            items: [message(3, READER), message(2, 'resident-1', ['media-a', 'media-b'])],
            hasMore: true,
            nextCursor: 'older',
          },
    );
  }

  reply(_id: OfficeThreadId, body: string): Observable<ThreadMessage> {
    if (this.failWith !== null) {
      const failure = this.failWith;
      return throwError(() => failure);
    }
    this.replies.push(body);
    return of(message(4, READER));
  }

  markRead(): Observable<OfficeThread> {
    this.acts.push('read');
    return of({ ...this.current, unreadCount: 0 });
  }

  close(): Observable<OfficeThread> {
    this.acts.push('close');
    this.current = { ...this.current, status: 'closed' };
    return of(this.current);
  }

  openAttachment(_message: ThreadMessage, media: MediaId): Observable<Blob> {
    this.opened.push(media);
    return of(new Blob(['image bytes'], { type: 'image/png' }));
  }
}

const OFFICES: readonly Office[] = [
  { id: MSWDO, name: 'Municipal Social Welfare and Development Office', slug: 'mswdo', shortName: 'MSWDO' },
];

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the page makes and gives back.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

function configure(directory: Observable<readonly Office[]> = of(OFFICES)): RecordingInbox {
  const inbox = new RecordingInbox();
  const offices: OfficeRepository = { list: () => directory };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: OFFICE_INBOX_REPOSITORY, useValue: inbox },
      { provide: OFFICE_REPOSITORY, useValue: offices },
      { provide: SessionStore, useValue: { user: signal({ id: READER }) } },
    ],
  });
  return inbox;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    ) ?? null
  );
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/* ── the list ────────────────────────────────────────────────────────────── */

describe('InboxPage (DL-168)', () => {
  it('reads one cursor page and says more are available, never "page 1 of N"', async () => {
    const inbox = configure();
    const element = await settle(TestBed.createComponent(InboxPage));

    expect(inbox.listed[0]).toEqual({ limit: 20, cursor: null });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.textContent).toContain('Showing 2 conversations. More are available.');
    expect(element.textContent).not.toMatch(/page \d+ of|of \d+ conversations/i);
  });

  it('appends the next page from its cursor, then says that is all', async () => {
    const inbox = configure();
    const fixture = TestBed.createComponent(InboxPage);
    const element = await settle(fixture);

    buttonNamed(element, INBOX_COPY.list.showMore)?.click();
    await settle(fixture);

    expect(inbox.listed[1]).toEqual({ limit: 20, cursor: 'cursor-2' });
    expect(element.textContent).toContain('Showing 3 conversations. That is all of them.');
  });

  it('links each subject to its conversation, names the office, and counts unread in words', async () => {
    configure();
    const element = await settle(TestBed.createComponent(InboxPage));

    const link = element.querySelector<HTMLAnchorElement>('tbody a');
    expect(link?.getAttribute('href')).toBe('/inbox/thread-1');
    expect(link?.textContent?.trim()).toBe('Subject 1');
    expect(element.textContent).toContain('Municipal Social Welfare and Development Office (MSWDO)');
    expect(element.textContent).toContain('2 unread');
  });

  it('shows offices by their code, and says why, when the directory cannot be read', async () => {
    configure(throwError(() => new Error('offline')));
    const element = await settle(TestBed.createComponent(InboxPage));

    expect(element.querySelector('tbody')?.textContent).toContain('mswdo');
    expect(element.textContent).toContain(INBOX_COPY.list.officesUnnamed);
  });

  it('tells an account with no office so, and who can fix it — never an empty inbox', async () => {
    const inbox = configure();
    inbox.answer = 'no-office';
    const element = await settle(TestBed.createComponent(InboxPage));

    expect(element.textContent).toContain(INBOX_COPY.noOffice.heading);
    expect(element.textContent).toContain('An administrator assigns staff accounts to offices');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).not.toContain(INBOX_COPY.list.emptyMessage);
  });

  it('says plainly that nobody has written when the office truly has nothing', async () => {
    const inbox = configure();
    inbox.answer = 'empty';
    const element = await settle(TestBed.createComponent(InboxPage));

    expect(element.textContent).toContain(INBOX_COPY.list.emptyMessage);
    expect(element.textContent).not.toContain(INBOX_COPY.noOffice.heading);
  });
});

/* ── one conversation ────────────────────────────────────────────────────── */

async function openThread(inbox?: (repository: RecordingInbox) => void): Promise<{
  fixture: ComponentFixture<ThreadPage>;
  element: HTMLElement;
  repository: RecordingInbox;
}> {
  const repository = configure();
  inbox?.(repository);
  const fixture = TestBed.createComponent(ThreadPage);
  fixture.componentRef.setInput('threadId', 'thread-1');
  const element = await settle(fixture);
  return { fixture, element, repository };
}

function modal(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe('ThreadPage (DL-168)', () => {
  it('reads the conversation oldest first, saying whose each message is', async () => {
    const { fixture, element } = await openThread();

    buttonNamed(element, INBOX_COPY.thread.earlier)?.click();
    await settle(fixture);

    const items = [...element.querySelectorAll('.thread__message')];
    expect(items.map((item) => item.querySelector('strong')?.textContent?.trim())).toEqual([
      'The resident',
      'The resident',
      'You, for the office',
    ]);
    expect(items[0]?.textContent).toContain('Words of message 1');
  });

  it('loads no image until somebody asks, and warns before it does', async () => {
    const { fixture, element, repository } = await openThread();

    expect(repository.opened).toEqual([]);
    expect(element.querySelector('img')).toBeNull();

    buttonNamed(element, 'Show image 1')?.click();
    await settle(fixture);
    expect(modal()?.textContent).toContain(INBOX_COPY.thread.warningHeading);
    expect(repository.opened).toEqual([]);

    const cancel = modal()?.querySelector<HTMLElement>('.btn--secondary');
    cancel?.click();
    await settle(fixture);
    expect(repository.opened).toEqual([]);
  });

  it('shows an image from an object URL it made, and gives it back when hidden', async () => {
    const { fixture, element, repository } = await openThread();

    buttonNamed(element, 'Show image 2')?.click();
    await settle(fixture);
    const proceed = [...(modal()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
      (button) => button.textContent?.trim() === INBOX_COPY.thread.warningProceed,
    );
    proceed?.click();
    await settle(fixture);

    expect(repository.opened).toEqual(['media-b']);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('blob:test/1');
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Image 2 attached to this message');

    buttonNamed(element, 'Hide image 2')?.click();
    await settle(fixture);
    expect(revoked).toEqual(['blob:test/1']);
    expect(element.querySelector('img')).toBeNull();
  });

  it('gives every image back when the page is left', async () => {
    const { fixture, element } = await openThread();

    buttonNamed(element, 'Show image 1')?.click();
    await settle(fixture);
    [...(modal()?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent?.trim() === INBOX_COPY.thread.warningProceed)
      ?.click();
    await settle(fixture);
    expect(created).toEqual(['blob:test/1']);

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('refuses an empty reply, then sends the words and says so in a live region', async () => {
    const { fixture, element, repository } = await openThread();

    buttonNamed(element, INBOX_COPY.thread.send)?.click();
    await settle(fixture);
    expect(element.textContent).toContain(INBOX_COPY.thread.replyEmpty);
    expect(repository.replies).toEqual([]);

    const box = element.querySelector<HTMLTextAreaElement>('#thread-reply-body');
    if (box === null) throw new Error('no reply box');
    box.value = 'Please bring the death certificate.';
    box.dispatchEvent(new Event('input'));
    buttonNamed(element, INBOX_COPY.thread.send)?.click();
    await settle(fixture);

    expect(repository.replies).toEqual(['Please bring the death certificate.']);
    expect(element.querySelector('[role="status"][aria-live="polite"]')?.textContent?.trim()).toBe(
      INBOX_COPY.thread.sent,
    );
  });

  it('says what the server said when a reply is refused, and nothing of what was written', async () => {
    const { fixture, element } = await openThread((repository) => {
      repository.failWith = { message: 'That thread is closed.' };
    });

    const box = element.querySelector<HTMLTextAreaElement>('#thread-reply-body');
    if (box === null) throw new Error('no reply box');
    box.value = 'A private sentence.';
    box.dispatchEvent(new Event('input'));
    buttonNamed(element, INBOX_COPY.thread.send)?.click();
    await settle(fixture);

    const live = element.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '';
    expect(live).toContain('That was not done. That thread is closed.');
    expect(live).not.toContain('A private sentence.');
  });

  it('marks read for the whole office, and says so before the button', async () => {
    const { fixture, element, repository } = await openThread();

    expect(element.textContent).toContain('not only for you');
    buttonNamed(element, INBOX_COPY.thread.markRead)?.click();
    await settle(fixture);

    expect(repository.acts).toEqual(['read']);
  });

  it('confirms a close with what the server does, asks for no reason, and then closes', async () => {
    const { fixture, element, repository } = await openThread();

    buttonNamed(element, INBOX_COPY.thread.closeOpen)?.click();
    await settle(fixture);
    const dialog = modal();
    for (const effect of THREAD_CLOSE_EFFECTS) {
      expect(dialog?.textContent).toContain(effect);
    }
    expect(dialog?.querySelector('textarea, input')).toBeNull();
    expect(repository.acts).toEqual([]);

    [...(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent?.trim() === INBOX_COPY.thread.closeConfirm)
      ?.click();
    await settle(fixture);

    expect(repository.acts).toEqual(['close']);
    expect(element.textContent).toContain(INBOX_COPY.thread.closedNote);
    expect(element.querySelector('#thread-reply-body')).toBeNull();
    expect(buttonNamed(element, INBOX_COPY.thread.closeOpen)).toBeNull();
  });
});
