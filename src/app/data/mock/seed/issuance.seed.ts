import {
  asId,
  asIsoDateTime,
  officeMovesFrom,
  type AppAccountId,
  type IssuanceAttachment,
  type IssuanceAttachmentId,
  type IssuanceEvent,
  type IssuanceEventId,
  type IssuanceMimeType,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceStatus,
  type IssuanceType,
  type IssuanceTypeId,
} from '@domain/index';

import { MOCK_OFFICE_HEALTH, MOCK_OFFICE_MSWDO } from './offices.seed';

/**
 * Fictional document types and residents' document requests for the `local-mock` configuration
 * (`DL-184`). No person here exists, and no file is a real document: every attachment is drawn
 * when asked for and says, in its own content, that it is a sample.
 */

/** Printed in every drawn file, and a `check:bundle` seed marker: it must never ship. */
export const SAMPLE_FILE_MARKER = 'SAMPLE ONLY - NOT A REAL FILE';

const MSWDO = { id: MOCK_OFFICE_MSWDO, name: 'Municipal Social Welfare and Development Office' };
const HEALTH = { id: MOCK_OFFICE_HEALTH, name: 'Municipal Health Office' };

const at = (iso: string) => asIsoDateTime(iso);

const RESIDENCY: IssuanceType = {
  id: asId<IssuanceTypeId>('issuance-type-residency'),
  office: { id: MSWDO.id, name: MSWDO.name },
  name: 'Certificate of residency for assistance',
  description: 'For a resident applying for assistance from another agency.',
  requirements: [
    { code: 'valid-id', label: 'A valid government ID', required: true, hint: null },
    {
      code: 'barangay-certificate',
      label: 'Barangay certificate',
      required: false,
      hint: 'Issued within the last three months.',
    },
  ],
  fee: { centavos: 5000, currency: 'PHP' },
  processingDays: 3,
  claimInstructions: 'Claim at the MSWDO counter, weekdays 8:00 to 17:00. Bring the ID you sent.',
  active: true,
  retiredAt: null,
  updatedAt: at('2026-10-20T01:00:00.000Z'),
};

const SOLO_PARENT: IssuanceType = {
  id: asId<IssuanceTypeId>('issuance-type-solo-parent'),
  office: { id: MSWDO.id, name: MSWDO.name },
  name: 'Solo parent certification',
  description: null,
  requirements: [
    { code: 'valid-id', label: 'A valid government ID', required: true, hint: null },
    {
      code: 'child-birth-certificate',
      label: 'Birth certificate of each child',
      required: true,
      hint: 'One file may hold several pages.',
    },
  ],
  fee: null,
  processingDays: null,
  claimInstructions: null,
  active: true,
  retiredAt: null,
  updatedAt: at('2026-10-21T01:00:00.000Z'),
};

const REFERRAL_LETTER: IssuanceType = {
  id: asId<IssuanceTypeId>('issuance-type-referral-letter'),
  office: { id: MSWDO.id, name: MSWDO.name },
  name: 'Referral letter for hospital assistance',
  description: 'Replaced by the hospital’s own form.',
  requirements: [],
  fee: { centavos: 0, currency: 'PHP' },
  processingDays: 0,
  claimInstructions: null,
  active: false,
  retiredAt: at('2026-10-30T02:00:00.000Z'),
  updatedAt: at('2026-10-30T02:00:00.000Z'),
};

const HEALTH_CERTIFICATE: IssuanceType = {
  id: asId<IssuanceTypeId>('issuance-type-health-certificate'),
  office: { id: HEALTH.id, name: HEALTH.name },
  name: 'Health certificate for food handlers',
  description: null,
  requirements: [{ code: 'valid-id', label: 'A valid government ID', required: true, hint: null }],
  fee: { centavos: 10000, currency: 'PHP' },
  processingDays: 1,
  claimInstructions: 'Claim at the Health Office, ground floor.',
  active: true,
  retiredAt: null,
  updatedAt: at('2026-10-22T01:00:00.000Z'),
};

