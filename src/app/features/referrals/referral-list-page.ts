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
import {
  combineLatest,
  firstValueFrom,
  map,
  switchMap,
  tap,
  type Observable,
  type Subscription,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  CASE_REPOSITORY,
  isCaseOpen,
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_REPOSITORY,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCY_LABELS,
  isReferralFilterActive,
  isReferralOverdue,
  todayAsIsoDate,
  type CursorPage,
  type Referral,
  type ReferralFilter,
  type ReferralDestination,
  type ReferralStatus,
  type ReferralUrgency,
  asId,
  REFERRAL_DESTINATIONS,
  REFERRAL_URGENCIES,
  type AssistanceRequest,
  type AssistanceRequestId,
  type CaseId,
  type CaseSummary,
  type ResidentId,
  type ResidentView,
  type ServiceProvider,
  type ServiceProviderId,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, ready, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PersonPicker } from '@shared/residents/person-picker';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { failureDetail, saidByTheHttpLayer } from './referral-failure';
import { REFERRALS_COPY } from './referrals.copy';
import { readReferralQuery } from './referral-query';

/**
 * Read a cursor page at a time, newest drafted first, as the API pages it (`DL-161`, `DL-181`). The
 * screen says how many are shown and whether more exist — never "page 1 of N", because the API
 * sends no total.
 */
const PAGE_SIZE = 20;

/**
 * How many cases and requests the compose form offers to link, read as one page like the case
 * page's own request picker. When more exist the form says so rather than letting the list read
 * as complete (`DL-161`).
 */
const LINK_CHOICES = 50;

/**
 * What a referral is about: a case or a filed request (`DL-185`). The server reads a caseload's
 * referrals through these links and refuses a caseload's draft without one (403), so for a social
 * worker the form starts here — from their assigned work — rather than from the registry, whose
 * search is closed to them (`DL-183`).
 */
export type ReferralLink =
  | {
      readonly kind: 'case';
      readonly id: CaseId;
      readonly residentId: ResidentId;
      readonly label: string;
    }
  | {
      readonly kind: 'request';
      readonly id: AssistanceRequestId;
      readonly residentId: ResidentId;
      readonly label: string;
    };

/** One value per option, so a `<select>` can carry either kind. */
export function linkKey(link: ReferralLink): string {
  return `${link.kind}:${link.id}`;
}

export function caseLink(summary: CaseSummary): ReferralLink {
  return {
    kind: 'case',
    id: summary.record.id,
    residentId: summary.record.subjectResidentId,
    label: `${summary.record.referenceNumber} — ${summary.subject.listedName}`,
  };
}

export function requestLink(request: AssistanceRequest): ReferralLink {
  return {
    kind: 'request',
    id: request.id,
    residentId: request.residentId,
    label: `${request.referenceNumber} — ${ASSISTANCE_STATUS_CATALOG[request.status].label}`,
  };
}

/** The cases and filed requests a referral may name, and whether more exist than were read. */
interface LinkChoices {
  readonly cases: readonly ReferralLink[];
  readonly requests: readonly ReferralLink[];
  readonly more: boolean;
}

