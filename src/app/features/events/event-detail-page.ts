import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap, type Observable } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ATTENDANCE_CATALOG,
  AUDIT_ACTION_LABELS,
  EVENT_CATEGORY_LABELS,
  EVENT_REPOSITORY,
  EVENT_STATUS_CATALOG,
  EVENT_STATUS_TRANSITIONS,
  REGISTRATION_AVAILABILITY_LABELS,
  REGISTRATION_STATUS_CATALOG,
  asId,
  asIsoDateTime,
  barangayName,
  canOfferPromotion,
  canTransition,
  describeAttendance,
  describeCapacity,
  hasFinished,
  placesRemaining,
  promotionExceedsCapacity,
  registrationAvailability,
  type AttendanceStatus,
  type AuditRow,
  type EventCapacitySummary,
  type LguEvent,
  type LguEventId,
  type RegistrantView,
  type RegistrationAction,
  type RegistrationStatus,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { EVENTS_COPY } from './events.copy';

/**
 * One event: the resident-facing preview, what the office did, and who signed
 * up.
 *
 * Three things this screen refuses to do, each of them easy to do by accident:
 *
 *  - **It never claims a place is free.** Every count is printed with the
 *    moment it was taken, and the promote button is offered on any waitlisted
 *    row — including when the office's own figures say the event is full,
 *    where it warns and lets the attempt through. The backend decides
 *    (`DL-129`).
 *  - **It never turns an unmarked registrant into a no-show.** Completing an
 *    event declares attendance final and sweeps nothing; the screen says so
 *    before the button (`DL-131`).
 *  - **It never renders a resident field it was not given.** Rows arrive as
 *    `RegistrantView` — reference, name, barangay, date, two statuses — and
 *    there is nothing else on them to leak (`DL-130`).
 *
 * Cancelling is the one act behind a modal, because it reaches everybody
 * registered and cannot be undone.
 */
@Component({
  selector: 'app-event-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, Modal, PageHeader, RouterLink, StatusBadge],
  templateUrl: './event-detail-page.html',
  styleUrl: './event-detail-page.scss',
})
export class EventDetailPage {
  private readonly repository = inject(EVENT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);

  readonly id = input.required<string>();

  protected readonly copy = EVENTS_COPY.detail;
  protected readonly statusCatalog = EVENT_STATUS_CATALOG;
  protected readonly registrationCatalog = REGISTRATION_STATUS_CATALOG;
  protected readonly attendanceCatalog = ATTENDANCE_CATALOG;
  protected readonly statuses = Object.keys(REGISTRATION_STATUS_CATALOG) as RegistrationStatus[];
  protected readonly attendances = Object.keys(ATTENDANCE_CATALOG) as AttendanceStatus[];

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly canPublish = computed(() => this.permissions.has('event.publish'));
  protected readonly canCancel = computed(() => this.permissions.has('event.cancel'));
  protected readonly canArchive = computed(() => this.permissions.has('event.archive'));
  protected readonly canEdit = computed(() => this.permissions.has('event.edit'));
  protected readonly canManage = computed(() =>
    this.permissions.has('event.manage-registrations'),
  );
  protected readonly canMarkAttendance = computed(() =>
    this.permissions.has('event.mark-attendance'),
  );
  protected readonly canExport = computed(() =>
    this.permissions.has('event.export-registrants'),
  );

  private readonly key = computed(() => ({ id: this.id(), nonce: this.reloads() }));

