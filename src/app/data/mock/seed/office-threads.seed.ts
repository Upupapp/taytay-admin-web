import {
  asId,
  asIsoDateTime,
  type AppAccountId,
  type MediaId,
  type OfficeId,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type ThreadMessageId,
  type ThreadStatus,
} from '@domain/index';

import { MOCK_OFFICE_HEALTH, MOCK_OFFICE_MSWDO } from './offices.seed';

/**
 * Fictional conversations between residents and offices, for the `local-mock` configuration
 * (`DL-168`).
 *
 * Nobody here exists. The residents are app accounts with no name — which is all the API tells the
 * office about them too — and every attached "image" is a drawn placeholder that says in its own
 * pixels that it is a sample.
 */

/** Printed on every placeholder attachment, and a `check:bundle` seed marker: it must never ship. */
export const SAMPLE_ATTACHMENT_MARKER = 'SAMPLE ONLY - NOT A REAL ATTACHMENT';

/** A member of the office's staff in the seed — never the signed-in mock account. */
const SEED_STAFF = asId<AppAccountId>('app-account-staff-0001');

interface SeedMessage {
  readonly from: 'resident' | 'office';
  readonly at: string;
  readonly body: string;
  readonly images?: number;
}

interface SeedThread {
  readonly n: number;
  readonly office: OfficeId;
  readonly subject: string;
  readonly status: ThreadStatus;
  readonly unread: number;
  readonly messages: readonly SeedMessage[];
}

const HAND_WRITTEN: readonly SeedThread[] = [
  {
    n: 1,
    office: MOCK_OFFICE_MSWDO,
    subject: 'Requirements for burial assistance',
    status: 'open',
    unread: 2,
    messages: [
      {
        from: 'resident',
        at: '2026-11-05T01:12:00.000Z',
        body:
          'Good morning po. My father passed away last week. What do I need to bring to apply for ' +
          'burial assistance?',
      },
      {
        from: 'resident',
        at: '2026-11-05T01:15:00.000Z',
        body: 'I attached the funeral contract we have so far.',
        images: 1,
      },
    ],
  },
  {
    n: 2,
    office: MOCK_OFFICE_MSWDO,
    subject: 'Social pension payout schedule',
    status: 'open',
    unread: 0,
    messages: [
      {
        from: 'resident',
        at: '2026-11-03T06:40:00.000Z',
        body: 'When is the next social pension payout for senior citizens in our barangay?',
      },
      {
        from: 'office',
        at: '2026-11-03T08:05:00.000Z',
        body:
          'Good afternoon. The schedule for each barangay is posted in the app’s news once it is ' +
          'final. We will reply here as well when it is set.',
      },
      {
        from: 'resident',
        at: '2026-11-04T02:30:00.000Z',
        body: 'Thank you po. My mother uses a wheelchair — can somebody receive it for her?',
      },
    ],
  },
  {
    n: 3,
    office: MOCK_OFFICE_HEALTH,
    subject: 'Vaccination for my baby',
    status: 'open',
    unread: 1,
    messages: [
      {
        from: 'resident',
        at: '2026-11-02T23:20:00.000Z',
        body: 'Is the health centre open on Saturday for the baby’s scheduled vaccine?',
      },
    ],
  },
  {
    n: 4,
    office: MOCK_OFFICE_MSWDO,
    subject: 'Solo parent ID renewal',
    status: 'closed',
    unread: 0,
    messages: [
      {
        from: 'resident',
        at: '2026-10-20T03:00:00.000Z',
        body: 'My solo parent ID expires next month. Can I renew it early?',
      },
      {
        from: 'office',
        at: '2026-10-20T05:30:00.000Z',
        body:
          'Yes. Bring your current ID and an updated barangay certificate to the office on any ' +
          'weekday morning.',
      },
      {
        from: 'resident',
        at: '2026-10-21T00:10:00.000Z',
        body: 'Salamat po. I will go on Monday.',
      },
    ],
  },
  {
    n: 5,
    office: MOCK_OFFICE_MSWDO,
    subject: 'Photo of the damage to our roof',
    status: 'open',
    unread: 1,
    messages: [
      {
        from: 'resident',
        at: '2026-11-01T09:45:00.000Z',
        body:
          'The typhoon took part of our roof. A neighbour said the office may help. I attached two ' +
          'photos.',
        images: 2,
      },
    ],
  },
];

