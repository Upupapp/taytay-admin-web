import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  buildTeamQueue,
  compareWork,
  isReferralOpen,
  isReferralOverdue,
  isReleaseOpen,
  isTaskOpen,
  isWithinBarangayScope,
  formatPersonName,
  todayAsIsoDate,
  userHasPermission,
  type AuthenticatedUser,
  asIsoDate,
  type IsoDate,
  type OfficeAlert,
  type Resident,
  type StaffUserId,
  type TeamQueue,
  type WorkItem,
  type WorkQueue,
  type WorkRepository,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockCaseStore } from './mock-case.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { candidatesFor } from './mock-duplicate-matcher';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/disbursements.seed';
import { MOCK_FIELD_VISITS } from './seed/field-visits.seed';
import { MOCK_REFERRALS } from './seed/referrals.seed';
import { MOCK_STAFF } from './seed/staff.seed';

/**
 * The work adapter.
 *
 * **It writes nothing, and there is no method here that could.** A work item is
 * a view of a record that lives somewhere else; acting on one goes to that
 * record's own repository, which already has the permission checks, the reason
 * requirement and the audit trail. A `complete()` on this class would be a
 * second task system with a second audit trail, which is the exact failure
 * `DL-55` exists to prevent (`DL-97`).
 *
 * Three rules it does enforce:
 *
 *  - **Permission.** Every item names the permission needed to act on it, and
 *    the queue drops the ones this user could not act on. An intake officer's
 *    queue never contains a payout: showing work somebody cannot do is how a
 *    queue becomes something people scroll past.
 *  - **Scope.** A barangay-link account sees its own barangay; a social worker
 *    on `assigned-cases` sees their own caseload and the unassigned pool.
 *  - **Nothing is stored.** Urgency, lateness and every count are computed from
 *    `asOf` on each read, so nothing here can be stale.
 */
