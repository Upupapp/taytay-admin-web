import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map, switchMap, tap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_REPOSITORY,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCY_LABELS,
  emptyPage,
  isReferralFilterActive,
  isReferralOverdue,
  todayAsIsoDate,
  type Page,
  type Referral,
  type ReferralDestination,
  type ReferralStatus,
  type ReferralUrgency,
  type SortSpec,
  asId,
  REFERRAL_DESTINATIONS,
  REFERRAL_URGENCIES,
  type ResidentView,
  type ServiceProvider,
  type ServiceProviderId,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PersonPicker } from '@shared/residents/person-picker';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { REFERRALS_COPY } from './referrals.copy';
import { readReferralQuery } from './referral-query';


/**
 * The referral queue.
 *
 * Overdue is **computed from the record**, not stored: a referral is overdue
 * when the office said it would chase by a date, that date has passed, and
 * nobody has heard back. A stored flag would need a nightly job to stay true
 * and would be wrong every morning until it ran.
 */
@Component({
  selector: 'app-referral-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PersonPicker,DataTable, HasPermissionDirective, PageHeader, RouterLink, StatusBadge],
  templateUrl: './referral-list-page.html',
  styleUrl: './referral-list-page.scss',
})
export class ReferralListPage {
  /* ── composing a new referral ───────────────────────────────────────────── */

  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);

  protected readonly canCompose = computed(() => this.permissions.has('referral.manage'));

  protected readonly client = signal<ResidentView | null>(null);
  protected readonly destination = signal<ReferralDestination>('dswd-field-office');
  protected readonly destinationName = signal('');
  protected readonly destinationContact = signal('');
  protected readonly urgency = signal<ReferralUrgency>('routine');
  protected readonly serviceRequested = signal('');
  protected readonly reason = signal('');
  protected readonly composing = signal(false);

  protected readonly destinationOptions = REFERRAL_DESTINATIONS;
  protected readonly destinationLabels = REFERRAL_DESTINATION_LABELS;
  protected readonly urgencyOptions = REFERRAL_URGENCIES;
  protected readonly urgencyLabels = REFERRAL_URGENCY_LABELS;

  /**
   * The provider directory, so a destination can be chosen rather than typed.
   *
   * A typed organisation name is one that appears three ways across three referrals, and the
   * office cannot then count where it sends people.
   */
  /*
   * Read lazily, because this block is declared above the injected repository.
   *
   * Reordering the fields would work equally well and would put the compose form's plumbing above
   * the page's own; a deferred read keeps the reading order — what this page IS, then what it lets
   * you do — without a field-initialisation order dependency nobody can see.
   */
  protected readonly providers = toSignal(
    toObservable(signal(null)).pipe(switchMap(() => this.repository.listProviders({}))),
    { initialValue: [] as readonly ServiceProvider[] },
  );

  protected readonly chosenProviderId = signal<ServiceProviderId | null>(null);

  protected readonly canCreate = computed(
    () =>
      this.client() !== null &&
      this.destinationName().trim().length > 0 &&
      this.serviceRequested().trim().length > 0 &&
      this.reason().trim().length > 0 &&
      !this.composing(),
  );

  protected onClient(resident: ResidentView): void {
    this.client.set(resident);
  }

  protected onComposeDestination(event: Event): void {
    this.destination.set((event.target as HTMLSelectElement).value as ReferralDestination);
  }

  protected onComposeUrgency(event: Event): void {
    this.urgency.set((event.target as HTMLSelectElement).value as ReferralUrgency);
  }

  protected onDestinationName(event: Event): void {
    this.destinationName.set((event.target as HTMLInputElement).value);
  }

  protected onDestinationContact(event: Event): void {
    this.destinationContact.set((event.target as HTMLInputElement).value);
  }

  protected onService(event: Event): void {
    this.serviceRequested.set((event.target as HTMLInputElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  /**
   * Choosing a provider fills the destination from the directory record.
   *
   * Read back rather than copied from the list already in hand: the directory row is a summary and
   * the record is the authority, and a contact number typed from a stale summary is the one
   * somebody rings on the day.
   */
  protected async chooseProvider(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;

    if (id === '') {
      this.chosenProviderId.set(null);
      return;
    }

    const provider = await firstValueFrom(
      this.repository.getProvider(asId<ServiceProviderId>(id)),
    );

    if (provider === null) {
      return;
    }

    this.chosenProviderId.set(provider.id);
    this.destinationName.set(provider.name);
    this.destinationContact.set(provider.contact.phone ?? '');
  }

  /**
   * Creates the referral as a **draft**, and goes to it.
   *
   * Nothing is disclosed by this act: the lawful basis and the shared fields are recorded on the
   * detail page, and the server refuses a send without a basis (`DL-140`). A create that also sent
   * would be the window `DL-81` exists to close.
   */
  protected async create(): Promise<void> {
    const client = this.client();

    if (client === null || !this.canCreate()) {
      return;
    }

    this.composing.set(true);

    try {
      const referral = await firstValueFrom(
        this.repository.createDraft({
          residentId: client.resident.id,
          requestId: null,
          caseId: null,
          providerId: this.chosenProviderId(),
          destination: this.destination(),
          destinationName: this.destinationName().trim(),
          destinationContact: this.destinationContact().trim() || null,
          urgency: this.urgency(),
          serviceRequested: this.serviceRequested().trim(),
          reason: this.reason().trim(),
          followUpOn: null,
        }),
      );

      this.notifications.success(this.copy.draftCreated);
      void this.router.navigate(['/referrals', referral.id]);
    } catch (failure: unknown) {
      this.notifications.error(
        failure instanceof Error ? failure.message : this.copy.draftNotCreated,
      );
    } finally {
      this.composing.set(false);
    }
  }

  private readonly repository = inject(REFERRAL_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = REFERRALS_COPY.list;
  protected readonly statusCatalog = REFERRAL_STATUS_CATALOG;
  protected readonly statuses = Object.keys(REFERRAL_STATUS_CATALOG) as ReferralStatus[];
  protected readonly destinations = Object.keys(
    REFERRAL_DESTINATION_LABELS,
  ) as ReferralDestination[];
  protected readonly urgencies = Object.keys(REFERRAL_URGENCY_LABELS) as ReferralUrgency[];

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('referenceCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('statusCell');
  private readonly followUpCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('followUpCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readReferralQuery(params))),
    { initialValue: readReferralQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<Referral>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<Referral>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isReferralFilterActive(this.filter()));

  protected readonly rowKey = (referral: Referral): string => referral.id;

  protected readonly columns = computed<readonly TableColumn<Referral>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'referredAt',
      cell: this.referenceCell(),
    },
    {
      key: 'destination',
      header: this.copy.columnDestination,
      value: (referral) => referral.destinationName,
    },
    { key: 'status', header: this.copy.columnStatus, sortField: 'status', cell: this.statusCell() },
    {
      key: 'urgency',
      header: this.copy.columnUrgency,
      sortField: 'urgency',
      width: '110px',
      value: (referral) => REFERRAL_URGENCY_LABELS[referral.urgency],
    },
    {
      key: 'followUp',
      header: this.copy.columnFollowUp,
      sortField: 'followUpOn',
      cell: this.followUpCell(),
    },
  ]);

  protected detailLink(referral: Referral): string {
    return `/referrals/${referral.id}`;
  }

  protected statusLabel(status: ReferralStatus): string {
    return REFERRAL_STATUS_CATALOG[status].label;
  }

  protected destinationLabel(destination: ReferralDestination): string {
    return REFERRAL_DESTINATION_LABELS[destination];
  }

  protected urgencyLabel(urgency: ReferralUrgency): string {
    return REFERRAL_URGENCY_LABELS[urgency];
  }

  protected isOverdue(referral: Referral): boolean {
    return isReferralOverdue(referral, todayAsIsoDate());
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.patch({ q: value.trim() || null }), SEARCH_DEBOUNCE_MS);
  }

  protected onStatus(event: Event): void {
    this.patch({ status: selectValue(event) });
  }

  protected onDestination(event: Event): void {
    this.patch({ destination: selectValue(event) });
  }

  protected onUrgency(event: Event): void {
    this.patch({ urgency: selectValue(event) });
  }

  protected onOverdueOnly(event: Event): void {
    this.patch({ overdue: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected onOpenOnly(event: Event): void {
    this.patch({ open: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected onSortChanged(sort: SortSpec): void {
    this.patch({ sort: sort.field, direction: sort.direction, page: null });
  }

  protected onPageChanged(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? String(page) : null },
      queryParamsHandling: 'merge',
    });
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...changes, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function selectValue(event: Event): string | null {
  return (event.target as HTMLSelectElement).value || null;
}
