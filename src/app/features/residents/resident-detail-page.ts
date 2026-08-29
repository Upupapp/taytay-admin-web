import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ageInYears,
  asId,
  ASSISTANCE_STATUS_CATALOG,
  barangayName,
  CIVIL_STATUS_LABELS,
  RELEASE_STATUS_CATALOG,
  HOUSEHOLD_ROLE_LABELS,
  PAYOUT_METHOD_LABELS,
  REFERRAL_STATUS_CATALOG,
  RESIDENT_REPOSITORY,
  SEX_LABELS,
  VULNERABILITY_SECTOR_LABELS,
  type HouseholdMemberView,
  type ResidentField,
  type ResidentId,
  type ResidentProfile,
  type VulnerabilitySector,
  FAMILY_REPOSITORY,
  type FamilySummary,
  type RelationshipEvent,
  FIELD_VISIT_REPOSITORY,
  type FieldVisit,
} from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELATIONSHIP_COPY } from '@shared/families/relationship.copy';
import { RESIDENTS_COPY } from './residents.copy';

/**
 * One resident, and everything attached to them.
 *
 * This screen is the registry's whole justification. A caseworker asked "has
 * this family had help before?" should not have to search three more lists and
 * hope they matched the same person each time — so the page loads a single
 * `ResidentProfile` that already carries household, family, requests, payouts
 * and referrals, and every one of those is a link back to the record it came
 * from.
 *
 * What it can show is decided upstream: a `ResidentView` arrives already
 * redacted, and the page reports what was withheld rather than rendering a gap
 * that reads like "nothing recorded" (`DL-38`).
 */
