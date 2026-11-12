import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { map, switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { SessionStore } from '@core/auth/session.store';
import {
  isResidentSummaryFiltered,
  isSensitiveSector,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_AGE_GROUPS,
  RESIDENT_REPOSITORY,
  RESIDENT_SUMMARY_PERIODS,
  SEX_LABELS,
  SEXES,
  summaryDelta,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  type RecordsToTidy,
  type ReportRow,
  type ReportSeries,
  type ResidentAgeGroup,
  type ResidentSummary,
  type ResidentSummaryFilter,
  type ResidentSummaryPeriod,
  type Sex,
  type SummaryDelta,
  type VulnerabilitySector,
} from '@domain/index';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ChartTable } from '@shared/ui/chart-table/chart-table';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { CITIZENS_OVERVIEW_COPY } from './citizens-overview.copy';
import { residentFilterParams } from './resident-query';

/** The three sectors the board shows as headline figures, in its order. */
const HEADLINE_SECTORS = ['senior-citizen', 'pwd', 'solo-parent'] as const;
type HeadlineSector = (typeof HEADLINE_SECTORS)[number];

interface Headline {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  /** `null` when the server withheld it (`DL-105`): said, never shown as a zero. */
  readonly value: number | null;
  readonly delta: SummaryDelta | null;
  /** Whether a delta is part of this figure at all; a sector count has no previous period. */
  readonly compared: boolean;
  /** The registry filtered the same way, or `null` when the registry cannot list these people. */
  readonly link: Readonly<Record<string, string>> | null;
}

/**
 * The Citizens overview (`DL-213`). Dashboard pattern, from `dashboard/dashboard-page`.
 *
 * **The server counts; this screen draws.** Every figure is one the API sent, already withheld
 * where it is small enough to identify somebody, and nothing is summed, rounded or filled in here.
 * A withheld figure says so and opens nothing; the series totals are the server's, taken before.
 *
 * **Every figure opens the registry filtered the same way** (`residentFilterParams`), except where
 * the registry cannot list the same people — records added in a period, records missing a contact —
 * and then it is plain text rather than a link that would show somebody else.
 *
 * **The URL is the filter**, as on the registry, so an overview is a link.
 */
