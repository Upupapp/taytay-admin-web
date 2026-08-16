import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  PERSON_LEVEL_WARNING,
  REPORT_PERIOD_LABELS,
  REPORT_REPOSITORY,
  TAYTAY_BARANGAYS,
  asId,
  type BarangayId,
  type ReportFilter,
  type ReportId,
  type ReportPeriod,
  type ReportResult,
  type ReportSeries,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ChartTable } from '@shared/ui/chart-table/chart-table';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { REPORTS_COPY } from './reports.copy';

/**
 * One report.
 *
 * Every series is rendered with `ChartTable`, which **is** a real table rather
 * than a chart with a table bolted beside it. That is what makes "every chart
 * claim can be verified from tabular data" true by construction instead of by
 * discipline: there is no second rendering to fall out of step, and nothing is
 * conveyed by colour alone.
 *
 * Three things this screen must never do, and does not:
 *
 *  - **Compute a figure.** The adapter applies the filter, the suppression and
 *    the arithmetic; this screen renders what it is handed. A total worked out
 *    here would be a second answer to the same question.
 *  - **Compose the export.** The file comes from the data layer with its own
 *    manifest (`DL-106`), for the same reason a payout manifest does (`DL-92`).
 *  - **Hide that figures are missing.** A withheld cell is labelled, and the
 *    notice above the table says the column will not add up.
 */
@Component({
  selector: 'app-report-view-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, ChartTable, DatePipe, PageHeader, RouterLink],
  templateUrl: './report-view-page.html',
  styleUrl: './report-view-page.scss',
})
export class ReportViewPage {
  private readonly repository = inject(REPORT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);

  readonly id = input.required<string>();

  protected readonly copy = REPORTS_COPY.view;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly periods = Object.keys(REPORT_PERIOD_LABELS) as ReportPeriod[];
  protected readonly personLevelWarning = PERSON_LEVEL_WARNING;

  protected readonly period = signal<ReportPeriod>('all-time');
  protected readonly barangayId = signal<BarangayId | null>(null);

  private readonly filter = computed<ReportFilter>(() => ({
    ...(this.period() !== 'all-time' ? { period: this.period() } : {}),
    ...(this.barangayId() !== null ? { barangayId: this.barangayId() as BarangayId } : {}),
  }));

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), filter: this.filter() }))).pipe(
      switchMap((query) =>
        toViewState(this.repository.run(query.id as ReportId, query.filter)),
      ),
    ),
    { initialValue: LOADING as ViewState<ReportResult | null> },
  );

  protected readonly result = computed(() => valueOf(this.state()) ?? null);

  protected readonly canExport = computed(() => this.permissions.has('report.export'));
  protected readonly hasFilters = computed(
    () => this.period() !== 'all-time' || this.barangayId() !== null,
  );

  protected periodLabel(period: ReportPeriod): string {
    return REPORT_PERIOD_LABELS[period];
  }

  protected onPeriod(event: Event): void {
    this.period.set((event.target as HTMLSelectElement).value as ReportPeriod);
  }

  protected onBarangay(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.barangayId.set(value === '' ? null : asId<BarangayId>(value));
  }

  protected clearFilters(): void {
    this.period.set('all-time');
    this.barangayId.set(null);
  }

  /** Series with nothing in them are dropped: an empty table is not a finding. */
  protected populated(result: ReportResult): readonly ReportSeries[] {
    return result.series.filter((series) => series.rows.length > 0);
  }

  /* ── Exporting ──────────────────────────────────────────────────────────── */

  protected readonly exporting = signal(false);
  /** Set when a person-level export has been asked for and not yet confirmed. */
  protected readonly awaitingConfirmation = signal(false);

  protected requestExport(result: ReportResult): void {
    // A person-level export is warned about **before** the file exists, not
    // after it is on somebody's desktop.
    if (result.grain === 'person-level') {
      this.awaitingConfirmation.set(true);
      return;
    }
    void this.runExport(result);
  }

  protected cancelExport(): void {
    this.awaitingConfirmation.set(false);
  }

  protected async confirmExport(result: ReportResult): Promise<void> {
    this.awaitingConfirmation.set(false);
    await this.runExport(result);
  }

  private async runExport(result: ReportResult): Promise<void> {
    if (this.exporting() || !this.canExport()) {
      return;
    }
    this.exporting.set(true);
    try {
      const file = await firstValueFrom(
        this.repository.export(result.definition.id, this.filter(), 'csv'),
      );
      // Reported by name, so an officer knows which file landed and under which
      // filter — the manifest inside says the rest.
      this.notifications.success(this.copy.exported, file.filename);
    } catch {
      this.notifications.error(this.copy.exportFailed);
    } finally {
      this.exporting.set(false);
    }
  }
}