/** Enough further conversations that the inbox has a second page, as a real office's would. */
const GENERATED: readonly SeedThread[] = Array.from({ length: 19 }, (_, index) => {
  const n = index + 6;
  const day = String(28 - (index % 25)).padStart(2, '0');
  const answered = index % 3 === 0;
  return {
    n,
    office: index % 4 === 0 ? MOCK_OFFICE_HEALTH : MOCK_OFFICE_MSWDO,
    subject: `Question about office hours (${n})`,
    status: index % 5 === 4 ? 'closed' : 'open',
    unread: answered ? 0 : 1,
    messages: [
      {
        from: 'resident',
        at: `2026-10-${day}T02:00:00.000Z`,
        body: 'What time does the office open, and do I need an appointment?',
      },
      ...(answered
        ? [
            {
              from: 'office' as const,
              at: `2026-10-${day}T04:00:00.000Z`,
              body: 'We are open 8:00 to 17:00 on weekdays. No appointment is needed.',
            },
          ]
        : []),
    ],
  };
});

function key(n: number): string {
  return String(n).padStart(4, '0');
}

function toThread(row: SeedThread): OfficeThread {
  const last = row.messages.at(-1);
  const first = row.messages[0];
  return {
    id: asId<OfficeThreadId>(`thread-${key(row.n)}`),
    residentAccountId: asId<AppAccountId>(`app-account-resident-${key(row.n)}`),
    officeId: row.office,
    officeSlug: row.office === MOCK_OFFICE_HEALTH ? 'mho' : 'mswdo',
    subject: row.subject,
    status: row.status,
    unreadCount: row.unread,
    lastMessageAt: last === undefined ? null : asIsoDateTime(last.at),
    createdAt: asIsoDateTime(first?.at ?? '2026-10-01T00:00:00.000Z'),
    updatedAt: asIsoDateTime(last?.at ?? '2026-10-01T00:00:00.000Z'),
  };
}

function toMessages(row: SeedThread): readonly ThreadMessage[] {
  return row.messages.map((message, index) => ({
    id: asId<ThreadMessageId>(`message-${key(row.n)}-${index + 1}`),
    threadId: asId<OfficeThreadId>(`thread-${key(row.n)}`),
    senderId:
      message.from === 'resident'
        ? asId<AppAccountId>(`app-account-resident-${key(row.n)}`)
        : SEED_STAFF,
    body: message.body,
    attachments: Array.from({ length: message.images ?? 0 }, (_, image) =>
      asId<MediaId>(`media-message-${key(row.n)}-${index + 1}-${image + 1}`),
    ),
    sentAt: asIsoDateTime(message.at),
  }));
}

const ROWS = [...HAND_WRITTEN, ...GENERATED];

export const MOCK_OFFICE_THREADS: readonly OfficeThread[] = ROWS.map(toThread);

export const MOCK_THREAD_MESSAGES: readonly ThreadMessage[] = ROWS.flatMap(toMessages);

/**
 * A drawn placeholder, made when asked rather than at import so loading the seed has no side
 * effect. An SVG with no script and no external reference: text and rectangles only.
 */
export function sampleAttachment(): Blob {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">` +
    `<rect width="100%" height="100%" rx="14" fill="#eef1e8" stroke="#5b6b7a" stroke-width="3"/>` +
    `<text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" font-size="22" ` +
    `fill="#1f2d3a">Attached image</text>` +
    `<text x="50%" y="60%" text-anchor="middle" font-family="sans-serif" font-size="14" ` +
    `fill="#8a1c1c">${SAMPLE_ATTACHMENT_MARKER}</text>` +
    `</svg>`;

  return new Blob([svg], { type: 'image/svg+xml' });
}
