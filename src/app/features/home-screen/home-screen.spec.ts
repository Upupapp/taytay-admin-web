import type { Provider, Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveUpdates } from '@core/live/live-updates';
import {
  ArchiveRefusedError,
  asId,
  asIsoDateTime,
  BANNER_NO_DESCRIPTION,
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
  type ArchiveEvent,
  type ArchiveEventId,
  type ArchiveRecord,
  type BannerDraft,
  type BannerImageChange,
  type HomeBanner,
  type HomeBannerId,
  type HomePreview,
  type HomeScreenRepository,
  type LinkDraft,
  type MediaId,
  type QuickLink,
  type QuickLinkId,
} from '@domain/index';

import { BannersSection } from './banners-section';
import { HomeScreenPage } from './home-screen-page';
import { HOME_SCREEN_COPY } from './home-screen.copy';
import { LinksSection } from './links-section';
import { PreviewSection } from './preview-section';

const STAMP = asIsoDateTime('2026-11-05T00:00:00.000Z');

/** Midday UTC, so the date reads the same in any test machine's zone. */
const ARCHIVED: ArchiveRecord = {
  at: asIsoDateTime('2026-11-03T12:00:00.000Z'),
  byName: 'Ana Reyes',
  reason: 'The drive ended.',
};

/** Newest first, as the server answers. */
const HISTORY: readonly ArchiveEvent[] = [
  {
    id: asId<ArchiveEventId>('event-2'),
    act: 'restored',
    reason: 'Running again in December.',
    actorName: 'Ben Cruz',
    occurredAt: asIsoDateTime('2026-11-04T12:00:00.000Z'),
  },
  {
    id: asId<ArchiveEventId>('event-1'),
    act: 'archived',
    reason: 'The drive ended.',
    actorName: 'Ana Reyes',
    occurredAt: asIsoDateTime('2026-11-03T12:00:00.000Z'),
  },
];

function banner(key: string, values: Partial<HomeBanner> = {}): HomeBanner {
  return {
    id: asId<HomeBannerId>(`banner-${key}`),
    title: `Banner ${key}`,
    mediaId: asId<MediaId>(`media-${key}`),
    href: null,
    sortOrder: 1,
    active: true,
    createdAt: STAMP,
    archived: null,
    ...values,
  };
}

function link(key: string, values: Partial<QuickLink> = {}): QuickLink {
  return {
    id: asId<QuickLinkId>(`link-${key}`),
    label: key,
    href: `https://home.example.test/${key}`,
    sortOrder: 1,
    createdAt: STAMP,
    archived: null,
    ...values,
  };
}

const LINK = link('Tulong');

/**
 * The archive half of one home list (`DL-225`): the list in use or archived, read whole; archive and
 * restore with a reason; the history. Records every call, and answers with a refusal when a test
 * sets one, as the adapters raise it.
 */
class ArchiveRecorder<TId extends string, TRow extends { readonly id: TId }> {
  inUse: readonly TRow[];
  archivedRows: readonly TRow[];
  readonly listed: boolean[] = [];
  readonly archivedCalls: { id: TId; reason: string }[] = [];
  readonly restoredCalls: { id: TId; reason: string }[] = [];
  readonly histories: TId[] = [];
  events: readonly ArchiveEvent[] = HISTORY;
  moveRefusal: unknown = null;
  saveRefusal: unknown = null;

  constructor(inUse: readonly TRow[], archivedRows: readonly TRow[]) {
    this.inUse = inUse;
    this.archivedRows = archivedRows;
  }

  list(archived: boolean): Observable<readonly TRow[]> {
    this.listed.push(archived);
    return of(archived ? this.archivedRows : this.inUse);
  }

  archive(id: TId, reason: string): Observable<TRow> {
    return this.move(id, reason, this.archivedCalls);
  }

  restore(id: TId, reason: string): Observable<TRow> {
    return this.move(id, reason, this.restoredCalls);
  }

  history(id: TId): Observable<readonly ArchiveEvent[]> {
    this.histories.push(id);
    return of(this.events);
  }

