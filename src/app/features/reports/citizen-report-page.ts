import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  REPORT_REPOSITORY,
  RESIDENT_AGE_GROUPS,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_SUMMARY_PERIODS,
  SENSITIVE_SECTORS,
  SEXES,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  VULNERABILITY_SECTOR_LABELS,
  isCitizenReportEmpty,
  type CitizenReport,
  type CitizenReportFilter,
  type CitizenReportSectionKey,
  type SummarySignatory,
} from '@domain/index';
import { MunicipalSeal } from '@shared/brand/municipal-seal';
import { ObjectUrls } from '@shared/media/object-urls';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { LOADING, ready, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { CITIZEN_REPORT_COPY } from './citizen-report.copy';
import { printSheet } from './print-sheet';
import type { SheetChartKind } from './sheet-chart';
import { SummarySectionView } from './summary-section';

type SignatoryRole = 'preparedBy' | 'notedBy' | 'approvedBy';
type Signatures = Readonly<Record<SignatoryRole, { name: string; title: string }>>;
type FilterKey = 'barangay' | 'sector' | 'ageGroup' | 'sex' | 'period';

const ROLES: readonly SignatoryRole[] = ['preparedBy', 'notedBy', 'approvedBy'];

/** The sections drawn as something other than bars: the twelve months, the pyramid, the funnel. */
const CHARTS: Readonly<Partial<Record<CitizenReportSectionKey, SheetChartKind>>> = {
  'registry-by-month': 'line',
  'by-age-sex': 'pyramid',
  'registry-to-id': 'funnel',
};

/**
 * The citizen registry report (`DL-234`; backend ADR 0007): the Citizen overview's figures on the
 * summary report's A4 sheet (`DL-228`) — letterhead, period, the filter in words, the executive
 * summary, sections A to G each with a chart and its table, signatures and the footer — from one
 * read of `GET office/reports/citizens`. The page adds up nothing (`DL-105`).
 *
 * **Not live, deliberately**, like the summary report: every read is a run the server audits
 * (`office_report.citizens_read`), so a re-read on a change hint would write audit rows nobody
 * asked for. The sheet says when it was generated, and "Download PDF" re-reads before it prints.
 *
 * **The PDF is the browser's print** of the A4 stylesheet, with the report's name as the file's.
 * **The CSV is the server's**, offered to a holder of `report.export-person-level` (`DL-106`).
 * **Signatures are the page's**: retyped for the printout, never saved or sent.
 */
@Component({
  selector: 'app-citizen-report-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    EmptyState,
    Icon,
    MunicipalSeal,
    PageHeader,
    RouterLink,
    SummarySectionView,
  ],
  templateUrl: './citizen-report-page.html',
  // The same sheet as the summary report's, so the two print alike.
  styleUrl: './summary-report-page.scss',
})
export class CitizenReportPage {
  private readonly repository = inject(REPORT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  // The filters live in the URL, by the Citizen overview's own names, so its link carries them.
  readonly barangay = input<string>();
  readonly sector = input<string>();
  readonly ageGroup = input<string>();
  readonly sex = input<string>();
  readonly period = input<string>();

  protected readonly copy = CITIZEN_REPORT_COPY;
  protected readonly roles = ROLES;
  protected readonly sexes = SEXES;
  protected readonly ages = RESIDENT_AGE_GROUPS;
  protected readonly periods = RESIDENT_SUMMARY_PERIODS;
  protected readonly ageLabels = RESIDENT_AGE_GROUP_LABELS;

  /** Only the barangays this account may narrow to: a barangay link sees its own. */
  protected readonly barangays = computed(() => {
    const bound = this.permissions.boundBarangayId();
    return bound === null
      ? TAYTAY_BARANGAYS
      : TAYTAY_BARANGAYS.filter((barangay) => barangay.id === bound);
  });

  /** A protected sector is offered only to a reader the API would count it for. */
  protected readonly sectors = computed(() => {
    const cleared = this.permissions.has('request.view-sensitive');
    return VULNERABILITY_SECTORS.filter(
      (sector) => cleared || !SENSITIVE_SECTORS.includes(sector),
    ).map((sector) => ({ value: sector, label: VULNERABILITY_SECTOR_LABELS[sector] }));
  });

  protected readonly filter = computed<CitizenReportFilter>(() => {
    const barangay = this.barangays().find((entry) => entry.id === this.barangay());
    const sector = this.sectors().find((entry) => entry.value === this.sector())?.value;
    const ageGroup = RESIDENT_AGE_GROUPS.find((value) => value === this.ageGroup());
    const sex = SEXES.find((value) => value === this.sex());
    const period = RESIDENT_SUMMARY_PERIODS.find((value) => value === this.period());
    return {
      ...(barangay !== undefined ? { barangayId: barangay.id } : {}),
      ...(sector !== undefined ? { sector } : {}),
      ...(ageGroup !== undefined ? { ageGroup } : {}),
      ...(sex !== undefined ? { sex } : {}),
      ...(period !== undefined ? { period } : {}),
    };
  });

  /** The period is not a narrowing: clearing the filters keeps it. */
  protected readonly hasFilters = computed(
    () => Object.keys(this.filter()).filter((key) => key !== 'period').length > 0,
  );

  /** The year to date is the API's default for this report. */
  protected readonly selectedPeriod = computed(() => this.filter().period ?? 'year');

  protected readonly state = toSignal(
    toObservable(this.filter).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((filter) => toViewState(this.repository.citizens(filter))),
    ),
    { initialValue: LOADING as ViewState<CitizenReport> },
  );

