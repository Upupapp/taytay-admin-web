import { signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import type { ApiFailure } from '@core/http/api-failure';
import {
  ArchiveRefusedError,
  asId,
  asIsoDateTime,
  DIRECTORY_OFFICE_REPOSITORY,
  COMMAND_CENTER_EFFECTS,
  HOTLINE_EFFECTS,
  HotlineCommandCenterTakenError,
  HOTLINE_REPOSITORY,
  OFFICE_EFFECTS,
  OFFICE_REPOSITORY,
  PROGRAM_REPOSITORY,
  UNSERVED_PORTS,
  SERVICE_EFFECTS,
  TULONG_SERVICE_REPOSITORY,
  type ArchiveEvent,
  type ArchiveEventId,
  type ArchiveRecord,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineRepository,
  type Office,
  type OfficeChanges,
  type OfficeDraft,
  type OfficeId,
  type Permission,
  type ServiceChanges,
  type ServiceDraft,
  type TulongService,
  type TulongServiceId,
  type TulongServiceRepository,
} from '@domain/index';

import { DirectoryPage } from './directory-page';
import { DIRECTORY_COPY } from './directory.copy';
import { HotlinesSection } from './hotlines-section';
import { OfficesSection } from './offices-section';
import { ServicesSection } from './services-section';

const STAMP = asIsoDateTime('2026-11-05T00:00:00.000Z');

/** Midday UTC, so the date reads the same in any test machine's zone. */
const ARCHIVED: ArchiveRecord = {
  at: asIsoDateTime('2026-11-03T12:00:00.000Z'),
  byName: 'Ana Reyes',
  reason: 'Merged into the MSWDO.',
};

/** Newest first, as the server answers. */
const HISTORY: readonly ArchiveEvent[] = [
  {
    id: asId<ArchiveEventId>('event-2'),
    act: 'restored',
    reason: 'Reopened for the holidays.',
    actorName: 'Ben Cruz',
    occurredAt: asIsoDateTime('2026-11-04T12:00:00.000Z'),
  },
  {
    id: asId<ArchiveEventId>('event-1'),
    act: 'archived',
    reason: 'Merged into the MSWDO.',
    actorName: 'Ana Reyes',
    occurredAt: asIsoDateTime('2026-11-03T12:00:00.000Z'),
  },
];

function office(key: string, values: Partial<DirectoryOffice> = {}): DirectoryOffice {
  return {
    id: asId<OfficeId>(`office-${key}`),
    name: `Office ${key}`,
    slug: key,
    shortName: null,
    category: null,
    description: 'Set at creation.',
    head: null,
    hours: null,
    phone: null,
    email: null,
    address: null,
    latitude: null,
    longitude: null,
    hasBanner: false,
    updatedAt: STAMP,
    archived: null,
    ...values,
  };
}

function service(key: string, values: Partial<TulongService> = {}): TulongService {
  return {
    id: asId<TulongServiceId>(`service-${key}`),
    name: `Page ${key}`,
    slug: key,
    category: null,
    summary: 'A summary.',
    details: 'Details.',
    eligibility: null,
    requirements: [],
    contacts: [],
    locations: [],
    officeId: null,
    programId: null,
    acceptsOnlineApplications: false,
    featured: false,
    featuredHeadline: null,
    hiddenFromList: false,
    badge: null,
    iconKey: null,
    tileColor: null,
    legalBasis: null,
    claimSteps: [],
    schedule: null,
    hasImage: false,
    updatedAt: STAMP,
    archived: null,
    ...values,
  };
}

function hotline(key: string, values: Partial<Hotline> = {}): Hotline {
  return {
    id: asId<HotlineId>(`hotline-${key}`),
    name: `Line ${key}`,
    number: '(02) 8000 0111',
    category: 'Emergency',
    kind: 'other',
    sortOrder: 1,
    active: true,
    updatedAt: STAMP,
    archived: null,
    ...values,
  };
}

/**
 * The archive half every directory repository shares (`DL-225`): the list in use or archived, read
 * whole; archive and restore with a reason; the history. Records every call, and answers with a
 * refusal when a test sets one, as the adapters raise it.
 */
class ArchiveRecorder<TId extends string, TRow extends { readonly id: TId }> {
  inUse: readonly TRow[];
  archivedRows: readonly TRow[];
  readonly listed: boolean[] = [];
  readonly archivedCalls: { id: TId; reason: string }[] = [];
  readonly restoredCalls: { id: TId; reason: string }[] = [];
  readonly histories: TId[] = [];
  events: readonly ArchiveEvent[] = HISTORY;
  listRefusal: unknown = null;
  moveRefusal: unknown = null;
  saveRefusal: unknown = null;

  constructor(inUse: readonly TRow[], archivedRows: readonly TRow[]) {
    this.inUse = inUse;
    this.archivedRows = archivedRows;
  }

  list(archived: boolean): Observable<readonly TRow[]> {
    this.listed.push(archived);
    const refusal = this.listRefusal;
    if (refusal !== null) return throwError(() => refusal);
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
  protected saving<T>(answer: () => T): Observable<T> {
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

class RecordingOffices
  extends ArchiveRecorder<OfficeId, DirectoryOffice>
  implements DirectoryOfficeRepository
{
  readonly created: { draft: OfficeDraft; banner: Blob | null }[] = [];
  readonly updated: { id: OfficeId; changes: OfficeChanges }[] = [];

  constructor() {
    super([office('a', { hasBanner: true }), office('b')], [office('old', { archived: ARCHIVED })]);
  }

  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice> {
    return this.saving(() => {
      this.created.push({ draft, banner });
      return office('new', { ...draft });
    });
  }

  update(id: OfficeId, changes: OfficeChanges): Observable<DirectoryOffice> {
    return this.saving(() => {
      this.updated.push({ id, changes });
      return office('a', { ...changes });
    });
  }
}

class RecordingServices
  extends ArchiveRecorder<TulongServiceId, TulongService>
  implements TulongServiceRepository
{
  readonly updated: { id: TulongServiceId; changes: ServiceChanges }[] = [];
  readonly created: ServiceDraft[] = [];

  constructor() {
    super(
      [service('senior-id', { featured: true }), service('hidden', { hiddenFromList: true })],
      [service('old', { archived: ARCHIVED })],
    );
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    return this.saving(() => {
      this.created.push(draft);
      return service('new', { ...draft });
    });
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    return this.saving(() => {
      this.updated.push({ id, changes });
      return service('senior-id', { ...changes });
    });
  }

  replaceImage(id: TulongServiceId): Observable<TulongService> {
    return of(service(id, { hasImage: true }));
  }
}

class RecordingHotlines extends ArchiveRecorder<HotlineId, Hotline> implements HotlineRepository {
  readonly updated: { id: HotlineId; changes: HotlineChanges }[] = [];
  readonly created: HotlineDraft[] = [];

  constructor() {
    super(
      [
        hotline('rescue'),
        hotline('old-shown', { name: 'Line hidden', active: false, sortOrder: 20 }),
      ],
      [hotline('old', { archived: ARCHIVED })],
    );
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    return this.saving(() => {
      this.created.push(draft);
      return hotline('new', draft);
    });
  }

  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline> {
    return this.saving(() => {
      this.updated.push({ id, changes });
      return hotline('rescue', changes);
    });
  }
}

interface Recorders {
  offices: RecordingOffices;
  services: RecordingServices;
  hotlines: RecordingHotlines;
  /** What the office directory (`OFFICE_REPOSITORY`) lists: the offices in use, by name. */
  officeNames: readonly Office[];
}

function configure(
  granted: readonly Permission[] = ['office.manage', 'service.manage', 'hotline.manage'],
): Recorders {
  const recorders: Recorders = {
    offices: new RecordingOffices(),
    services: new RecordingServices(),
    hotlines: new RecordingHotlines(),
    officeNames: [],
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DIRECTORY_OFFICE_REPOSITORY, useValue: recorders.offices },
      { provide: TULONG_SERVICE_REPOSITORY, useValue: recorders.services },
      { provide: HOTLINE_REPOSITORY, useValue: recorders.hotlines },
      { provide: OFFICE_REPOSITORY, useValue: { list: () => of(recorders.officeNames) } },
      { provide: PROGRAM_REPOSITORY, useValue: { listActive: () => of([]) } },
      { provide: UNSERVED_PORTS, useValue: [] },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  return recorders;
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

function tick(selector: string, checked: boolean): void {
  const box = [...document.querySelectorAll<HTMLLabelElement>('label.check')]
    .find((label) => label.textContent?.includes(selector))
    ?.querySelector('input');
  if (box === undefined || box === null) throw new Error(`No box for ${selector}.`);
  box.checked = checked;
  box.dispatchEvent(new Event('change'));
}

/** The archive or restore confirmation, while it is open. */
function archiveDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('app-archive-dialog [role="dialog"]');
}

function confirmButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('app-archive-dialog .btn--primary');
}

/** Says the words in an element as a reader hears them: one space between each. */
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

/* ── the page ────────────────────────────────────────────────────────────── */

describe('DirectoryPage (DL-170)', () => {
  it('says residents see it, before anything else', async () => {
    configure();
    const element = await settle(TestBed.createComponent(DirectoryPage));

    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Residents see this in the Taytay app',
    );
  });

  it('offers only the sections the reader holds a key for, and opens the one in the URL', async () => {
    configure(['service.manage', 'hotline.manage']);
    const fixture = TestBed.createComponent(DirectoryPage);
    fixture.componentRef.setInput('section', 'hotlines');
    const element = await settle(fixture);

    expect(
      [...element.querySelectorAll('.directory-tabs__link')].map((a) => a.textContent?.trim()),
    ).toEqual(['Tulong pages', 'Hotlines']);
    expect(element.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Hotlines');
    expect(element.querySelector('app-hotlines-section')).not.toBeNull();
    expect(element.querySelector('app-offices-section')).toBeNull();
  });

  it('opens the first section offered for an unknown one', async () => {
    configure();
    const fixture = TestBed.createComponent(DirectoryPage);
    fixture.componentRef.setInput('section', 'banners');
    const element = await settle(fixture);

    expect(element.querySelector('app-offices-section')).not.toBeNull();
  });

  it('shows the archived list the address names, and its tabs keep the section (DL-225)', async () => {
    const { hotlines } = configure();
    await TestBed.inject(Router).navigateByUrl('/?section=hotlines&archived=true');
    const fixture = TestBed.createComponent(DirectoryPage);
    fixture.componentRef.setInput('section', 'hotlines');
    fixture.componentRef.setInput('archived', 'true');
    const element = await settle(fixture);

    expect(hotlines.listed).toEqual([true]);
    const tabs = [...element.querySelectorAll('app-archive-tabs a')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['In use', 'Archived']);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/?section=hotlines',
      '/?section=hotlines&archived=true',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('reads the list in use when the address says anything but true', async () => {
    const { offices } = configure();
    const fixture = TestBed.createComponent(DirectoryPage);
    fixture.componentRef.setInput('archived', 'yes');
    await settle(fixture);

    expect(offices.listed).toEqual([false]);
  });
});

/* ── archive, never delete: the same acts in each section (DL-225) ──────── */

/** What a test reads back from a section's recording repository. */
interface ArchiveLog {
  readonly listed: readonly boolean[];
  readonly archivedCalls: readonly { readonly id: string; readonly reason: string }[];
  readonly restoredCalls: readonly { readonly id: string; readonly reason: string }[];
  readonly histories: readonly string[];
  events: readonly ArchiveEvent[];
  moveRefusal: unknown;
  saveRefusal: unknown;
}

interface ArchiveCase {
  readonly title: string;
  readonly component: Type<unknown>;
  readonly log: (recorders: Recorders) => ArchiveLog;
  /** A record in use, and one archived, as the fake lists them. */
  readonly current: { readonly id: string; readonly name: string };
  readonly old: { readonly id: string; readonly name: string };
  readonly noun: string;
  readonly effects: { readonly archive: readonly string[]; readonly restore: readonly string[] };
  readonly confirm: { readonly archive: string; readonly restore: string };
  readonly restored: string;
  readonly form: string;
  /** Changes the open form so it has something to save. */
  readonly change: () => void;
}

const CASES: readonly ArchiveCase[] = [
  {
    title: 'OfficesSection',
    component: OfficesSection,
    log: (recorders) => recorders.offices,
    current: { id: 'office-a', name: 'Office a' },
    old: { id: 'office-old', name: 'Office old' },
    noun: 'office',
    effects: OFFICE_EFFECTS,
    confirm: { archive: 'Archive the office', restore: 'Restore the office' },
    restored: 'Office old was restored to the app’s directory.',
    form: 'app-office-form',
    change: () => type('#office-slug', 'office-a-renamed'),
  },
  {
    title: 'ServicesSection',
    component: ServicesSection,
    log: (recorders) => recorders.services,
    current: { id: 'service-senior-id', name: 'Page senior-id' },
    old: { id: 'service-old', name: 'Page old' },
    noun: 'Tulong page',
    effects: SERVICE_EFFECTS,
    confirm: { archive: 'Archive the page', restore: 'Restore the page' },
    restored: 'Page old was restored to the app.',
    form: 'app-service-form',
    change: () => tick('Hide from the app’s catalogue', true),
  },
  {
    title: 'HotlinesSection',
    component: HotlinesSection,
    log: (recorders) => recorders.hotlines,
    current: { id: 'hotline-rescue', name: 'Line rescue' },
    old: { id: 'hotline-old', name: 'Line old' },
    noun: 'hotline',
    effects: HOTLINE_EFFECTS,
    confirm: { archive: 'Archive the hotline', restore: 'Restore the hotline' },
    restored: 'Line old was restored.',
    form: 'app-hotline-form',
    change: () => type('#hotline-number', '(02) 8000 0222'),
  },
];

describe.each(CASES)('$title — archive, never delete (DL-225)', (c) => {
  async function open(archived = false): Promise<{
    fixture: ComponentFixture<unknown>;
    element: HTMLElement;
    log: ArchiveLog;
  }> {
    const log = c.log(configure());
    const fixture = TestBed.createComponent(c.component);
    if (archived) fixture.componentRef.setInput('archived', true);
    const element = await settle(fixture);
    return { fixture, element, log };
  }

  it('offers Edit and Archive on a record in use, and nothing that deletes', async () => {
    const { element, log } = await open();

    expect(log.listed).toEqual([false]);
    expect(buttonNamed(`Edit ${c.current.name}`)).not.toBeNull();
    expect(buttonNamed(`Archive ${c.current.name}`)?.className).toBe('btn');
    expect(buttonNamed(`Restore ${c.current.name}`)).toBeNull();
    expect(element.textContent).not.toMatch(/delete/i);
  });

  it('archives only after a confirmation that says what it does first, with a reason, trimmed', async () => {
    const { fixture, element, log } = await open();

    buttonNamed(`Archive ${c.current.name}`)?.click();
    await settle(fixture);
    const dialog = archiveDialog();
    for (const effect of c.effects.archive) {
      expect(dialog?.textContent).toContain(effect);
    }
    const confirm = confirmButton();
    expect(confirm?.textContent?.trim()).toBe(c.confirm.archive);
    expect(follows(dialog?.querySelector('ul'), confirm)).toBe(true);
    expect(confirm?.getAttribute('aria-describedby')).toBe(dialog?.querySelector('ul')?.id);

    // No reason yet: the button waits, and the hint says why without scolding.
    expect(confirm?.disabled).toBe(true);
    expect(dialog?.querySelector('.field__error')).toBeNull();
    expect(dialog?.textContent).toContain('Required, up to 500 characters.');

    // A blank one is explained, and still nothing is sent.
    type('app-archive-dialog textarea', '   ');
    await settle(fixture);
    expect(dialog?.querySelector('.field__error')?.textContent).toContain(
      'Give a reason. It is kept with the record, under your name.',
    );
    expect(dialog?.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
    expect(confirmButton()?.disabled).toBe(true);
    confirmButton()?.click();
    await settle(fixture);
    expect(log.archivedCalls).toEqual([]);

    type('app-archive-dialog textarea', '  No longer offered.  ');
    await settle(fixture);
    expect(confirmButton()?.disabled).toBe(false);
    confirmButton()?.click();
    await settle(fixture);

    expect(log.archivedCalls).toEqual([{ id: c.current.id, reason: 'No longer offered.' }]);
    expect(archiveDialog()).toBeNull();
    expect(element.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
      `${c.current.name} was archived. It is under Archived, with your reason, and can be restored there.`,
    );
    // The list is read again, so the row leaves it.
    expect(log.listed).toEqual([false, false]);
  });

  it('shows the archived records: when, by whom and why, with History and Restore but no Edit', async () => {
    const { element, log } = await open(true);

    expect(log.listed).toEqual([true]);
    const row = words(element.querySelector('tbody tr'));
    expect(row).toContain(c.old.name);
    expect(row).toContain('Archived 3 Nov 2026 by Ana Reyes');
    expect(row).toContain('Reason: Merged into the MSWDO.');
    expect(buttonNamed(`History of ${c.old.name}`)).not.toBeNull();
    expect(buttonNamed(`Restore ${c.old.name}`)?.className).toBe('btn');
    expect(buttonNamed(`Edit ${c.old.name}`)).toBeNull();
    expect(buttonNamed(`Archive ${c.old.name}`)).toBeNull();
    // Nothing is added to an archive.
    expect(element.querySelector('.btn--primary')).toBeNull();
    expect(element.textContent).toContain('nothing in this directory is deleted');
  });

  it('restores with a reason, after saying what restoring does', async () => {
    const { fixture, element, log } = await open(true);

    buttonNamed(`Restore ${c.old.name}`)?.click();
    await settle(fixture);
    for (const effect of c.effects.restore) {
      expect(archiveDialog()?.textContent).toContain(effect);
    }
    expect(confirmButton()?.textContent?.trim()).toBe(c.confirm.restore);
    type('app-archive-dialog textarea', 'Offered again.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(log.restoredCalls).toEqual([{ id: c.old.id, reason: 'Offered again.' }]);
    expect(archiveDialog()).toBeNull();
    expect(element.textContent).toContain(c.restored);
    expect(log.listed).toEqual([true, true]);
  });

  it('says plainly — never in a code — that somebody else archived it first, and reads the list again', async () => {
    const { fixture, log } = await open();
    log.moveRefusal = new ArchiveRefusedError('already-archived', 'ALREADY_ARCHIVED');

    buttonNamed(`Archive ${c.current.name}`)?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'No longer offered.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    const alert = document.querySelector('app-archive-dialog .callout--danger[role="alert"]');
    expect(alert?.textContent).toContain(
      `Someone else archived this ${c.noun} a moment ago, so nothing was done. It is under Archived now.`,
    );
    expect(alert?.textContent).not.toContain('ALREADY_ARCHIVED');
    expect(archiveDialog()).not.toBeNull();
    expect(log.listed).toEqual([false, false]);
  });

  it('says plainly that somebody else restored it first, and reads the list again', async () => {
    const { fixture, log } = await open(true);
    log.moveRefusal = new ArchiveRefusedError('not-archived', 'NOT_ARCHIVED');

    buttonNamed(`Restore ${c.old.name}`)?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Offered again.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    const alert = document.querySelector('app-archive-dialog [role="alert"]');
    expect(alert?.textContent).toContain(
      `Someone else restored this ${c.noun} a moment ago, so nothing was done. It is under In use now.`,
    );
    expect(alert?.textContent).not.toContain('NOT_ARCHIVED');
    expect(log.listed).toEqual([true, true]);
  });

  it('says a save refused because it was archived meanwhile in words, never the code', async () => {
    const { fixture, log } = await open();
    log.saveRefusal = new ArchiveRefusedError('read-only', 'ARCHIVED');

    buttonNamed(`Edit ${c.current.name}`)?.click();
    await settle(fixture);
    c.change();
    await settle(fixture);
    document.querySelector<HTMLButtonElement>(`${c.form} button[type="submit"]`)?.click();
    await settle(fixture);

    const outcome = document.querySelector(`${c.form} .directory-form__outcome`)?.textContent;
    expect(outcome).toContain(
      `Not done. This ${c.noun} was archived while you were working on it, so nothing was saved. ` +
        `An archived ${c.noun} cannot be changed: restore it first, then make the change.`,
    );
    expect(outcome).not.toContain('ARCHIVED');
  });

  it('shows the archive history under the edit form, newest first, in words', async () => {
    const { fixture, log } = await open();

    buttonNamed(`Edit ${c.current.name}`)?.click();
    await settle(fixture);

    expect(log.histories).toEqual([c.current.id]);
    const history = document.querySelector('[role="dialog"] app-archive-history');
    expect(history?.textContent).toContain('Archive history');
    const lines = [...(history?.querySelectorAll('li') ?? [])].map(words);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Restored');
    expect(lines[0]).toContain('by Ben Cruz');
    expect(lines[0]).toContain('Reason given: Reopened for the holidays.');
    expect(lines[1]).toContain('Archived');
    expect(lines[1]).toContain('by Ana Reyes');
    expect(lines[1]).toContain('Reason given: Merged into the MSWDO.');
  });

  it('opens an archived record’s history in its own dialog, and says when there is none', async () => {
    const { fixture, log } = await open(true);
    log.events = [];

    buttonNamed(`History of ${c.old.name}`)?.click();
    await settle(fixture);

    expect(log.histories).toEqual([c.old.id]);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe(`${c.old.name}: archive history`);
    expect(dialog?.textContent).toContain('It has never been archived.');
    expect(dialog?.querySelector('form')).toBeNull();

    buttonNamed('Close', dialog ?? document)?.click();
    await settle(fixture);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

/* ── offices ─────────────────────────────────────────────────────────────── */

describe('OfficesSection (DL-170)', () => {
  it('reads every office in use whole, by name, and says how many — never "page 1 of N"', async () => {
    const { offices } = configure();
    const element = await settle(TestBed.createComponent(OfficesSection));

    expect(offices.listed).toEqual([false]);
    expect(element.textContent).toContain('2 offices in use.');
    expect(element.textContent).not.toMatch(/page \d+ of/i);
    expect(buttonNamed('Show more')).toBeNull();
  });

  it('keeps the dialog open and says in words what still uses the office', async () => {
    const { offices } = configure();
    offices.moveRefusal = new ArchiveRefusedError(
      'office-in-use',
      'OFFICE_IN_USE: the office is referenced.',
      { staffAccounts: 2, services: 1, issuanceTypes: 0 },
    );
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Archive Office b')?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Merged into the MSWDO.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    const alert = document.querySelector('app-archive-dialog [role="alert"]');
    expect(alert?.textContent).toContain(
      'The office is still in use, so it was not archived. It stays under In use until nothing uses it:',
    );
    const lines = [...(alert?.querySelectorAll('li') ?? [])].map(words);
    expect(lines).toEqual([
      '2 staff accounts are linked to it. Link them to another office in Users and roles.',
      '1 Tulong page in use is under it. Archive them under Tulong pages.',
    ]);
    expect(alert?.textContent).not.toContain('OFFICE_IN_USE');
    // Kept open, with the reason as typed, and the button offered again.
    expect(archiveDialog()).not.toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>('app-archive-dialog textarea')?.value).toBe(
      'Merged into the MSWDO.',
    );
    expect(confirmButton()?.disabled).toBe(false);
    // Nothing moved, so nothing is read again.
    expect(offices.listed).toEqual([false]);
  });

  it('says what another failure said, after "Not done."', async () => {
    const { offices } = configure();
    offices.moveRefusal = new Error('The server is busy.');
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Archive Office b')?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Merged.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(document.querySelector('app-archive-dialog [role="alert"]')?.textContent).toContain(
      'Not done. The server is busy.',
    );
  });

  it('adds an office: says what it does before the button, and sends nothing the app would refuse', async () => {
    const { offices } = configure();
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Add an office')?.click();
    await settle(fixture);
    const form = document.querySelector('app-office-form');
    const effects = form?.querySelector('.directory-form__effects');
    const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(effects?.textContent).toContain(OFFICE_EFFECTS.create[0]);
    expect(follows(effects, submit)).toBe(true);
    // A new office has no history yet.
    expect(document.querySelector('app-archive-history')).toBeNull();

    type('#office-name', 'Tourism Office');
    type('#office-slug', 'Tourism Office');
    await settle(fixture);
    submit?.click();
    await settle(fixture);
    expect(offices.created).toEqual([]);
    expect(form?.querySelector('[role="alert"]')?.textContent).toContain('lower-case letters');

    type('#office-slug', 'tourism');
    type('#office-latitude', '14.5');
    await settle(fixture);
    form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await settle(fixture);
    expect(offices.created).toEqual([
      {
        draft: expect.objectContaining({
          name: 'Tourism Office',
          slug: 'tourism',
          latitude: 14.5,
          email: null,
        }),
        banner: null,
      },
    ]);
  });

  it('changes an office with only what a change can carry, and says what a new address does', async () => {
    const { offices } = configure();
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Edit Office a')?.click();
    await settle(fixture);
    const form = document.querySelector('app-office-form');
    expect(form?.textContent).toContain('Nothing has changed yet.');
    expect(form?.querySelector('#office-description')).toBeNull();
    expect(form?.textContent).toContain('Set at creation.');

    type('#office-slug', 'office-a');
    await settle(fixture);
    expect(form?.querySelector('.directory-form__effects')?.textContent).toContain(
      OFFICE_EFFECTS.slug[0],
    );
    form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await settle(fixture);

    expect(offices.updated).toEqual([{ id: 'office-a', changes: { slug: 'office-a' } }]);
  });

  it('says so when there is no archived office', async () => {
    const { offices } = configure();
    offices.archivedRows = [];
    const fixture = TestBed.createComponent(OfficesSection);
    fixture.componentRef.setInput('archived', true);
    const element = await settle(fixture);

    expect(element.textContent).toContain('No archived offices');
    expect(buttonNamed('Add an office')).toBeNull();
  });
});

/* ── Tulong pages ────────────────────────────────────────────────────────── */

describe('ServicesSection (DL-170)', () => {
  it('lists every page in use, hidden ones included, and asks for no address to open one', async () => {
    const { services } = configure();
    const element = await settle(TestBed.createComponent(ServicesSection));

    expect(services.listed).toEqual([false]);
    expect(element.textContent).toContain('A page is never a programme itself.');
    expect(element.textContent).not.toContain('cannot apply through it');
    expect(element.textContent).toContain('Page hidden');
    expect(element.textContent).toContain('2 pages in use, hidden ones included.');
    expect(element.querySelector('#service-find')).toBeNull();
    expect(element.querySelector('.directory-section__find')).toBeNull();
  });

  it('names a page’s archived office as archived, and an office it cannot read as an archived one', async () => {
    const recorders = configure();
    recorders.officeNames = [
      {
        id: asId<OfficeId>('office-mswdo'),
        name: 'Municipal Social Welfare and Development Office',
        slug: 'mswdo',
        shortName: 'MSWDO',
      },
    ];
    recorders.services.inUse = [
      service('a', { name: 'Senior ID', officeId: asId<OfficeId>('office-mswdo') }),
      service('b', { name: 'Old programme', officeId: asId<OfficeId>('office-old') }),
      service('c', { name: 'Unread', officeId: asId<OfficeId>('office-gone') }),
    ];
    const element = await settle(TestBed.createComponent(ServicesSection));

    const rows = [...element.querySelectorAll('tbody tr')].map(words);
    expect(rows[0]).toContain('Municipal Social Welfare and Development Office (MSWDO)');
    expect(rows[1]).toContain('Office old (archived)');
    expect(rows[2]).toContain('An archived office');
    expect(rows[2]).not.toContain('office-gone');
  });

  it('says what hiding and featuring do before saving, and sends only the change', async () => {
    const { services } = configure();
    const fixture = TestBed.createComponent(ServicesSection);
    await settle(fixture);

    buttonNamed('Edit Page senior-id')?.click();
    await settle(fixture);
    tick('Hide from the app’s catalogue', true);
    tick('Feature on the app’s home screen', false);
    await settle(fixture);

    const effects = document.querySelector(
      'app-service-form .directory-form__effects',
    )?.textContent;
    expect(effects).toContain(SERVICE_EFFECTS.hide[1]);
    expect(effects).toContain(SERVICE_EFFECTS.unfeature[0]);
    document.querySelector<HTMLButtonElement>('app-service-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(services.updated).toEqual([
      { id: 'service-senior-id', changes: { hiddenFromList: true, featured: false } },
    ]);
  });

  it('adds a picture only once the page exists', async () => {
    configure();
    const fixture = TestBed.createComponent(ServicesSection);
    await settle(fixture);

    buttonNamed('Add a page')?.click();
    await settle(fixture);
    const form = document.querySelector('app-service-form');
    expect(form?.querySelector('input[type="file"]')).toBeNull();
    expect(form?.textContent).toContain('Add a picture once the page exists.');
    expect(form?.textContent).not.toContain('Feature on the app’s home screen');
  });

  it('says a restore under an archived office is refused, in words, with the dialog kept open', async () => {
    const { services } = configure();
    services.moveRefusal = new ArchiveRefusedError('office-archived', 'OFFICE_ARCHIVED');
    const fixture = TestBed.createComponent(ServicesSection);
    fixture.componentRef.setInput('archived', true);
    await settle(fixture);

    buttonNamed('Restore Page old')?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Offered again.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    const alert = document.querySelector('app-archive-dialog [role="alert"]');
    expect(alert?.textContent).toContain(
      'That office has been archived, so nothing was put under it. Choose an office in use, or ' +
        'restore that office first under App directory, Offices, Archived.',
    );
    expect(alert?.textContent).not.toContain('OFFICE_ARCHIVED');
    expect(archiveDialog()).not.toBeNull();
    // Nobody else moved it: the list is not read again.
    expect(services.listed).toEqual([true]);
  });

  it('says a page saved under an archived office was not saved, in words', async () => {
    const { services } = configure();
    services.saveRefusal = new ArchiveRefusedError('office-archived', 'OFFICE_ARCHIVED');
    const fixture = TestBed.createComponent(ServicesSection);
    await settle(fixture);

    buttonNamed('Edit Page senior-id')?.click();
    await settle(fixture);
    tick('Hide from the app’s catalogue', true);
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('app-service-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(
      document.querySelector('app-service-form .directory-form__outcome')?.textContent,
    ).toContain('Not done. That office has been archived, so nothing was put under it.');
  });
});

/* ── hotlines ────────────────────────────────────────────────────────────── */

describe('HotlinesSection (DL-170)', () => {
  it('lists shown and hidden lines in use, whole, and says nothing of a cap', async () => {
    const { hotlines } = configure();
    const element = await settle(TestBed.createComponent(HotlinesSection));

    expect(hotlines.listed).toEqual([false]);
    expect(element.textContent).toContain('Shown in the app');
    expect(element.textContent).toContain('Hidden from the app');
    expect(element.textContent).toContain('2 lines in use, shown and hidden.');
    expect(element.textContent).not.toContain('the most the API sends');
  });

  it('shows a list too long to send as an error, in the server’s words, with Try again (DL-225)', async () => {
    const { hotlines } = configure();
    const tooLong: ApiFailure = {
      code: 'LIST_TOO_LONG',
      status: 503,
      message: 'There are more hotlines than one list can hold. Archive some, then try again.',
      details: null,
      requestId: 'req-1',
      retryAfterSeconds: null,
      counts: null,
    };
    hotlines.listRefusal = tooLong;
    const fixture = TestBed.createComponent(HotlinesSection);
    const element = await settle(fixture);

    expect(element.textContent).toContain(
      'There are more hotlines than one list can hold. Archive some, then try again.',
    );
    expect(element.textContent).not.toContain('LIST_TOO_LONG');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).not.toContain('No line is marked as the command center.');

    hotlines.listRefusal = null;
    buttonNamed('Try again')?.click();
    await settle(fixture);

    expect(hotlines.listed).toEqual([false, false]);
    expect(element.textContent).toContain('2 lines in use, shown and hidden.');
  });

  it('reads a changed number back, and says what hiding does, before saving', async () => {
    const { hotlines } = configure();
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Edit Line rescue')?.click();
    await settle(fixture);
    type('#hotline-number', '(02) 8000 0222');
    tick('Show in the app', false);
    await settle(fixture);

    const effects = document.querySelector(
      'app-hotline-form .directory-form__effects',
    )?.textContent;
    expect(effects).toContain('(02) 8000 0111 → (02) 8000 0222');
    expect(effects).toContain(HOTLINE_EFFECTS.number[0]);
    expect(effects).toContain(HOTLINE_EFFECTS.hide[0]);
    document.querySelector<HTMLButtonElement>('app-hotline-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(hotlines.updated).toEqual([
      { id: 'hotline-rescue', changes: { number: '(02) 8000 0222', active: false } },
    ]);
  });

  it('refuses a number the API would refuse, without sending it', async () => {
    const { hotlines } = configure();
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Add a hotline')?.click();
    await settle(fixture);
    type('#hotline-name', 'Rescue');
    type('#hotline-number', 'call us');
    type('#hotline-category', 'Emergency');
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('app-hotline-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(hotlines.created).toEqual([]);
    expect(document.querySelector('app-hotline-form [role="alert"]')?.textContent).toContain(
      'A number is digits',
    );
  });

  it('says nothing of a command center among the archived lines', async () => {
    configure();
    const fixture = TestBed.createComponent(HotlinesSection);
    fixture.componentRef.setInput('archived', true);
    const element = await settle(fixture);

    expect(element.textContent).toContain('1 archived line.');
    expect(element.querySelector('.callout--warning')).toBeNull();
    expect(buttonNamed('Add a hotline')).toBeNull();
  });
});

describe('HotlinesSection — a line’s kind and the command center (DL-217)', () => {
  function select(selector: string, value: string): void {
    const element = document.querySelector<HTMLSelectElement>(selector);
    if (element === null) throw new Error(`No ${selector}.`);
    element.value = value;
    element.dispatchEvent(new Event('change'));
  }

  function submit(): void {
    document.querySelector<HTMLButtonElement>('app-hotline-form button[type="submit"]')?.click();
  }

  it('shows each line’s kind as words, and says plainly when no line is the command center', async () => {
    configure();
    const element = await settle(TestBed.createComponent(HotlinesSection));

    const cells = [...element.querySelectorAll('td, th')].map((cell) => cell.textContent?.trim());
    expect(cells).toContain('Kind');
    expect(cells).toContain('Other');
    const note = element.querySelector('.callout--warning');
    expect(note?.textContent).toContain('No line is marked as the command center.');
    expect(note?.textContent).toContain('set its kind to Command center');
  });

  it('names the command center when one is marked, and not an inactive one', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [
      hotline('rescue', { name: 'Rescue', number: '(02) 8000 0111', kind: 'command-center' }),
      hotline('old', { kind: 'command-center', active: false }),
    ];
    const element = await settle(TestBed.createComponent(HotlinesSection));

    expect(element.textContent).toContain('The command center is Rescue, (02) 8000 0111');
    expect(element.textContent).toContain('Command center');
    expect(element.querySelector('.callout--warning')).toBeNull();
  });

  it('offers every kind with the command center explained, and sends the one chosen', async () => {
    const { hotlines } = configure();
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Add a hotline')?.click();
    await settle(fixture);
    const options = [...document.querySelectorAll('#hotline-kind option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(options).toEqual([
      'Command center',
      'Emergency 911',
      'Police',
      'Fire',
      'Medical',
      'Disaster and rescue',
      'Other',
    ]);
    expect(document.querySelector('#hotline-kind-hint')?.textContent).toContain(
      'the one line the app shows when it tells residents to call for an emergency',
    );
    type('#hotline-name', 'Emergency');
    type('#hotline-number', '911');
    type('#hotline-category', 'Emergency');
    select('#hotline-kind', 'emergency');
    await settle(fixture);
    submit();
    await settle(fixture);

    expect(hotlines.created).toEqual([
      {
        name: 'Emergency',
        number: '911',
        category: 'Emergency',
        kind: 'emergency',
        sortOrder: 0,
        active: true,
      },
    ]);
  });

  it('says before the button that the role is held by another line, and says it becomes one otherwise', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [
      hotline('rescue', { name: 'Rescue', number: '(02) 8000 0111', kind: 'command-center' }),
      hotline('police', { name: 'Police', kind: 'police' }),
    ];
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Edit Police')?.click();
    await settle(fixture);
    select('#hotline-kind', 'command-center');
    await settle(fixture);

    const warning = document.querySelector('#hotline-kind-taken');
    expect(warning?.textContent).toContain('Rescue ((02) 8000 0111) is the command center now');
    expect(warning?.textContent).toContain(
      'The server will refuse this until Rescue is given another kind',
    );
    expect(document.querySelector('#hotline-kind')?.getAttribute('aria-describedby')).toContain(
      'hotline-kind-taken',
    );
    const submitButton = document.querySelector('app-hotline-form button[type="submit"]');
    expect(follows(warning, submitButton)).toBe(true);
    // A warning, not a block: the list is a moment old, and the server decides.
    expect(submitButton?.hasAttribute('disabled')).toBe(false);

    // Hidden, it is no second command center, and the warning goes.
    tick('Show in the app', false);
    await settle(fixture);
    expect(document.querySelector('#hotline-kind-taken')).toBeNull();
  });

  it('shows a line the server sent with no kind as not set, never as Other (DL-220)', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [
      hotline('old', { name: 'Old line', kind: null }),
      hotline('fire', { name: 'Fire', kind: 'fire' }),
    ];
    const element = await settle(TestBed.createComponent(HotlinesSection));

    const rows = [...element.querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');
    expect(rows[0]).toContain('Type not set');
    expect(rows[0]).not.toContain('Other');
    expect(element.textContent).toContain('1 line has no type set: the server did not say');
  });

  it('edits a line whose kind is not set, and sends no kind until one is chosen', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [hotline('old', { name: 'Old line', kind: null })];
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Edit Old line')?.click();
    await settle(fixture);
    const kind = document.querySelector<HTMLSelectElement>('#hotline-kind');
    expect(kind?.selectedOptions[0]?.textContent?.trim()).toBe('Type not set — choose one');
    type('#hotline-name', 'Old line, renamed');
    await settle(fixture);
    submit();
    await settle(fixture);
    expect(hotlines.updated.at(-1)?.changes).toEqual({ name: 'Old line, renamed' });

    buttonNamed('Edit Old line')?.click();
    await settle(fixture);
    select('#hotline-kind', 'medical');
    await settle(fixture);
    expect(document.querySelector('#hotline-kind option[value=""]')).toBeNull();
    submit();
    await settle(fixture);
    expect(hotlines.updated.at(-1)?.changes).toEqual({ kind: 'medical' });
  });

  it('says what giving up the role does, before saving', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [hotline('rescue', { name: 'Rescue', kind: 'command-center' })];
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Edit Rescue')?.click();
    await settle(fixture);
    select('#hotline-kind', 'disaster');
    await settle(fixture);

    expect(
      document.querySelector('app-hotline-form .directory-form__effects')?.textContent,
    ).toContain(COMMAND_CENTER_EFFECTS.leaves[0]);
  });

  it('puts the server’s refusal of a second command center beside the kind, until it is changed', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [hotline('police', { name: 'Police', kind: 'police' })];
    hotlines.saveRefusal = new HotlineCommandCenterTakenError(
      'An active command-center hotline already exists.',
    );
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Edit Police')?.click();
    await settle(fixture);
    select('#hotline-kind', 'command-center');
    await settle(fixture);
    submit();
    await settle(fixture);

    const kind = document.querySelector('#hotline-kind');
    expect(document.querySelector('#hotline-kind-error')?.textContent).toContain(
      'An active command-center hotline already exists.',
    );
    expect(kind?.getAttribute('aria-invalid')).toBe('true');
    expect(kind?.getAttribute('aria-describedby')).toContain('hotline-kind-error');
    expect(document.querySelector('.directory-form__outcome')).toBeNull();

    select('#hotline-kind', 'police');
    await settle(fixture);
    expect(document.querySelector('#hotline-kind-error')).toBeNull();
  });

  it('says archiving the command center leaves the app without one, before the button', async () => {
    const { hotlines } = configure();
    hotlines.inUse = [hotline('rescue', { name: 'Rescue', kind: 'command-center' })];
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Archive Rescue')?.click();
    await settle(fixture);

    const dialog = archiveDialog();
    expect(dialog?.textContent).toContain(COMMAND_CENTER_EFFECTS.leaves[0]);
    expect(dialog?.textContent).toContain(HOTLINE_EFFECTS.archive[0]);
    expect(follows(dialog?.querySelector('ul'), confirmButton())).toBe(true);
  });

  it('says which line to change first when a restore would make a second command center', async () => {
    const { hotlines } = configure();
    hotlines.archivedRows = [
      hotline('old', { name: 'Old rescue', kind: 'command-center', archived: ARCHIVED }),
    ];
    hotlines.moveRefusal = new HotlineCommandCenterTakenError(
      'An active command-center hotline already exists.',
    );
    const fixture = TestBed.createComponent(HotlinesSection);
    fixture.componentRef.setInput('archived', true);
    await settle(fixture);

    buttonNamed('Restore Old rescue')?.click();
    await settle(fixture);
    type('app-archive-dialog textarea', 'Back in service.');
    await settle(fixture);
    confirmButton()?.click();
    await settle(fixture);

    expect(document.querySelector('app-archive-dialog [role="alert"]')?.textContent).toContain(
      DIRECTORY_COPY.hotlineForm.kindRefused('An active command-center hotline already exists.'),
    );
    expect(archiveDialog()).not.toBeNull();
    expect(hotlines.restoredCalls).toEqual([]);
  });
});
