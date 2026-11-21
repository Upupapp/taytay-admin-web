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
import { catchError, distinctUntilChanged, firstValueFrom, map, of, switchMap } from 'rxjs';

import { NotConnected } from '@core/access/not-connected';
import { PermissionService } from '@core/access/permission.service';
import { ServedPorts } from '@core/access/served-ports';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  PROGRAM_REPOSITORY,
  REPORT_REPOSITORY,
  SENSITIVE_SECTORS,
  SUMMARY_AGE_GROUPS,
  SUMMARY_SEXES,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  VULNERABILITY_SECTOR_LABELS,
  asId,
  asIsoDate,
  isSummaryEmpty,
  type AssistanceProgram,
  type BarangayId,
  type ProgramId,
  type SummaryAgeGroup,
  type SummaryReport,
  type SummaryReportFilter,
  type SummarySex,
  type SummarySignatory,
  type VulnerabilitySector,
} from '@domain/index';
import { MunicipalSeal } from '@shared/brand/municipal-seal';
import { ObjectUrls } from '@shared/media/object-urls';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { LOADING, ready, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { printSheet } from './print-sheet';
import { SUMMARY_REPORT_COPY } from './summary-report.copy';
import { SummarySectionView } from './summary-section';

type SignatoryRole = 'preparedBy' | 'notedBy' | 'approvedBy';
type Signatures = Readonly<Record<SignatoryRole, { name: string; title: string }>>;
type FilterKey = 'from' | 'to' | 'barangay' | 'program' | 'sex' | 'age' | 'sector';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly SignatoryRole[] = ['preparedBy', 'notedBy', 'approvedBy'];

/** Today in Manila, the API's calendar: the period ends today at the latest. */
function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

/**
 * The summary report, in the office's standard template (`DL-228`; backend ADR 0005, decision 4).
 *
 * **The server counts and words; this page lays out an A4 sheet.** Letterhead, period, the filter
 * in words, the executive summary, sections A to I, signatures and the footer are drawn from one
 * read of `GET office/reports/summary`, and the page adds up nothing (`DL-105`).
 *
 * **Not live, deliberately.** Every read is a run the server audits (`office_report.summary_read`),
 * so a re-read on a change hint would write audit rows nobody asked for; the sheet says when it was
 * generated instead. It is named in `check:live` as a report run.
 *
 * **Print re-reads first.** "Print" asks for the report again with the same filters — a recorded
 * run, and the figures as of the moment the paper is made — then opens the browser's print window,
 * where "Save as PDF" makes the file. No PDF library: the print stylesheet is the layout.
 *
 * **Excel is the server's CSV**, offered only to a holder of `report.export-person-level`, the key
 * every report export takes; the file carries its own conditions (`DL-106`). No spreadsheet
 * dependency.
 *
 * **Signatures are the page's, never the record's.** The three names and positions start from what
 * the server says and can be retyped for the printout; they live in a signal, are never saved or
 * sent, and are gone when the page is left.
 */
@Component({
  selector: 'app-summary-report-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    EmptyState,
    Icon,
    MunicipalSeal,
    NotConnected,
    PageHeader,
    RouterLink,
    SummarySectionView,
  ],
  templateUrl: './summary-report-page.html',
  styleUrl: './summary-report-page.scss',
})
export class SummaryReportPage {
  private readonly repository = inject(REPORT_REPOSITORY);
  private readonly programs = inject(PROGRAM_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  // The filters live in the URL, so a printed sheet can be asked for again by its address.
  readonly from = input<string>();
  readonly to = input<string>();
  readonly barangay = input<string>();
  readonly program = input<string>();
  readonly sex = input<string>();
  readonly age = input<string>();
  readonly sector = input<string>();

  protected readonly copy = SUMMARY_REPORT_COPY;
  protected readonly roles = ROLES;
  protected readonly sexes = SUMMARY_SEXES;
  protected readonly ages = SUMMARY_AGE_GROUPS;
  protected readonly today = manilaToday();

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

  /** The programme filter's list is a panel of its own: without the port, it says so in place. */
  protected readonly servesPrograms = inject(ServedPorts).serves('program');

  /** The programmes to pick from, or `null` when this account cannot read the list. */
  protected readonly programList = toSignal(
    this.servesPrograms && this.permissions.has('program.view')
      ? this.programs.listActive().pipe(
          map((list): readonly AssistanceProgram[] | null => list),
          catchError(() => of(null)),
        )
      : of(null),
    { initialValue: [] as readonly AssistanceProgram[] | null },
  );

  private readonly period = computed(() => {
    const day = (value: string | undefined): string | undefined =>
      value !== undefined && DAY.test(value) && value <= this.today ? value : undefined;
    const from = day(this.from());
    const to = day(this.to());
    return from !== undefined && to !== undefined && from > to
      ? { from: undefined, to: undefined, reversed: true }
      : { from, to, reversed: false };
  });
  protected readonly periodReversed = computed(() => this.period().reversed);

  protected readonly filter = computed<SummaryReportFilter>(() => {
    const { from, to } = this.period();
    const barangay = this.barangays().find((entry) => entry.id === this.barangay());
    const program = this.program();
    const sex = SUMMARY_SEXES.find((value) => value === this.sex());
    const age = SUMMARY_AGE_GROUPS.find((value) => value === this.age());
    const sector = this.sectors().find((entry) => entry.value === this.sector())?.value;
    return {
      ...(from !== undefined ? { from: asIsoDate(from) } : {}),
      ...(to !== undefined ? { to: asIsoDate(to) } : {}),
      ...(barangay !== undefined ? { barangayId: barangay.id } : {}),
      ...(program !== undefined && UUID.test(program)
        ? { programId: asId<ProgramId>(program) }
        : {}),
      ...(sex !== undefined ? { sex } : {}),
      ...(age !== undefined ? { age } : {}),
      ...(sector !== undefined ? { sector } : {}),
    };
  });

  protected readonly hasFilters = computed(() => Object.keys(this.filter()).length > 0);

  protected readonly state = toSignal(
    toObservable(this.filter).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((filter) => toViewState(this.repository.summary(filter))),
    ),
    { initialValue: LOADING as ViewState<SummaryReport> },
  );

