import {
  asId,
  asIsoDateTime,
  type HomeBanner,
  type HomeBannerId,
  type MediaId,
  type QuickLink,
  type QuickLinkId,
} from '@domain/index';

/**
 * The residents' app home screen, for the `local-mock` configuration (`DL-170`). Fictional: every
 * link points at `home.example.test`, a reserved name, and `check:bundle` fails a production build
 * that contains it. The banner images are drawn by `sampleBannerImage`, not photographs.
 */
export const SAMPLE_HOME_DOMAIN = 'home.example.test';

const banner = (
  key: string,
  title: string,
  sortOrder: number,
  values: Partial<HomeBanner> = {},
): HomeBanner => ({
  id: asId<HomeBannerId>(`banner-${key}`),
  title,
  mediaId: asId<MediaId>(`media-banner-${key}`),
  href: `https://${SAMPLE_HOME_DOMAIN}/${key}`,
  sortOrder,
  active: true,
  createdAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
  ...values,
});

export const MOCK_HOME_BANNERS: readonly HomeBanner[] = [
  banner('senior-id', 'Senior citizen IDs, every weekday (sample)', 1),
  banner('feeding', 'Supplementary feeding resumes (sample)', 2),
  banner('typhoon', 'Typhoon relief, 2025 (sample)', 3, { active: false, href: null }),
];

const link = (key: string, label: string, sortOrder: number): QuickLink => ({
  id: asId<QuickLinkId>(`link-${key}`),
  label,
  href: `https://${SAMPLE_HOME_DOMAIN}/${key}`,
  sortOrder,
  createdAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
});

export const MOCK_QUICK_LINKS: readonly QuickLink[] = [
  link('tulong', 'Tulong (sample)', 1),
  link('hotlines', 'Hotlines (sample)', 2),
];

/** A drawn placeholder standing in for a banner's image: a coloured SVG, never a photograph. */
export function sampleBannerImage(title: string): Blob {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200">' +
    '<rect width="640" height="200" fill="#10559a"/>' +
    `<text x="24" y="110" font-size="24" fill="#fff">SAMPLE BANNER - ${title.replace(/[<&>]/g, '')}</text>` +
    '</svg>';
  return new Blob([svg], { type: 'image/svg+xml' });
}
