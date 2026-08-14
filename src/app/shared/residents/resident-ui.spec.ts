import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  asIsoDateTime,
  discloseResident,
  pesos,
  RESIDENT_REPOSITORY,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type HouseholdId,
  type Permission,
  type Resident,
  type ResidentId,
  type ResidentView,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { PersonPicker } from './person-picker';
import { ResidentSummaryCard } from './resident-summary-card';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function authenticated(role: StaffRole): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-x'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId: null,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

function resident(overrides: Partial<Resident> = {}): Resident {
  const actor = asId<StaffUserId>('staff-test');
  return {
    id: asId<ResidentId>('res-card'),
    householdId: asId<HouseholdId>('hh-card'),
    name: { first: 'Aurora', middle: null, last: 'Mercado', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1960-05-05'),
    civilStatus: 'widowed',
    address: {
      barangayId: asId<BarangayId>('brgy-san-juan'),
      purokOrSitio: null,
      streetAddress: '18 Rizal Street',
    },
    contact: { mobile: '0917-555-0101', email: null },
    sectors: ['senior-citizen'],
    philsysLastFour: '4471',
    monthlyIncome: pesos(4000),
    isActive: true,
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: actor,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: actor,
    },
    ...overrides,
  };
}

function viewOf(record: Resident, ...permissions: readonly Permission[]): ResidentView {
  const held = new Set<Permission>(permissions);
  return discloseResident(record, (permission) => held.has(permission));
}

/* ── ResidentSummaryCard ──────────────────────────────────────────────────── */

async function renderCard(
  view: ResidentView,
  inputs: Record<string, unknown> = {},
): Promise<ComponentFixture<ResidentSummaryCard>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ResidentSummaryCard);
  fixture.componentRef.setInput('view', view);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  return fixture;
}

describe('ResidentSummaryCard says the same thing about a person everywhere', () => {
  it('shows the disclosed name and a readable summary line', async () => {
    const element = (await renderCard(viewOf(resident(), 'resident.view')))
      .nativeElement as HTMLElement;
    expect(element.querySelector('.rsc__name')?.textContent).toContain('Mercado, Aurora');
    expect(element.querySelector('.rsc__meta')?.textContent).toContain('San Juan');
  });

  it('states in words that a record is protected', async () => {
    // Never by colour alone: the tag carries the meaning as text.
    const view = viewOf(resident({ sectors: ['vawc-survivor'] }), 'resident.view');
    const element = (await renderCard(view)).nativeElement as HTMLElement;
    expect(element.querySelector('.rsc__protected-tag')?.textContent).toContain('Protected record');
    expect(element.textContent).not.toContain('Aurora');
  });

  it('reports how much was hidden rather than showing a blank', async () => {
    const element = (await renderCard(viewOf(resident(), 'resident.view')))
      .nativeElement as HTMLElement;
    expect(element.querySelector('.rsc__withheld')?.textContent).toContain('2 details hidden');
  });

  it('says nothing about hiding when nothing was hidden', async () => {
    const view = viewOf(resident(), 'resident.view', 'resident.view-sensitive');
    const element = (await renderCard(view)).nativeElement as HTMLElement;
    expect(element.querySelector('.rsc__withheld')).toBeNull();
  });

  it('renders the name as a link only when given somewhere to go', async () => {
    const view = viewOf(resident(), 'resident.view');
    const plain = (await renderCard(view)).nativeElement as HTMLElement;
    expect(plain.querySelector('a.rsc__name')).toBeNull();

    const linked = (await renderCard(view, { routerLink: '/residents/res-card' }))
      .nativeElement as HTMLElement;
    expect(linked.querySelector<HTMLAnchorElement>('a.rsc__name')?.getAttribute('href')).toContain(
      '/residents/res-card',
    );
  });

  it('marks a retired record so it is not mistaken for an active one', async () => {
    const view = viewOf(resident({ isActive: false }), 'resident.view');
    const element = (await renderCard(view)).nativeElement as HTMLElement;
    expect(element.querySelector('.rsc__inactive')?.textContent).toContain('Retired');
  });
});

/* ── PersonPicker ─────────────────────────────────────────────────────────── */