@Injectable()
export class MockWorkRepository implements WorkRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly cases = inject(MockCaseStore);
  private readonly residents = inject(MockResidentStore);

  myQueue(asOf: IsoDate): Observable<WorkQueue> {
    const user = this.access.currentUser();
    const denied = denyUnless<WorkQueue>(user, 'dashboard.view');
    if (denied) {
      return denied;
    }

    const mine = this.visibleWork(user).filter(
      (item) => item.assignedTo === null || item.assignedTo === (user?.id ?? null),
    );

    return this.latency.respond({
      ownerId: user?.id ?? null,
      ownerName: user?.displayName ?? null,
      items: [...mine].sort((a, b) => compareWork(a, b, asOf)),
      asOf,
    });
  }

  teamQueue(asOf: IsoDate): Observable<TeamQueue> {
    const user = this.access.currentUser();
    // Seeing another officer's caseload is supervision, not a default.
    const denied = denyUnless<TeamQueue>(user, 'staff.view');
    if (denied) {
      return denied;
    }

    const names = new Map<string, string>(
      MOCK_STAFF.map((staff) => [staff.id, formatPersonName(staff.name)]),
    );
    return this.latency.respond(
      buildTeamQueue(this.visibleWork(user), names, asOf, 'Nobody yet'),
    );
  }

  alerts(): Observable<readonly OfficeAlert[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly OfficeAlert[]>(user, 'dashboard.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.deriveAlerts(user).filter((alert) => userHasPermission(user, alert.permission)),
    );
  }

  /* ── Assembling the work ────────────────────────────────────────────────── */

  /**
   * Everything this user may see and could act on.
   *
   * The permission filter is applied here rather than in a screen so both
   * queues and every future consumer inherit it. Filtering in a template would
   * mean the next screen to render a queue forgets.
   */
  private visibleWork(user: AuthenticatedUser | null): readonly WorkItem[] {
    const today = todayAsIsoDate();
    return [
      ...this.caseTaskWork(user),
      ...this.requestWork(user),
      ...this.visitWork(user),
      ...this.referralWork(user, today),
      ...this.releaseWork(user),
    ].filter((item) => userHasPermission(user, item.permission));
  }

  /** The only source with a task record behind it — so the only manageable one. */
  private caseTaskWork(user: AuthenticatedUser | null): readonly WorkItem[] {
    return this.cases
      .allTasks()
      .filter(isTaskOpen)
      .flatMap((task) => {
        const record = this.cases.findCase(task.caseId);
        if (record === undefined || !isWithinBarangayScope(user, record.barangayId)) {
          return [];
        }
        if (
          user?.scope === 'assigned-cases' &&
          record.assignedTo !== null &&
          record.assignedTo !== user.id
        ) {
          return [];
        }
        return [
          {
            id: `case-task:${task.id}`,
            source: 'case-task' as const,
            sourceId: task.id,
            kind: task.kind === 'home-visit' ? ('conduct-visit' as const) : ('close-case' as const),
            priority: 'important' as const,
            title: task.title,
            subject: this.residentLabel(record.subjectResidentId),
            preview: `Case ${record.referenceNumber}`,
            dueOn: task.dueOn,
            waitingSince: null,
            assignedTo: task.assignedTo,
            assignedToName: this.staffName(task.assignedTo),
            permission: 'case.manage' as const,
            link: { routerLink: ['/cases', record.id], label: 'Open the case' },
            isManageable: true,
          },
        ];
      });
  }

  private requestWork(user: AuthenticatedUser | null): readonly WorkItem[] {
    return MOCK_ASSISTANCE_REQUESTS.flatMap((request) => {
      const resident = this.residents.find(request.residentId);
      if (resident === undefined || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return [];
      }

      const owed = REQUEST_WORK[request.status];
      if (owed === undefined) {
        return [];
      }
      return [
        {
          id: `assistance-request:${request.id}`,
          source: 'assistance-request' as const,
          sourceId: request.id,
          kind: owed.kind,
          priority: owed.priority,
          title: owed.title,
          subject: this.residentLabel(request.residentId),
          preview: request.referenceNumber,
          // No service standard was supplied, so there is no deadline to claim
          // (`DL-101`). What the office does have is the day it was filed.
          dueOn: null,
          waitingSince: request.submittedAt === null ? null : asIsoDate(request.submittedAt.slice(0, 10)),
          assignedTo: request.assignedTo,
          assignedToName: this.staffName(request.assignedTo),
          permission: owed.permission,
          link: {
            routerLink: ['/assistance-requests', request.id],
            label: 'Open the request',
          },
          isManageable: false,
        },
      ];
    });
  }

  private visitWork(user: AuthenticatedUser | null): readonly WorkItem[] {
    return MOCK_FIELD_VISITS.flatMap((visit) => {
      if (visit.status !== 'scheduled') {
        return [];
      }
      const resident = this.residents.find(visit.residentId);
      if (resident === undefined || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return [];
      }
      return [
        {
          id: `field-visit:${visit.id}`,
          source: 'field-visit' as const,
          sourceId: visit.id,
          kind: 'conduct-visit' as const,
          priority: 'important' as const,
          title: 'Conduct the scheduled home visit',
          subject: this.residentLabel(visit.residentId),
          preview: visit.referenceNumber,
          dueOn: visit.scheduledFor,
          waitingSince: null,
          assignedTo: visit.assignedTo,
          assignedToName: this.staffName(visit.assignedTo),
          permission: 'case.view' as const,
          link: { routerLink: ['/visits', visit.id], label: 'Open the visit' },
          isManageable: false,
        },
      ];
    });
  }

  private referralWork(user: AuthenticatedUser | null, today: IsoDate): readonly WorkItem[] {
    return MOCK_REFERRALS.flatMap((referral) => {
      if (!isReferralOpen(referral.status) || referral.followUpOn === null) {
        return [];
      }
      const resident = this.residents.find(referral.residentId);
      if (resident === undefined || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return [];
      }
      return [
        {
          id: `referral:${referral.id}`,
          source: 'referral' as const,
          sourceId: referral.id,
          kind: 'follow-up-referral' as const,
          // Urgent only when the office said it would chase and has not — the
          // one case where a person is waiting on a promise nobody kept.
          priority: isReferralOverdue(referral, today)
            ? ('urgent' as const)
            : ('routine' as const),
          title: `Follow up with ${referral.destinationName}`,
          subject: this.residentLabel(referral.residentId),
          preview: referral.serviceRequested,
          dueOn: referral.followUpOn,
          waitingSince: asIsoDate(referral.referredAt.slice(0, 10)),
          assignedTo: referral.referredBy,
          assignedToName: this.staffName(referral.referredBy),
          permission: 'referral.view' as const,
          link: { routerLink: ['/referrals', referral.id], label: 'Open the referral' },
          isManageable: false,
        },
      ];
    });
  }

  private releaseWork(user: AuthenticatedUser | null): readonly WorkItem[] {
    return MOCK_DISBURSEMENTS.flatMap((release) => {
      if (!isReleaseOpen(release.status)) {
        return [];
      }
      const owed = RELEASE_WORK[release.status];
      if (owed === undefined) {
        return [];
      }
      const resident = this.residents.find(release.residentId);
      if (resident === undefined || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return [];
      }
      return [
        {
          id: `release:${release.id}`,
          source: 'release' as const,
          sourceId: release.id,
          kind: owed.kind,
          priority: owed.priority,
          title: owed.title,
          subject: this.residentLabel(release.residentId),
          preview: release.referenceNumber,
          dueOn: release.scheduledFor,
          waitingSince: null,
          assignedTo: null,
          assignedToName: null,
          permission: owed.permission,
          link: { routerLink: ['/releases', release.id], label: 'Open the release' },
          isManageable: false,
        },
      ];
    });
  }

  /* ── Alerts ─────────────────────────────────────────────────────────────── */

  /**
   * Conditions of the data, derived on every read.
   *
   * Never stored, so an alert cannot outlive the problem: fix the record and it
   * is gone on the next load, with no job to run and nothing to clear down.
   * Each one states the rule it applied, because an alert nobody can check is
   * one an office learns to dismiss (`DL-98`).
   */
  private deriveAlerts(user: AuthenticatedUser | null): readonly OfficeAlert[] {
    const alerts: OfficeAlert[] = [];
    const today = todayAsIsoDate();

    const duplicatePairs = this.countDuplicatePairs(user);
    if (duplicatePairs > 0) {
      alerts.push({
        id: 'alert-possible-duplicates',
        kind: 'possible-duplicate',
        severity: 'attention',
        summary: `${duplicatePairs} ${duplicatePairs === 1 ? 'pair of records may be' : 'pairs of records may each be'} the same person.`,
        basis:
          'Compared every active record against the registry on the duplicate rules, and counted ' +
          'only the strong resemblances. Nothing is decided here.',
        permission: 'beneficiary.review-duplicates',
        link: { routerLink: ['/beneficiaries', 'duplicates'], label: 'Open the review queue' },
        detectedFrom: duplicatePairs,
      });
    }

    const unscheduled = MOCK_DISBURSEMENTS.filter(
      (release) => release.status === 'for-release' && release.scheduledFor === null,
    );
    if (unscheduled.length > 0) {
      alerts.push({
        id: 'alert-unscheduled-approvals',
        kind: 'unscheduled-approval',
        severity: 'attention',
        summary: `${unscheduled.length} approved ${unscheduled.length === 1 ? 'release has' : 'releases have'} no payout date.`,
        basis:
          'Read every release still marked for release, and listed those with no scheduled date.',
        permission: 'disbursement.schedule',
        link: { routerLink: ['/releases'], label: 'Open the release queue' },
        detectedFrom: unscheduled.length,
      });
    }

    const mismatched = MOCK_DISBURSEMENTS.filter(
      (release) => release.status === 'needs-correction',
    );
    if (mismatched.length > 0) {
      alerts.push({
        id: 'alert-voucher-mismatch',
        kind: 'voucher-mismatch',
        severity: 'risk',
        summary: `${mismatched.length} ${mismatched.length === 1 ? 'voucher does' : 'vouchers do'} not match the registry and cannot be released.`,
        basis: 'Read every release held for correction. Somebody is waiting on the office.',
        permission: 'disbursement.view',
        link: { routerLink: ['/releases'], label: 'Open the release queue' },
        detectedFrom: mismatched.length,
      });
    }

    const unanswered = MOCK_REFERRALS.filter((referral) => isReferralOverdue(referral, today));
    if (unanswered.length > 0) {
      alerts.push({
        id: 'alert-unanswered-referrals',
        kind: 'unanswered-referral',
        severity: 'attention',
        summary: `${unanswered.length} ${unanswered.length === 1 ? 'referral is' : 'referrals are'} past the date this office said it would chase.`,
        basis: 'Compared each open referral’s follow-up date with today. Nothing stored.',
        permission: 'referral.view',
        link: { routerLink: ['/referrals'], label: 'Open referrals' },
        detectedFrom: unanswered.length,
      });
    }

    const stalled = MOCK_ASSISTANCE_REQUESTS.filter(
      (request) => request.status === 'returned',
    );
    if (stalled.length > 0) {
      alerts.push({
        id: 'alert-stalled-requests',
        kind: 'stalled-request',
        severity: 'notice',
        summary: `${stalled.length} ${stalled.length === 1 ? 'request is' : 'requests are'} waiting on the applicant.`,
        basis: 'Read every request returned for more information.',
        permission: 'request.view',
        link: { routerLink: ['/assistance-requests'], label: 'Open assistance requests' },
        detectedFrom: stalled.length,
      });
    }

    void user;
    return alerts;
  }

  /**
   * How many pairs resemble each other strongly enough to be worth a look.
   *
   * A **count**, not a list. The queue held one row per pair before `DL-103`,
   * and on this registry that was 182 rows in front of seven late items.
   */
  private countDuplicatePairs(user: AuthenticatedUser | null): number {
    const population = this.residents.all().filter((resident) => resident.isActive);
    const seen = new Set<string>();

    for (const resident of population) {
      if (!isWithinBarangayScope(user, resident.address.barangayId)) {
        continue;
      }
      for (const candidate of candidatesFor(resident, population)) {
        if (candidate.strength !== 'strong') {
          continue;
        }
        // A-B and B-A are one review.
        seen.add([candidate.residentId, candidate.otherResidentId].sort().join('|'));
      }
    }
    return seen.size;
  }

  /* ── Labels ─────────────────────────────────────────────────────────────── */

  private residentLabel(id: Resident['id']): string | null {
    const resident = this.residents.find(id);
    return resident === undefined ? null : formatPersonName(resident.name);
  }

  private staffName(id: StaffUserId | null): string | null {
    if (id === null) {
      return null;
    }
    const staff = MOCK_STAFF.find((member) => member.id === id);
    return staff === undefined ? null : formatPersonName(staff.name);
  }
}