@Component({
  selector: 'app-citizens-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, ChartTable, HasPermissionDirective, Icon, PageHeader, RouterLink],
  templateUrl: './citizens-overview-page.html',
  styleUrl: './citizens-overview-page.scss',
})
export class CitizensOverviewPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  protected readonly copy = CITIZENS_OVERVIEW_COPY;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly ageGroups = RESIDENT_AGE_GROUPS;
  protected readonly sexes = SEXES;
  protected readonly periods = RESIDENT_SUMMARY_PERIODS;

  /** A protected sector is offered only to a reader cleared for it; the server refuses it besides. */
  protected readonly sectors = computed<readonly VulnerabilitySector[]>(() =>
    VULNERABILITY_SECTORS.filter(
      (sector) =>
        !isSensitiveSector(sector) || this.session.permissions().has('request.view-sensitive'),
    ),
  );

  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readFilter)), {
    initialValue: readFilter(this.route.snapshot.queryParamMap),
  });

  /** Bumped by "Try again" to ask for the same filter again. */
  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
      switchMap(({ filter }) => toViewState(this.repository.summary(filter))),
    ),
    { initialValue: LOADING as ViewState<ResidentSummary> },
  );

  protected readonly filtered = computed(() => isResidentSummaryFiltered(this.filter()));

  /** The registry's own parameters for this filter: what every link adds its row to. */
  private readonly base = computed(() =>
    residentFilterParams({
      ...(this.filter().barangayId === undefined ? {} : { barangayId: this.filter().barangayId }),
      ...(this.filter().sector === undefined ? {} : { sector: this.filter().sector }),
      ...(this.filter().ageGroup === undefined ? {} : { ageGroup: this.filter().ageGroup }),
      ...(this.filter().sex === undefined ? {} : { sex: this.filter().sex }),
    }),
  );

  protected headlines(summary: ResidentSummary): readonly Headline[] {
    const registered = summary.registered;
    const figures: Headline[] = [
      {
        key: 'registry',
        label: this.copy.onRegistry,
        hint: this.copy.onRegistryHint,
        value: summary.residents.current,
        delta: summaryDelta(summary.residents.current, summary.residents.previous),
        compared: true,
        link: this.base(),
      },
      {
        key: 'registered',
        label: this.copy.registered(summary.period.kind),
        hint: this.copy.registeredHint,
        value: registered.current.value,
        delta: summaryDelta(registered.current.value, registered.previous.value),
        compared: true,
        link: null,
      },
    ];
    // Under a sector filter the board's sector figures would count an overlap the registry cannot
    // list with one filter, so they stand aside for the sector table.
    if (this.filter().sector === undefined) {
      for (const sector of HEADLINE_SECTORS) {
        const row = summary.bySector.rows.find((candidate) => candidate.key === sector);
        if (row === undefined) continue;
        figures.push(this.sectorHeadline(sector, row));
      }
    }
    return figures;
  }

  protected deltaText(delta: SummaryDelta | null): string {
    if (delta === null) return this.copy.delta.none;
    return delta.direction === 'same'
      ? this.copy.delta.same
      : this.copy.delta[delta.direction](delta.amount);
  }

  protected barangayRows(series: ReportSeries): readonly ReportRow[] {
    return this.linked(series, (row) =>
      TAYTAY_BARANGAYS.some((barangay) => barangay.id === row.key) ? { barangay: row.key } : null,
    );
  }

  protected sectorRows(series: ReportSeries): readonly ReportRow[] {
    const chosen = this.filter().sector;
    return this.linked(series, (row) =>
      VULNERABILITY_SECTORS.some((sector) => sector === row.key) &&
      (chosen === undefined || chosen === row.key)
        ? { sector: row.key }
        : null,
    );
  }

  protected ageSexRows(series: ReportSeries): readonly ReportRow[] {
    return this.linked(series, (row) => {
      const [group, sex] = row.key.split('.');
      const ageGroup = RESIDENT_AGE_GROUPS.find((candidate) => candidate === group);
      const known = SEXES.find((candidate) => candidate === sex);
      return ageGroup === undefined || known === undefined ? null : { ageGroup, sex: known };
    });
  }

  protected tidyLabel(item: RecordsToTidy): string {
    return this.copy.tidy[item.key];
  }

  protected asOf(summary: ResidentSummary): string {
    return this.copy.asOf(
      formatDate(summary.asOf, 'd MMM y, h:mm a', this.locale),
      formatDate(summary.period.from, 'd MMM y', this.locale),
      formatDate(summary.period.to, 'd MMM y', this.locale),
    );
  }

  protected when(value: string): string {
    return formatDate(value, 'd MMM y, h:mm a', this.locale);
  }

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  protected ageGroupLabel(group: ResidentAgeGroup): string {
    return RESIDENT_AGE_GROUP_LABELS[group];
  }

  protected sexLabel(sex: Sex): string {
    return SEX_LABELS[sex];
  }

  protected periodLabel(period: ResidentSummaryPeriod): string {
    return this.copy.periods[period];
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  protected onFilter(name: 'barangay' | 'sector' | 'ageGroup' | 'sex', event: Event): void {
    this.patch({ [name]: (event.target as HTMLSelectElement).value || null });
  }

  protected onPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    // The month is the server's default, so it is the URL's absence rather than a parameter.
    this.patch({ period: value === 'month' ? null : value });
  }

  protected clearFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { period: this.filter().period ?? null },
    });
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  private sectorHeadline(sector: HeadlineSector, row: ReportRow): Headline {
    const words = this.copy.kpiSector[sector];
    return {
      key: sector,
      label: words.label,
      hint: row.isWithheld ? this.copy.withheldHint : words.hint,
      value: row.isWithheld ? null : row.value,
      delta: null,
      compared: false,
      link: row.isWithheld ? null : { ...this.base(), sector },
    };
  }

  /** A withheld row keeps its label and opens nothing (`DL-105`); any other row opens the registry. */
  private linked(
    series: ReportSeries,
    narrow: (row: ReportRow) => Readonly<Record<string, string>> | null,
  ): readonly ReportRow[] {
    return series.rows.map((row) => {
      const params = row.isWithheld ? null : narrow(row);
      return params === null
        ? row
        : { ...row, routerLink: '/residents', queryParams: { ...this.base(), ...params } };
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

/** The overview's filter from the URL, by the registry's parameter names; unknown values are dropped. */
function readFilter(params: ParamMap): ResidentSummaryFilter {
  const barangay = TAYTAY_BARANGAYS.find((candidate) => candidate.id === params.get('barangay'));
  const sector = VULNERABILITY_SECTORS.find((candidate) => candidate === params.get('sector'));
  const ageGroup = RESIDENT_AGE_GROUPS.find((candidate) => candidate === params.get('ageGroup'));
  const sex = SEXES.find((candidate) => candidate === params.get('sex'));
  const period = RESIDENT_SUMMARY_PERIODS.find((candidate) => candidate === params.get('period'));
  return {
    ...(barangay === undefined ? {} : { barangayId: barangay.id }),
    ...(sector === undefined ? {} : { sector }),
    ...(ageGroup === undefined ? {} : { ageGroup }),
    ...(sex === undefined ? {} : { sex }),
    ...(period === undefined ? {} : { period }),
  };
}