const NO_CHOICES: LinkChoices = { cases: [], requests: [], more: false };


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
  private readonly session = inject(SessionStore);
  private readonly caseRepository = inject(CASE_REPOSITORY);
  private readonly requestRepository = inject(ASSISTANCE_REQUEST_REPOSITORY);

  protected readonly canCompose = computed(() => this.permissions.has('referral.manage'));

  /**
   * A caseload (`assigned-cases`) refers from its own work: it chooses one of its cases or requests
   * and the client is that record's person. The registry's search is closed to it (`DL-183`), and
   * the server refuses its draft without a link (`DL-185`).
   */
  protected readonly isCaseload = computed(() => this.permissions.scope() === 'assigned-cases');

  protected readonly client = signal<ResidentView | null>(null);
  protected readonly link = signal<ReferralLink | null>(null);
  protected readonly linkState = signal<ViewState<LinkChoices>>(ready(NO_CHOICES));
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

  /** Who the draft is about: the chosen person, or — for a caseload — the linked record's. */
  private readonly residentId = computed<ResidentId | null>(
    () => this.link()?.residentId ?? this.client()?.resident.id ?? null,
  );

  protected readonly canCreate = computed(
    () =>
      this.residentId() !== null &&
      (!this.isCaseload() || this.link() !== null) &&
      this.destinationName().trim().length > 0 &&
      this.serviceRequested().trim().length > 0 &&
      this.reason().trim().length > 0 &&
      !this.composing(),
  );

  protected onClient(resident: ResidentView): void {
    this.client.set(resident);
    this.link.set(null);
    this.readLinks(
      this.caseRepository
        .casesForResident(resident.resident.id)
        .pipe(map((cases) => ({ items: cases, hasMore: false, nextCursor: null }))),
      this.requestRepository.list(
        { residentId: resident.resident.id },
        { limit: LINK_CHOICES, cursor: null },
      ),
    );
  }

  /** The options of the link `<select>`, both kinds, in the order they are shown. */
  protected readonly linkOptions = computed(() => {
    const state = this.linkState();
    return state.kind === 'ready' ? [...state.value.cases, ...state.value.requests] : [];
  });

  protected readonly linkKey = linkKey;

  /** More cases or requests exist than were read: said, so the list never reads as complete. */
  protected readonly linkMore = computed(() => valueOf(this.linkState())?.more === true);

  protected onLink(event: Event): void {
    const key = (event.target as HTMLSelectElement).value;
    this.link.set(this.linkOptions().find((option) => linkKey(option) === key) ?? null);
  }

  private linkRead: Subscription | null = null;

  /**
   * Reads the cases and requests offered for linking. Open cases only — the server refuses a link
   * to a closed one — and filed requests only, which is all the request list ever returns.
   */
  private readLinks(
    cases: Observable<CursorPage<CaseSummary>>,
    requests: Observable<CursorPage<AssistanceRequest>>,
  ): void {
    // A person chosen since makes an earlier read stale: only the latest is kept.
    this.linkRead?.unsubscribe();
    this.linkRead = toViewState(
      combineLatest([cases, requests]).pipe(
        map(([casePage, requestPage]) => ({
          cases: casePage.items
            .filter((summary) => isCaseOpen(summary.record.status))
            .map((summary) => caseLink(summary)),
          requests: requestPage.items.map((request) => requestLink(request)),
          more: casePage.hasMore || requestPage.hasMore,
        })),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this.linkState.set(state));
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
    const residentId = this.residentId();
    const link = this.link();

    if (residentId === null || !this.canCreate()) {
      return;
    }

    this.composing.set(true);

    try {
      const referral = await firstValueFrom(
        this.repository.createDraft({
          residentId,
          requestId: link?.kind === 'request' ? link.id : null,
          caseId: link?.kind === 'case' ? link.id : null,
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
      // In the server's words where it gave some; a refusal it has already said is not said twice.
      if (!saidByTheHttpLayer(failure)) {
        this.notifications.error(this.copy.draftNotCreated, failureDetail(failure));
      }
    } finally {
      this.composing.set(false);
    }
  }

  private readonly repository = inject(REFERRAL_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<Referral>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => {
        this.searchText.set(query.filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((query) =>
        toViewState(this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<Referral>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly rows = computed<readonly Referral[]>(() => [
    ...(valueOf(this.state())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly hasFilters = computed(() => isReferralFilterActive(this.filter()));
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.state()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: ReferralFilter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list(filter, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The filter changed meanwhile: this page continues a list nobody is looking at.
          if (filter === this.filter()) {
            this.further.update((pages) => [...pages, page]);
          }
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  protected readonly rowKey = (referral: Referral): string => referral.id;

  protected readonly columns = computed<readonly TableColumn<Referral>[]>(() => [
    { key: 'reference', header: this.copy.columnReference, cell: this.referenceCell() },
    {
      key: 'destination',
      header: this.copy.columnDestination,
      value: (referral) => referral.destinationName,
    },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'urgency',
      header: this.copy.columnUrgency,
      width: '110px',
      value: (referral) => REFERRAL_URGENCY_LABELS[referral.urgency],
    },
    { key: 'followUp', header: this.copy.columnFollowUp, cell: this.followUpCell() },
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

    // A caseload's own work, read once when the page opens (`DL-178`, `DL-179`, `DL-185`).
    const me = this.session.user();
    if (this.isCaseload() && this.canCompose() && me !== null) {
      this.readLinks(
        this.caseRepository.list({ assignedTo: me.id }, { limit: LINK_CHOICES, cursor: null }),
        this.requestRepository.list({ assignedTo: me.id }, { limit: LINK_CHOICES, cursor: null }),
      );
    }
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

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...changes },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function selectValue(event: Event): string | null {
  return (event.target as HTMLSelectElement).value || null;
}
