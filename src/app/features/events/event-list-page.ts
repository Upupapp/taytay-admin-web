import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  EVENT_CATEGORY_LABELS,
  EVENT_STATUS_CATALOG,
  EVENT_VIEW_LABELS,
  REGISTRATION_AVAILABILITY_LABELS,
  asIsoDateTime,
  barangayName,
  registrationAvailability,
  type EventCategory,
  type EventView,
  type LguEvent,
  type RegistrationAvailability,
} from '@domain/index';
import { EVENT_REPOSITORY } from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { EVENTS_COPY } from './events.copy';

/**
 * The events list.
 *
 * Ordered by **when the event is**, not by when the row was written: this list
 * is read to answer "what is next", and a newest-first ordering answers a
 * question nobody asked.
 *
 * The registration column shows a state that is **derived every render** from
 * the event, the clock and the count (`DL-128`). Nothing stores whether
 * registration is open, because a stored flag is wrong from the moment the
 * deadline passes until something updates it.
 */
@Component({
  selector: 'app-event-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink, StatusBadge],
  templateUrl: './event-list-page.html',
  styleUrl: './event-list-page.scss',
})
export class EventListPage {
  private readonly repository = inject(EVENT_REPOSITORY);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = EVENTS_COPY.list;
  protected readonly statusCatalog = EVENT_STATUS_CATALOG;
  protected readonly views = Object.keys(EVENT_VIEW_LABELS) as EventView[];
  protected readonly categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];

  protected readonly view = signal<EventView>('upcoming');
  protected readonly search = signal('');
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly category = signal<EventCategory | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly canCompose = computed(() => this.permissions.has('events.create'));

  private readonly query = computed(() => ({
    view: this.view(),
    filter: {
      ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
      ...(this.category() ? { category: this.category() as EventCategory } : {}),
      ...(this.from() ? { from: asIsoDateTime(new Date(this.from())) } : {}),
      ...(this.to() ? { to: asIsoDateTime(new Date(this.to())) } : {}),
    },
  }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) => toViewState(this.repository.list(query.view, query.filter))),
    ),
    { initialValue: LOADING as ViewState<readonly LguEvent[]> },
  );

  protected readonly events = computed<readonly LguEvent[]>(() => valueOf(this.state()) ?? []);
  protected readonly hasFilters = computed(
    () => this.search().length > 0 || this.category() !== null || this.from() !== '' || this.to() !== '',
  );

  /*
   * No count on the tabs.
   *
   * The six views the command names do not partition the set — a published
   * event that has happened is in both `published` and `past` — so a count per
   * tab needs the whole list, and the port takes a view. The options were a
   * seventh hidden view or six queries per render, and neither is worth it for
   * a number nobody asked for: "Drafts (0)" that really means "no drafts match
   * this filter" is worse than no number at all.
   */

  protected viewLabel(view: EventView): string {
    return EVENT_VIEW_LABELS[view];
  }

  protected categoryLabel(category: EventCategory): string {
    return EVENT_CATEGORY_LABELS[category];
  }

  protected venueLine(event: LguEvent): string {
    const barangay = event.venue.barangayId === null ? null : barangayName(event.venue.barangayId);
    return barangay === null ? event.venue.name : `${event.venue.name}, ${barangay}`;
  }

  /**
   * Derived per row from the event, its snapshot count and the clock — never
   * read from a stored `registrationState` (`DL-128`).
   */
  protected availability(event: LguEvent): RegistrationAvailability {
    return registrationAvailability(event, event.registeredCount, asIsoDateTime(new Date()));
  }

  protected availabilityLabel(event: LguEvent): string {
    return REGISTRATION_AVAILABILITY_LABELS[this.availability(event)];
  }

  protected onView(view: EventView): void {
    this.view.set(view);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.category.set(value === '' ? null : (value as EventCategory));
  }

  protected onFrom(event: Event): void {
    this.from.set((event.target as HTMLInputElement).value);
  }

  protected onTo(event: Event): void {
    this.to.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.category.set(null);
    this.from.set('');
    this.to.set('');
  }
}
