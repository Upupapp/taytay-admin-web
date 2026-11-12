import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  canRemap,
  RESIDENT_IMPORT_REPOSITORY,
  type ImportColumn,
  type ImportField,
  type ImportMapping,
  type ResidentImport,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';

import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

/**
 * Step 2 (`DL-214`): which column feeds which registry field. One select per field, in the server's
 * order and words, the required ones marked. A column chosen for a second field is refused here with
 * a sentence, as the API would refuse it; the whole mapping is sent at once, only by its button.
 *
 * Once any row has been resolved the mapping is read-only, and says why: the API refuses a new one,
 * because it would change what was decided about those rows.
 */
@Component({
  selector: 'app-import-mapping-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-mapping-form.html',
})
export class ImportMappingForm {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly record = input.required<ResidentImport>();
  readonly saved = output<ResidentImport>();

  protected readonly copy = RESIDENT_IMPORT_COPY.map;
  protected readonly noAnswer = RESIDENT_IMPORT_COPY.noAnswer;

  protected readonly draft = signal<ImportMapping>({});
  protected readonly saving = signal(false);
  protected readonly problem = signal('');
  protected readonly outcome = signal('');

  protected readonly locked = computed(() => !canRemap(this.record()));
  protected readonly missing = computed(() =>
    this.record()
      .missingFields.map((field) => this.labelOf(field))
      .join(', '),
  );

  constructor() {
    // The server's mapping seeds the form, and its answer after a save re-seeds it.
    effect(() => this.draft.set(this.record().mapping));
  }

  protected labelOf(field: ImportField): string {
    return this.record().fields.find((spec) => spec.field === field)?.label ?? field;
  }

  protected optionLabel(column: ImportColumn): string {
    return this.copy.columnOption(column.header, column.samples.join(', '));
  }

  protected columnOf(field: ImportField): number | null {
    return this.draft()[field] ?? null;
  }

  protected choose(field: ImportField, event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const column = raw === '' ? null : Number(raw);
    this.outcome.set('');
    const taken =
      column === null
        ? undefined
        : this.record().fields.find(
            (spec) => spec.field !== field && this.draft()[spec.field] === column,
          );
    if (taken !== undefined) {
      this.problem.set(this.copy.taken(taken.label));
      (event.target as HTMLSelectElement).value = String(this.columnOf(field) ?? '');
      return;
    }
    this.problem.set('');
    this.draft.update((mapping) => ({ ...mapping, [field]: column }));
  }

  protected save(): void {
    if (this.saving() || this.locked()) return;
    this.saving.set(true);
    this.problem.set('');
    this.outcome.set('');
    this.repository
      .map(this.record().id, this.draft())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => {
          this.saving.set(false);
          this.outcome.set(this.copy.saved);
          this.saved.emit(answer);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          this.problem.set(failureReason(failure) ?? this.noAnswer);
        },
      });
  }
}
