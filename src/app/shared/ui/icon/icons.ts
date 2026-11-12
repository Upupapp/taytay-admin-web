/**
 * The console's icon set: one path per glyph, on a 24-unit grid.
 *
 * Line icons are copied from the redesign's console mock-ups (stroked at
 * 1.8–2.2); solid ones from the reference's `icons/` folder (filled, even-odd).
 * The reference sits in `design/` while the redesign runs and moves to
 * `docs/design/` when it ends (`DL-200`). Only icons a screen uses are here. To add
 * one, copy its path data under a new name — a circle becomes two arcs
 * (`M cx+r cy a r r 0 1 1 -2r 0 r r 0 0 1 2r 0z`) — and mark a filled icon
 * `solid`.
 *
 * Drawn inline rather than loaded as files, so an icon takes the colour of the
 * text around it and costs no request.
 */
export interface IconDefinition {
  readonly d: string;
  /** Filled (the solid set) rather than stroked (the mock-ups' line set). */
  readonly solid?: true;
}

const DEFINITIONS = {
  // ── Navigation (console mock-ups) ──────────────────────────────────────
  grid: { d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  checkSquare: { d: 'M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11' },
  folder: { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  file: { d: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6' },
  user: { d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
  heart: { d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  home: { d: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5' },
  // The three sector pages (CitizensOverview mock-up, `DL-210`).
  senior: { d: 'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 22l1-7-2-2 1-4h6l1 4M17 13l2 9M14 22l-1-5' },
  accessible: { d: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 8h4l-1 5h4l2 6M9 11a6 6 0 1 0 6 7' },
  soloParent: {
    d: 'M9 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22v-6l-1-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2l-1 5v6M18 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22v-4h4v4',
  },
  users: {
    d: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  },
  pin: { d: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  share: { d: 'M15 4h5v5M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' },
  layers: { d: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5' },
  cash: { d: 'M3 7h18v10H3zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 10v.01M18 14v.01' },
  chart: { d: 'M4 20V10M10 20V4M16 20v-7M2 20h20' },
  calendar: { d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  shield: { d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  inbox: { d: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5' },
  docPlus: { d: 'M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6' },
  userPlus: { d: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 11-5.7M18 15v6M15 18h6' },
  building: { d: 'M4 21V5l8-2v18M12 7l8 2v12M7 9h2M7 13h2M7 17h2M15 12h2M15 16h2M2 21h20' },
  phone: {
    d: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  },
  sliders: { d: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4' },
  idCard: {
    d: 'M3 5h18v14H3zM8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16c.6-1.6 1.7-2 3-2s2.4.4 3 2M14 9h4M14 13h4',
  },
  news: {
    d: 'M4 5h13v14a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1zM17 9h3v10a1 1 0 0 1-2 0M7 9h7M7 13h7M7 17h4',
  },
  history: { d: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2' },
  staff: {
    d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
  },
  clipboard: { d: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4' },
  gear: {
    d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  },
  /** "Not connected yet": a module the API does not serve (`DL-167`). */
  unplugged: {
    d: 'M3 3l18 18M9 4v4M15 4v3M7 8h8.5M17 11v1a5 5 0 0 1-1.6 3.7M8.6 15.6A5 5 0 0 1 7 12V8M12 17v4',
  },

  // ── Shell controls (console mock-ups) ──────────────────────────────────
  menu: { d: 'M4 6h16M4 12h16M4 18h16' },
  mail: { d: 'M4 5h16v14H4zM4 6l8 7 8-7' },
  search: { d: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-3.5-3.5' },
  bell: { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0' },
  signOut: { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' },
  close: { d: 'M6 6l12 12M18 6 6 18' },
  plus: { d: 'M12 5v14M5 12h14' },
  pencil: { d: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' },
  arrowRight: { d: 'M5 12h14M13 6l6 6-6 6' },
  arrowUpRight: { d: 'M7 17 17 7M8 7h9v9' },
  download: { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' },
  chevronDown: { d: 'm6 9 6 6 6-6' },
  chevronUp: { d: 'm6 15 6-6 6 6' },
  chevronsUpDown: { d: 'm8 9 4-4 4 4M8 15l4 4 4-4' },

  // ── States (console mock-ups' notices) ─────────────────────────────────
  info: { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v5M12 8h.01' },
  success: { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l3 3 5-5' },
  warning: { d: 'M12 3 2 20h20zM12 10v4M12 17h.01' },
  error: { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7.5v5.5M12 16.5h.01' },
  lock: { d: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4' },

  // ── Theme switch (DL-207) ──────────────────────────────────────────────
  sun: {
    d: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  },
  moon: { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' },

  // ── Solid set (design/icons) ───────────────────────────────────────────
  cloud: {
    solid: true,
    d: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  },
  cloudOff: {
    solid: true,
    d: 'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  },
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof DEFINITIONS;

export const ICONS: Readonly<Record<IconName, IconDefinition>> = DEFINITIONS;
