import { describe, expect, it } from 'vitest';

import OFFICES_PAGE from '../fixtures/offices-page.json';
import THREAD_MESSAGES_PAGE from '../fixtures/thread-messages-page.json';
import THREAD_REPLY from '../fixtures/thread-reply.json';
import THREADS_PAGE from '../fixtures/threads-page.json';
import { toOffice } from './office.mapper';
import { toOfficeThread, toPostedMessage, toThreadMessage } from './office-thread.mapper';

describe('office inbox mappers (DL-168)', () => {
  it('reads a conversation by name, and nothing of what was last written', () => {
    const [wire] = THREADS_PAGE.data;
    const thread = toOfficeThread(wire);

    expect(thread).toEqual({
      id: wire?.id,
      residentAccountId: wire?.resident_id,
      officeId: wire?.office_id,
      officeSlug: 'mswdo',
      subject: 'Requirements for burial assistance',
      status: 'open',
      unreadCount: 2,
      lastMessageAt: '2026-11-05T01:15:00.000Z',
      createdAt: '2026-11-05T01:12:00.000Z',
      updatedAt: '2026-11-05T01:15:00.000Z',
    });
    expect(JSON.stringify(thread)).not.toContain(wire?.last_message_preview);
  });

  it('refuses a conversation missing what it cannot be read without', () => {
    const [wire] = THREADS_PAGE.data;
    for (const field of ['id', 'resident_id', 'office_id', 'subject', 'status', 'unread_count']) {
      expect(toOfficeThread({ ...wire, [field]: null }), field).toBeNull();
    }
    expect(toOfficeThread({ ...wire, status: 'archived' })).toBeNull();
    expect(toOfficeThread({ ...wire, last_message_at: null })?.lastMessageAt).toBeNull();
  });

  it('reads a message and its images as media ids, never addresses', () => {
    const message = toThreadMessage(THREAD_MESSAGES_PAGE.data[0]);

    expect(message?.attachments).toEqual(['bb22cc33-dd44-4e55-8f66-007708809901']);
    expect(message?.sentAt).toBe('2026-11-05T01:15:00.000Z');
    expect(toThreadMessage({ ...THREAD_MESSAGES_PAGE.data[0], body: '' })).toBeNull();
  });

  it('reads the message out of a reply’s answer', () => {
    expect(toPostedMessage(THREAD_REPLY.data)?.body).toBe(
      'Please bring the death certificate and a valid ID.',
    );
    expect(toPostedMessage({ thread: THREAD_REPLY.data.thread })).toBeNull();
  });

  it('reads an office by name, and only what names it', () => {
    const [wire] = OFFICES_PAGE.data;

    expect(toOffice(wire)).toEqual({
      id: wire?.id,
      name: 'Municipal Social Welfare and Development Office',
      slug: 'mswdo',
      shortName: 'MSWDO',
    });
    expect(toOffice({ ...wire, name: null })).toBeNull();
  });
});