export const MOCK_ISSUANCE_TYPES: readonly IssuanceType[] = [
  RESIDENCY,
  SOLO_PARENT,
  REFERRAL_LETTER,
  HEALTH_CERTIFICATE,
];

const OFFICE_ACTOR = 'staff-account-sample-0001';

interface SeedMove {
  readonly to: IssuanceStatus;
  readonly at: string;
  readonly reason?: string;
  readonly claimDetails?: string;
  readonly byResident?: boolean;
}

interface SeedRequest {
  readonly n: number;
  readonly type: IssuanceType;
  readonly resident: string | null;
  readonly purpose: string;
  readonly filed: string;
  readonly files: readonly (readonly [string, IssuanceMimeType, string])[];
  readonly moves: readonly SeedMove[];
}

const HAND_WRITTEN: readonly SeedRequest[] = [
  {
    n: 1,
    type: RESIDENCY,
    resident: 'Teresita Lumbao',
    purpose: 'For my application for medical assistance at the provincial hospital.',
    filed: '2026-10-27T01:30:00.000Z',
    files: [['valid-id', 'image/jpeg', '2026-10-27T01:30:00.000Z']],
    moves: [],
  },
  {
    n: 2,
    type: SOLO_PARENT,
    resident: 'Danilo Abrenica',
    purpose: 'To apply for the solo parent benefits at my employer.',
    filed: '2026-11-03T05:10:00.000Z',
    files: [
      ['valid-id', 'image/png', '2026-11-03T05:10:00.000Z'],
      ['child-birth-certificate', 'application/pdf', '2026-11-03T05:10:00.000Z'],
    ],
    moves: [],
  },
  {
    n: 3,
    type: RESIDENCY,
    resident: 'Josefina Pacheco',
    purpose: 'Required by the PCSO for my mother’s medicine assistance.',
    filed: '2026-10-29T02:00:00.000Z',
    files: [
      ['valid-id', 'image/jpeg', '2026-10-29T02:00:00.000Z'],
      ['barangay-certificate', 'application/pdf', '2026-10-29T02:00:00.000Z'],
    ],
    moves: [
      {
        to: 'under-review',
        at: '2026-10-30T01:00:00.000Z',
        reason: 'We have started reviewing your request.',
      },
    ],
  },
  {
    n: 4,
    type: SOLO_PARENT,
    resident: 'Analyn Morales',
    purpose: 'For the renewal of my solo parent ID at the barangay.',
    filed: '2026-10-25T03:00:00.000Z',
    files: [
      ['valid-id', 'image/jpeg', '2026-10-25T03:00:00.000Z'],
      ['child-birth-certificate', 'image/jpeg', '2026-10-25T03:00:00.000Z'],
    ],
    moves: [
      {
        to: 'under-review',
        at: '2026-10-26T01:00:00.000Z',
        reason: 'We have started reviewing your request.',
      },
      {
        to: 'needs-info',
        at: '2026-10-26T03:00:00.000Z',
        reason: 'The birth certificate is cut off at the bottom. Please send the whole page.',
      },
    ],
  },
  {
    n: 5,
    type: RESIDENCY,
    resident: 'Rommel Garduque',
    purpose: 'For a burial assistance application with the provincial office.',
    filed: '2026-10-22T02:00:00.000Z',
    files: [
      ['valid-id', 'image/jpeg', '2026-10-22T02:00:00.000Z'],
      ['valid-id', 'application/pdf', '2026-10-24T01:15:00.000Z'],
    ],
    moves: [
      {
        to: 'under-review',
        at: '2026-10-23T01:00:00.000Z',
        reason: 'We have started reviewing your request.',
      },
      {
        to: 'needs-info',
        at: '2026-10-23T03:00:00.000Z',
        reason: 'The photo of your ID is too dark to read. Please send a clearer copy.',
      },
      {
        to: 'under-review',
        at: '2026-10-24T01:15:00.000Z',
        reason: 'Here is a scan of the ID.',
        byResident: true,
      },
      {
        to: 'approved',
        at: '2026-11-04T06:30:00.000Z',
        reason: 'Your request is approved. We are preparing the certificate.',
      },
    ],
  },
  {
    n: 6,
    type: RESIDENCY,
    resident: null,
    purpose: 'For my scholarship application at the municipal college.',
    filed: '2026-10-20T02:00:00.000Z',
    files: [['valid-id', 'image/png', '2026-10-20T02:00:00.000Z']],
    moves: [
      {
        to: 'under-review',
        at: '2026-10-21T01:00:00.000Z',
        reason: 'We have started reviewing your request.',
      },
      { to: 'approved', at: '2026-10-22T01:00:00.000Z', reason: 'Approved. We are preparing it.' },
      {
        to: 'ready-for-pickup',
        at: '2026-10-23T05:00:00.000Z',
        reason: 'Your certificate is ready.',
        claimDetails:
          'MSWDO counter, any weekday from 24 October, 8:00 to 17:00. The fee is ₱50.00, paid at the counter.',
      },
    ],
  },
  {
    n: 7,
    type: HEALTH_CERTIFICATE,
    resident: 'Celso Ignacio',
    purpose: 'Needed for my work at a carinderia in the public market.',
    filed: '2026-11-05T01:00:00.000Z',
    files: [['valid-id', 'image/jpeg', '2026-11-05T01:00:00.000Z']],
    moves: [],
  },
  {
    n: 8,
    type: RESIDENCY,
    resident: 'Marites Dalisay',
    purpose: 'For a requirement of the PhilHealth office.',
    filed: '2026-10-15T02:00:00.000Z',
    files: [['valid-id', 'image/jpeg', '2026-10-15T02:00:00.000Z']],
    moves: [
      {
        to: 'under-review',
        at: '2026-10-16T01:00:00.000Z',
        reason: 'We have started reviewing your request.',
      },
      {
        to: 'rejected',
        at: '2026-10-16T05:00:00.000Z',
        reason:
          'Our records show you live outside Taytay, so this office cannot certify your residency. Your barangay of residence can.',
      },
    ],
  },
  {
    n: 9,
    type: SOLO_PARENT,
    resident: 'Gloria Santiago',
    purpose: 'For my child’s school requirements.',
    filed: '2026-10-18T02:00:00.000Z',
    files: [['valid-id', 'image/png', '2026-10-18T02:00:00.000Z']],
    moves: [
      {
        to: 'cancelled',
        at: '2026-10-18T09:00:00.000Z',
        reason: 'I filed the wrong document.',
        byResident: true,
      },
    ],
  },
];

