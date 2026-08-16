import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  REPORT_AREA_LABELS,
  REPORT_REPOSITORY,
  type ReportArea,
  type ReportDefinition,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { REPORTS_COPY } from './reports.copy';

/**
 * The reports hub.
 *
 * The catalogue is data (`REPORT_CATALOGUE`), so this screen renders whatever
 * it is handed and branches on no report id — the same rule the programme
 * screens follow (`DL-66`). Adding a report is a record and a producer, never
 * a new `@if` here.
 *
 * Each card states the **question** the report answers rather than only its
 * title, and the one report that names people says so on its card, before it is
 * opened rather than after.
 */
@Component({
  selector: 'app-report-hub-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink],
  templateUrl: './report-hub-page.html',
  styleUrl: './report-hub-page.scss',
})
export class ReportHubPage {
  private readonly repository = inject(REPORT_REPOSITORY);

  protected readonly copy = REPORTS_COPY.hub;

  protected readonly state = toSignal(toViewState(this.repository.catalogue()), {
    initialValue: LOADING as ViewState<readonly ReportDefinition[]>,
  });

  private readonly reports = computed<readonly ReportDefinition[]>(
    () => valueOf(this.state()) ?? [],
  );

  protected readonly hasAny = computed(() => this.reports().length > 0);

  /** Only areas that actually hold a report this account may open. */
  protected readonly areas = computed(() =>
    (Object.keys(REPORT_AREA_LABELS) as ReportArea[])
      .map((area) => ({
        area,
        label: REPORT_AREA_LABELS[area],
        reports: this.reports().filter((report) => report.area === area),
      }))
      .filter((group) => group.reports.length > 0),
  );
}
