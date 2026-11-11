import type { Routes } from '@angular/router';

import {
  anonymousOnlyGuard,
  authenticatedGuard,
  permissionGuard,
  scopeGuard,
} from '@core/access/access.guards';
import { servedGuard } from '@core/access/served-ports';
/**
 * Routing skeleton.
 *
 * Rules that later TABs inherit:
 *  - every feature route is lazy (`loadComponent` / `loadChildren`);
 *  - every route carries the same permission its nav entry declares;
 *  - every route lists, in `servedGuard`, every port its screen reads, as its nav entry
 *    does, so a module the API cannot serve is withheld from both (`DL-167`);
 *  - authenticated routes live under the `Shell`, unauthenticated ones do not;
 *  - a screen a later TAB will build gets a placeholder, never a dead link.
 *
 * As of TAB 26 there are **no placeholders left** — Events was the last one,
 * and the helper went with it. `FeaturePlaceholderPage` stays in the tree for
 * the next module that needs a routed screen before it has one; reintroduce
 * the helper beside it rather than pointing a nav entry at nothing.
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
            canActivate: [servedGuard('case', 'work'), permissionGuard('dashboard.view')],
            loadComponent: () =>
              import('@features/work/work-queue-page').then((m) => m.WorkQueuePage),
          },
          {
            path: 'team',
            title: 'The team’s work — Taytay Social Welfare',
            // Seeing a colleague's caseload is supervision, not a default. The
            // adapter re-checks this; hiding the link is not protection.
            canActivate: [servedGuard('work'), permissionGuard('staff.view')],
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
        // that explains which types an account cannot search (`DL-112`). Withheld whole when the
        // API serves no search at all (`DL-167`).
        canActivate: [servedGuard('search')],
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
        canActivate: [servedGuard('dashboard'), permissionGuard('dashboard.view')],
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
            title: 'Citizen registry — Taytay Social Welfare',
            // Saved views degrade in place on this screen; only the registry gates it (DL-175).
            canActivate: [
              servedGuard('resident'),
              permissionGuard('resident.view'),
              // A caseload reads its clients, never the registry's list (`DL-183`, `DL-185`).
              scopeGuard('assigned-cases'),
            ],
            loadComponent: () =>
              import('@features/residents/resident-list-page').then((m) => m.ResidentListPage),
          },
          {
            path: 'new',
            title: 'Register a resident — Taytay Social Welfare',
            canActivate: [servedGuard('resident'), permissionGuard('resident.create')],
            loadComponent: () =>
              import('@features/residents/resident-form-page').then((m) => m.ResidentFormPage),
          },
          {
            path: ':id/edit',
            title: 'Edit resident — Taytay Social Welfare',
            canActivate: [servedGuard('resident'), permissionGuard('resident.update')],
            loadComponent: () =>
              import('@features/residents/resident-form-page').then((m) => m.ResidentFormPage),
          },
          {
            path: ':id',
            title: 'Resident — Taytay Social Welfare',
            // Families and home visits degrade in place on the record (DL-175).
            canActivate: [servedGuard('resident'), permissionGuard('resident.view')],
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
            canActivate: [
              servedGuard('beneficiary', 'program', 'saved-view'),
              permissionGuard('beneficiary.view'),
            ],
            loadComponent: () =>
              import('@features/beneficiaries/beneficiary-list-page').then(
                (m) => m.BeneficiaryListPage,
              ),
          },
          {
            path: 'duplicates',
            title: 'Possible duplicates — Taytay Social Welfare',
            canActivate: [
              servedGuard('beneficiary'),
              permissionGuard('beneficiary.review-duplicates'),
            ],
            loadComponent: () =>
              import('@features/beneficiaries/duplicate-review-page').then(
                (m) => m.DuplicateReviewPage,
              ),
          },
          {
            path: ':id',
            title: 'Beneficiary — Taytay Social Welfare',
            canActivate: [servedGuard('beneficiary'), permissionGuard('beneficiary.view')],
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
            canActivate: [
              servedGuard('household'),
              permissionGuard('household.view'),
              scopeGuard('assigned-cases'),
            ],
            loadComponent: () =>
              import('@features/households/household-list-page').then((m) => m.HouseholdListPage),
          },
          {
            path: 'new',
            title: 'Register a household — Taytay Social Welfare',
            // The head is picked from the registry, so the form reads both.
            canActivate: [servedGuard('household', 'resident'), permissionGuard('household.manage')],
            loadComponent: () =>
              import('@features/households/household-form-page').then((m) => m.HouseholdFormPage),
          },
          {
            path: ':id',
            title: 'Household — Taytay Social Welfare',
            canActivate: [servedGuard('household', 'resident'), permissionGuard('household.view')],
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
            canActivate: [
              servedGuard('family'),
              permissionGuard('family.view'),
              scopeGuard('assigned-cases'),
            ],
            loadComponent: () =>
              import('@features/families/family-list-page').then((m) => m.FamilyListPage),
          },
          {
            path: 'new',
            title: 'Record a family — Taytay Social Welfare',
            // Members are picked from the registry and the household from the register, so the
            // form reads all three.
            canActivate: [
              servedGuard('family', 'household', 'resident'),
              permissionGuard('family.manage'),
            ],
            loadComponent: () =>
              import('@features/families/family-form-page').then((m) => m.FamilyFormPage),
          },
          {
            path: ':id',
            title: 'Family — Taytay Social Welfare',
            canActivate: [servedGuard('family', 'resident'), permissionGuard('family.view')],
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
            canActivate: [servedGuard('case'), permissionGuard('case.view')],
            loadComponent: () =>
              import('@features/cases/case-list-page').then((m) => m.CaseListPage),
          },
          {
            // `new` must precede `:id`, or "new" is read as a case id. The subject is found with
            // the person picker and the requests offered from the request list, so the form reads
            // all three (`DL-179`).
            path: 'new',
            title: 'Open a case — Taytay Social Welfare',
            canActivate: [
              servedGuard('case', 'resident', 'assistance-request'),
              permissionGuard('case.manage'),
            ],
            loadComponent: () =>
              import('@features/cases/case-open-page').then((m) => m.CaseOpenPage),
          },
          {
            path: ':id',
            title: 'Case — Taytay Social Welfare',
            canActivate: [servedGuard('case'), permissionGuard('case.view')],
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
            canActivate: [servedGuard('assistance-request'), permissionGuard('request.view')],
            loadComponent: () =>
              import('@features/requests/request-list-page').then((m) => m.RequestListPage),
          },
          {
            path: 'new',
            title: 'New assistance request — Taytay Social Welfare',
            canActivate: [
              servedGuard('assistance-request', 'program', 'resident'),
              permissionGuard('request.create'),
            ],
            loadComponent: () => import('@features/requests/intake-page').then((m) => m.IntakePage),
          },
          {
            path: ':id/edit',
            title: 'Unfinished intake — Taytay Social Welfare',
            canActivate: [
              servedGuard('assistance-request', 'program', 'resident'),
              permissionGuard('request.create'),
            ],
            loadComponent: () => import('@features/requests/intake-page').then((m) => m.IntakePage),
          },
          {
            path: ':id',
            title: 'Assistance request — Taytay Social Welfare',
            canActivate: [
              servedGuard('assistance-request', 'program', 'resident'),
              permissionGuard('request.view'),
            ],
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
            canActivate: [servedGuard('program'), permissionGuard('program.view')],
            loadComponent: () =>
              import('@features/programs/program-list-page').then((m) => m.ProgramListPage),
          },
          // `new` and `templates` must precede `:id`, or each is read as a programme id.
          {
            path: 'new',
            title: 'New programme — Taytay Social Welfare',
            canActivate: [servedGuard('program'), permissionGuard('program.manage')],
            loadComponent: () =>
              import('@features/programs/program-form-page').then((m) => m.ProgramFormPage),
          },
          {
            path: 'templates',
            title: 'Requirement templates — Taytay Social Welfare',
            canActivate: [servedGuard('program'), permissionGuard('program.manage')],
            loadComponent: () =>
              import('@features/programs/requirement-templates-page').then(
                (m) => m.RequirementTemplatesPage,
              ),
          },
          // The whole record, edited with a reason (`DL-178`), guarded as creating one is.
          {
            path: ':id/edit',
            title: 'Edit programme — Taytay Social Welfare',
            canActivate: [servedGuard('program'), permissionGuard('program.manage')],
            loadComponent: () =>
              import('@features/programs/program-form-page').then((m) => m.ProgramFormPage),
          },
          {
            path: ':id',
            title: 'Programme — Taytay Social Welfare',
            canActivate: [servedGuard('program'), permissionGuard('program.view')],
            loadComponent: () =>
              import('@features/programs/program-detail-page').then((m) => m.ProgramDetailPage),
          },
        ],
      },
      {
        path: 'releases',
        // `sessions` and `prepare` must precede `:id`, or each is read as a release id.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Releases — Taytay Social Welfare',
            canActivate: [servedGuard('release'), permissionGuard('release.view')],
            loadComponent: () =>
              import('@features/releases/release-list-page').then((m) => m.ReleaseListPage),
          },
          {
            path: 'sessions',
            title: 'Payout sessions — Taytay Social Welfare',
            canActivate: [servedGuard('release'), permissionGuard('release.view')],
            loadComponent: () =>
              import('@features/releases/payout-session-page').then((m) => m.PayoutSessionPage),
          },
          {
            // Reached from an approved request's record, with `?request=`.
            path: 'prepare',
            title: 'Prepare a release — Taytay Social Welfare',
            canActivate: [
              servedGuard('release', 'assistance-request'),
              permissionGuard('release.schedule'),
            ],
            loadComponent: () =>
              import('@features/releases/release-prepare-page').then((m) => m.ReleasePreparePage),
          },
          {
            path: ':id',
            title: 'Release — Taytay Social Welfare',
            canActivate: [servedGuard('release'), permissionGuard('release.view')],
            loadComponent: () =>
              import('@features/releases/release-detail-page').then((m) => m.ReleaseDetailPage),
          },
        ],
      },
      {
        // The old path kept as a redirect: a bookmark or a note from before
        // TAB 17 should still land somewhere, not on the not-found page.
        path: 'releases',
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
            canActivate: [
              servedGuard('referral', 'resident', 'case', 'assistance-request'),
              permissionGuard('referral.view'),
            ],
            loadComponent: () =>
              import('@features/referrals/referral-list-page').then((m) => m.ReferralListPage),
          },
          {
            path: 'providers',
            title: 'Service providers — Taytay Social Welfare',
            canActivate: [servedGuard('referral'), permissionGuard('referral.view')],
            loadComponent: () =>
              import('@features/referrals/provider-directory-page').then(
                (m) => m.ProviderDirectoryPage,
              ),
          },
          {
            path: ':id',
            title: 'Referral — Taytay Social Welfare',
            canActivate: [servedGuard('referral'), permissionGuard('referral.view')],
            loadComponent: () =>
              import('@features/referrals/referral-detail-page').then((m) => m.ReferralDetailPage),
          },
        ],
      },
      {
        path: 'visits',
        // `schedule` must precede `:id`, or it is read as a visit id.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Field visits — Taytay Social Welfare',
            canActivate: [servedGuard('field-visit'), permissionGuard('visit.view')],
            loadComponent: () =>
              import('@features/visits/visit-list-page').then((m) => m.VisitListPage),
          },
          {
            // Reached from a case, with `?case=` (`DL-181`).
            path: 'schedule',
            title: 'Schedule a home visit — Taytay Social Welfare',
            canActivate: [servedGuard('field-visit', 'case'), permissionGuard('visit.manage')],
            loadComponent: () =>
              import('@features/visits/visit-schedule-page').then((m) => m.VisitSchedulePage),
          },
          {
            path: ':id',
            title: 'Field visit — Taytay Social Welfare',
            canActivate: [servedGuard('field-visit'), permissionGuard('visit.view')],
            loadComponent: () =>
              import('@features/visits/visit-detail-page').then((m) => m.VisitDetailPage),
          },
        ],
      },
      {
        path: 'events',
        // `new` before `:id`, or the composer resolves as an event id.
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Events — Taytay Social Welfare',
            canActivate: [servedGuard('event'), permissionGuard('event.view')],
            loadComponent: () =>
              import('@features/events/event-list-page').then((m) => m.EventListPage),
          },
          {
            path: 'new',
            title: 'Create an event — Taytay Social Welfare',
            // Writing costs `create`; putting it in the resident app costs
            // `publish`, on the detail screen.
            canActivate: [servedGuard('event'), permissionGuard('event.create')],
            loadComponent: () =>
              import('@features/events/event-composer-page').then((m) => m.EventComposerPage),
          },
          {
            path: ':id',
            title: 'Event — Taytay Social Welfare',
            canActivate: [servedGuard('event'), permissionGuard('event.view')],
            loadComponent: () =>
              import('@features/events/event-detail-page').then((m) => m.EventDetailPage),
          },
          {
            // Correcting a published event goes out in the office's name, as publishing did, so it
            // costs `publish` (`DL-195`). The detail screen offers the link under the same grant.
            path: ':id/correct',
            title: 'Correct an event — Taytay Social Welfare',
            canActivate: [servedGuard('event'), permissionGuard('event.publish')],
            loadComponent: () =>
              import('@features/events/event-composer-page').then((m) => m.EventComposerPage),
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
            canActivate: [servedGuard('report'), permissionGuard('report.view')],
            loadComponent: () =>
              import('@features/reports/report-hub-page').then((m) => m.ReportHubPage),
          },
          {
            path: ':id',
            title: 'Report — Taytay Social Welfare',
            canActivate: [servedGuard('report'), permissionGuard('report.view')],
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
            canActivate: [servedGuard('governance'), permissionGuard('staff.view')],
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
            canActivate: [servedGuard('governance'), permissionGuard('audit.view')],
            loadComponent: () =>
              import('@features/administration/audit-page').then((m) => m.AuditPage),
          },
          {
            path: 'settings',
            title: 'Data governance — Taytay Social Welfare',
            canActivate: [servedGuard('governance'), permissionGuard('settings.manage')],
            loadComponent: () =>
              import('@features/administration/governance-page').then((m) => m.GovernancePage),
          },
        ],
      },
      {
        path: 'verification',
        title: 'ID verification — Taytay Social Welfare',
        // The API grants `verification.review` to administrators alone, and this guard mirrors it.
        // It is not the protection: the API refuses anybody else whatever this console shows (rule 4).
        canActivate: [servedGuard('verification'), permissionGuard('verification.review')],
        loadComponent: () =>
          import('@features/verification/verification-queue-page').then(
            (m) => m.VerificationQueuePage,
          ),
      },
      {
        // `DL-168`. The API grants `office-inbox.manage` to administrators, and to staff only while
        // they are assigned to an office; these guards mirror it and are not the protection (rule 4).
        // Both screens read the office directory too, to name the office a conversation went to.
        path: 'inbox',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Office inbox — Taytay Social Welfare',
            canActivate: [servedGuard('office-inbox', 'office'), permissionGuard('office-inbox.manage')],
            loadComponent: () => import('@features/inbox/inbox-page').then((m) => m.InboxPage),
          },
          {
            path: ':threadId',
            title: 'Conversation — Taytay Social Welfare',
            canActivate: [servedGuard('office-inbox', 'office'), permissionGuard('office-inbox.manage')],
            loadComponent: () => import('@features/inbox/thread-page').then((m) => m.ThreadPage),
          },
        ],
      },
      {
        // `DL-184`. Residents' document requests ("issuance" on the wire). The API grants both keys
        // to administrators and to staff assigned to an office; these guards mirror the role table
        // and are not the protection (rule 4). The catalogue reads the office directory too, for an
        // administrator's choice of office.
        path: 'resident-documents',
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Resident document requests — Taytay Social Welfare',
            canActivate: [servedGuard('issuance'), permissionGuard('issuance-request.manage')],
            loadComponent: () =>
              import('@features/issuance/issuance-queue-page').then((m) => m.IssuanceQueuePage),
          },
          {
            path: 'catalogue',
            title: 'Document catalogue — Taytay Social Welfare',
            canActivate: [
              servedGuard('issuance', 'office'),
              permissionGuard('issuance-type.manage'),
            ],
            loadComponent: () =>
              import('@features/issuance/issuance-catalogue-page').then(
                (m) => m.IssuanceCataloguePage,
              ),
          },
          {
            path: ':requestId',
            title: 'Resident document request — Taytay Social Welfare',
            canActivate: [servedGuard('issuance'), permissionGuard('issuance-request.manage')],
            loadComponent: () =>
              import('@features/issuance/issuance-request-page').then((m) => m.IssuanceRequestPage),
          },
        ],
      },
      {
        // `DL-168`. The API grants `user.view` — and the two keys that change an account — to
        // administrators alone; this guard mirrors it and is not the protection (rule 4). The screen
        // reads the office directory too, to name a staff account's office and to offer one.
        path: 'users',
        title: 'Users and roles — Taytay Social Welfare',
        canActivate: [servedGuard('app-account', 'office'), permissionGuard('user.view')],
        loadComponent: () =>
          import('@features/accounts/accounts-page').then((m) => m.AccountsPage),
      },
      {
        // `DL-170`. The API grants `office.manage`, `service.manage` and `hotline.manage` to
        // administrators alone; this guard opens for any of the three, as the menu entry does, and
        // each section asks for its own. Not the protection (rule 4). The Tulong section reads the
        // office directory as well, to name a page's office and offer one.
        path: 'directory',
        title: 'App directory — Taytay Social Welfare',
        canActivate: [
          servedGuard('directory-office', 'hotline', 'office', 'tulong-service'),
          permissionGuard('office.manage', 'service.manage', 'hotline.manage'),
        ],
        loadComponent: () =>
          import('@features/directory/directory-page').then((m) => m.DirectoryPage),
      },
      {
        // `DL-170`. The API grants `home.manage` to administrators alone; this guard mirrors it and is
        // not the protection (rule 4).
        path: 'home-screen',
        title: 'Home screen — Taytay Social Welfare',
        canActivate: [servedGuard('home-screen'), permissionGuard('home.manage')],
        loadComponent: () =>
          import('@features/home-screen/home-screen-page').then((m) => m.HomeScreenPage),
      },
      {
        // `DL-170`. The API grants `app-config.manage` to administrators alone; this guard mirrors it
        // and is not the protection (rule 4).
        path: 'app-settings',
        title: 'App settings — Taytay Social Welfare',
        canActivate: [servedGuard('app-config'), permissionGuard('app-config.manage')],
        loadComponent: () =>
          import('@features/app-settings/app-settings-page').then((m) => m.AppSettingsPage),
      },
      {
        // `DL-171`. The API grants `digital-id.verify` to every staff account and `digital-id.manage` to
        // administrators; this guard opens for either, as the menu entry does, and each section asks
        // for its own. Not the protection (rule 4). Keeping cards reads the app accounts as well.
        path: 'digital-ids',
        title: 'Digital IDs — Taytay Social Welfare',
        canActivate: [
          servedGuard('digital-id', 'app-account'),
          permissionGuard('digital-id.verify', 'digital-id.manage'),
        ],
        loadComponent: () =>
          import('@features/digital-ids/digital-ids-page').then((m) => m.DigitalIdsPage),
      },
      {
        // `DL-171`. The API grants `news.write` to administrators and to staff at an office; this guard
        // mirrors it and is not the protection (rule 4). The office picker reads the office directory.
        path: 'balita',
        title: 'Balita — Taytay Social Welfare',
        canActivate: [servedGuard('balita', 'office'), permissionGuard('news.write')],
        loadComponent: () => import('@features/balita/balita-page').then((m) => m.BalitaPage),
      },
      {
        // `DL-171`. The API grants `audit.view` to administrators alone; this guard mirrors it and is
        // not the protection (rule 4). Not the governance audit page, which has no server.
        path: 'app-audit',
        title: 'App audit trail — Taytay Social Welfare',
        canActivate: [servedGuard('platform-audit'), permissionGuard('audit.view')],
        loadComponent: () =>
          import('@features/platform-audit/platform-audit-page').then((m) => m.PlatformAuditPage),
      },
      {
        // Where every unserved module's address leads (`DL-167`). No permission: it names what the
        // server lacks, which is no secret about any record, and it is linked from the menu.
        path: 'unavailable',
        title: 'Not connected yet — Taytay Social Welfare',
        loadComponent: () => import('@features/errors/unserved-page').then((m) => m.UnservedPage),
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
