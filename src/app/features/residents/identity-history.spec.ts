import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import { LiveUpdates } from '@core/live/live-updates';
import {
  asId,
  asIsoDateTime,
  RESIDENT_REPOSITORY,
  type IdentityChange,
  type IdentityChangeValues,
  type Permission,
  type ResidentId,
} from '@domain/index';

import { IdentityHistory } from './identity-history';
import { RESIDENTS_COPY } from './residents.copy';

const COPY = RESIDENTS_COPY.identityHistory;
const RECORD = asId<ResidentId>('resident-1');

const SURNAME: IdentityChange = {
  id: 'change-1',
  field: 'lastName',
  reason: 'Married name, PSA certificate seen.',
  reasonWithheld: false,
  source: 'registry-edit',
  idChecked: true,
  actorName: 'Ana Intake',
  at: asIsoDateTime('2026-11-26T02:00:00.000Z'),
  valuesReadable: true,
};

class Registry {
  history: readonly IdentityChange[] = [SURNAME];
  failing = false;
  readonly opened: string[] = [];
  identityHistory(): Observable<readonly IdentityChange[]> {
    return this.failing ? throwError(() => new Error('down')) : of(this.history);
  }
  identityChangeValues(_id: ResidentId, changeId: string): Observable<IdentityChangeValues> {
    this.opened.push(changeId);
    return of({ id: changeId, field: 'lastName', previous: 'Lopez', next: 'Lopez-Tan' });
  }
}

async function render(
  registry: Registry,
  granted: readonly Permission[],
  hints = new Subject<void>(),
): Promise<ComponentFixture<IdentityHistory>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RESIDENT_REPOSITORY, useValue: registry },
      {
        provide: LiveUpdates,
        useValue: {
          changes: () => hints.asObservable(),
          noteRefreshed: vi.fn(),
          noteRefreshFailed: vi.fn(),
        },
      },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  const fixture = TestBed.createComponent(IdentityHistory);
  fixture.componentRef.setInput('residentId', RECORD);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ComponentFixture<IdentityHistory>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function button(
  fixture: ComponentFixture<IdentityHistory>,
  name: string,
): HTMLButtonElement | null {
  return (
    [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === name,
    ) ?? null
  );
}

describe('a record’s identity history (DL-264)', () => {
  it('lists when, who, which field, how and why, and never a value', async () => {
    const fixture = await render(new Registry(), ['resident.view']);
    const shown = text(fixture);
    expect(shown).toContain('Last name');
    expect(shown).toContain('Ana Intake');
    expect(shown).toContain('Married name, PSA certificate seen.');
    expect(shown).toContain(COPY.idSeen);
    expect(shown).not.toContain('Lopez');
    // Without the auditor's grant the values are not offered, and the page says who opens them.
    expect(button(fixture, COPY.showValues)).toBeNull();
    expect(shown).toContain(COPY.valuesNeedGrant);
  });

  it('opens one change’s values for a reader holding audit.view-detail, when asked', async () => {
    const registry = new Registry();
    const fixture = await render(registry, ['resident.view', 'audit.view-detail']);
    expect(registry.opened).toEqual([]);
    button(fixture, COPY.showValues)?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(registry.opened).toEqual(['change-1']);
    expect(text(fixture)).toContain('Lopez');
    expect(text(fixture)).toContain('Lopez-Tan');
  });

  it('offers no values the server says this reader may not open, and says a withheld reason', async () => {
    const registry = new Registry();
    registry.history = [{ ...SURNAME, reason: null, reasonWithheld: true, valuesReadable: false }];
    const fixture = await render(registry, ['resident.view', 'audit.view-detail']);
    expect(button(fixture, COPY.showValues)).toBeNull();
    expect(text(fixture)).toContain(COPY.reasonWithheld);
  });

  it('says an empty history in words, and a failed read is never shown as empty', async () => {
    const empty = new Registry();
    empty.history = [];
    expect(text(await render(empty, ['resident.view']))).toContain(COPY.empty);

    const failing = new Registry();
    failing.failing = true;
    const fixture = await render(failing, ['resident.view']);
    expect(text(fixture)).toContain(COPY.failedHeading);
    expect(text(fixture)).not.toContain(COPY.empty);
  });

  it('reads again on a registry hint, keeping a value already opened', async () => {
    const registry = new Registry();
    const hints = new Subject<void>();
    const read = vi.spyOn(registry, 'identityHistory');
    const fixture = await render(registry, ['resident.view', 'audit.view-detail'], hints);
    button(fixture, COPY.showValues)?.click();
    fixture.detectChanges();
    hints.next();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(read).toHaveBeenCalledTimes(2);
    expect(text(fixture)).toContain('Lopez-Tan');
  });
});
