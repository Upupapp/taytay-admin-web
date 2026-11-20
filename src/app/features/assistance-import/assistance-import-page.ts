import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  asId,
  ASSISTANCE_IMPORT_GROUPS,
  ASSISTANCE_IMPORT_REPOSITORY,
  ASSISTANCE_IMPORT_STEPS,
  assistanceImportBlockers,
  canWithdrawAssistanceImport,
  type AssistanceImport,
  type AssistanceImportGroup,
  type AssistanceImportId,
  type AssistanceImportResolution,
  type AssistanceImportRow,
  type AssistanceImportStep,
} from '@domain/index';
import { ImportSteps } from '@shared/imports/import-steps';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';
import { AssistanceImportMappingForm } from './assistance-import-mapping-form';
import { refusalLines } from './assistance-import-refusal';
import { AssistanceImportRowFinding } from './assistance-import-row';
import { AssistanceImportWithdraw } from './assistance-import-withdraw';

const STEP_NUMBER: Readonly<Record<AssistanceImportStep, number>> = {
  map: 2,
  review: 3,
  commit: 4,
  done: 5,
};

const RESULT_TALLY = ['imported', 'skipped', 'duplicates', 'errors', 'residentsCreated'] as const;

/**
 * The import and its rows, and the registry records its matches are read against: a resident added
 * since the check may be a new candidate (`DL-222`).
 */
export const ASSISTANCE_IMPORT_TOPICS: readonly LiveTopic[] = ['imports', 'residents'];

/**
 * Import past assistance, steps 2 to 5 (`DL-228`): match the columns, review the rows, commit, and
 * the result. One route with the step in the URL, as the citizen import is (`DL-214`, `DL-62`), so
 * a half-reviewed import is a link and survives a reload: everything decided is on the server.
 *
 * **What the server answers is what is shown.** Each act answers the import read again, and that
 * answer replaces the page's copy; nothing is patched locally. An import that is no longer open
 * shows only its result — and, once withdrawn, who withdrew it, when and why — whatever step the URL
 * names.
 */
