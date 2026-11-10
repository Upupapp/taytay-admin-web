import type { IconName } from '@shared/ui/icon/icons';

/**
 * The icon the sidebar draws beside each module, keyed by its route: the
 * console mock-ups' choice for every entry they show.
 *
 * Kept here rather than on `NavItem`, because `core/` may not import `shared/`
 * and an icon is a matter of presentation. A module added to `NAVIGATION`
 * without an icon falls back to its two-letter glyph, and the layout spec fails
 * until it has one.
 */
export const NAV_ICONS: Readonly<Record<string, IconName>> = {
  '/dashboard': 'grid',
  '/work': 'checkSquare',
  '/cases': 'folder',
  '/assistance-requests': 'file',
  '/residents': 'user',
  '/beneficiaries': 'heart',
  '/households': 'home',
  '/families': 'users',
  '/visits': 'pin',
  '/referrals': 'share',
  '/programs': 'layers',
  '/releases': 'cash',
  '/reports': 'chart',
  '/events': 'calendar',
  '/verification': 'shield',
  '/inbox': 'inbox',
  '/resident-documents': 'docPlus',
  '/users': 'userPlus',
  '/directory': 'building',
  '/home-screen': 'phone',
  '/app-settings': 'sliders',
  '/digital-ids': 'idCard',
  '/balita': 'news',
  '/app-audit': 'history',
  '/administration/staff': 'staff',
  '/administration/audit': 'clipboard',
  '/administration/settings': 'gear',
};