/**
 * Enough released requests that the ended list runs past one page, so "more available" is
 * exercised in development rather than first seen against the server.
 */
const GENERATED: readonly SeedRequest[] = Array.from({ length: 24 }, (_, index) => {
  const day = String(1 + (index % 28)).padStart(2, '0');
  return {
    n: 100 + index,
    type: RESIDENCY,
    resident: `Sample Resident ${index + 1}`,
    purpose: 'For an application for assistance with another agency.',
    filed: `2026-09-${day}T01:00:00.000Z`,
    files: [['valid-id', 'image/jpeg', `2026-09-${day}T01:00:00.000Z`] as const],
    moves: [
      { to: 'under-review' as const, at: `2026-09-${day}T03:00:00.000Z`, reason: 'Reviewing now.' },
      {
        to: 'approved' as const,
        at: `2026-09-${day}T05:00:00.000Z`,
        reason: 'Approved after review.',
      },
      {
        to: 'ready-for-pickup' as const,
        at: `2026-09-${day}T07:00:00.000Z`,
        reason: 'Your certificate is ready.',
        claimDetails: 'MSWDO counter, weekdays 8:00 to 17:00.',
      },
      {
        to: 'released' as const,
        at: `2026-09-${day}T08:00:00.000Z`,
        reason: 'Handed to the resident.',
      },
    ],
  };
});

