import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_FIELDS_NOT_RECORDED,
  AUDIT_SOURCE_LABELS,
  GOVERNANCE_REPOSITORY,
  asId,
  describeAuditFilter,
  describeAuditRows,
  isAuditFilterActive,
  type AuditAction,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditFilter,
  type AuditRow,
  type CursorPage,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ADMIN_COPY } from './administration.copy';

/**
 * The audit trail.
 *
 * **A row cannot quote what changed, because it does not hold it** (`DL-114`).
 * The rows this screen renders carry a summary, the field names that moved and
 * how sensitive each was; the recorded values are a separate fetch behind
 * `audit.view-detail`, and the screen says so at the top rather than leaving
 * their absence to look like a missing feature.
 *
 * That split matters most on exactly this screen. An audit list is the one
 * surface designed to be scrolled and filtered by somebody reviewing *other
 * people's* work — a row reading `monthlyIncome: 3,200 → 18,000` would disclose
 * a resident's income to every reviewer who filters by date, in the name of
 * accountability.
 */
/** The API's own ceiling on a page. */
const PAGE_SIZE = 50;

@Component({
  selector: 'app-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage {
  private readonly repository = inject(GOVERNANCE_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = ADMIN_COPY.audit;
  protected readonly fieldsNotRecorded = AUDIT_FIELDS_NOT_RECORDED;
  protected readonly actions = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

  protected readonly search = signal('');

  /**
   * The term the data layer actually sees.
   *
   * Debounced so typing a surname is one read rather than one per keystroke
   * (`DL-119`). The other filters are not debounced: choosing from a dropdown
   * is a single deliberate act and should take effect at once.
   */
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly action = signal<AuditAction | null>(null);
  protected readonly sensitiveOnly = signal(false);

  protected readonly canOpenValues = computed(() =>
    this.permissions.has('audit.view-detail'),
  );

  private readonly filter = computed<AuditFilter>(() => ({
    ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
    ...(this.action() ? { action: this.action() as AuditAction } : {}),
    ...(this.sensitiveOnly() ? { sensitiveOnly: true } : {}),
  }));

  /** Older pages, appended by "Show older entries" and dropped whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<AuditRow>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.filter).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((filter) =>
        toViewState(this.repository.auditRows(filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AuditRow>> },
  );

  protected readonly rows = computed<readonly AuditRow[]>(() => [
    ...(valueOf(this.state())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.state()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  // While more exist, the count is of what is shown and says so; a total is never invented.
  protected readonly summary = computed(() =>
    this.hasMore() ? this.copy.shown(this.rows().length) : describeAuditRows(this.rows()),
  );
  protected readonly coverage = computed(() => describeAuditFilter(this.filter()));
  protected readonly hasFilters = computed(() => isAuditFilterActive(this.filter()));

  protected actionLabel(action: AuditAction): string {
    return AUDIT_ACTION_LABELS[action];
  }

  protected sourceLabel(row: AuditRow): string {
    return AUDIT_SOURCE_LABELS[row.source];
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onAction(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.action.set(value === '' ? null : (value as AuditAction));
  }

  protected onSensitiveOnly(event: Event): void {
    this.sensitiveOnly.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.action.set(null);
    this.sensitiveOnly.set(false);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .auditRows(filter, { limit: PAGE_SIZE, cursor })
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

  /* ── Opening the recorded values ────────────────────────────────────────── */

  protected readonly openRowId = signal<string | null>(null);
  protected readonly detail = signal<AuditEntryDetail | null>(null);

  protected isOpen(row: AuditRow): boolean {
    return this.openRowId() === row.id;
  }

  protected async toggleValues(row: AuditRow): Promise<void> {
    if (this.isOpen(row)) {
      this.openRowId.set(null);
      this.detail.set(null);
      return;
    }
    if (!this.canOpenValues()) {
      return;
    }
    // Fetched only when asked for. The list response never carries values.
    const detail = await firstValueFrom(
      this.repository.auditDetail(asId<AuditEntryId>(row.id)),
    );
    this.openRowId.set(row.id);
    this.detail.set(detail);
  }
}