  /** A save answered with `saveRefusal` when one is set. */
  saving<T>(answer: () => T): Observable<T> {
    const refusal = this.saveRefusal;
    return refusal === null ? of(answer()) : throwError(() => refusal);
  }

  private move(id: TId, reason: string, log: { id: TId; reason: string }[]): Observable<TRow> {
    const refusal = this.moveRefusal;
    if (refusal !== null) return throwError(() => refusal);
    log.push({ id, reason });
    const row = [...this.inUse, ...this.archivedRows].find((candidate) => candidate.id === id);
    return row === undefined ? throwError(() => new Error(`No row ${id}.`)) : of(row);
  }
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingHome implements HomeScreenRepository {
  readonly bannerLog = new ArchiveRecorder<HomeBannerId, HomeBanner>(
    [banner('a'), banner('b', { active: false, mediaId: null, sortOrder: 2 })],
    [banner('old', { archived: ARCHIVED })],
  );
  readonly linkLog = new ArchiveRecorder<QuickLinkId, QuickLink>(
    [LINK],
    [link('Old', { archived: ARCHIVED })],
  );
  readonly createdBanners: { draft: BannerDraft; image: Blob | null }[] = [];
  readonly updatedBanners: { id: HomeBannerId; draft: BannerDraft; image: BannerImageChange }[] =
    [];
  readonly updatedLinks: { id: QuickLinkId; draft: LinkDraft }[] = [];
  readonly imagesRead: HomeBannerId[] = [];
  previews = 0;

  banners(archived: boolean): Observable<readonly HomeBanner[]> {
    return this.bannerLog.list(archived);
  }

  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner> {
    return this.bannerLog.saving(() => {
      this.createdBanners.push({ draft, image });
      return banner('new', draft);
    });
  }

  updateBanner(
    id: HomeBannerId,
    draft: BannerDraft,
    image: BannerImageChange,
  ): Observable<HomeBanner> {
    return this.bannerLog.saving(() => {
      this.updatedBanners.push({ id, draft, image });
      return banner('a', draft);
    });
  }

  archiveBanner(id: HomeBannerId, reason: string): Observable<HomeBanner> {
    return this.bannerLog.archive(id, reason);
  }

  restoreBanner(id: HomeBannerId, reason: string): Observable<HomeBanner> {
    return this.bannerLog.restore(id, reason);
  }

  bannerHistory(id: HomeBannerId): Observable<readonly ArchiveEvent[]> {
    return this.bannerLog.history(id);
  }

  bannerImage(shown: HomeBanner): Observable<Blob> {
    this.imagesRead.push(shown.id);
    return of(new Blob(['x'], { type: 'image/png' }));
  }

  links(archived: boolean): Observable<readonly QuickLink[]> {
    return this.linkLog.list(archived);
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    return this.linkLog.saving(() => ({ ...LINK, ...draft }));
  }

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    return this.linkLog.saving(() => {
      this.updatedLinks.push({ id, draft });
      return { ...LINK, ...draft };
    });
  }

  archiveLink(id: QuickLinkId, reason: string): Observable<QuickLink> {
    return this.linkLog.archive(id, reason);
  }

  restoreLink(id: QuickLinkId, reason: string): Observable<QuickLink> {
    return this.linkLog.restore(id, reason);
  }

  linkHistory(id: QuickLinkId): Observable<readonly ArchiveEvent[]> {
    return this.linkLog.history(id);
  }

  preview(): Observable<HomePreview> {
    this.previews++;
    return of({
      banners: [banner('a')],
      links: [LINK],
      featuredServices: ['Senior citizen ID'],
      hotlines: 4,
      news: 5,
    });
  }
}

function configure(extra: readonly Provider[] = []): RecordingHome {
  const home = new RecordingHome();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: HOME_SCREEN_REPOSITORY, useValue: home }, ...extra],
  });
  return home;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function buttonNamed(name: string, root: ParentNode = document): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
    ) ?? null
  );
}

function type(selector: string, value: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (input === null) throw new Error(`No ${selector}.`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** The archive or restore confirmation, while it is open. */
function archiveDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('app-archive-dialog [role="dialog"]');
}

function confirmButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('app-archive-dialog .btn--primary');
}

