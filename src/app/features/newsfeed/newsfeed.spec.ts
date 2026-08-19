import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNewsfeedRepository } from '@data/mock/mock-newsfeed.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  NEWSFEED_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { PostComposerPage } from './post-composer-page';
import { PostDetailPage } from './post-detail-page';
import { PostListPage } from './post-list-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole, id: string): StaffUser {
  return {
    id: asId<StaffUserId>(id),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: null,
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
}

function staffRepository(user: StaffUser): StaffRepository {
  const authenticated = toAuthenticatedUser(user);
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

async function configure(user: StaffUser): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'newsfeed', component: PostListPage },
        { path: 'newsfeed/new', component: PostComposerPage },
        { path: 'newsfeed/:id', component: PostDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(user) },
      { provide: NEWSFEED_REPOSITORY, useClass: MockNewsfeedRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<PostListPage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl('/newsfeed');
  const fixture = TestBed.createComponent(PostListPage);
  await fixture.whenStable();
  return fixture;
}

async function openComposer(): Promise<ComponentFixture<PostComposerPage>> {
  await configure(staffUser('mswdo-head', 'staff-head'));
  await TestBed.inject(Router).navigateByUrl('/newsfeed/new');
  const fixture = TestBed.createComponent(PostComposerPage);
  await fixture.whenStable();
  return fixture;
}

async function openPost(
  postId: string,
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<PostDetailPage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl(`/newsfeed/${postId}`);
  const fixture = TestBed.createComponent(PostDetailPage);
  fixture.componentRef.setInput('id', postId);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: the composer asks for alt text where it can be answered ───── */

describe('the composer and the image description', () => {
  it('puts the description field beside the image, not behind a toggle', async () => {
    const fixture = await openComposer();
    const labels = [...html(fixture).querySelectorAll('.field__label')].map((n) => n.textContent);

    // Both visible in the same section on first render (`DL-125`). A field
    // reachable only through "advanced" is a field that stays empty.
    expect(labels).toContain('Image');
    expect(labels).toContain('Describe the image');
    expect(html(fixture).querySelector('details')).toBeNull();
  });

  it('names the missing description while the post is being written', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      body: { set: (value: string) => void };
      imageUrl: { set: (value: string) => void };
      publishProblems: () => readonly string[];
    };
    page.body.set('Relief goods arrive Tuesday.');
    page.imageUrl.set('/uploads/advisory.png');
    await fixture.whenStable();

    expect(page.publishProblems().join(' ')).toContain('screen reader');
  });

  it('still lets the draft be saved, because half-written is not a failure', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      body: { set: (value: string) => void };
      imageUrl: { set: (value: string) => void };
      canSave: () => boolean;
    };
    page.body.set('Relief goods arrive Tuesday.');
    page.imageUrl.set('/uploads/advisory.png');
    await fixture.whenStable();

    expect(page.canSave()).toBe(true);
  });
});

/* ── Criterion: publishing warns before, not after ────────────────────────── */

describe('publishing a post', () => {
  it('shows what publishing does before the button, not in a confirmation after', async () => {
    const fixture = await openPost('post-0005');
    const text = html(fixture).textContent ?? '';

    expect(text).toContain('It cannot be unsent');
    expect(text).toContain('does not reach anybody who already read it');
  });

  it('refuses to act without a recorded reason', async () => {
    const fixture = await openPost('post-0005');
    const publish = [...html(fixture).querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Publish now'),
    );

    expect(publish).toBeDefined();
    expect(publish?.disabled).toBe(true);
  });

  it('offers no way back to draft once a post is out', async () => {
    const fixture = await openPost('post-0001');
    const buttons = [...html(fixture).querySelectorAll('button')].map((b) => b.textContent ?? '');

    // Archive is the only exit, and it is not an unpublish (`DL-124`).
    expect(buttons.some((label) => /draft|unpublish|retract/i.test(label))).toBe(false);
    expect(buttons.some((label) => label.includes('Archive'))).toBe(true);
  });
});

/* ── Criterion: reach is counts, never a list of residents ────────────────── */

describe('what the office learns about reach', () => {
  it('reports counts and says so', async () => {
    const fixture = await openPost('post-0001');
    const text = html(fixture).textContent ?? '';

    expect(text).toContain('Counts only');
    expect(text).toContain('does not see which residents reacted');
  });

  it('has no screen anywhere that lists who reacted', async () => {
    const fixture = await openPost('post-0001');
    const text = html(fixture).textContent ?? '';

    // The port has no method that could answer this, and no template asks
    // (`DL-126`).
    expect(text).not.toMatch(/who reacted|reacted by|reaction list|liked by/i);
  });
});