async function renderPicker(
  role: StaffRole = 'intake-officer',
): Promise<ComponentFixture<PersonPicker>> {
  const context: AccessContext = { currentUser: () => authenticated(role) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
    ],
  });
  const fixture = TestBed.createComponent(PersonPicker);
  fixture.componentRef.setInput('debounceMs', 0);
  await fixture.whenStable();
  return fixture;
}

const host = (fixture: ComponentFixture<PersonPicker>) => fixture.nativeElement as HTMLElement;

function input(fixture: ComponentFixture<PersonPicker>): HTMLInputElement {
  const element = host(fixture).querySelector<HTMLInputElement>('input[role="combobox"]');
  if (element === null) {
    throw new Error('the combobox is not rendered');
  }
  return element;
}

async function type(fixture: ComponentFixture<PersonPicker>, text: string): Promise<void> {
  const field = input(fixture);
  field.value = text;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function press(fixture: ComponentFixture<PersonPicker>, key: string): Promise<void> {
  input(fixture).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await fixture.whenStable();
}

describe('PersonPicker is a combobox, not a text field with a list under it', () => {
  it('declares the ARIA combobox contract up front', async () => {
    const fixture = await renderPicker();
    const field = input(fixture);
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    expect(field.getAttribute('aria-controls')).toBe(
      host(fixture).querySelector('[role="listbox"]')?.id,
    );
  });

  it('stays closed until the search is worth running', async () => {
    // One letter over a registry of hundreds is not a search, it is a scroll.
    const fixture = await renderPicker();
    await type(fixture, 'M');
    expect(input(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(host(fixture).querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('opens with matching residents once there is enough to go on', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    expect(input(fixture).getAttribute('aria-expanded')).toBe('true');
    const options = host(fixture).querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]?.textContent).toContain('Mercado');
  });

  it('moves a virtual cursor with the arrow keys and never steals focus', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    expect(input(fixture).getAttribute('aria-activedescendant')).toBeNull();

    await press(fixture, 'ArrowDown');
    const active = input(fixture).getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(host(fixture).querySelector(`#${active}`)?.getAttribute('aria-selected')).toBe('true');
  });

  it('wraps rather than dead-ending at the top of the list', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    await press(fixture, 'ArrowUp');
    const active = input(fixture).getAttribute('aria-activedescendant');
    const options = host(fixture).querySelectorAll('[role="option"]');
    expect(active).toBe(options[options.length - 1]?.id);
  });

  it('chooses with Enter and reports the person outward', async () => {
    const fixture = await renderPicker();
    let chosen: ResidentView | null = null;
    fixture.componentInstance.chosen.subscribe((view) => (chosen = view));

    await type(fixture, 'Mercado');
    await press(fixture, 'ArrowDown');
    await press(fixture, 'Enter');

    expect(chosen).not.toBeNull();
    expect(fixture.componentInstance.selected()?.listedName).toContain('Mercado');
    expect(host(fixture).querySelector('.picker__chosen-name')?.textContent).toContain('Mercado');
  });

  it('lets the choice be undone', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    await press(fixture, 'ArrowDown');
    await press(fixture, 'Enter');

    host(fixture).querySelector<HTMLButtonElement>('.picker__chosen button')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBeNull();
    expect(host(fixture).querySelector('input[role="combobox"]')).not.toBeNull();
  });

  it('closes on Escape without choosing anything', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    await press(fixture, 'Escape');
    expect(input(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.selected()).toBeNull();
  });

  it('announces the result count, because the list change is otherwise silent', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Mercado');
    const status = host(fixture).querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toMatch(/residents? found/);
  });

  it('says so when nothing matches', async () => {
    const fixture = await renderPicker();
    await type(fixture, 'Zzzzznobody');
    expect(host(fixture).querySelector('.picker__empty')?.textContent).toContain('No resident');
    expect(host(fixture).querySelector('[role="status"]')?.textContent).toContain('No resident');
  });

  it('shows a protected record masked, exactly as the list does', async () => {
    const fixture = await renderPicker('intake-officer');
    await type(fixture, 'Manalo');
    const options = host(fixture).querySelectorAll('[role="option"]');
    expect(options[0]?.textContent).toContain('Manalo, C.');
    expect(options[0]?.textContent).toContain('Protected record');
    expect(options[0]?.textContent).not.toContain('Cristina');
  });
});
