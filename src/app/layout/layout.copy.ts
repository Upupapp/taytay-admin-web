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
  // `DL-167`: a module the API cannot serve is withheld, and this link says which and why.
  navUnserved: 'Not connected yet',
  navUnservedDescription: 'Parts of the console the API it is connected to does not serve.',
  navEmptyUnserved: 'Nothing this account may open is served by the API yet.',
  // `DL-168`: the same link, for an account no office is linked to, when nothing is withheld.
  navAwaitingOfficeDescription: 'Why this account cannot open the office inbox yet.',

  // Breadcrumb
  breadcrumbLandmark: 'Breadcrumb',
  breadcrumbHome: 'Dashboard',

  // Global search. The trigger navigates; the search screen owns the rest. The button's name
  // holds every word it shows, the shortcut included, so a speech user can say what they see
  // (WCAG 2.5.3).
  searchLabel: 'Search residents, requests, programmes, Ctrl K',
  // No closing ellipsis: the pill is wide enough for the whole prompt (DL-227), and a typed "…"
  // read as text cut off.
  searchPlaceholder: 'Search residents, requests, programmes',
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

  // Live updates (`DL-222`). The button's visible word never changes, so its name never does: the
  // state is `aria-pressed` and the description beside it, which is read on focus, never announced.
  liveLabel: 'Live',
  liveName: 'Live updates',
  liveState: {
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    polling: 'Every 15 s',
    paused: 'Paused',
    idle: 'Paused, no activity',
  },
  liveUpdatedAt: (time: string): string => `Updated ${time}`,
  liveRefreshFailed: 'Not updated',
  liveRefreshNow: 'Refresh now',
} as const;
