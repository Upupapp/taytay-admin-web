import type { Permission } from '@domain/index';

/**
 * Sidebar definition.
 *
 * The nav is data, not markup: adding a feature means adding an entry here and
 * a lazy route in `app.routes.ts`. `permissions` mirrors the route guard so a
 * user is never shown a link that would bounce them to /forbidden.
 */
export interface NavItem {
  readonly label: string;
  readonly route: string;
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
        glyph: 'DB',
        permissions: ['dashboard.view'],
        description: 'Office-wide caseload and payout position.',
      },
      {
        label: 'Cases',
        route: '/cases',
        glyph: 'CS',
        permissions: ['case.view'],
        description: 'The continuing file on a household, and what is owed next.',
      },
      {
        label: 'Assistance requests',
        route: '/assistance-requests',
        glyph: 'AR',
        permissions: ['request.view'],
        description: 'Intake, assessment, endorsement and approval.',
      },
      {
        label: 'Residents',
        route: '/residents',
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
        glyph: 'BN',
        permissions: ['beneficiary.view'],
        description: 'Who the office has served, and what they have received.',
      },
      {
        label: 'Households',
        route: '/households',
        glyph: 'HH',
        permissions: ['household.view'],
        description: 'Families as a unit, with the indicators behind each one.',
      },
      {
        label: 'Families',
        route: '/families',
        glyph: 'FM',
        permissions: ['family.view'],
        description: 'Family units and the relationships between people.',
      },
      {
        label: 'Referrals',
        route: '/referrals',
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
        glyph: 'PG',
        permissions: ['program.view'],
        description: 'Assistance programmes, eligibility and requirements.',
      },
      {
        label: 'Disbursements',
        route: '/disbursements',
        glyph: 'DS',
        permissions: ['disbursement.view'],
        description: 'Payout scheduling, release and acknowledgement.',
      },
      {
        label: 'Reports',
        route: '/reports',
        glyph: 'RP',
        permissions: ['report.view'],
        description: 'Statutory and management reporting.',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Staff and roles',
        route: '/administration/staff',
        glyph: 'ST',
        permissions: ['staff.view'],
        description: 'Accounts, roles and data scope.',
      },
      {
        label: 'Audit trail',
        route: '/administration/audit',
        glyph: 'AU',
        permissions: ['audit.view'],
        description: 'Who accessed or changed what, and when.',
      },
      {
        label: 'Settings',
        route: '/administration/settings',
        glyph: 'SE',
        permissions: ['settings.manage'],
        description: 'Reference data and office configuration.',
      },
    ],
  },
];
