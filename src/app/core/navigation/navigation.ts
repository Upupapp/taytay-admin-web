import type { DataPort, Permission } from '@domain/index';

/**
 * Sidebar definition.
 *
 * The nav is data, not markup: adding a feature means adding an entry here and
 * a lazy route in `app.routes.ts`. `permissions` mirrors the route guard so a
 * user is never shown a link that would bounce them to /forbidden, and `reads`
 * mirrors its served guard so nobody is offered a module the API cannot serve.
 */
export interface NavItem {
  readonly label: string;
  readonly route: string;
  /**
   * Every port the screen at `route` reads, exactly as its route's `servedGuard` lists them. An
   * entry is withheld when the bound adapter set cannot serve one of them (`DL-167`), and
   * `check:unserved` holds this list to the route and the route to the screen.
   */
  readonly reads: readonly DataPort[];
  /** Two-letter glyph rendered in the sidebar. Keeps the shell icon-library free. */
  readonly glyph: string;
  readonly permissions: readonly Permission[];
  readonly description: string;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    title: 'Casework',
    items: [
      {
        label: 'Dashboard',
        route: '/dashboard',
        reads: ['dashboard'],
        glyph: 'DB',
        permissions: ['dashboard.view'],
        description: 'Office-wide caseload and payout position.',
      },
      {
        label: 'My work',
        route: '/work',
        reads: ['case', 'work'],
        glyph: 'WK',
        permissions: ['dashboard.view'],
        description: 'What you owe today, across every module.',
      },
      {
        label: 'Cases',
        route: '/cases',
        reads: ['case'],
        glyph: 'CS',
        permissions: ['case.view'],
        description: 'The continuing file on a household, and what is owed next.',
      },
      {
        label: 'Assistance requests',
        route: '/assistance-requests',
        reads: ['assistance-request'],
        glyph: 'AR',
        permissions: ['request.view'],
        description: 'Intake, assessment, endorsement and approval.',
      },
      {
        label: 'Residents',
        route: '/residents',
        reads: ['resident', 'saved-view'],
        glyph: 'RS',
        permissions: ['resident.view'],
        // Was "Beneficiary and household registry" before TAB 13. The two are
        // now distinct screens answering different questions, and one label
        // covering both is how a caseworker ends up on the wrong one.
        description: 'The registry: who is on file, and their details.',
      },
      {
        label: 'Beneficiaries',
        route: '/beneficiaries',
        reads: ['beneficiary', 'program', 'saved-view'],
        glyph: 'BN',
        permissions: ['beneficiary.view'],
        description: 'Who the office has served, and what they have received.',
      },
      {
        label: 'Households',
        route: '/households',
        reads: ['household'],
        glyph: 'HH',
        permissions: ['household.view'],
        description: 'Families as a unit, with the indicators behind each one.',
      },
      {
        label: 'Families',
        route: '/families',
        reads: ['family'],
        glyph: 'FM',
        permissions: ['family.view'],
        description: 'Family units and the relationships between people.',
      },
      {
        label: 'Field visits',
        route: '/visits',
        reads: ['field-visit'],
        glyph: 'FV',
        permissions: ['case.view'],
        description: 'Home visits, what was found, and what is owed next.',
      },
      {
        label: 'Referrals',
        route: '/referrals',
        reads: ['referral', 'resident'],
        glyph: 'RF',
        permissions: ['referral.view'],
        description: 'Cases routed to partner offices and agencies.',
      },
    ],
  },
  {
    title: 'Delivery',
    items: [
      {
        label: 'Programs',
        route: '/programs',
        reads: ['program'],
        glyph: 'PG',
        permissions: ['program.view'],
        description: 'Assistance programmes, eligibility and requirements.',
      },
      {
        label: 'Releases',
        route: '/releases',
        reads: ['release'],
        // Was 'DS', an abbreviation of the noun this console no longer uses (DL-132).
        glyph: 'RL',
        permissions: ['release.view'],
        description: 'Payout scheduling, release and acknowledgement.',
      },
      {
        label: 'Reports',
        route: '/reports',
        reads: ['report'],
        glyph: 'RP',
        permissions: ['report.view'],
        description: 'Statutory and management reporting.',
      },
    ],
  },
  {
    // Added by the late-phase command. A new section rather than items squeezed
    // into Casework or Delivery: these are the two modules that speak to
    // residents rather than about them, and the command asked for them to be
    // placed naturally without reorganising the sidebar.
    title: 'Community',
    items: [
      {
        label: 'Newsfeed',
        route: '/newsfeed',
        reads: ['newsfeed'],
        glyph: 'NF',
        permissions: ['newsfeed.view'],
        description: 'What the office has published, and what residents said back.',
      },
      {
        label: 'Events',
        route: '/events',
        reads: ['event'],
        glyph: 'EV',
        permissions: ['event.view'],
        description: 'Municipal activities, registrations and attendance.',
      },
    ],
  },
  {
    // `DL-167`. The first module built on what the Node API serves: the residents' app's back
    // office. Its own section because it acts on app accounts, not on the office's registry, and a
    // reader of the Casework section should never take one for the other (`DL-164`).
    title: 'Residents’ app',
    items: [
      {
        label: 'ID verification',
        route: '/verification',
        reads: ['verification'],
        glyph: 'IV',
        permissions: ['verification.review'],
        description: 'Residents asking to have their app account verified against an ID.',
      },
      {
        // `DL-168`. Staff hold the key only while assigned to an office; an account without one is
        // told so on the page that names what it can open, never shown an empty inbox.
        label: 'Office inbox',
        route: '/inbox',
        reads: ['office-inbox', 'office'],
        glyph: 'OI',
        permissions: ['office-inbox.manage'],
        description: 'Residents writing to an office from the app, and the office’s replies.',
      },
      {
        // `DL-168`. Every app account, residents included, and who among them is staff.
        label: 'Users and roles',
        route: '/users',
        reads: ['app-account', 'office'],
        glyph: 'UR',
        permissions: ['user.view'],
        description: 'Every residents’ app account, and who among them is staff.',
      },
      {
        // `DL-170`. What residents read in the app: offices, Tulong pages, hotlines.
        label: 'App directory',
        route: '/directory',
        reads: ['directory-office', 'hotline', 'office', 'tulong-service'],
        glyph: 'AD',
        permissions: ['office.manage', 'service.manage', 'hotline.manage'],
        description: 'The offices, Tulong pages and hotlines residents see in the Taytay app.',
      },
      {
        // `DL-170`. The first screen every resident opens: its banners and quick links.
        label: 'Home screen',
        route: '/home-screen',
        reads: ['home-screen'],
        glyph: 'HS',
        permissions: ['home.manage'],
        description: 'The banners and quick links on the Taytay app’s home screen.',
      },
      {
        // `DL-170`. One change here can make every resident update the app or accept again.
        label: 'App settings',
        route: '/app-settings',
        reads: ['app-config'],
        glyph: 'AS',
        permissions: ['app-config.manage'],
        description: 'Contact details, required versions and feature flags of the Taytay app.',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Staff and roles',
        route: '/administration/staff',
        reads: ['governance'],
        glyph: 'ST',
        permissions: ['staff.view'],
        description: 'Accounts, roles and data scope.',
      },
      {
        label: 'Audit trail',
        route: '/administration/audit',
        reads: ['governance'],
        glyph: 'AU',
        permissions: ['audit.view'],
        description: 'Who accessed or changed what, and when.',
      },
      {
        label: 'Settings',
        route: '/administration/settings',
        reads: ['governance'],
        glyph: 'SE',
        permissions: ['settings.manage'],
        description: 'Reference data and office configuration.',
      },
    ],
  },
];