  /** The report as re-read for printing; gone when the filter changes. */
  private readonly reprinted = linkedSignal<SummaryReportFilter, SummaryReport | null>({
    source: this.filter,
    computation: () => null,
  });

  protected readonly sheetState = computed<ViewState<SummaryReport>>(() => {
    const fresh = this.reprinted();
    return fresh === null ? this.state() : ready(fresh);
  });

  private readonly report = computed(() => {
    const state = this.sheetState();
    return state.kind === 'ready' ? state.value : null;
  });

  /* ── Signatures: held here, never saved or sent ───────────────────────── */

  protected readonly signatures = linkedSignal<
    SummaryReport | null,
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
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value === '' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected sexLabel(sex: SummarySex): string {
    return this.copy.sexLabels[sex];
  }

  protected ageLabel(age: SummaryAgeGroup): string {
    return this.copy.ageLabels[age];
  }

  protected isBarangaySelected(id: BarangayId): boolean {
    return this.filter().barangayId === id;
  }

  protected isSectorSelected(sector: VulnerabilitySector): boolean {
    return this.filter().sector === sector;
  }

  protected isEmpty(report: SummaryReport): boolean {
    return isSummaryEmpty(report);
  }

  protected generatedLine(report: SummaryReport): string {
    return this.copy.generated(
      formatDisplayDate(report.footer.generatedAt, 'date-time') ?? report.footer.generatedAt,
      report.footer.generatedBy,
    );
  }

  /* ── Print ────────────────────────────────────────────────────────────── */

  protected readonly printing = signal(false);

  /**
   * Re-reads the report with the same filters — a run the server records — and prints the sheet
   * as it now stands. A failed re-read prints nothing: paper with figures nobody re-checked is the
   * one copy that cannot be corrected later.
   */
  protected async print(): Promise<void> {
    if (this.printing()) {
      return;
    }
    this.printing.set(true);
    try {
      const fresh = await firstValueFrom(this.repository.summary(this.filter()));
      this.reprinted.set(fresh);
      afterNextRender(
        () => printSheet(this.document, this.copy.pdfName(fresh.period.from, fresh.period.to)),
        { injector: this.injector },
      );
    } catch {
      this.notifications.error(this.copy.printFailed);
    } finally {
      this.printing.set(false);
    }
  }

  /* ── Excel (the server's CSV) ─────────────────────────────────────────── */

  protected readonly canExport = computed(() => this.permissions.has('report.export-person-level'));
  protected readonly exporting = signal(false);
  private readonly objectUrls = new ObjectUrls();
  protected readonly fileReady = linkedSignal<
    SummaryReportFilter,
    { url: string; filename: string } | null
  >({ source: this.filter, computation: () => null });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrls.revokeAll());
  }

  protected async exportCsv(): Promise<void> {
    if (this.exporting() || !this.canExport()) {
      return;
    }
    this.exporting.set(true);
    try {
      const file = await firstValueFrom(this.repository.exportSummary(this.filter()));
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

function signaturesFrom(report: SummaryReport | null): Signatures {
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
