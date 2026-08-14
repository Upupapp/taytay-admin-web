import type { Routes } from '@angular/router';

import {
  anonymousOnlyGuard,
  authenticatedGuard,
  permissionGuard,
} from '@core/access/access.guards';
import type { PlaceholderRouteData } from '@features/placeholder/feature-placeholder-page';

/**
 * Routing skeleton.
 *
 * Rules that later TABs inherit:
 *  - every feature route is lazy (`loadComponent` / `loadChildren`);
 *  - every route carries the same permission its nav entry declares;
 *  - authenticated routes live under the `Shell`, unauthenticated ones do not;
 *  - a screen that a later TAB will build gets a placeholder, never a dead link.
 */
function placeholder(data: PlaceholderRouteData) {
  return {
    loadComponent: () =>
      import('@features/placeholder/feature-placeholder-page').then(
        (m) => m.FeaturePlaceholderPage,
      ),
    data,
  };
}

export const routes: Routes = [
  {
    path: 'sign-in',
    title: 'Sign in — Taytay Social Welfare',
    // Keeps an already-authenticated officer off a form asking them to prove
    // who they are. There is deliberately no 'register' route (DL-32).
    canActivate: [anonymousOnlyGuard],
    loadComponent: () => import('@features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authenticatedGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard — Taytay Social Welfare',
        canActivate: [permissionGuard('dashboard.view')],
        loadComponent: () =>
          import('@features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'residents',
        // `new` must precede `:id`, or "new" is read as a resident id and the
        // create screen becomes unreachable.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Residents — Taytay Social Welfare',
            canActivate: [permissionGuard('resident.view')],
            loadComponent: () =>
              import('@features/residents/resident-list-page').then((m) => m.ResidentListPage),
          },
          {
            path: 'new',
            title: 'Register a resident — Taytay Social Welfare',
            canActivate: [permissionGuard('resident.create')],
            loadComponent: () =>
              import('@features/residents/resident-form-page').then((m) => m.ResidentFormPage),
          },
          {
            path: ':id/edit',
            title: 'Edit resident — Taytay Social Welfare',
            canActivate: [permissionGuard('resident.update')],
            loadComponent: () =>
              import('@features/residents/resident-form-page').then((m) => m.ResidentFormPage),
          },
          {
            path: ':id',
            title: 'Resident — Taytay Social Welfare',
            canActivate: [permissionGuard('resident.view')],
            loadComponent: () =>
              import('@features/residents/resident-detail-page').then((m) => m.ResidentDetailPage),
          },
        ],
      },
      {
        path: 'households',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Households — Taytay Social Welfare',
            canActivate: [permissionGuard('household.view')],
            loadComponent: () =>
              import('@features/households/household-list-page').then((m) => m.HouseholdListPage),
          },
          {
            path: ':id',
            title: 'Household — Taytay Social Welfare',
            canActivate: [permissionGuard('household.view')],
            loadComponent: () =>
              import('@features/households/household-detail-page').then(
                (m) => m.HouseholdDetailPage,
              ),
          },
        ],
      },
      {
        path: 'assistance-requests',
        title: 'Assistance requests — Taytay Social Welfare',
        canActivate: [permissionGuard('request.view')],
        ...placeholder({
          title: 'Assistance requests',
          subtitle: 'Intake, assessment, endorsement, approval and closure of requests.',
          plannedIn: 'the assistance-request TAB',
        }),
      },
      {
        path: 'programs',
        title: 'Programs — Taytay Social Welfare',
        canActivate: [permissionGuard('program.view')],
        ...placeholder({
          title: 'Programs',
          subtitle: 'Assistance programmes, eligibility rules and required documents.',
          plannedIn: 'the programme-management TAB',
        }),
      },
      {
        path: 'disbursements',
        title: 'Disbursements — Taytay Social Welfare',
        canActivate: [permissionGuard('disbursement.view')],
        ...placeholder({
          title: 'Disbursements',
          subtitle: 'Payout scheduling, release and acknowledgement of assistance.',
          plannedIn: 'the disbursement TAB',
        }),
      },
      {
        path: 'referrals',
        title: 'Referrals — Taytay Social Welfare',
        canActivate: [permissionGuard('referral.view')],
        ...placeholder({
          title: 'Referrals',
          subtitle: 'Cases routed to partner offices, hospitals and national agencies.',
          plannedIn: 'the referral TAB',
        }),
      },
      {
        path: 'reports',
        title: 'Reports — Taytay Social Welfare',
        canActivate: [permissionGuard('report.view')],
        ...placeholder({
          title: 'Reports',
          subtitle: 'Statutory and management reporting for the office.',
          plannedIn: 'the reporting TAB',
        }),
      },
      {
        path: 'administration',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'staff' },
          {
            path: 'staff',
            title: 'Staff and roles — Taytay Social Welfare',
            canActivate: [permissionGuard('staff.view')],
            ...placeholder({
              title: 'Staff and roles',
              subtitle: 'Accounts, role assignment and data scope.',
              plannedIn: 'the administration TAB',
            }),
          },
          {
            path: 'audit',
            title: 'Audit trail — Taytay Social Welfare',
            canActivate: [permissionGuard('audit.view')],
            ...placeholder({
              title: 'Audit trail',
              subtitle: 'Who accessed or changed a record, and when.',
              plannedIn: 'the administration TAB',
            }),
          },
          {
            path: 'settings',
            title: 'Settings — Taytay Social Welfare',
            canActivate: [permissionGuard('settings.manage')],
            ...placeholder({
              title: 'Settings',
              subtitle: 'Reference data and office configuration.',
              plannedIn: 'the administration TAB',
            }),
          },
        ],
      },
      {
        path: 'forbidden',
        title: 'No access — Taytay Social Welfare',
        loadComponent: () => import('@features/errors/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'Page not found — Taytay Social Welfare',
        loadComponent: () => import('@features/errors/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
