import { describe, expect, it } from 'vitest';

import ARCHIVE_EVENTS from '../fixtures/archive-events.json';
import OFFICE from '../fixtures/office.json';
import OFFICE_ARCHIVED from '../fixtures/office-archived.json';
import { toArchiveEvent, toArchiveState, toWireArchiveReason } from './archive.mapper';

describe('toArchiveState (DL-225)', () => {
  it('reads a record in use as null, whether the fields are null or not sent at all', () => {
    expect(toArchiveState(OFFICE.data)).toBeNull();
    // A public read — the home screen's banners and links — never carries the fields.
    expect(toArchiveState({ id: 'x' })).toBeNull();
  });

  it('reads an archived record as when, by whom and why', () => {
    expect(toArchiveState(OFFICE_ARCHIVED.data)).toEqual({
      at: '2026-11-10T01:00:00.000Z',
      byName: 'Fixture Administrator',
      reason: 'Merged into the MSWDO.',
    });
    expect(
      toArchiveState({
        archived_at: '2026-11-10T01:00:00.000Z',
        archive_reason: null,
        archived_by_name: null,
      }),
    ).toEqual({ at: '2026-11-10T01:00:00.000Z', byName: null, reason: null });
  });

  it('cannot say where a record stands when the time is not a time, and says so with undefined', () => {
    expect(toArchiveState({ ...OFFICE_ARCHIVED.data, archived_at: 'yesterday' })).toBeUndefined();
    expect(toArchiveState({ ...OFFICE_ARCHIVED.data, archived_at: 1731200400 })).toBeUndefined();
  });
});

describe('toArchiveEvent (DL-225)', () => {
  it('reads each line of the history, newest first as sent, by the name the trail gives', () => {
    expect(ARCHIVE_EVENTS.data.map(toArchiveEvent)).toEqual([
      {
        id: '6c7d8e9f-0a1b-4c2d-8e3f-4a5b6c7d8e02',
        act: 'restored',
        reason: 'The office reopened after the merger was called off.',
        actorName: 'Fixture Administrator',
        occurredAt: '2026-11-12T03:00:00.000Z',
      },
      {
        id: '6c7d8e9f-0a1b-4c2d-8e3f-4a5b6c7d8e01',
        act: 'archived',
        reason: 'Merged into the MSWDO.',
        actorName: 'An account since closed',
        occurredAt: '2026-11-10T01:00:00.000Z',
      },
    ]);
  });

  it('never carries the account id beside the name', () => {
    expect(JSON.stringify(ARCHIVE_EVENTS.data.map(toArchiveEvent))).not.toContain(
      '0f1e2d3c-4b5a-4968-8776-655443322101',
    );
  });

  it('reads a line with no reason — a flag’s — and refuses one that cannot say what, who or when', () => {
    const [line] = ARCHIVE_EVENTS.data;
    expect(toArchiveEvent({ ...line, reason: null })?.reason).toBeNull();
    expect(toArchiveEvent({ ...line, act: 'deleted' })).toBeNull();
    expect(toArchiveEvent({ ...line, actor_name: null })).toBeNull();
    expect(toArchiveEvent({ ...line, occurred_at: 'last week' })).toBeNull();
    expect(toArchiveEvent({ ...line, id: undefined })).toBeNull();
  });
});

describe('toWireArchiveReason (DL-225)', () => {
  it('sends the reason trimmed, as the server keeps it, and nothing else', () => {
    expect(toWireArchiveReason('  Merged into the MSWDO.\n')).toEqual({
      reason: 'Merged into the MSWDO.',
    });
  });
});