@Component({
  selector: 'app-resident-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DatePipe,
    HasPermissionDirective,
    Modal,
    PageHeader,
    PesoPipe,
    ResidentSummaryCard,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './resident-detail-page.html',
  styleUrl: './resident-detail-page.scss',
})
export class ResidentDetailPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly families = inject(FAMILY_REPOSITORY);
  private readonly visits = inject(FIELD_VISIT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly copy = RESIDENTS_COPY.detail;
  protected readonly requestStatuses = ASSISTANCE_STATUS_CATALOG;
  protected readonly payoutStatuses = RELEASE_STATUS_CATALOG;
  protected readonly referralStatuses = REFERRAL_STATUS_CATALOG;

  /* ── family, and how it changed ─────────────────────────────────────────── */

  protected readonly relationshipCopy = RELATIONSHIP_COPY;

  /**
   * Which families this person belongs to — plural, and that is the point.
   *
   * A household is an address and a family is a claim about who belongs to whom (`DL-47`). One
   * person may belong to more than one family, and the profile's `householdMembers` answers a
   * different question: who shares this address. Showing them together, labelled apart, is what
   * stops a reader treating the second as the first.
   */
  protected readonly familiesOf = toSignal(
    toObservable(computed(() => this.id())).pipe(
      switchMap((id) => this.families.familiesOf(asId<ResidentId>(id))),
      /*
       * A panel this role may not read is ABSENT, never fatal.
       *
       * These are side panels on somebody's record. Letting a refusal propagate takes the whole
       * page down — so an intake officer looking up an address would see nothing at all because
       * they cannot read home visits. The empty state and the refused state look alike here,
       * which is the one thing `DL-112` argues against; it is the lesser harm, and the panel
       * headings stay visible so nobody reads a missing panel as a missing record.
       */
      catchError(() => of([])),
    ),
    { initialValue: [] as readonly FamilySummary[] },
  );

  /**
   * Every recorded change to this person's family standing, newest first.
   *
   * Append-only (`DL-48`): ending a relationship or moving somebody records an event with actor,
   * time and reason, and never deletes what was true before. This is where that record becomes
   * readable — until now it was written and shown nowhere.
   */
  protected readonly kinshipHistory = toSignal(
    toObservable(computed(() => this.id())).pipe(
      switchMap((id) => this.families.historyForResident(asId<ResidentId>(id))),
      /*
       * A panel this role may not read is ABSENT, never fatal.
       *
       * These are side panels on somebody's record. Letting a refusal propagate takes the whole
       * page down — so an intake officer looking up an address would see nothing at all because
       * they cannot read home visits. The empty state and the refused state look alike here,
       * which is the one thing `DL-112` argues against; it is the lesser harm, and the panel
       * headings stay visible so nobody reads a missing panel as a missing record.
       */
      catchError(() => of([])),
    ),
    { initialValue: [] as readonly RelationshipEvent[] },
  );

  /**
   * Home visits to this person, which no composite carries.
   *
   * The profile assembles requests, payouts and referrals; visits are not on it. Unlike those, this
   * is a genuinely missing read rather than a second way to ask an answered question — and a visit
   * is often the only record of what the office actually saw.
   */
  protected readonly visitsFor = toSignal(
    toObservable(computed(() => this.id())).pipe(
      switchMap((id) => this.visits.forResident(asId<ResidentId>(id))),
      /*
       * A panel this role may not read is ABSENT, never fatal.
       *
       * These are side panels on somebody's record. Letting a refusal propagate takes the whole
       * page down — so an intake officer looking up an address would see nothing at all because
       * they cannot read home visits. The empty state and the refused state look alike here,
       * which is the one thing `DL-112` argues against; it is the lesser harm, and the panel
       * headings stay visible so nobody reads a missing panel as a missing record.
       */
      catchError(() => of([])),
    ),
    { initialValue: [] as readonly FieldVisit[] },
  );

  protected eventLabel(event: RelationshipEvent): string {
    return RELATIONSHIP_COPY.eventLabel[event.kind];
  }

  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getProfile(asId<ResidentId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<ResidentProfile | null> },
  );

  protected readonly profile = computed(() => valueOf(this.state()) ?? null);
  protected readonly editLink = computed(() => `/residents/${this.id()}/edit`);

  protected readonly retiring = signal(false);
  protected readonly restoring = signal(false);

  /* ── formatting ─────────────────────────────────────────────────────────── */

  protected age(profile: ResidentProfile): number {
    return ageInYears(profile.view.resident.birthDate);
  }

  protected barangay(profile: ResidentProfile): string {
    return barangayName(profile.view.resident.address.barangayId);
  }

  protected sexLabel(profile: ResidentProfile): string {
    return SEX_LABELS[profile.view.resident.sex];
  }

  protected civilStatusLabel(profile: ResidentProfile): string {
    return CIVIL_STATUS_LABELS[profile.view.resident.civilStatus];
  }

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  protected withheldLabel(field: ResidentField): string {
    return RESIDENTS_COPY.withheldField[field];
  }

  protected methodLabel(method: keyof typeof PAYOUT_METHOD_LABELS): string {
    return PAYOUT_METHOD_LABELS[method];
  }

  protected memberLink(residentId: string): string {
    return `/residents/${residentId}`;
  }

  protected relationshipLabel(member: HouseholdMemberView): string {
    return HOUSEHOLD_ROLE_LABELS[member.role];
  }

  /* ── retiring and restoring ─────────────────────────────────────────────── */

  protected askRetire(): void {
    this.retiring.set(true);
  }

  protected askRestore(): void {
    this.restoring.set(true);
  }

  protected confirmRetire(): void {
    this.setActive(false);
    this.retiring.set(false);
  }

  protected confirmRestore(): void {
    this.setActive(true);
    this.restoring.set(false);
  }

  private setActive(isActive: boolean): void {
    this.repository.setActive(asId<ResidentId>(this.id()), isActive).subscribe({
      next: () => {
        this.notifications.success(
          isActive ? 'Record restored to the active registry.' : 'Record retired.',
        );
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) =>
        this.notifications.error(
          failure instanceof Error ? failure.message : 'That change could not be saved.',
        ),
    });
  }
}
