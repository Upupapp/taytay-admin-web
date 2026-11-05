import { describe, expect, it } from 'vitest';

import { asId, asIsoDateTime } from '../shared/ids';
import type {
  AppAccountId,
  MediaId,
  OfficeId,
  OfficeThreadId,
  ThreadMessageId,
} from '../shared/ids';
import {
  authorOf,
  isOpen,
  REPLY_LIMITS,
  replyProblem,
  THREAD_CLOSE_EFFECTS,
  THREAD_STATUS_CATALOG,
  THREAD_STATUS_TRANSITIONS,
  THREAD_STATUSES,
  type OfficeThread,
  type ThreadMessage,
} from './office-thread';

const thread: OfficeThread = {
  id: asId<OfficeThreadId>('thread-1'),
  residentAccountId: asId<AppAccountId>('resident-1'),
  officeId: asId<OfficeId>('office-1'),
  officeSlug: 'mswdo',
  subject: 'A question',
  status: 'open',
  unreadCount: 1,
  lastMessageAt: null,
  createdAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
  updatedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
};

function from(sender: string): ThreadMessage {
  return {
    id: asId<ThreadMessageId>('message-1'),
    threadId: thread.id,
    senderId: asId<AppAccountId>(sender),
    body: 'Words',
    attachments: [asId<MediaId>('media-1')],
    sentAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
  };
}

describe('an office conversation (DL-168)', () => {
  it('defines every status once, with a description, and closed as terminal', () => {
    for (const status of THREAD_STATUSES) {
      expect(THREAD_STATUS_CATALOG[status].description.length).toBeGreaterThan(20);
      expect(THREAD_STATUS_TRANSITIONS[status]).toBeDefined();
    }
    expect(THREAD_STATUS_TRANSITIONS.closed).toEqual([]);
    expect(isOpen(thread)).toBe(true);
    expect(isOpen({ ...thread, status: 'closed' })).toBe(false);
  });

  it('tells the resident’s words from the office’s, and the reader’s own', () => {
    expect(authorOf(thread, from('resident-1'), 'staff-9')).toBe('resident');
    expect(authorOf(thread, from('staff-2'), 'staff-9')).toBe('office');
    expect(authorOf(thread, from('staff-9'), 'staff-9')).toBe('you');
    expect(authorOf(thread, from('staff-9'), null)).toBe('office');
  });

  it('takes the API’s limits on a reply and invents no floor of its own', () => {
    expect(replyProblem('   ')).toBe('empty');
    expect(replyProblem('Yes.')).toBeNull();
    expect(replyProblem('a'.repeat(REPLY_LIMITS.maximum))).toBeNull();
    expect(replyProblem('a'.repeat(REPLY_LIMITS.maximum + 1))).toBe('too-long');
  });

  it('says before closing that no reason is kept, and that nothing reopens it', () => {
    const said = THREAD_CLOSE_EFFECTS.join(' ');
    expect(said).toMatch(/keeps no reason/);
    expect(said).toMatch(/can reopen it/);
    expect(said).toMatch(/new conversation/);
  });
});
