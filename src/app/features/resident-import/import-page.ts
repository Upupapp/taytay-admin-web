import { formatDate } from '@angular/common';
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

import {
  asId,
  commitBlockers,
  IMPORT_GROUPS,
  IMPORT_STEPS,
  RESIDENT_IMPORT_REPOSITORY,
  type ImportGroup,
  type ImportOutcomeKind,
  type ImportResolution,
  type ImportRow,
  type ImportStep,
  type ResidentImport,
  type ResidentImportId,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ImportMappingForm } from './import-mapping-form';
import { ImportRowFinding } from './import-row-finding';
import { ImportSteps } from './import-steps';
import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

const STEP_NUMBER: Readonly<Record<ImportStep, number>> = { map: 2, check: 3, confirm: 4, done: 5 };
const OUTCOMES: readonly ImportOutcomeKind[] = ['created', 'attached', 'skipped', 'error'];

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
  imports: [AsyncContent, ImportMappingForm, ImportRowFinding, ImportSteps, PageHeader, RouterLink],
  templateUrl: './import-page.html',
  styleUrl: './resident-import.scss',
})
export class ImportPage {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  /** Bound from the route (`withComponentInputBinding`). */
  readonly importId = input.required<string>();
  readonly step = input<string | undefined>(undefined);

  protected readonly copy = RESIDENT_IMPORT_COPY;
  protected readonly groups = IMPORT_GROUPS;
  protected readonly outcomes = OUTCOMES;

  private readonly generation = signal(0);
  /** The server's latest answer to an act on this import; cleared when the import is read again. */
  private readonly latest = signal<ResidentImport | null>(null);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.importId(), generation: this.generation() }))).pipe(
      tap(() => this.latest.set(null)),
      switchMap(({ id }) => toViewState(this.repository.get(asId<ResidentImportId>(id)))),
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
    return value === null ? '' : formatDate(value, 'd MMM y, h:mm a', this.locale);
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
    this.latest.set(record);
  }

  protected resolve(row: ImportRow, resolution: ImportResolution): void {
    const record = this.record();
    if (record === null) return;
    this.repository
      .resolve(record.id, row.row, resolution)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => this.latest.set(answer),
        error: (failure: unknown) =>
          this.problem.set(this.copy.finding.refused(failureReason(failure) ?? this.copy.noAnswer)),
      });
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
