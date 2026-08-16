import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import {
  DISBURSEMENT_REPOSITORY,
  DISBURSEMENT_STATUS_CATALOG,
  RELEASE_KIND_LABELS,
  isReleaseOpen,
  isReleased,
  type Disbursement,
  type DisbursementStatus,
  type ReleaseKind,
} from '@domain/index';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELEASES_COPY } from './releases.copy';

/**
 * Bucketed rather than paged, so the whole working set is fetched at once. A
 * municipal office does not hold more open releases than this, and the cap is
 * stated rather than implicit.
 */
const LIST_LIMIT = 300;

/**
 * The release queue.
 *
 * Bucketed by **who has to act**, not by status alphabetically. The first
 * bucket is what the office got wrong — a wrong voucher, a payout it could not
 * make — because those are the ones where somebody is waiting on the office
 * rather than the other way round, and a queue sorted by status hides them
 * among everything else.
 */
@Component({
  selector: 'app-release-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, NgTemplateOutlet, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './release-list-page.html',
  styleUrl: './release-list-page.scss',
})
export class ReleaseListPage {
  private readonly repository = inject(DISBURSEMENT_REPOSITORY);

  protected readonly copy = RELEASES_COPY.list;
  protected readonly statusCatalog = DISBURSEMENT_STATUS_CATALOG;
  protected readonly statuses = Object.keys(DISBURSEMENT_STATUS_CATALOG) as DisbursementStatus[];
  protected readonly kinds: readonly ReleaseKind[] = ['money', 'in-kind'];

  protected readonly search = signal('');
  protected readonly status = signal<DisbursementStatus | null>(null);
  protected readonly kind = signal<ReleaseKind | null>(null);
  protected readonly openOnly = signal(false);

  private readonly query = computed(() => ({
    ...(this.search() ? { search: this.search() } : {}),
    ...(this.status() ? { status: this.status() as DisbursementStatus } : {}),
    ...(this.kind() ? { kind: this.kind() as ReleaseKind } : {}),
    ...(this.openOnly() ? { openOnly: true } : {}),
  }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((filter) =>
        toViewState(
          this.repository
            .list(filter, { page: 1, pageSize: LIST_LIMIT })
            .pipe(map((page) => page.items)),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly Disbursement[]> },
  );

  protected readonly releases = computed<readonly Disbursement[]>(
    () => valueOf(this.state()) ?? [],
  );

  /** What the office itself must fix before anybody can be paid. */
  protected readonly needsOffice = computed(() =>
    this.releases().filter(
      (release) => release.status === 'needs-correction' || release.status === 'deferred',
    ),
  );

  protected readonly waiting = computed(() =>
    this.releases().filter(
      (release) => release.status === 'for-release' || release.status === 'scheduled',
    ),
  );

  protected readonly settled = computed(() =>
    this.releases().filter(
      (release) =>
        isReleased(release.status) || !isReleaseOpen(release.status) || release.status === 'unclaimed',
    ),
  );

  protected readonly hasAny = computed(() => this.releases().length > 0);
  protected readonly hasFilters = computed(
    () =>
      this.search().length > 0 ||
      this.status() !== null ||
      this.kind() !== null ||
      this.openOnly(),
  );

  protected detailLink(release: Disbursement): string {
    return `/releases/${release.id}`;
  }

  protected statusLabel(status: DisbursementStatus): string {
    return DISBURSEMENT_STATUS_CATALOG[status].label;
  }

  protected kindLabel(kind: ReleaseKind): string {
    return RELEASE_KIND_LABELS[kind];
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value === '' ? null : (value as DisbursementStatus));
  }

  protected onKind(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.kind.set(value === '' ? null : (value as ReleaseKind));
  }

  protected onOpenOnly(event: Event): void {
    this.openOnly.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set(null);
    this.kind.set(null);
    this.openOnly.set(false);
  }
}
