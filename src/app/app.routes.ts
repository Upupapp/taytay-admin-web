import type { Routes } from '@angular/router';

import {
  anonymousOnlyGuard,
  authenticatedGuard,
  permissionGuard,
} from '@core/access/access.guards';
/**
 * Routing skeleton.
 *
 * Rules that later TABs inherit:
 *  - every feature route is lazy (`loadComponent` / `loadChildren`);
 *  - every route carries the same permission its nav entry declares;
 *  - authenticated routes live under the `Shell`, unauthenticated ones do not;
 *  - a screen that a later TAB will build gets a placeholder, never a dead link.
 *
 * As of TAB 21 **there are no placeholder routes left**. Every entry below
 * loads a real screen. `FeaturePlaceholderPage` stays in the tree because the
 * rule it exists to serve still holds: a module planned for a later TAB gets a
 * placeholder rather than a dead link.
 */

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
        path: 'work',
        // `team` must precede nothing here, but the order is kept explicit so a
        // later `:id` route cannot swallow it.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'My work — Taytay Social Welfare',
            canActivate: [permissionGuard('dashboard.view')],
            loadComponent: () =>
              import('@features/work/work-queue-page').then((m) => m.WorkQueuePage),
          },
          {
            path: 'team',
            title: 'The team’s work — Taytay Social Welfare',
            // Seeing a colleague's caseload is supervision, not a default. The
            // adapter re-checks this; hiding the link is not protection.
            canActivate: [permissionGuard('staff.view')],
            loadComponent: () =>
              import('@features/work/team-queue-page').then((m) => m.TeamQueuePage),
          },
        ],
      },
      {
        path: 'search',
        title: 'Search — Taytay Social Welfare',
        // Nothing beyond being signed in: every group inside is gated by its
        // own record type, so a narrower guard here would only hide the screen
        // that explains which types an account cannot search (`DL-112`).
        loadComponent: () => import('@features/search/search-page').then((m) => m.SearchPage),
      },
      {
        path: 'notifications',
        title: 'Notifications — Taytay Social Welfare',
        canActivate: [permissionGuard('dashboard.view')],
        loadComponent: () =>
          import('@features/work/notification-centre-page').then(
            (m) => m.NotificationCentrePage,
          ),
      },
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
        path: 'beneficiaries',
        // `duplicates` must precede `:id`, or it is read as a resident id and
        // the review queue becomes unreachable.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Beneficiaries — Taytay Social Welfare',
            canActivate: [permissionGuard('beneficiary.view')],
            loadComponent: () =>
              import('@features/beneficiaries/beneficiary-list-page').then(
                (m) => m.BeneficiaryListPage,
              ),
          },
          {
            path: 'duplicates',
            title: 'Possible duplicates — Taytay Social Welfare',
            canActivate: [permissionGuard('beneficiary.review-duplicates')],
            loadComponent: () =>
              import('@features/beneficiaries/duplicate-review-page').then(
                (m) => m.DuplicateReviewPage,
              ),
          },
          {
            path: ':id',
            title: 'Beneficiary — Taytay Social Welfare',
            canActivate: [permissionGuard('beneficiary.view')],
            loadComponent: () =>
              import('@features/beneficiaries/beneficiary-detail-page').then(
                (m) => m.BeneficiaryDetailPage,
              ),
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
        path: 'families',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Families — Taytay Social Welfare',
            canActivate: [permissionGuard('family.view')],
            loadComponent: () =>
              import('@features/families/family-list-page').then((m) => m.FamilyListPage),
          },
          {
            path: ':id',
            title: 'Family — Taytay Social Welfare',
            canActivate: [permissionGuard('family.view')],
            loadComponent: () =>
              import('@features/families/family-detail-page').then((m) => m.FamilyDetailPage),
          },
        ],
      },
      {
        path: 'cases',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Cases — Taytay Social Welfare',
            canActivate: [permissionGuard('case.view')],
            loadComponent: () =>
              import('@features/cases/case-list-page').then((m) => m.CaseListPage),
          },
          {
            path: ':id',
            title: 'Case — Taytay Social Welfare',
            canActivate: [permissionGuard('case.view')],
            loadComponent: () =>
              import('@features/cases/case-workspace-page').then((m) => m.CaseWorkspacePage),
          },
        ],
      },
      {
        path: 'assistance-requests',
        // `new` must precede `:id`, or "new" is read as a request id.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Assistance requests — Taytay Social Welfare',
            canActivate: [permissionGuard('request.view')],
            loadComponent: () =>
              import('@features/requests/request-list-page').then((m) => m.RequestListPage),
          },
          {
            path: 'new',
            title: 'New assistance request — Taytay Social Welfare',
            canActivate: [permissionGuard('request.create')],
            loadComponent: () => import('@features/requests/intake-page').then((m) => m.IntakePage),
          },
          {
            path: ':id/edit',
            title: 'Unfinished intake — Taytay Social Welfare',
            canActivate: [permissionGuard('request.create')],
            loadComponent: () => import('@features/requests/intake-page').then((m) => m.IntakePage),
          },
          {
            path: ':id',
            title: 'Assistance request — Taytay Social Welfare',
            canActivate: [permissionGuard('request.view')],
            loadComponent: () =>
              import('@features/requests/assessment-page').then((m) => m.AssessmentPage),
          },
        ],
      },
      {
        path: 'programs',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Programmes — Taytay Social Welfare',
            canActivate: [permissionGuard('program.view')],
            loadComponent: () =>
              import('@features/programs/program-list-page').then((m) => m.ProgramListPage),
          },
          {
            path: ':id',
            title: 'Programme — Taytay Social Welfare',
            canActivate: [permissionGuard('program.view')],
            loadComponent: () =>
              import('@features/programs/program-detail-page').then((m) => m.ProgramDetailPage),
          },
        ],
      },
      {
        path: 'releases',
        // `sessions` must precede `:id`, or it is read as a release id.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Releases — Taytay Social Welfare',
            canActivate: [permissionGuard('disbursement.view')],
            loadComponent: () =>
              import('@features/releases/release-list-page').then((m) => m.ReleaseListPage),
          },
          {
            path: 'sessions',
            title: 'Payout sessions — Taytay Social Welfare',
            canActivate: [permissionGuard('disbursement.view')],
            loadComponent: () =>
              import('@features/releases/payout-session-page').then((m) => m.PayoutSessionPage),
          },
          {
            path: ':id',
            title: 'Release — Taytay Social Welfare',
            canActivate: [permissionGuard('disbursement.view')],
            loadComponent: () =>
              import('@features/releases/release-detail-page').then((m) => m.ReleaseDetailPage),
          },
        ],
      },
      {
        // The old path kept as a redirect: a bookmark or a note from before
        // TAB 17 should still land somewhere, not on the not-found page.
        path: 'disbursements',
        pathMatch: 'full',
        redirectTo: 'releases',
      },
      {
        path: 'referrals',
        // `providers` must precede `:id`, or the directory is read as a
        // referral id and becomes unreachable.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Referrals — Taytay Social Welfare',
            canActivate: [permissionGuard('referral.view')],
            loadComponent: () =>
              import('@features/referrals/referral-list-page').then((m) => m.ReferralListPage),
          },
          {
            path: 'providers',
            title: 'Service providers — Taytay Social Welfare',
            canActivate: [permissionGuard('referral.view')],
            loadComponent: () =>
              import('@features/referrals/provider-directory-page').then(
                (m) => m.ProviderDirectoryPage,
              ),
          },
          {
            path: ':id',
            title: 'Referral — Taytay Social Welfare',
            canActivate: [permissionGuard('referral.view')],
            loadComponent: () =>
              import('@features/referrals/referral-detail-page').then((m) => m.ReferralDetailPage),
          },
        ],
      },
      {
        path: 'visits',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Field visits — Taytay Social Welfare',
            canActivate: [permissionGuard('case.view')],
            loadComponent: () =>
              import('@features/visits/visit-list-page').then((m) => m.VisitListPage),
          },
          {
            path: ':id',
            title: 'Field visit — Taytay Social Welfare',
            canActivate: [permissionGuard('case.view')],
            loadComponent: () =>
              import('@features/visits/visit-detail-page').then((m) => m.VisitDetailPage),
          },
        ],
      },
      {
        path: 'reports',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Reports — Taytay Social Welfare',
            canActivate: [permissionGuard('report.view')],
            loadComponent: () =>
              import('@features/reports/report-hub-page').then((m) => m.ReportHubPage),
          },
          {
            path: ':id',
            title: 'Report — Taytay Social Welfare',
            canActivate: [permissionGuard('report.view')],
            loadComponent: () =>
              import('@features/reports/report-view-page').then((m) => m.ReportViewPage),
          },
        ],
      },
      {
        path: 'administration',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'staff' },
          {
            path: 'staff',
            title: 'Staff and roles — Taytay Social Welfare',
            canActivate: [permissionGuard('staff.view')],
            loadComponent: () =>
              import('@features/administration/staff-page').then((m) => m.StaffPage),
          },
          {
            path: 'roles',
            title: 'Permission matrix — Taytay Social Welfare',
            // Reading the matrix is reading the office's own rules; it names no
            // person and needs no more than seeing staff exist.
            canActivate: [permissionGuard('staff.view')],
            loadComponent: () =>
              import('@features/administration/roles-page').then((m) => m.RolesPage),
          },
          {
            path: 'audit',
            title: 'Audit trail — Taytay Social Welfare',
            canActivate: [permissionGuard('audit.view')],
            loadComponent: () =>
              import('@features/administration/audit-page').then((m) => m.AuditPage),
          },
          {
            path: 'settings',
            title: 'Data governance — Taytay Social Welfare',
            canActivate: [permissionGuard('settings.manage')],
            loadComponent: () =>
              import('@features/administration/governance-page').then((m) => m.GovernancePage),
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