function words(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function follows(first: Node | null | undefined, second: Node | null | undefined): boolean {
  return (
    first !== null &&
    first !== undefined &&
    second !== null &&
    second !== undefined &&
    (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the screen makes and gives back.
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

describe('HomeScreenPage (DL-170)', () => {
  it('says residents see it, and reads the preview again after a save', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(HomeScreenPage);
    const element = await settle(fixture);

    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Residents see this in the Taytay app',
    );
    expect(home.previews).toBe(1);

    buttonNamed('Edit the banner Banner a')?.click();
    await settle(fixture);
    type('#banner-title', 'Banner a, renamed');
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(home.previews).toBe(2);
  });

  it('reads the preview again after an archive, because the home screen changed (DL-225)', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(HomeScreenPage);
    await settle(fixture);

    buttonNamed('Archive the link Tulong')?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Moved to the menu.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(home.linkLog.archivedCalls).toEqual([
      { id: 'link-Tulong', reason: 'Moved to the menu.' },
    ]);
    expect(home.previews).toBe(2);
  });

  it('holds each list’s archived tab in its own address parameter, keeping the other (DL-225)', async () => {
    const home = configure();
    await TestBed.inject(Router).navigateByUrl('/?archivedLinks=true');
    const fixture = TestBed.createComponent(HomeScreenPage);
    fixture.componentRef.setInput('archivedLinks', 'true');
    const element = await settle(fixture);

    expect(home.bannerLog.listed).toEqual([false]);
    expect(home.linkLog.listed).toEqual([true]);
    const bannerTabs = [...element.querySelectorAll('app-banners-section app-archive-tabs a')];
    expect(bannerTabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/?archivedLinks=true',
      '/?archivedLinks=true&archivedBanners=true',
    ]);
    const linkTabs = [...element.querySelectorAll('app-links-section app-archive-tabs a')];
    expect(linkTabs.map((tab) => tab.getAttribute('href'))).toEqual(['/', '/?archivedLinks=true']);
    expect(linkTabs.map((tab) => tab.getAttribute('aria-current'))).toEqual([null, 'true']);
  });
});

/* ── archive, never delete: the same acts in each list (DL-225) ──────────── */

interface ArchiveCase {
  readonly title: string;
  readonly component: Type<unknown>;
  readonly log: (home: RecordingHome) => {
    readonly listed: readonly boolean[];
    readonly archivedCalls: readonly { readonly id: string; readonly reason: string }[];
    readonly restoredCalls: readonly { readonly id: string; readonly reason: string }[];
    readonly histories: readonly string[];
    events: readonly ArchiveEvent[];
    moveRefusal: unknown;
    saveRefusal: unknown;
  };
  /** "the banner " or "the link ", as the buttons name a record. */
  readonly kind: string;
  readonly noun: string;
  readonly current: { readonly id: string; readonly name: string };
  readonly old: { readonly id: string; readonly name: string };
  readonly effects: { readonly archive: readonly string[]; readonly restore: readonly string[] };
  readonly confirm: { readonly archive: string; readonly restore: string };
  readonly form: string;
  readonly change: () => void;
}

const CASES: readonly ArchiveCase[] = [
  {
    title: 'BannersSection',
    component: BannersSection,
    log: (home) => home.bannerLog,
    kind: 'the banner ',
    noun: 'banner',
    current: { id: 'banner-a', name: 'Banner a' },
    old: { id: 'banner-old', name: 'Banner old' },
    effects: { archive: HOME_EFFECTS.bannerArchive, restore: HOME_EFFECTS.bannerRestore },
    confirm: { archive: 'Archive the banner', restore: 'Restore the banner' },
    form: 'app-banner-form',
    change: () => type('#banner-title', 'Banner a, renamed'),
  },
  {
    title: 'LinksSection',
    component: LinksSection,
    log: (home) => home.linkLog,
    kind: 'the link ',
    noun: 'link',
    current: { id: 'link-Tulong', name: 'Tulong' },
    old: { id: 'link-Old', name: 'Old' },
    effects: { archive: HOME_EFFECTS.linkArchive, restore: HOME_EFFECTS.linkRestore },
    confirm: { archive: 'Archive the link', restore: 'Restore the link' },
    form: 'app-link-form',
    change: () => type('#link-label', 'Tulong, renamed'),
  },
];

