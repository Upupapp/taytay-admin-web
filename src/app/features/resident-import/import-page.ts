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
  commitBlockers,
  IMPORT_GROUPS,
  IMPORT_STEPS,
  RESIDENT_IMPORT_REPOSITORY,
  type ImportGroup,
  type ImportOutcomeKind,
  type ImportRow,
  type ImportStep,
  type ResidentImport,
  type ResidentImportId,
} from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ImportSteps } from '@shared/imports/import-steps';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { ImportMappingForm } from './import-mapping-form';
import { ImportRowFinding } from './import-row-finding';
import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

const STEP_NUMBER: Readonly<Record<ImportStep, number>> = { map: 2, check: 3, confirm: 4, done: 5 };
const OUTCOMES: readonly ImportOutcomeKind[] = ['created', 'attached', 'skipped', 'error'];

/**
 * The import and its rows, and the registry records its matches are read against: a resident added
 * since the check is a new match (`DL-222`).
 */
export const IMPORT_TOPICS: readonly LiveTopic[] = ['imports', 'residents'];

/**
 * Import citizens, steps 2 to 5 (`DL-214`): match the columns, check the rows, confirm, done. One
 * route with the step in the URL, as intake is (`DL-62`), so a half-checked import is a link and
 * survives a reload: everything decided is on the server, nothing in this page.
 *
 * **What the server answers is what is shown.** Each act answers the import read again under the
 * mapping, and that answer replaces the page's copy; nothing is patched locally. A committed import
 * shows only what became of its rows, whatever step the URL names.
 */
@Component({
  selector: 'app-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollRegion,
    AsyncContent,
    ImportMappingForm,
    ImportRowFinding,
    ImportSteps,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './import-page.html',
  styleUrl: './resident-import.scss',
})
export class ImportPage {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly live = inject(LiveUpdates);

  /** Bound from the route (`withComponentInputBinding`). */
  readonly importId = input.required<string>();
  readonly step = input<string | undefined>(undefined);

  protected readonly copy = RESIDENT_IMPORT_COPY;
  protected readonly groups = IMPORT_GROUPS;
  protected readonly outcomes = OUTCOMES;

  private readonly generation = signal(0);
  /** The server's latest answer to an act on this import; cleared when the import is read again. */
  private readonly latest = signal<ResidentImport | null>(null);
  /**
   * Answers to acts so far, and how many there were when the last read was asked: a re-read asked
   * before an act's answer is older than it and must not replace it (`DL-222`).
   */
  private answers = 0;
  private askedAfter = 0;

  /**
   * A hint reads the import again quietly. A re-read is a read: it resolves, maps and commits
   * nothing, and the mapping form and each row's finding keep what the person has chosen and typed
   * (`DL-222`).
   */
  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.importId(), generation: this.generation() }))).pipe(
      tap(() => this.latest.set(null)),
      switchMap(({ id }) =>
        liveViewState(
          () => {
            this.askedAfter = this.answers;
            return this.repository.get(asId<ResidentImportId>(id));
          },
          this.live.changes(IMPORT_TOPICS),
          this.live,
        ).pipe(
          tap((state) => {
            if (state.kind === 'ready' && this.askedAfter === this.answers) this.latest.set(null);
          }),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<ResidentImport | null> },
  );

  protected readonly record = computed(() => this.latest() ?? valueOf(this.state()) ?? null);

  protected readonly current = computed<ImportStep>(() => {
    const record = this.record();
    if (record?.status === 'committed') return 'done';
    const asked = IMPORT_STEPS.find((candidate) => candidate === this.step());
    return asked === undefined || asked === 'done' ? 'map' : asked;
  });

  protected readonly stepNumber = computed(() => STEP_NUMBER[this.current()]);
  protected readonly tab = signal<ImportGroup>('match');
  protected readonly committing = signal(false);
  protected readonly problem = signal('');

  protected readonly blockers = computed(() => {
    const record = this.record();
    return record === null ? [] : commitBlockers(record);
  });

  /** The server's words for each field, for a row's cells. */
  protected readonly fieldLabels = computed<Readonly<Record<string, string>>>(() =>
    Object.fromEntries((this.record()?.fields ?? []).map((spec) => [spec.field, spec.label])),
  );

  protected rowsOf(record: ResidentImport, group: ImportGroup): readonly ImportRow[] {
    return record.groups[group];
  }

  protected labelOf(record: ResidentImport, field: string): string {
    return record.fields.find((spec) => spec.field === field)?.label ?? field;
  }

  protected outcomeCount(record: ResidentImport, kind: ImportOutcomeKind): number {
    return record.outcomes.filter((outcome) => outcome.outcome === kind).length;
  }

  protected when(value: string | null): string {
    return value === null ? '' : (formatDisplayDate(value, 'date-time', this.locale) ?? '');
  }

  protected goTo(step: ImportStep): void {
    this.problem.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { step } });
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** The mapping form saved: its answer is the import read again under the new mapping. */
  protected mapped(record: ResidentImport): void {
    this.answer(record);
  }

  /** A row's finding was kept: the server's answer is the import read again (`DL-260`). */
  protected resolved(answer: ResidentImport): void {
    this.answer(answer);
  }

  private answer(record: ResidentImport): void {
    this.answers += 1;
    this.latest.set(record);
  }

  protected commit(): void {
    const record = this.record();
    if (record === null || this.committing() || this.blockers().length > 0) return;
    this.committing.set(true);
    this.problem.set('');
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
          this.problem.set(this.copy.confirm.refused(failureReason(failure) ?? this.copy.noAnswer));
          // A record added since the check is a new match: read the rows again to show it.
          this.retry();
        },
      });
  }
}
