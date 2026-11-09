import {
  asId,
  asIsoDate,
  asIsoDateTime,
  type AppAccountId,
  type IdDocumentType,
  type MediaId,
  type VerificationImageKind,
  type VerificationRequest,
  type VerificationRequestId,
  type VerificationStatus,
} from '@domain/index';

/**
 * Fictional ID verification requests for the `local-mock` configuration (`DL-167`).
 *
 * No person here exists, and no image is a photograph: every "ID" and every "selfie" is a drawn
 * placeholder that says, in its own pixels, that it is a sample. A realistic-looking sample ID in a
 * development build is one screenshot away from being mistaken for a real one.
 */

/** Printed on every placeholder, and a `check:bundle` seed marker: it must never ship. */
export const SAMPLE_IMAGE_MARKER = 'SAMPLE ONLY - NOT A REAL ID';

interface SeedRow {
  readonly n: number;
  readonly idType: IdDocumentType;
  readonly withBack: boolean;
  readonly status: VerificationStatus;
  readonly submitted: string;
  readonly reviewed?: string;
  readonly residentMessage?: string;
  readonly reviewNote?: string;
  /** What the account gives; read only while pending, as the API sends it (`DL-197`). */
  readonly accountName?: string | null;
  readonly accountBirthDate?: string;
}

const HAND_WRITTEN: readonly SeedRow[] = [
  {
    n: 1,
    idType: 'philid',
    withBack: true,
    status: 'pending',
    submitted: '2026-11-04T23:40:00.000Z',
    accountName: 'Liza Sample Reyes',
    accountBirthDate: '1988-03-14',
  },
  {
    n: 2,
    idType: 'drivers-license',
    withBack: true,
    status: 'pending',
    submitted: '2026-11-04T08:15:00.000Z',
    residentMessage: 'I took the photo again in daylight so the name can be read.',
    accountName: 'Jun Sample Bautista',
  },
  {
    n: 3,
    idType: 'umid',
    withBack: false,
    status: 'pending',
    submitted: '2026-11-03T02:05:00.000Z',
    // An account that gives no name: there is nothing to check, so it can only be rejected.
    accountName: null,
  },
  {
    n: 4,
    idType: 'postal',
    withBack: false,
    status: 'approved',
    submitted: '2026-10-30T01:00:00.000Z',
    reviewed: '2026-10-30T05:30:00.000Z',
    reviewNote: 'Selfie matches the ID photo; card legible and unexpired.',
  },
  {
    n: 5,
    idType: 'voters',
    withBack: false,
    status: 'rejected',
    submitted: '2026-10-28T03:00:00.000Z',
    reviewed: '2026-10-28T06:10:00.000Z',
    reviewNote:
      'The photo of the ID is too blurred to read the name. Please take it again in good light.',
  },
];

/**
 * Enough waiting requests that the queue runs past one page, so "more available" is exercised in
 * development rather than first seen in production.
 */
const GENERATED: readonly SeedRow[] = Array.from({ length: 22 }, (_, index) => ({
  n: 100 + index,
  idType: (['passport', 'sss', 'philid', 'other'] as const)[index % 4] ?? 'other',
  withBack: index % 3 !== 0,
  status: 'pending' as const,
  submitted: new Date(Date.UTC(2026, 9, 25, 9) - index * 3_600_000).toISOString(),
  accountName: `Sample Resident ${100 + index}`,
}));

function toRequest(row: SeedRow): VerificationRequest {
  const key = String(row.n).padStart(4, '0');

  return {
    id: asId<VerificationRequestId>(`vr-${key}`),
    accountId: asId<AppAccountId>(`app-account-${key}`),
    idType: row.idType,
    images: {
      idFront: asId<MediaId>(`media-${key}-front`),
      idBack: row.withBack ? asId<MediaId>(`media-${key}-back`) : null,
      selfie: asId<MediaId>(`media-${key}-selfie`),
    },
    status: row.status,
    submittedAt: asIsoDateTime(row.submitted),
    reviewedAt: row.reviewed === undefined ? null : asIsoDateTime(row.reviewed),
    residentMessage: row.residentMessage ?? null,
    reviewNote: row.reviewNote ?? null,
    account:
      row.status === 'pending'
        ? {
            name: row.accountName ?? null,
            birthDate: row.accountBirthDate === undefined ? null : asIsoDate(row.accountBirthDate),
          }
        : null,
  };
}

export const MOCK_VERIFICATION_REQUESTS: readonly VerificationRequest[] = [
  ...HAND_WRITTEN,
  ...GENERATED,
].map(toRequest);

const PLACEHOLDER_CAPTION: Readonly<Record<VerificationImageKind, string>> = {
  'id-front': 'ID - front',
  'id-back': 'ID - back',
  selfie: 'Selfie',
};

/**
 * A drawn placeholder, made when asked rather than at import so loading the seed has no side
 * effect. An SVG with no script and no external reference: text and rectangles only.
 */
export function samplePlaceholder(kind: VerificationImageKind): Blob {
  const portrait = kind === 'selfie';
  const width = portrait ? 300 : 428;
  const height = portrait ? 400 : 270;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" rx="14" fill="#e8eef3" stroke="#5b6b7a" stroke-width="3"/>` +
    `<text x="50%" y="42%" text-anchor="middle" font-family="sans-serif" font-size="22" ` +
    `fill="#1f2d3a">${PLACEHOLDER_CAPTION[kind]}</text>` +
    `<text x="50%" y="58%" text-anchor="middle" font-family="sans-serif" font-size="15" ` +
    `fill="#8a1c1c">${SAMPLE_IMAGE_MARKER}</text>` +
    `</svg>`;

  return new Blob([svg], { type: 'image/svg+xml' });
}
