import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  asId,
  DEFAULT_PAGE_REQUEST,
  isTerminalAssistanceStatus,
  type AssistanceRequestId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAssistanceRequestRepository } from './mock-assistance-request.repository';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function repository(): MockAssistanceRequestRepository {
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      MockAssistanceRequestRepository,
    ],
  });
  return TestBed.inject(MockAssistanceRequestRepository);
}

describe('MockAssistanceRequestRepository', () => {
  it('pages seeded requests', async () => {
    const page = await firstValueFrom(repository().list({}, { page: 1, pageSize: 3 }));
    expect(page.items).toHaveLength(3);
    expect(page.totalItems).toBeGreaterThan(3);
  });

  it('filters to open requests only', async () => {
    const page = await firstValueFrom(repository().list({ openOnly: true }, DEFAULT_PAGE_REQUEST));
    for (const request of page.items) {
      expect(isTerminalAssistanceStatus(request.status)).toBe(false);
    }
  });

  it('searches by reference number', async () => {
    const page = await firstValueFrom(
      repository().list({ search: 'TAY-2026-000841' }, DEFAULT_PAGE_REQUEST),
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.referenceNumber).toBe('TAY-2026-000841');
  });

  it('returns null for an id that does not exist', async () => {
    const found = await firstValueFrom(repository().getById(asId<AssistanceRequestId>('req-nope')));
    expect(found).toBeNull();
  });

  it('records a legal status change in the history', async () => {
    const repo = repository();
    const id = asId<AssistanceRequestId>('req-0001');
    const updated = await firstValueFrom(repo.changeStatus(id, 'approved', 'Within ceiling.'));

    expect(updated.status).toBe('approved');
    const latest = updated.statusHistory.at(-1);
    expect(latest?.from).toBe('endorsed');
    expect(latest?.to).toBe('approved');
    expect(latest?.reason).toBe('Within ceiling.');
  });

  it('persists the change for subsequent reads', async () => {
    const repo = repository();
    const id = asId<AssistanceRequestId>('req-0001');
    await firstValueFrom(repo.changeStatus(id, 'approved', null));
    const reread = await firstValueFrom(repo.getById(id));
    expect(reread?.status).toBe('approved');
  });

  it('rejects a transition the lifecycle does not allow', async () => {
    const repo = repository();
    await expect(
      firstValueFrom(repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'released', null)),
    ).rejects.toThrow(/cannot move from Endorsed to Released/);
  });

  it('rejects any change to a terminal request', async () => {
    const repo = repository();
    await expect(
      firstValueFrom(repo.changeStatus(asId<AssistanceRequestId>('req-0005'), 'approved', null)),
    ).rejects.toThrow();
  });

  it('reports a missing request rather than failing silently', async () => {
    const repo = repository();
    await expect(
      firstValueFrom(repo.changeStatus(asId<AssistanceRequestId>('req-nope'), 'approved', null)),
    ).rejects.toThrow(/was not found/);
  });

  it('returns case notes newest first', async () => {
    const notes = await firstValueFrom(
      repository().listNotes(asId<AssistanceRequestId>('req-0001')),
    );
    expect(notes.length).toBeGreaterThan(1);
    const timestamps = notes.map((note) => note.createdAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });
});