/* ── What each state actually owes somebody ───────────────────────────────── */

interface OwedWork {
  readonly kind: WorkItem['kind'];
  readonly priority: WorkItem['priority'];
  readonly title: string;
  readonly permission: WorkItem['permission'];
}

/**
 * A request status is not itself work. This map says what somebody must *do*
 * about it, which is the whole difference between a status list and a queue.
 *
 * Statuses absent from this map owe nobody anything: a `draft` is the
 * applicant's, and `completed`, `rejected`, `cancelled` and `expired` are done.
 */
const REQUEST_WORK: Partial<Record<string, OwedWork>> = {
  submitted: {
    kind: 'review-intake',
    priority: 'important',
    title: 'Review a submitted intake',
    permission: 'request.intake',
  },
  'intake-review': {
    kind: 'verify-household',
    priority: 'important',
    title: 'Verify the resident and household',
    permission: 'request.intake',
  },
  assessment: {
    kind: 'complete-assessment',
    priority: 'important',
    title: 'Complete the assessment',
    permission: 'request.assess',
  },
  endorsed: {
    kind: 'review-recommendation',
    priority: 'urgent',
    title: 'Review an endorsed recommendation',
    permission: 'request.approve',
  },
  returned: {
    kind: 'request-requirements',
    priority: 'routine',
    title: 'Chase what was asked of the applicant',
    permission: 'request.intake',
  },
};

const RELEASE_WORK: Partial<Record<string, OwedWork>> = {
  'for-release': {
    kind: 'prepare-release',
    priority: 'important',
    title: 'Schedule an approved release',
    permission: 'disbursement.schedule',
  },
  scheduled: {
    kind: 'confirm-release',
    priority: 'important',
    title: 'Release and record the receipt',
    permission: 'disbursement.release',
  },
  released: {
    kind: 'confirm-release',
    priority: 'important',
    title: 'Record the beneficiary’s receipt',
    permission: 'disbursement.release',
  },
  deferred: {
    kind: 'prepare-release',
    priority: 'urgent',
    title: 'Fix what stopped this payout and reschedule',
    permission: 'disbursement.schedule',
  },
  'needs-correction': {
    kind: 'prepare-release',
    priority: 'urgent',
    title: 'Correct the voucher',
    permission: 'disbursement.schedule',
  },
  unclaimed: {
    kind: 'prepare-release',
    priority: 'routine',
    title: 'Follow up an uncollected payout',
    permission: 'disbursement.schedule',
  },
};
