import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import {
  ASSISTANCE_STATUS_CATALOG,
  DASHBOARD_PERIODS,
  DASHBOARD_REPOSITORY,
  barangayName,
  isFilterActive,
  PROGRAM_CATEGORY_LABELS,
  TAYTAY_BARANGAYS,
  toDecimal,
  type AttentionSignal,
  type BarangayId,
  type DashboardFilter,
  type DashboardPeriod,
  type DashboardSummary,
  type ProgramCategory,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ChartTable, type ChartRow } from '@shared/ui/chart-table/chart-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PesoPipe } from '@shared/pipes/peso.pipe';

import { DASHBOARD_COPY } from './dashboard.copy';
import {
  attentionDrillDown,
  barangayDrillDown,
  categoryDrillDown,
  releasesDrillDown,
  requestsDrillDown,
  statusDrillDown,
  type DrillDown,
} from './dashboard-drill-down';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

interface AttentionCard {
  readonly signal: AttentionSignal;
  readonly message: string;
  readonly severityLabel: string;
  readonly drillDown: DrillDown;
}

/**
 * The executive dashboard.
 *
 * Built to answer one question first — *what needs attention now?* — and to
 * make every figure traceable. Three properties hold it together:
 *
 * 1. **Attention before analytics.** The top of the screen is a ranked list of
 *    things a person can act on, filtered to what *this* user may act on. A
 *    disbursing officer is not told about approvals they cannot give.
 * 2. **Filter state lives in the URL.** Drill-down is shareable, survives the
 *    back button, and — because the same filter is passed to the repository and
 *    into every link — a metric and the records behind it cannot disagree.
 * 3. **Charts are tables.** Every breakdown renders through `ChartTable`, which
 *    is a real `<table>` with decorative bars, so nothing depends on colour and
 *    there is no separate "accessible version" to fall out of date.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    ChartTable,
    DatePipe,
    HasPermissionDirective,
    PageHeader,
    PesoPipe,
    RouterLink,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly repository = inject(DASHBOARD_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = DASHBOARD_COPY;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly periods = DASHBOARD_PERIODS;
  protected readonly categories = Object.keys(PROGRAM_CATEGORY_LABELS) as ProgramCategory[];

  /** Filter state is read from the URL, never held privately. */
  protected readonly filter = toSignal(
    this.route.queryParamMap.pipe(map((params) => readFilter(params))),
    { initialValue: {} as DashboardFilter },
  );

  protected readonly state = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => readFilter(params)),
      switchMap((filter) => toViewState(this.repository.summary(filter))),
    ),
    { initialValue: LOADING as ViewState<DashboardSummary> },
  );

  protected readonly filterActive = computed(() => isFilterActive(this.filter()));

  /**
   * Only signals this user can act on.
   *
   * Showing an intake officer "4 payouts scheduled" is noise: they cannot
   * release one. Filtering by the acting permission is what makes the list a
   * to-do rather than a news feed.
   */
  protected readonly attention = computed<readonly AttentionCard[]>(() => {
    const summary = valueOf(this.state());
    if (!summary) {
      return [];
    }
    return summary.attention
      .filter((signal) => this.permissions.has(signal.permission))
      .map((signal) => ({
        signal,
        message: this.copy.attention[signal.kind](signal.count),
        severityLabel: this.copy.severityLabel[signal.severity],
        drillDown: attentionDrillDown(signal.kind, summary.appliedFilter),
      }));
  });

  /** True when something needed attention but none of it was this user's. */
  protected readonly attentionHiddenByRole = computed(() => {
    const summary = valueOf(this.state());
    return summary !== null && summary.attention.length > 0 && this.attention().length === 0;
  });

  protected readonly statusRows = computed<readonly ChartRow[]>(() => {
    const summary = valueOf(this.state());
    if (!summary) {
      return [];
    }
    return summary.requestsByStatus.map((row) => {
      const drill = statusDrillDown(summary.appliedFilter, row.status);
      return {
        key: row.status,
        label: ASSISTANCE_STATUS_CATALOG[row.status].label,
        value: row.count,
        routerLink: drill.route,
        queryParams: drill.queryParams,
      };
    });
  });

  protected readonly barangayRows = computed<readonly ChartRow[]>(() => {
    const summary = valueOf(this.state());
    if (!summary) {
      return [];
    }
    return summary.requestsByBarangay.map((row) => {
      const drill = barangayDrillDown(summary.appliedFilter, row.barangayId);
      return {
        key: row.barangayId,
        label: barangayName(row.barangayId),
        value: row.count,
        routerLink: drill.route,
        queryParams: drill.queryParams,
      };
    });
  });

  protected readonly categoryRows = computed<readonly ChartRow[]>(() => {
    const summary = valueOf(this.state());
    if (!summary) {
      return [];
    }
    return summary.disbursedByCategory.map((row) => {
      const drill = categoryDrillDown(summary.appliedFilter, row.category);
      return {
        key: row.category,
        label: PROGRAM_CATEGORY_LABELS[row.category],
        value: toDecimal(row.amount),
        display: PESO.format(toDecimal(row.amount)),
        routerLink: drill.route,
        queryParams: drill.queryParams,
      };
    });
  });

  /* ── drill-down targets for the headline figures ────────────────────────── */

  protected openRequestsLink(summary: DashboardSummary): DrillDown {
    return requestsDrillDown(summary.appliedFilter, { openOnly: 'true' });
  }

  protected awaitingApprovalLink(summary: DashboardSummary): DrillDown {
    return statusDrillDown(summary.appliedFilter, 'endorsed');
  }

  protected scheduledPayoutsLink(summary: DashboardSummary): DrillDown {
    return releasesDrillDown(summary.appliedFilter, { status: 'scheduled' });
  }

  protected disbursedLink(summary: DashboardSummary): DrillDown {
    return releasesDrillDown(summary.appliedFilter, { status: 'released' });
  }

  protected periodLabel(period: DashboardPeriod): string {
    return this.copy.period[period];
  }

  protected categoryLabel(category: ProgramCategory): string {
    return PROGRAM_CATEGORY_LABELS[category];
  }

  /* ── filter changes rewrite the URL ─────────────────────────────────────── */

  protected onBarangay(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patch({ barangay: value || null });
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patch({ category: value || null });
  }

  protected onPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patch({ period: value === 'all-time' ? null : value });
  }

  protected clearFilter(): void {
    this.patch({ barangay: null, category: null, period: null });
  }

  protected refresh(): void {
    // Re-navigating with the same params re-runs the query without a full
    // reload, and keeps the URL as the single source of filter truth.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.route.snapshot.queryParams, r: Date.now().toString(36) },
      replaceUrl: true,
    });
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

/**
 * Reads the filter from query params.
 *
 * Exported for test: URL parsing is where a dashboard filter usually breaks,
 * and it is worth asserting that junk in the URL degrades to "no filter"
 * rather than to an exception or a silently wrong figure.
 */
export function readFilter(params: { get(name: string): string | null }): DashboardFilter {
  const filter: {
    barangayId?: BarangayId;
    category?: ProgramCategory;
    period?: DashboardPeriod;
  } = {};

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((b) => b.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  const category = params.get('category');
  if (category && category in PROGRAM_CATEGORY_LABELS) {
    filter.category = category as ProgramCategory;
  }

  const period = params.get('period');
  if (period && (DASHBOARD_PERIODS as readonly string[]).includes(period)) {
    filter.period = period as DashboardPeriod;
  }

  return filter;
}
