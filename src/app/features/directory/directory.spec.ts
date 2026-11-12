import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import {
  asId,
  asIsoDateTime,
  DIRECTORY_OFFICE_REPOSITORY,
  COMMAND_CENTER_EFFECTS,
  HOTLINE_EFFECTS,
  HOTLINE_LIST_CAP,
  HotlineCommandCenterTakenError,
  HOTLINE_REPOSITORY,
  OFFICE_EFFECTS,
  OFFICE_REPOSITORY,
  SERVICE_EFFECTS,
  TULONG_SERVICE_REPOSITORY,
  type CursorPage,
  type CursorRequest,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineListing,
  type HotlineRepository,
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
import { HotlinesSection } from './hotlines-section';
import { OfficesSection } from './offices-section';
import { ServicesSection } from './services-section';

const STAMP = asIsoDateTime('2026-11-05T00:00:00.000Z');

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
    ...values,
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingOffices implements DirectoryOfficeRepository {
  readonly listed: CursorRequest[] = [];
  readonly created: { draft: OfficeDraft; banner: Blob | null }[] = [];
  readonly updated: { id: OfficeId; changes: OfficeChanges }[] = [];
  readonly removed: OfficeId[] = [];
  refuseRemoval: string | null = null;

  list(page: CursorRequest): Observable<CursorPage<DirectoryOffice>> {
    this.listed.push(page);
    return of(
      page.cursor
        ? { items: [office('c')], hasMore: false, nextCursor: null }
        : {
            items: [office('a', { hasBanner: true }), office('b')],
            hasMore: true,
            nextCursor: 'next',
          },
    );
  }

  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice> {
    this.created.push({ draft, banner });
    return of(office('new', { ...draft }));
  }

  update(id: OfficeId, changes: OfficeChanges): Observable<DirectoryOffice> {
    this.updated.push({ id, changes });
    return of(office('a', { ...changes }));
  }

  remove(id: OfficeId): Observable<void> {
    if (this.refuseRemoval !== null) {
      const message = this.refuseRemoval;
      return throwError(() => new Error(message));
    }
    this.removed.push(id);
    return of(undefined);
  }
}

class RecordingServices implements TulongServiceRepository {
  readonly found: string[] = [];
  readonly updated: { id: TulongServiceId; changes: ServiceChanges }[] = [];
  readonly created: ServiceDraft[] = [];

  list(): Observable<CursorPage<TulongService>> {
    return of({
      items: [service('senior-id', { featured: true })],
      hasMore: false,
      nextCursor: null,
    });
  }

  find(slug: string): Observable<TulongService | null> {
    this.found.push(slug);
    return of(slug === 'archived' ? service('archived', { hiddenFromList: true }) : null);
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    this.created.push(draft);
    return of(service('new', { ...draft }));
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    this.updated.push({ id, changes });
    return of(service('senior-id', { ...changes }));
  }

  replaceImage(id: TulongServiceId): Observable<TulongService> {
    return of(service(id, { hasImage: true }));
  }

  remove(): Observable<void> {
    return of(undefined);
  }
}

class RecordingHotlines implements HotlineRepository {
  rows: readonly Hotline[] = [hotline('rescue'), hotline('old', { active: false, sortOrder: 20 })];
  capped = false;
  readonly updated: { id: HotlineId; changes: HotlineChanges }[] = [];
  readonly created: HotlineDraft[] = [];
  /** A refusal to answer a save with, as the adapter raises it. */
  refusal: Error | null = null;

  list(): Observable<HotlineListing> {
    return of({ hotlines: this.rows, mayBeIncomplete: this.capped });
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    const refusal = this.refusal;
    if (refusal !== null) return throwError(() => refusal);
    this.created.push(draft);
    return of(hotline('new', draft));
  }

  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline> {
    const refusal = this.refusal;
    if (refusal !== null) return throwError(() => refusal);
    this.updated.push({ id, changes });
    return of(hotline('rescue', changes));
  }

  remove(): Observable<void> {
    return of(undefined);
  }
}

interface Recorders {
  offices: RecordingOffices;
  services: RecordingServices;
  hotlines: RecordingHotlines;
}

function configure(
  granted: readonly Permission[] = ['office.manage', 'service.manage', 'hotline.manage'],
): Recorders {
  const recorders: Recorders = {
    offices: new RecordingOffices(),
    services: new RecordingServices(),
    hotlines: new RecordingHotlines(),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DIRECTORY_OFFICE_REPOSITORY, useValue: recorders.offices },
      { provide: TULONG_SERVICE_REPOSITORY, useValue: recorders.services },
      { provide: HOTLINE_REPOSITORY, useValue: recorders.hotlines },
      { provide: OFFICE_REPOSITORY, useValue: { list: () => of([]) } },
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

function buttonNamed(name: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
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
});

/* ── offices ─────────────────────────────────────────────────────────────── */

describe('OfficesSection (DL-170)', () => {
  it('reads one cursor page and says more are available, never "page 1 of N"', async () => {
    const { offices } = configure();
    const fixture = TestBed.createComponent(OfficesSection);
    const element = await settle(fixture);

    expect(offices.listed[0]).toEqual({ limit: 20, cursor: null });
    expect(element.textContent).toContain('Showing 2 offices. More are available.');
    expect(element.textContent).not.toMatch(/page \d+ of/i);

    buttonNamed('Show more')?.click();
    await settle(fixture);
    expect(offices.listed).toContainEqual({ limit: 20, cursor: 'next' });
    expect(element.textContent).toContain('Showing 3 offices. That is all of them.');
  });

  it('deletes only after a confirmation that lists what deleting does', async () => {
    const { offices } = configure();
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Delete Office a')?.click();
    await settle(fixture);
    expect(offices.removed).toEqual([]);
    const dialog = document.querySelector('[role="dialog"]');
    for (const effect of OFFICE_EFFECTS.remove) {
      expect(dialog?.textContent).toContain(effect);
    }

    const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.trim() === 'Delete Office a',
    );
    confirm?.click();
    await settle(fixture);
    expect(offices.removed).toEqual(['office-a']);
    expect(document.body.textContent).toContain('Office a was deleted from the app’s directory.');
  });

  it('keeps the confirmation open and says why when the server refuses', async () => {
    const recorders = configure();
    recorders.offices.refuseRemoval = 'That office still has staff or other records.';
    const fixture = TestBed.createComponent(OfficesSection);
    await settle(fixture);

    buttonNamed('Delete Office b')?.click();
    await settle(fixture);
    const dialog = document.querySelector('[role="dialog"]');
    [...(dialog?.querySelectorAll('button') ?? [])]
      .find((button) => button.textContent?.trim() === 'Delete Office b')
      ?.click();
    await settle(fixture);

    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      'Not done. That office still has staff or other records.',
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
    expect(
      effects !== null && effects !== undefined && submit !== null && submit !== undefined
        ? effects.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();

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
});

/* ── Tulong pages ────────────────────────────────────────────────────────── */

describe('ServicesSection (DL-170)', () => {
  it('says a hidden page is not listed, and opens one by its address', async () => {
    const { services } = configure();
    const fixture = TestBed.createComponent(ServicesSection);
    const element = await settle(fixture);

    expect(element.textContent).toContain('is not listed here unless it is featured');
    expect(element.textContent).toContain('It is not one of the office’s assistance programmes.');

    type('#service-find', 'nothing');
    element
      .querySelector<HTMLFormElement>('.directory-section__find')
      ?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'There is no Tulong page at the address nothing.',
    );

    type('#service-find', 'archived');
    element
      .querySelector<HTMLFormElement>('.directory-section__find')
      ?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(services.found).toEqual(['nothing', 'archived']);
    expect(document.querySelector('app-service-form')).not.toBeNull();
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
});

/* ── hotlines ────────────────────────────────────────────────────────────── */

describe('HotlinesSection (DL-170)', () => {
  it('lists shown and hidden lines, and says nothing about a cap it has not reached', async () => {
    configure();
    const element = await settle(TestBed.createComponent(HotlinesSection));

    expect(element.textContent).toContain('Shown in the app');
    expect(element.textContent).toContain('Hidden from the app');
    expect(element.textContent).toContain('2 lines, shown and hidden.');
    expect(element.textContent).not.toContain('the most the API sends');
  });

  it('says a list as long as the cap may be missing lines', async () => {
    const { hotlines } = configure();
    hotlines.capped = true;
    const element = await settle(TestBed.createComponent(HotlinesSection));

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      `This is ${HOTLINE_LIST_CAP} lines — the most the API sends`,
    );
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
    hotlines.rows = [
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
    hotlines.rows = [
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
    expect(
      warning !== null &&
        submitButton !== null &&
        (warning.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    // A warning, not a block: the list is a moment old, and the server decides.
    expect(submitButton?.hasAttribute('disabled')).toBe(false);

    // Hidden, it is no second command center, and the warning goes.
    tick('Show in the app', false);
    await settle(fixture);
    expect(document.querySelector('#hotline-kind-taken')).toBeNull();
  });

  it('shows a line the server sent with no kind as not set, never as Other (DL-220)', async () => {
    const { hotlines } = configure();
    hotlines.rows = [
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
    hotlines.rows = [hotline('old', { name: 'Old line', kind: null })];
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
    hotlines.rows = [hotline('rescue', { name: 'Rescue', kind: 'command-center' })];
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
    hotlines.rows = [hotline('police', { name: 'Police', kind: 'police' })];
    hotlines.refusal = new HotlineCommandCenterTakenError(
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

  it('says deleting the command center leaves the app without one', async () => {
    const { hotlines } = configure();
    hotlines.rows = [hotline('rescue', { name: 'Rescue', kind: 'command-center' })];
    const fixture = TestBed.createComponent(HotlinesSection);
    await settle(fixture);

    buttonNamed('Delete Rescue')?.click();
    await settle(fixture);

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      COMMAND_CENTER_EFFECTS.leaves[0],
    );
  });
});
