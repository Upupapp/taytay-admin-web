/**
 * User-facing copy for the application shell.
 *
 * Follows the convention set in `DL-23`: strings live in a typed `*.copy.ts`
 * module beside the code they serve, never inline in a template, so switching
 * on `@angular/localize` later changes these literals and nothing else.
 */
export const LAYOUT_COPY = {
  skipToContent: 'Skip to main content',

  // Navigation
  navLandmark: 'Main navigation',
  navToggleOpen: 'Open navigation',
  navToggleClose: 'Close navigation',
  navEmpty: 'No sections are available for this role.',

  // Breadcrumb
  breadcrumbLandmark: 'Breadcrumb',
  breadcrumbHome: 'Dashboard',

  // Global search. The trigger navigates; the search screen owns the rest.
  searchLabel: 'Search',
  searchPlaceholder: 'Search residents, requests, programmes…',
  searchShortcutHint: 'Ctrl K',

  // Notifications
  notificationsLabel: 'Notifications',
  notificationsHeading: 'Notifications',
  notificationsDescription: 'Case and payout activity for your account.',
  notificationsEmptyHeading: 'No notifications',
  notificationsEmptyBody: 'Activity on your cases and payouts will appear here.',
  markRead: 'Mark as read',
  markAllRead: 'Mark all as read',
  unreadCountLabel: (count: number): string =>
    count === 1 ? '1 unread notification' : `${count} unread notifications`,

  // Identity
  signOut: 'Sign out',
  scopeAllBarangays: 'All barangays',
  scopeAssignedCases: 'Assigned cases',
  scopeOwnBarangay: (barangay: string): string => `Barangay ${barangay}`,

  // Route progress
  routeLoading: 'Loading page',
} as const;
