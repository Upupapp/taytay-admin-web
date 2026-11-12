import type { DataPort, DataScope, Permission } from '@domain/index';

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
   * The screen's primary ports, exactly as its route's `servedGuard` lists them. An entry is
   * withheld when the bound adapter set cannot serve one of them (`DL-167`). A secondary panel's
   * port is not listed: the panel says in place that it is not connected (`DL-175`).
   * `check:unserved` holds this list to the route, and the route to what the screen reads.
   */
  readonly reads: readonly DataPort[];
  /** Two-letter glyph rendered in the sidebar. Keeps the shell icon-library free. */
  readonly glyph: string;
  readonly permissions: readonly Permission[];
  /**
   * Data scopes the screen is closed to although the role holds its permission, mirrored by the
   * route's `scopeGuard`. A caseload (`assigned-cases`) reads its own clients' records and never the
   * registry's lists, which the server answers 403 (`DL-183`, `DL-185`).
   */
  readonly closedTo?: readonly DataScope[];
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
        closedTo: ['assigned-cases'],
        description: 'Families as a unit, with the indicators behind each one.',
      },
      {
        label: 'Families',
        route: '/families',
        reads: ['family'],
        glyph: 'FM',
        permissions: ['family.view'],
        closedTo: ['assigned-cases'],
        description: 'Family units and the relationships between people.',
      },
      {
        label: 'Field visits',
        route: '/visits',
        reads: ['field-visit'],
        glyph: 'FV',
        permissions: ['visit.view'],
        description: 'Home visits, what was found, and what is owed next.',
      },
      {
        label: 'Referrals',
        route: '/referrals',
        // The compose form names the person, and the case or request it is about (`DL-185`).
        reads: ['referral', 'resident', 'case', 'assistance-request'],
        glyph: 'RF',
        permissions: ['referral.view'],
        description: 'Cases routed to partner offices and agencies.',
      },
    ],
  },
  {
    // `DL-208`. The office's registry of the people of Taytay, and the card the residents' app
    // shows them: one section, so a clerk looking for a person or their ID looks in one place.
    // The entries keep the routes and guards they had in Casework and Residents' app.
    title: 'Citizens',
    items: [
      {
        // `DL-213`. The registry counted by the server; every figure opens the registry filtered.
        label: 'Citizen overview',
        route: '/residents/overview',
        reads: ['resident'],
        glyph: 'CO',
        permissions: ['resident.view'],
        closedTo: ['assigned-cases'],
        description: 'The registry in figures: where people live, their sectors, age and sex.',
      },
      {
        label: 'Citizen registry',
        route: '/residents',
        reads: ['resident'],
        glyph: 'CR',
        permissions: ['resident.view'],
        closedTo: ['assigned-cases'],
        // Was "Beneficiary and household registry" before TAB 13 and "Residents" in Casework before
        // `DL-208`. The registry and the beneficiaries are distinct screens answering different
        // questions, and one label covering both is how a caseworker ends up on the wrong one.
        description: 'The registry: who is on file, and their details.',
      },
      // `DL-210`. The registry narrowed to one sector each: a page per sector, guarded as the registry.
      {
        label: 'Senior citizens',
        route: '/residents/sectors/senior-citizen',
        reads: ['resident'],
        glyph: 'SC',
        permissions: ['resident.view'],
        closedTo: ['assigned-cases'],
        description: 'Residents recorded in the senior citizen sector.',
      },
      {
        label: 'Persons with disability',
        route: '/residents/sectors/pwd',
        reads: ['resident'],
        glyph: 'PW',
        permissions: ['resident.view'],
        closedTo: ['assigned-cases'],
        description: 'Residents recorded in the PWD sector.',
      },
      {
        label: 'Solo parents',
        route: '/residents/sectors/solo-parent',
        reads: ['resident'],
        glyph: 'SP',
        permissions: ['resident.view'],
        closedTo: ['assigned-cases'],
        description: 'Residents recorded in the solo parent sector.',
      },
      {
        // `DL-171`. A resident's card in the app: checked by staff, kept by an administrator.
        // "Digital IDs" under Residents' app before `DL-208`; the route stays for bookmarks.
        label: 'Citizen IDs',
        route: '/digital-ids',
        reads: ['digital-id', 'app-account'],
        glyph: 'CI',
        permissions: ['digital-id.verify', 'digital-id.manage'],
        description: 'Check the digital ID a resident shows, and issue, suspend or revoke cards.',
      },
      // ── The citizen pack's further pages (DL-212 to DL-215). ──────────────────────────────────
      {
        // `DL-212`. Every card the municipality has issued, for whoever keeps the cards.
        label: 'Citizen ID list',
        route: '/citizen-ids',
        reads: ['digital-id'],
        glyph: 'CL',
        permissions: ['digital-id.manage'],
        description: 'Every card issued, where the cards stand, and each card’s record.',
      },
      {
        // `DL-214`. A list the office keeps, checked row by row before the registry changes.
        label: 'Import citizens',
        route: '/residents/import',
        reads: ['resident-import'],
        glyph: 'IC',
        permissions: ['resident.import'],
        closedTo: ['assigned-cases'],
        description: 'Bring in a list the office keeps, checking every row before the registry changes.',
      },
      {
        // `DL-215`. Residents ask in the app to be recorded in a sector; the office decides.
        label: 'Sector applications',
        route: '/residents/sector-applications',
        // The record an account is linked to may be found through the registry search.
        reads: ['sector-application', 'resident'],
        glyph: 'SA',
        permissions: ['resident.update'],
        closedTo: ['assigned-cases'],
        description: 'Applications from the app to be recorded as a senior, PWD or solo parent.',
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
    // into Casework or Delivery: events speak to residents rather than about
    // them, and the command asked for them to be placed naturally without
    // reorganising the sidebar. The newsfeed that sat here was retired in
    // favour of Balita, the news residents read in the app (`DL-194`).
    title: 'Community',
    items: [
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
        // `DL-184`. Certificates and other documents residents request from an office in the app —
        // not the casework documents an office asks an applicant for. Staff at an office and
        // administrators; the catalogue (`issuance-type.manage`, the head's) opens from this page.
        label: 'Resident document requests',
        route: '/resident-documents',
        reads: ['issuance'],
        glyph: 'DR',
        permissions: ['issuance-request.manage'],
        description: 'Documents residents asked an office for in the app, worked to the counter.',
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
      {
        // `DL-171`. The news residents read in the app — the console's one news channel (`DL-194`).
        label: 'Balita',
        route: '/balita',
        reads: ['balita', 'office'],
        glyph: 'BL',
        permissions: ['news.write'],
        description: 'Write and publish the news residents read in the Taytay app.',
      },
      {
        // `DL-171`. Who did what through the app's API, and when. Not the governance trail.
        label: 'App audit trail',
        route: '/app-audit',
        reads: ['platform-audit'],
        glyph: 'AT',
        permissions: ['audit.view'],
        description: 'Who did what through the Taytay app’s API, and when. Read-only.',
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
