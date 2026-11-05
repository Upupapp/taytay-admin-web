import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AuthenticatedUser,
  type BalitaArticleId,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockBalitaRepository } from './mock-balita.repository';

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

function signedInAs(role: StaffRole): MockBalitaRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>('staff-test'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId: null,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: { currentUser: () => user } },
      MockBalitaRepository,
    ],
  });
  return TestBed.inject(MockBalitaRepository);
}

describe('MockBalitaRepository (DL-171)', () => {
  it('lists published articles only, pinned first, a page at a time', async () => {
    const page = await firstValueFrom(signedInAs('auditor').list({ limit: 20, cursor: null }));
    expect(page.items[0]?.pinned).toBe(true);
    expect(page.items.every((article) => article.status === 'published')).toBe(true);
    expect(page.hasMore).toBe(true);
  });

  it('writes for a role the server lets write, and refuses the auditor', async () => {
    const draft = {
      title: 'Water interruption',
      body: 'Words',
      category: null,
      officeId: null,
      status: 'draft' as const,
    };
    const created = await firstValueFrom(signedInAs('intake-officer').create(draft, null));
    expect(created.status).toBe('draft');

    const refusal = await firstValueFrom(signedInAs('auditor').create(draft, null)).catch(
      (error: unknown) => error,
    );
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('keeps the first publication date when an article is published again', async () => {
    const news = signedInAs('social-worker');
    const id = asId<BalitaArticleId>('balita-0002');
    const first = (await firstValueFrom(news.get(id)))?.publishedAt;
    await firstValueFrom(news.update(id, { status: 'draft' }, null));
    const again = await firstValueFrom(news.update(id, { status: 'published' }, null));
    expect(again.publishedAt).toBe(first);
  });
});