  /**
   * Whether the sheet on screen is the one the filter asks for. Download PDF and CSV wait for it,
   * so neither can be pressed over figures still loading for a filter just changed (DL-247).
   */
  protected readonly settled = computed(() => this.state().kind === 'ready');

  /** Whether `asked` is still the filter on screen: an answer for an earlier one is dropped. */
  private stillAsked(asked: CitizenReportFilter): boolean {
    return JSON.stringify(this.filter()) === JSON.stringify(asked);
  }

  /** The report as re-read for printing; gone when the filter changes. */
  private readonly reprinted = linkedSignal<CitizenReportFilter, CitizenReport | null>({
    source: this.filter,
    computation: () => null,
  });

  protected readonly sheetState = computed<ViewState<CitizenReport>>(() => {
    const fresh = this.reprinted();
    return fresh === null ? this.state() : ready(fresh);
  });

  private readonly report = computed(() => {
    const state = this.sheetState();
    return state.kind === 'ready' ? state.value : null;
  });

  protected chartOf(key: CitizenReportSectionKey): SheetChartKind | null {
    return CHARTS[key] ?? null;
  }

  /* ── Signatures: held here, never saved or sent ───────────────────────── */

  protected readonly signatures = linkedSignal<
    CitizenReport | null,
    { readonly edited: boolean; readonly lines: Signatures }
  >({
    source: this.report,
    computation: (report, previous) =>
      previous !== undefined && previous.value.edited
        ? previous.value
        : { edited: false, lines: signaturesFrom(report) },
  });

  protected roleLabel(role: SignatoryRole): string {
    return this.copy[role];
  }

  protected editSignature(role: SignatoryRole, part: 'name' | 'title', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.signatures.update((current) => ({
      edited: true,
      lines: { ...current.lines, [role]: { ...current.lines[role], [part]: value } },
    }));
  }

  /* ── Filters ──────────────────────────────────────────────────────────── */

  protected setFilter(key: FilterKey, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value === '' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    const period = this.filter().period;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: period === undefined ? {} : { period },
      replaceUrl: true,
    });
  }

  protected isEmpty(report: CitizenReport): boolean {
    return isCitizenReportEmpty(report);
  }

  protected generatedLine(report: CitizenReport): string {
    return this.copy.generated(
      formatDisplayDate(report.footer.generatedAt, 'manila-date-time') ?? report.footer.generatedAt,
      report.footer.generatedBy,
    );
  }

  /* ── Download PDF ─────────────────────────────────────────────────────── */

  protected readonly printing = signal(false);

  /**
   * Re-reads the report with the same filters — a run the server records — and opens the print
   * window on the sheet as it now stands. A failed re-read prints nothing: paper with figures nobody
   * re-checked is the one copy that cannot be corrected later.
   */
  protected async print(): Promise<void> {
    if (this.printing() || !this.settled()) {
      return;
    }
    this.printing.set(true);
    const asked = this.filter();
    try {
      const fresh = await firstValueFrom(this.repository.citizens(asked));
      if (!this.stillAsked(asked)) {
        // The filter changed during the re-read: the old filter's sheet is not printed under the new one.
        return;
      }
      this.reprinted.set(fresh);
      afterNextRender(() => printSheet(this.document, this.copy.pdfName(fresh.period.to)), {
        injector: this.injector,
      });
    } catch {
      this.notifications.error(this.copy.printFailed);
    } finally {
      this.printing.set(false);
    }
  }

  /* ── Download CSV (the server's) ──────────────────────────────────────── */

  protected readonly canExport = computed(() => this.permissions.has('report.export-person-level'));
  protected readonly exporting = signal(false);
  private readonly objectUrls = new ObjectUrls();
  protected readonly fileReady = linkedSignal<
    CitizenReportFilter,
    { url: string; filename: string } | null
  >({ source: this.filter, computation: () => null });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrls.revokeAll());
  }

  protected async exportCsv(): Promise<void> {
    if (this.exporting() || !this.canExport() || !this.settled()) {
      return;
    }
    this.exporting.set(true);
    const asked = this.filter();
    try {
      const file = await firstValueFrom(this.repository.exportCitizens(asked));
      if (!this.stillAsked(asked)) {
        // A file for a filter no longer on screen is not offered under it.
        return;
      }
      // The server's text, byte for byte: the page adds nothing to the file.
      this.objectUrls.revokeAll();
      this.fileReady.set({
        url: this.objectUrls.makeText(file.content, 'text/csv;charset=utf-8'),
        filename: file.filename,
      });
      this.notifications.success(this.copy.exported, file.filename);
    } catch {
      this.notifications.error(this.copy.exportFailed);
    } finally {
      this.exporting.set(false);
    }
  }
}

function signaturesFrom(report: CitizenReport | null): Signatures {
  const line = (signatory: SummarySignatory | undefined) => ({
    name: signatory?.name ?? '',
    title: signatory?.title ?? '',
  });
  return {
    preparedBy: line(report?.signatories.preparedBy),
    notedBy: line(report?.signatories.notedBy),
    approvedBy: line(report?.signatories.approvedBy),
  };
}
