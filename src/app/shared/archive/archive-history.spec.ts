import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { asId, asIsoDateTime, type ArchiveEvent, type ArchiveEventId } from '@domain/index';

import { ArchiveHistory } from './archive-history';

const EVENTS: readonly ArchiveEvent[] = [
  {
    id: asId<ArchiveEventId>('event-2'),
    act: 'restored',
    reason: null,
    actorName: 'An account since closed',
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

function show(
  source: Observable<readonly ArchiveEvent[]> | null,
): ComponentFixture<ArchiveHistory> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(ArchiveHistory);
  fixture.componentRef.setInput('source', source);
  return fixture;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ArchiveHistory (DL-225)', () => {
  it('lists every archive and restore in the order given, each in words', async () => {
    const element = await settle(show(of(EVENTS)));

    const section = element.querySelector('section');
    const heading = element.querySelector('h3');
    expect(heading?.textContent).toBe('Archive history');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(element.textContent).toContain('newest first. Nothing here can be changed.');

    const lines = [...element.querySelectorAll('ol > li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Restored 4 Nov 2026, \d\d:\d\d by an account since closed/);
    expect(lines[0]).toContain('No reason was recorded.');
    expect(lines[1]).toMatch(/^Archived 3 Nov 2026, \d\d:\d\d by Ana Reyes/);
    expect(lines[1]).toContain('Reason given: Merged into the MSWDO.');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-04T12:00:00.000Z',
    );
  });

  it('says a record that was never archived has no history, rather than an empty list', async () => {
    const element = await settle(show(of([])));

    expect(element.textContent).toContain('It has never been archived.');
    expect(element.querySelector('ol')).toBeNull();
  });

  it('says the history could not be read, and offers to try again', async () => {
    let reads = 0;
    const source = new Observable<readonly ArchiveEvent[]>((subscriber) => {
      reads++;
      if (reads === 1) {
        subscriber.error(new Error('The server did not answer.'));
      } else {
        subscriber.next(EVENTS);
        subscriber.complete();
      }
    });
    const fixture = show(source);
    const element = await settle(fixture);

    expect(element.textContent).toContain('The archive history could not be read');
    expect(element.textContent).toContain('The server did not answer.');
    const again = [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Try again',
    );
    again?.click();
    await settle(fixture);

    expect(reads).toBe(2);
    expect(element.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('reads nothing while there is no record', async () => {
    const element = await settle(show(null));

    expect(element.querySelector('ol')).toBeNull();
    expect(element.textContent).not.toContain('never been archived');
    expect(element.textContent).not.toContain('could not be read');
  });

  it('never throws a read failure past itself', async () => {
    const element = await settle(show(throwError(() => new Error('Refused.'))));

    expect(element.textContent).toContain('Refused.');
  });
});