  protected readonly state = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<LguEventId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<LguEvent | null> },
  );

  protected readonly capacityState = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.capacity(asId<LguEventId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<EventCapacitySummary> },
  );

  protected readonly historyState = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.history(asId<LguEventId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<readonly AuditRow[]> },
  );

  /* ── Registrants ────────────────────────────────────────────────────────── */

  protected readonly registrantSearch = signal('');
  private readonly settledSearch = debouncedTerm(this.registrantSearch);
  protected readonly statusFilter = signal<RegistrationStatus | null>(null);
  protected readonly attendanceFilter = signal<AttendanceStatus | null>(null);

  private readonly registrantQuery = computed(() => ({
    id: this.id(),
    nonce: this.reloads(),
    filter: {
      ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
      ...(this.statusFilter() ? { status: this.statusFilter() as RegistrationStatus } : {}),
      ...(this.attendanceFilter()
        ? { attendance: this.attendanceFilter() as AttendanceStatus }
        : {}),
    },
  }));

  protected readonly registrantState = toSignal(
    toObservable(this.registrantQuery).pipe(
      switchMap((query) =>
        toViewState(this.repository.registrants(asId<LguEventId>(query.id), query.filter)),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly RegistrantView[]> },
  );

  protected readonly registrants = computed<readonly RegistrantView[]>(
    () => valueOf(this.registrantState()) ?? [],
  );

  protected readonly hasRegistrantFilters = computed(
    () =>
      this.registrantSearch().length > 0 ||
      this.statusFilter() !== null ||
      this.attendanceFilter() !== null,
  );

  protected readonly summary = computed(() => valueOf(this.capacityState()) ?? null);

  protected readonly capacityLine = computed(() => {
    const summary = this.summary();
    return summary === null ? '' : describeCapacity(summary);
  });

  protected readonly attendanceLine = computed(() => {
    const summary = this.summary();
    return summary === null ? '' : describeAttendance(summary);
  });

  protected readonly remaining = computed(() => {
    const summary = this.summary();
    return summary === null ? null : placesRemaining(summary);
  });

  /** True where the office's own snapshot says there is no room (`DL-129`). */
  protected readonly overCapacity = computed(() => {
    const summary = this.summary();
    return summary !== null && promotionExceedsCapacity(summary);
  });

  protected readonly history = computed<readonly AuditRow[]>(
    () => valueOf(this.historyState()) ?? [],
  );

  /* ── Reading the event ──────────────────────────────────────────────────── */

  protected categoryLabel(event: LguEvent): string {
    return EVENT_CATEGORY_LABELS[event.category];
  }

  protected availabilityLabel(event: LguEvent): string {
    return REGISTRATION_AVAILABILITY_LABELS[
      registrationAvailability(event, event.registeredCount, asIsoDateTime(new Date()))
    ];
  }

  protected venueBarangay(event: LguEvent): string | null {
    return event.venue.barangayId === null ? null : barangayName(event.venue.barangayId);
  }

  protected registrantBarangay(row: RegistrantView): string {
    return row.barangayId === null ? '—' : barangayName(row.barangayId);
  }

  protected actionLabel(row: AuditRow): string {
    return AUDIT_ACTION_LABELS[row.action];
  }

  protected can(event: LguEvent, to: LguEvent['status']): boolean {
    return canTransition(EVENT_STATUS_TRANSITIONS, event.status, to);
  }

  /** Held, but attendance not yet declared final — the gap `DL-131` protects. */
  protected isHeldNotCompleted(event: LguEvent): boolean {
    return hasFinished(event, asIsoDateTime(new Date())) && event.status === 'published';
  }

  protected canPromote(row: RegistrantView): boolean {
    return this.canManage() && canOfferPromotion(row.status);
  }

  /* ── Acting ─────────────────────────────────────────────────────────────── */

  protected readonly reason = signal('');
  protected readonly cancelling = signal<LguEvent | null>(null);

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected onRegistrantSearch(event: Event): void {
    this.registrantSearch.set((event.target as HTMLInputElement).value);
  }

  protected onStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value === '' ? null : (value as RegistrationStatus));
  }

  protected onAttendanceFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.attendanceFilter.set(value === '' ? null : (value as AttendanceStatus));
  }

  protected readonly canAct = computed(
    () => this.reason().trim().length > 0 && !this.saving(),
  );

  protected async publish(event: LguEvent): Promise<void> {
    await this.act(this.repository.publish(asId<LguEventId>(event.id), this.reason().trim()));
  }

  protected async complete(event: LguEvent): Promise<void> {
    await this.act(this.repository.complete(asId<LguEventId>(event.id), this.reason().trim()));
  }

  protected async archive(event: LguEvent): Promise<void> {
    await this.act(this.repository.archive(asId<LguEventId>(event.id), this.reason().trim()));
  }

  protected askToCancel(event: LguEvent): void {
    if (this.reason().trim().length === 0) {
      return;
    }
    this.cancelling.set(event);
  }

  protected keepEvent(): void {
    this.cancelling.set(null);
  }

  protected async confirmCancel(): Promise<void> {
    const event = this.cancelling();
    this.cancelling.set(null);
    if (event !== null) {
      await this.act(this.repository.cancel(asId<LguEventId>(event.id), this.reason().trim()));
    }
  }

  protected async moveRegistration(
    row: RegistrantView,
    action: RegistrationAction,
  ): Promise<void> {
    if (!this.canAct()) {
      return;
    }
    await this.act(
      this.repository.actOnRegistration(row.id, action, this.reason().trim()),
    );
  }

  protected async mark(row: RegistrantView, attendance: AttendanceStatus): Promise<void> {
    // No reason required: marking somebody present is an observation, not a
    // decision about their place.
    await this.act(this.repository.markAttendance(row.id, attendance));
  }

  protected async exportList(event: LguEvent): Promise<void> {
    this.saving.set(true);
    try {
      const file = await firstValueFrom(
        this.repository.exportRegistrants(asId<LguEventId>(event.id)),
      );
      // Announced rather than silently downloaded: the office should know a
      // file naming residents now exists.
      this.notifications.success(`${this.copy.exported} ${file.filename}`);
    } catch {
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }

  private async act(call: Observable<unknown>): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      this.reason.set('');
      this.notifications.success(this.copy.saved);
      this.reloads.update((value) => value + 1);
    } catch {
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