function toRequest(seed: SeedRequest): IssuanceRequest {
  const key = String(seed.n).padStart(4, '0');
  const accountId = asId<AppAccountId>(`app-account-issuance-${key}`);
  const versions = new Map<string, number>();
  const attachments: IssuanceAttachment[] = seed.files.map(([code, mimeType, sent], index) => {
    const version = (versions.get(code) ?? 0) + 1;
    versions.set(code, version);
    return {
      id: asId<IssuanceAttachmentId>(`issuance-file-${key}-${index + 1}`),
      requirementCode: code,
      version,
      mimeType,
      byteSize: 120_000 + index * 40_000,
      current: true,
      sentAt: at(sent),
    };
  });
  const current = attachments.map((attachment) => ({
    ...attachment,
    current: attachment.version === versions.get(attachment.requirementCode),
  }));

  const history: IssuanceEvent[] = [
    {
      id: asId<IssuanceEventId>(`issuance-event-${key}-0`),
      from: null,
      to: 'submitted',
      side: 'resident',
      actorId: accountId,
      reason: null,
      claimDetails: null,
      at: at(seed.filed),
    },
  ];
  let status: IssuanceStatus = 'submitted';
  let statusSince = seed.filed;
  let claimDetails: string | null = null;
  for (const [index, move] of seed.moves.entries()) {
    history.push({
      id: asId<IssuanceEventId>(`issuance-event-${key}-${index + 1}`),
      from: status,
      to: move.to,
      side: move.byResident === true ? 'resident' : 'office',
      actorId: move.byResident === true ? accountId : OFFICE_ACTOR,
      reason: move.reason ?? null,
      claimDetails: move.claimDetails ?? null,
      at: at(move.at),
    });
    status = move.to;
    statusSince = move.at;
    claimDetails = move.claimDetails ?? claimDetails;
  }

  return {
    id: asId<IssuanceRequestId>(`issuance-request-${key}`),
    referenceNumber: `DR-2026-${String(seed.n).padStart(6, '0')}`,
    status,
    type: { id: seed.type.id, name: seed.type.name },
    office: seed.type.office,
    resident: { accountId, name: seed.resident },
    filedAt: at(seed.filed),
    statusSince: at(statusSince),
    purpose: seed.purpose,
    fee: seed.type.fee,
    processingDays: seed.type.processingDays,
    claimInstructions: seed.type.claimInstructions,
    requirements: seed.type.requirements,
    attachments: current,
    claimDetails,
    history,
    allowedMoves: officeMovesFrom(status),
  };
}

export const MOCK_ISSUANCE_REQUESTS: readonly IssuanceRequest[] = [
  ...HAND_WRITTEN,
  ...GENERATED,
].map(toRequest);

/**
 * A drawn file, made when asked rather than at import so loading the seed has no side effect. An
 * image is an SVG of text and rectangles; a PDF is one page of text. Neither holds anything real.
 */
export function sampleFile(mimeType: IssuanceMimeType, label: string): Blob {
  if (mimeType === 'application/pdf') {
    const text = `(${SAMPLE_FILE_MARKER}) Tj`;
    const content = `BT /F1 16 Tf 24 100 Td ${text} ET`;
    const pdf =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R' +
      '/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
      `4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n` +
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n';
    return new Blob([pdf], { type: 'application/pdf' });
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="270" viewBox="0 0 420 270">' +
    '<rect width="100%" height="100%" rx="12" fill="#eef1e8" stroke="#5b6b5a" stroke-width="3"/>' +
    `<text x="50%" y="42%" text-anchor="middle" font-family="sans-serif" font-size="20" ` +
    `fill="#1f2d1f">${label.replace(/[<&>]/g, ' ')}</text>` +
    '<text x="50%" y="58%" text-anchor="middle" font-family="sans-serif" font-size="15" ' +
    `fill="#8a1c1c">${SAMPLE_FILE_MARKER}</text>` +
    '</svg>';
  return new Blob([svg], { type: 'image/svg+xml' });
}
