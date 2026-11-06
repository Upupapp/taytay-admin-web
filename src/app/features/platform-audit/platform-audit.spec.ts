import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDateTime,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_REPOSITORY,
  type CursorPage,
  type CursorRequest,
  type PlatformAuditEntry,
  type PlatformAuditEntryId,
  type PlatformAuditRepository,
} from '@domain/index';

import { PlatformAuditPage } from './platform-audit-page';
import { PLATFORM_AUDIT_COPY } from './platform-audit.copy';

function entry(key: string, action: string, actorId: string | null): PlatformAuditEntry {
  return {
    id: asId<PlatformAuditEntryId>(key),
    actorId,
    action,
    subjectType: 'user',
    subjectId: `subject-${key}`,
    at: asIsoDateTime('2026-11-05T01:00:00.000Z'),
  };
}

class RecordingTrail implements PlatformAuditRepository {
  readonly listed: CursorRequest[] = [];
  list(page: CursorRequest): Observable<CursorPage<PlatformAuditEntry>> {
    this.listed.push(page);
    return of(
      page.cursor === null
        ? {
            items: [
              entry('a', 'user.role_changed', 'actor-1'),
              entry('b', 'something.new', null),
            ],
            hasMore: true,
            nextCursor: 'next',
          }
        : { items: [entry('c', 'news.created', 'actor-2')], hasMore: false, nextCursor: null },
    );
  }
}

/** Only the trail is provided: a page that looked up a name beside a row would fail to build. */
function configure(): RecordingTrail {
  const trail = new RecordingTrail();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: PLATFORM_AUDIT_REPOSITORY, useValue: trail }],
  });
  return trail;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const COPY = PLATFORM_AUDIT_COPY;

describe('PlatformAuditPage (DL-171)', () => {
  it('reads the newest fifty and says more are available, never "of N"', async () => {
    const trail = configure();
    const element = await settle(TestBed.createComponent(PlatformAuditPage));
    expect(trail.listed).toEqual([{ limit: 50, cursor: null }]);
    expect(element.textContent).toContain('Showing the newest 2 entries. More are available.');
    expect(element.textContent).not.toMatch(/page \d+ of|of \d+ entries/i);
  });

  it('says an action in words, keeps the code, and never guesses at one it does not know', async () => {
    configure();
    const element = await settle(TestBed.createComponent(PlatformAuditPage));
    const rows = [...element.querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');
    expect(rows[0]).toContain('Changed an account’s role');
    expect(rows[0]).toContain('user.role_changed');
    expect(rows[1]).toContain(COPY.noWords);
    expect(rows[1]).toContain('something.new');
    expect(rows[1]).toContain(COPY.noActor);
  });

  it('shows people and records by their ids, and says no values are kept', async () => {
    configure();
    const element = await settle(TestBed.createComponent(PlatformAuditPage));
    expect(element.textContent).toContain('actor-1');
    expect(element.textContent).toContain('subject-a');
    expect(element.textContent).toContain('keeps no earlier or later value');
  });

  it('reads older entries on request, continuing from the cursor', async () => {
    const trail = configure();
    const fixture = TestBed.createComponent(PlatformAuditPage);
    const element = await settle(fixture);
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === COPY.showMore)
      ?.click();
    await settle(fixture);
    expect(trail.listed[1]).toEqual({ limit: 50, cursor: 'next' });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(element.textContent).toContain(COPY.noMore);
  });
});

describe('the words for every case act the API audits (DL-183, DL-185)', () => {
  /**
   * The backend's `office-cases` `AUDIT_ACTIONS` as of `fb43122`. Cancelling a task and ending a
   * request's link arrived with DL-183 and were shown as undescribed codes until DL-185.
   */
  const CASE_ACTIONS = [
    'office_case.opened',
    'office_case.status_changed',
    'office_case.assigned',
    'office_case.unassigned',
    'office_case.note_added',
    'office_case.task_added',
    'office_case.task_completed',
    'office_case.task_cancelled',
    'office_case.task_reassigned',
    'office_case.task_rescheduled',
    'office_case.request_linked',
    'office_case.request_unlinked',
  ];

  it('describes each one', () => {
    for (const action of CASE_ACTIONS) {
      expect(PLATFORM_AUDIT_ACTIONS[action], action).toBeTruthy();
    }
  });

  it('says a cancelled task and an ended link are kept, not deleted', () => {
    expect(PLATFORM_AUDIT_ACTIONS['office_case.task_cancelled']).toContain('kept');
    expect(PLATFORM_AUDIT_ACTIONS['office_case.request_unlinked']).toContain('history');
  });
});