describe.each(CASES)('$title — archive, never delete (DL-225)', (c) => {
  const label = (verb: string, name: string): string =>
    verb === 'History' ? `History of ${c.kind}${name}` : `${verb} ${c.kind}${name}`;

  async function open(archived = false): Promise<{
    fixture: ComponentFixture<unknown>;
    element: HTMLElement;
    home: RecordingHome;
  }> {
    const home = configure();
    const fixture = TestBed.createComponent(c.component);
    if (archived) fixture.componentRef.setInput('archived', true);
    const element = await settle(fixture);
    return { fixture, element, home };
  }

  it('offers Edit and Archive on a record in use, and nothing that deletes', async () => {
    const { element, home } = await open();

    expect(c.log(home).listed).toEqual([false]);
    expect(buttonNamed(label('Edit', c.current.name))).not.toBeNull();
    expect(buttonNamed(label('Archive', c.current.name))?.className).toBe('btn btn--small');
    expect(element.textContent).not.toMatch(/delete/i);
  });

  it('archives only after a confirmation that says what it does first, with a reason, trimmed', async () => {
    const { fixture, element, home } = await open();
    const log = c.log(home);

    buttonNamed(label('Archive', c.current.name))?.click();
    await settle(fixture);
    const dialog = archiveDialog();
    for (const effect of c.effects.archive) {
      expect(dialog?.textContent).toContain(effect);
    }
    expect(confirmButton()?.textContent?.trim()).toBe(c.confirm.archive);
    expect(follows(dialog?.querySelector('ul'), confirmButton())).toBe(true);
    expect(confirmButton()?.disabled).toBe(true);

    type('app-archive-dialog textarea', ' ');
    await settle(fixture);
    expect(dialog?.querySelector('.field__error')?.textContent).toContain('Give a reason.');
    confirmButton()?.click();
    await settle(fixture);
    expect(log.archivedCalls).toEqual([]);

    type('app-archive-dialog textarea', '  The drive ended.  ');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(log.archivedCalls).toEqual([{ id: c.current.id, reason: 'The drive ended.' }]);
    expect(archiveDialog()).toBeNull();
    expect(element.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
      `The ${c.noun} ${c.current.name} was archived. It is under Archived, with your reason, and ` +
        'can be restored there.',
    );
    expect(log.listed).toEqual([false, false]);
  });

  it('shows the archived records: when, by whom and why, with History and Restore but no Edit', async () => {
    const { element, home } = await open(true);

    expect(c.log(home).listed).toEqual([true]);
    const row = words(element.querySelector('tbody tr'));
    expect(row).toContain(c.old.name);
    expect(row).toContain('Archived 3 Nov 2026 by Ana Reyes');
    expect(row).toContain('Reason: The drive ended.');
    expect(buttonNamed(label('History', c.old.name))).not.toBeNull();
    expect(buttonNamed(label('Restore', c.old.name))).not.toBeNull();
    expect(buttonNamed(label('Edit', c.old.name))).toBeNull();
    expect(element.querySelector('.btn--primary')).toBeNull();
    expect(element.textContent).toContain('nothing here is deleted');
  });

  it('restores with a reason, after saying what restoring does', async () => {
    const { fixture, element, home } = await open(true);
    const log = c.log(home);

    buttonNamed(label('Restore', c.old.name))?.click();
    await settle(fixture);
    for (const effect of c.effects.restore) {
      expect(archiveDialog()?.textContent).toContain(effect);
    }
    expect(confirmButton()?.textContent?.trim()).toBe(c.confirm.restore);
    type('app-archive-dialog textarea', 'Running again.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(log.restoredCalls).toEqual([{ id: c.old.id, reason: 'Running again.' }]);
    expect(element.textContent).toContain(`The ${c.noun} ${c.old.name} was restored.`);
    expect(log.listed).toEqual([true, true]);
  });

  it('says plainly — never in a code — that somebody else archived it first, and reads again', async () => {
    const { fixture, home } = await open();
    const log = c.log(home);
    log.moveRefusal = new ArchiveRefusedError('already-archived', 'ALREADY_ARCHIVED');

    buttonNamed(label('Archive', c.current.name))?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'The drive ended.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    const alert = document.querySelector('app-archive-dialog [role="alert"]');
    expect(alert?.textContent).toContain(
      `Someone else archived this ${c.noun} a moment ago, so nothing was done.`,
    );
    expect(alert?.textContent).not.toContain('ALREADY_ARCHIVED');
    expect(archiveDialog()).not.toBeNull();
    expect(log.listed).toEqual([false, false]);
  });

  it('says plainly that somebody else restored it first', async () => {
    const { fixture, home } = await open(true);
    c.log(home).moveRefusal = new ArchiveRefusedError('not-archived', 'NOT_ARCHIVED');

    buttonNamed(label('Restore', c.old.name))?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Running again.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(document.querySelector('app-archive-dialog [role="alert"]')?.textContent).toContain(
      `Someone else restored this ${c.noun} a moment ago, so nothing was done.`,
    );
  });

  it('says a save refused because it was archived meanwhile in words, never the code', async () => {
    const { fixture, home } = await open();
    c.log(home).saveRefusal = new ArchiveRefusedError('read-only', 'ARCHIVED');

    buttonNamed(label('Edit', c.current.name))?.click();
    await settle(fixture);
    c.change();
    await settle(fixture);
    document.querySelector<HTMLButtonElement>(`${c.form} button[type="submit"]`)?.click();
    await settle(fixture);

    const outcome = document.querySelector(`${c.form} .home-form__outcome`)?.textContent;
    expect(outcome).toContain(
      `Not done. This ${c.noun} was archived while you were working on it, so nothing was saved.`,
    );
    expect(outcome).not.toContain('ARCHIVED');
  });

  it('shows the archive history under the edit form, and in its own dialog from the Archived tab', async () => {
    const first = await open();
    buttonNamed(label('Edit', c.current.name))?.click();
    await settle(first.fixture);

    expect(c.log(first.home).histories).toEqual([c.current.id]);
    const lines = [...document.querySelectorAll('[role="dialog"] app-archive-history li')].map(
      words,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Restored');
    expect(lines[0]).toContain('by Ben Cruz');
    expect(lines[0]).toContain('Reason given: Running again in December.');
    expect(lines[1]).toContain('Archived');
    expect(lines[1]).toContain('Reason given: The drive ended.');
    first.fixture.destroy();

    const second = await open(true);
    buttonNamed(label('History', c.old.name))?.click();
    await settle(second.fixture);

    expect(c.log(second.home).histories).toEqual([c.old.id]);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe(`The ${c.noun} ${c.old.name}: archive history`);
    expect(dialog?.querySelectorAll('app-archive-history li')).toHaveLength(2);
  });
});

describe('BannersSection (DL-170)', () => {
  it('says the app has no description of a banner’s image, and asks for none', async () => {
    configure();
    const fixture = TestBed.createComponent(BannersSection);
    const element = await settle(fixture);
    expect(element.textContent).toContain(BANNER_NO_DESCRIPTION);

    buttonNamed('Add a banner')?.click();
    await settle(fixture);
    const form = document.querySelector('app-banner-form');
    expect(form?.textContent).toContain(BANNER_NO_DESCRIPTION);
    expect(form?.querySelector('textarea')).toBeNull();
    expect(
      [...(form?.querySelectorAll('label') ?? [])].map((label) => label.textContent?.trim()),
    ).not.toContain('Description');
  });

  it('adds a banner, saying the image is stored first and stays if the banner is refused', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Add a banner')?.click();
    await settle(fixture);
    type('#banner-title', 'Feeding resumes');
    type('#banner-href', 'https://home.example.test/feeding');
    await settle(fixture);

    const effects = document.querySelector('app-banner-form .home-form__effects')?.textContent;
    expect(effects).toContain(HOME_EFFECTS.bannerCreateShown[0]);
    expect(effects).toContain(HOME_EFFECTS.href[0]);
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(home.createdBanners).toEqual([
      {
        draft: {
          title: 'Feeding resumes',
          href: 'https://home.example.test/feeding',
          sortOrder: 0,
          active: true,
        },
        image: null,
      },
    ]);
  });

  it('shows the current image only when asked, and removes it with its effect said first', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Edit the banner Banner a')?.click();
    await settle(fixture);
    expect(home.imagesRead).toEqual([]);
    buttonNamed('Show the current image')?.click();
    await settle(fixture);
    expect(home.imagesRead).toEqual(['banner-a']);
    expect(document.querySelector('app-banner-form img')?.getAttribute('src')).toBe('blob:test/1');

    const remove = [...document.querySelectorAll<HTMLLabelElement>('app-banner-form label.check')]
      .find((label) => label.textContent?.includes('Remove the image'))
      ?.querySelector('input');
    if (remove === undefined || remove === null) throw new Error('No remove box.');
    remove.checked = true;
    remove.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(document.querySelector('app-banner-form .home-form__effects')?.textContent).toContain(
      HOME_EFFECTS.imageRemoved[0],
    );
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);
    expect(home.updatedBanners[0]?.image).toEqual({ kind: 'remove' });
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('says an archived banner keeps its image, and says nothing of deleting', async () => {
    configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Archive the banner Banner a')?.click();
    await settle(fixture);
    expect(archiveDialog()?.textContent).toContain('Its image stays stored in the system with it.');
    expect(archiveDialog()?.textContent).not.toMatch(/delete/i);
  });
});

describe('LinksSection (DL-170)', () => {
  it('says every link in use is shown, and that archiving is how one comes off', async () => {
    const home = configure();
    const element = await settle(TestBed.createComponent(LinksSection));

    expect(element.textContent).toContain('there is no hidden link');
    expect(element.textContent).toContain('archiving is the way to take one off');
    expect(element.textContent).toContain('1 link in use, every one shown.');
    expect(home.linkLog.listed).toEqual([false]);
  });
});

describe.each([
  { title: 'BannersSection', component: BannersSection as Type<unknown>, list: 'bannerLog' },
  { title: 'LinksSection', component: LinksSection as Type<unknown>, list: 'linkLog' },
] as const)('$title — live (DL-222, DL-225)', ({ component, list }) => {
  it('re-reads its list quietly when the home screen changes, in use or archived', async () => {
    const changes = new Subject<void>();
    const asked: (readonly string[])[] = [];
    const live = {
      changes: (topics: readonly string[]) => {
        asked.push(topics);
        return changes.asObservable();
      },
      noteRefreshed: vi.fn(),
      noteRefreshFailed: vi.fn(),
    };
    const home = configure([{ provide: LiveUpdates, useValue: live }]);
    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('archived', true);
    const element = await settle(fixture);
    expect(asked).toEqual([['home']]);
    expect(home[list].listed).toEqual([true]);

    changes.next();
    fixture.detectChanges();
    // What is on screen stays while the new list is read: no skeleton.
    expect(element.querySelector('app-skeleton')).toBeNull();
    await settle(fixture);

    expect(home[list].listed).toEqual([true, true]);
    expect(live.noteRefreshed).toHaveBeenCalledTimes(2);
  });
});

describe('PreviewSection (DL-170)', () => {
  it('says the app carries no Balita article, never "the latest 0"', () => {
    expect(HOME_SCREEN_COPY.preview.carries(0, 0)).toBe(
      'It also carries 0 hotlines and no Balita article.',
    );
    expect(HOME_SCREEN_COPY.preview.carries(1, 1)).toBe(
      'It also carries 1 hotline and the latest 1 Balita article.',
    );
  });

  it('shows what the app is given, with banner images read through the data layer', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(PreviewSection);
    const element = await settle(fixture);

    expect(element.textContent).toContain('Banner a');
    expect(element.textContent).toContain('Senior citizen ID');
    expect(element.textContent).toContain(
      'It also carries 4 hotlines and the latest 5 Balita articles.',
    );
    expect(home.imagesRead).toEqual(['banner-a']);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Banner: Banner a');

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
  });
});
