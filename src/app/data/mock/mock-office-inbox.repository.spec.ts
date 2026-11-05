import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type InboxListing,
  type MediaId,
  type OfficeThread,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockOfficeInboxRepository } from './mock-office-inbox.repository';
import { SAMPLE_ATTACHMENT_MARKER } from './seed/office-threads.seed';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  firebaseWebApiKey: null,
  mockLatencyMs: 0,
  enableDevTools: false,
};

function signedInAs(role: StaffRole): MockOfficeInboxRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
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
  const context: AccessContext = { currentUser: () => user };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockOfficeInboxRepository,
    ],
  });
  return TestBed.inject(MockOfficeInboxRepository);
}

function threadsOf(listing: InboxListing): readonly OfficeThread[] {
  if (listing.kind !== 'threads') throw new Error('expected threads');
  return listing.page.items;
}

async function firstOpen(repository: MockOfficeInboxRepository): Promise<OfficeThread> {
  const rows = threadsOf(await firstValueFrom(repository.list({ limit: 50 })));
  const open = rows.find((thread) => thread.status === 'open');
  if (open === undefined) throw new Error('the seed has no open conversation');
  return open;
}

describe('MockOfficeInboxRepository (DL-168)', () => {
  it.each(['auditor', 'barangay-link'] as const)(
    're-checks the grant for %s, because hiding the screen is not protection',
    async (role) => {
      const refusal: unknown = await firstValueFrom(signedInAs(role).list({ limit: 20 })).catch(
        (error: unknown) => error,
      );
      expect(isPermissionDenied(refusal)).toBe(true);
    },
  );

  it('pages newest activity first, with a cursor and no total', async () => {
    const repository = signedInAs('intake-officer');
    const first = await firstValueFrom(repository.list({ limit: 20 }));
    if (first.kind !== 'threads') throw new Error('expected threads');

    const times = first.page.items.map((thread) => thread.updatedAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(first.page.hasMore).toBe(true);

    const second = await firstValueFrom(
      repository.list({ limit: 20, cursor: first.page.nextCursor }),
    );
    expect(threadsOf(second).length).toBeGreaterThan(0);
    expect(Object.keys(first.page)).not.toContain('total');
  });

  it('sends a reply into an open conversation, as the reader, and refuses a closed one', async () => {
    const repository = signedInAs('social-worker');
    const thread = await firstOpen(repository);

    const sent = await firstValueFrom(repository.reply(thread.id, '  We can help. Come on Monday. '));
    expect(sent.body).toBe('We can help. Come on Monday.');
    expect(String(sent.senderId)).toBe('staff-x');

    await firstValueFrom(repository.close(thread.id));
    await expect(firstValueFrom(repository.reply(thread.id, 'Again'))).rejects.toThrow(/closed/);
    await expect(firstValueFrom(repository.close(thread.id))).rejects.toThrow(/already closed/);
  });

  it('refuses an empty reply, as the API does', async () => {
    const repository = signedInAs('social-worker');
    const thread = await firstOpen(repository);

    await expect(firstValueFrom(repository.reply(thread.id, '   '))).rejects.toThrow(/words/);
  });

  it('marks read for the office as one count', async () => {
    const repository = signedInAs('mswdo-head');
    const rows = threadsOf(await firstValueFrom(repository.list({ limit: 50 })));
    const unread = rows.find((thread) => thread.unreadCount > 0);
    if (unread === undefined) throw new Error('the seed has nothing unread');

    expect((await firstValueFrom(repository.markRead(unread.id))).unreadCount).toBe(0);
  });

  it('answers messages newest first, and an image only for the message that carries it', async () => {
    const repository = signedInAs('intake-officer');
    const rows = threadsOf(await firstValueFrom(repository.list({ limit: 50 })));
    const withImage = rows.find((thread) => thread.subject.startsWith('Photo of the damage'));
    if (withImage === undefined) throw new Error('the seed has no image');

    const page = await firstValueFrom(repository.messages(withImage.id, { limit: 20 }));
    const [message] = page.items;
    const [media] = message?.attachments ?? [];
    if (message === undefined || media === undefined) throw new Error('no attachment');

    const blob = await firstValueFrom(repository.openAttachment(message, media));
    expect(await blob.text()).toContain(SAMPLE_ATTACHMENT_MARKER);
    await expect(
      firstValueFrom(repository.openAttachment(message, asId<MediaId>('elsewhere'))),
    ).rejects.toThrow(/no such image/);
  });
});