@Component({
  selector: 'app-assistance-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistanceImportMappingForm,
    AssistanceImportRowFinding,
    AssistanceImportWithdraw,
    AsyncContent,
    ImportSteps,
    PageHeader,
    RouterLink,
    ScrollRegion,
  ],
  templateUrl: './assistance-import-page.html',
  styleUrl: './assistance-import.scss',
})
export class AssistanceImportPage {
  private readonly repository = inject(ASSISTANCE_IMPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly live = inject(LiveUpdates);

  /** Bound from the route (`withComponentInputBinding`). */
  readonly importId = input.required<string>();
  readonly step = input<string | undefined>(undefined);

  protected readonly copy = ASSISTANCE_IMPORT_COPY;
  protected readonly groups = ASSISTANCE_IMPORT_GROUPS;
  protected readonly tally = RESULT_TALLY;
  protected readonly canWithdraw = canWithdrawAssistanceImport;

  private readonly generation = signal(0);
  /** The server's latest answer to an act on this import; cleared when the import is read again. */
  private readonly latest = signal<AssistanceImport | null>(null);
  /**
   * Answers to acts so far, and how many there were when the last read was asked: a re-read asked
   * before an act's answer is older than it and must not replace it (`DL-222`).
   */
  private answers = 0;
  private askedAfter = 0;

  /**
   * A hint reads the import again quietly. A re-read is a read: it resolves, maps and commits
   * nothing, and the mapping form and each row's finding keep what the person has chosen and typed.
   */
  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.importId(), generation: this.generation() }))).pipe(
      tap(() => this.latest.set(null)),
      switchMap(({ id }) =>
        liveViewState(
          () => {
            this.askedAfter = this.answers;
            return this.repository.get(asId<AssistanceImportId>(id));
          },
          this.live.changes(ASSISTANCE_IMPORT_TOPICS),
          this.live,
        ).pipe(
          tap((state) => {
            if (state.kind === 'ready' && this.askedAfter === this.answers) this.latest.set(null);
          }),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<AssistanceImport | null> },
  );

  protected readonly record = computed(() => this.latest() ?? valueOf(this.state()) ?? null);

  protected readonly current = computed<AssistanceImportStep>(() => {
    const record = this.record();
    if (record !== null && record.status !== 'open') return 'done';
    const asked = ASSISTANCE_IMPORT_STEPS.find((candidate) => candidate === this.step());
    return asked === undefined || asked === 'done' ? 'map' : asked;
  });

  protected readonly stepNumber = computed(() => STEP_NUMBER[this.current()]);
  protected readonly tab = signal<AssistanceImportGroup>('needs-review');
  protected readonly committing = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly problem = signal('');
  /** The lines the server gave beside a refusal — what a record would lack, which rows wait. */
  protected readonly problemLines = signal<readonly string[]>([]);

  protected readonly blockers = computed(() => {
    const record = this.record();
    return record === null ? [] : assistanceImportBlockers(record);
  });

  /** The server's words for each field, for a row's cells. */
  protected readonly fieldLabels = computed<Readonly<Record<string, string>>>(() =>
    Object.fromEntries((this.record()?.fields ?? []).map((spec) => [spec.field, spec.label])),
  );

  protected rowsOf(
    record: AssistanceImport,
    group: AssistanceImportGroup,
  ): readonly AssistanceImportRow[] {
    return record.rows.filter((row) => row.group === group);
  }

  protected labelOf(record: AssistanceImport, field: string): string {
    return record.fields.find((spec) => spec.field === field)?.label ?? field;
  }

  protected duplicateText(row: AssistanceImportRow): string {
    const duplicate = row.duplicate;
    if (duplicate === null) return '';
    const reason = this.copy.review.duplicateOf[duplicate.reason];
    if (duplicate.ofRow !== null) return this.copy.review.duplicateRow(reason, duplicate.ofRow);
    if (duplicate.ofRequestReference !== null) {
      return this.copy.review.duplicateRequest(reason, duplicate.ofRequestReference);
    }
    return this.copy.review.duplicateSystem(reason);
  }

  protected when(value: string | null): string {
    return value === null ? '' : (formatDisplayDate(value, 'date-time', this.locale) ?? '');
  }

  protected goTo(step: AssistanceImportStep): void {
    this.refused('', []);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { step } });
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** The mapping form saved: its answer is the import read again under the new mapping. */
  protected mapped(record: AssistanceImport): void {
    this.answer(record);
  }

  protected resolve(row: AssistanceImportRow, resolution: AssistanceImportResolution): void {
    const record = this.record();
    if (record === null) return;
    this.refused('', []);
    this.repository
      .resolve(record.id, row.row, resolution)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => this.answer(answer),
        error: (failure: unknown) =>
          this.refused(
            this.copy.finding.refused(failureReason(failure) ?? this.copy.noAnswer),
            refusalLines(failure),
          ),
      });
  }

  private answer(record: AssistanceImport): void {
    this.answers += 1;
    this.latest.set(record);
  }

  private refused(message: string, lines: readonly string[]): void {
    this.problem.set(message);
    this.problemLines.set(lines);
  }

  protected commit(): void {
    const record = this.record();
    if (record === null || this.committing() || this.blockers().length > 0) return;
    this.committing.set(true);
    this.refused('', []);
    this.repository
      .commit(record.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.committing.set(false);
          // The committed import is read again for its outcomes, row by row.
          this.retry();
          void this.router.navigate([], { relativeTo: this.route, queryParams: { step: 'done' } });
        },
        error: (failure: unknown) => {
          this.committing.set(false);
          this.refused(
            this.copy.commit.refused(failureReason(failure) ?? this.copy.noAnswer),
            refusalLines(failure),
          );
          // A row filed since the check is a new duplicate: read the rows again to show it.
          this.retry();
        },
      });
  }

  /** The withdrawal answered: the import is read again as the server now holds it. */
  protected withdrawn(): void {
    this.withdrawing.set(false);
    this.retry();
  }
}