/* ── Criterion: hide is reversible and inline; remove asks twice ──────────── */

describe('moderating comments on the screen', () => {
  it('does not put a modal in front of hiding', async () => {
    const fixture = await openPost('post-0001');
    const page = fixture.componentInstance as unknown as {
      openCommentId: { set: (value: string) => void };
      moderationText: { set: (value: string) => void };
      removing: () => unknown;
    };
    page.openCommentId.set('cmt-0001');
    page.moderationText.set('Named a child.');
    await fixture.whenStable();
    const hide = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Hide',
    );
    hide?.click();
    await fixture.whenStable();

    expect(page.removing()).toBeNull();
  });

  it('puts removal behind a confirmation that names the difference', async () => {
    const fixture = await openPost('post-0001');
    const page = fixture.componentInstance as unknown as {
      openCommentId: { set: (value: string) => void };
      moderationText: { set: (value: string) => void };
      removing: () => unknown;
    };
    page.openCommentId.set('cmt-0001');
    page.moderationText.set('Abusive.');
    await fixture.whenStable();
    const remove = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Remove permanently',
    );
    remove?.click();
    await fixture.whenStable();

    expect(page.removing()).not.toBeNull();
    const text = html(fixture).textContent ?? '';
    expect(text).toContain('cannot be brought back');
    expect(text).toContain('Hide it instead');
  });

  it('shows nothing of a removed comment but says it was removed', async () => {
    const fixture = await openPost('post-0001');
    const text = html(fixture).textContent ?? '';

    expect(text).toContain('This comment was removed.');
  });

  it('counts the queue rather than pronouncing it clean', async () => {
    const fixture = await openPost('post-0001');
    const summary = html(fixture).querySelector('.comments__summary')?.textContent ?? '';

    expect(summary).toMatch(/\d+ visible/);
    expect(summary).not.toMatch(/healthy|clean|all good/i);
  });
});

/* ── Criterion: an auditor reads and changes nothing ──────────────────────── */

describe('the read-only executive', () => {
  it('is offered no publishing, pinning or moderation control', async () => {
    const fixture = await openPost('post-0001', 'auditor', 'staff-auditor');
    const buttons = [...html(fixture).querySelectorAll('button')].map((b) =>
      (b.textContent ?? '').trim(),
    );

    for (const label of ['Publish now', 'Schedule', 'Archive', 'Pin to the top', 'Moderate']) {
      expect(buttons).not.toContain(label);
    }
  });

  it('is not offered the composer', async () => {
    const fixture = await openList('auditor', 'staff-auditor');
    const links = [...html(fixture).querySelectorAll('a')].map((a) => (a.textContent ?? '').trim());

    expect(links).not.toContain('Write a post');
  });

  it('can still read the post and its reach', async () => {
    const fixture = await openPost('post-0001', 'auditor', 'staff-auditor');
    const text = html(fixture).textContent ?? '';

    expect(text).toContain('What residents see');
    expect(text).toContain('Reach');
  });
});

/* ── Criterion: the list counts what it filtered away ─────────────────────── */

describe('the post list', () => {
  it('takes the tab counts from the whole set, not the filtered rows', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      category: { set: (value: string) => void };
      counts: () => { all: number };
      posts: () => readonly unknown[];
    };
    const total = page.counts().all;
    page.category.set('advisory');
    await fixture.whenStable();

    // Otherwise "Drafts (0)" means "no drafts match this filter" while reading
    // as "no drafts exist".
    expect(page.posts().length).toBeLessThan(total);
    expect(page.counts().all).toBe(total);
  });

  it('tells an empty filter result apart from an empty feed', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      hasFilters: () => boolean;
      category: { set: (value: string) => void };
    };
    expect(page.hasFilters()).toBe(false);
    page.category.set('advisory');
    await fixture.whenStable();

    expect(page.hasFilters()).toBe(true);
  });

  it('sorts pinned posts first, which is what a pin is for', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      posts: () => readonly { isPinned: boolean }[];
    };
    const rows = page.posts();
    const lastPinned = rows.map((row) => row.isPinned).lastIndexOf(true);
    const firstUnpinned = rows.map((row) => row.isPinned).indexOf(false);

    if (lastPinned >= 0 && firstUnpinned >= 0) {
      expect(lastPinned).toBeLessThan(firstUnpinned);
    }
  });
});
