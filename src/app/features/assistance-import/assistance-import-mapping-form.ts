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
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ASSISTANCE_IMPORT_REPOSITORY,
  canRemapAssistanceImport,
  type AssistanceImport,
  type AssistanceImportField,
  type AssistanceImportId,
  type AssistanceImportMapping,
  type ImportColumn,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';
import { refusalLines } from './assistance-import-refusal';

/**
 * Step 2 (`DL-228`): which column feeds which field, as the citizen import's (`DL-214`). One select
 * per field, in the server's order and words, the required ones marked. A column chosen for a second
 * field is refused here with a sentence, as the API would refuse it; the whole mapping is sent at
 * once, only by its button. Read-only once a row is decided, and says why.
 */
@Component({
  selector: 'app-assistance-import-mapping-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollRegion],
  templateUrl: './assistance-import-mapping-form.html',
})
export class AssistanceImportMappingForm {
  private readonly repository = inject(ASSISTANCE_IMPORT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly record = input.required<AssistanceImport>();
  readonly saved = output<AssistanceImport>();

  protected readonly copy = ASSISTANCE_IMPORT_COPY.map;
  protected readonly noAnswer = ASSISTANCE_IMPORT_COPY.noAnswer;

  protected readonly draft = signal<AssistanceImportMapping>({});
  protected readonly saving = signal(false);
  protected readonly problem = signal('');
  protected readonly outcome = signal('');
  /** Nothing chosen since the form was last seeded, so the server's mapping may seed it again. */
  private readonly pristine = signal(true);
  private seededFor: AssistanceImportId | null = null;

  protected readonly locked = computed(() => !canRemapAssistanceImport(this.record()));
  protected readonly missing = computed(() =>
    this.record()
      .missingFields.map((field) => this.labelOf(field))
      .join(', '),
  );

  constructor() {
    // The server's mapping seeds the form, and its answer after a save re-seeds it. A live re-read
    // of the same import re-seeds it only while nothing is chosen and unsaved (`DL-222`).
    effect(() => {
      const record = this.record();
      if (record.id !== this.seededFor || untracked(this.pristine)) {
        this.seededFor = record.id;
        this.pristine.set(true);
        this.draft.set(record.mapping);
      }
    });
  }

  /** The server's words; a whole name missing is said as the choice it is. */
  protected labelOf(field: AssistanceImportField): string {
    const spec = this.record().fields.find((candidate) => candidate.field === field);
    if (spec !== undefined) return spec.label;
    return field === 'fullName' ? this.copy.nameField : field;
  }

  protected optionLabel(column: ImportColumn): string {
    return this.copy.columnOption(column.header, column.samples.join(', '));
  }

  protected columnOf(field: AssistanceImportField): number | null {
    return this.draft()[field] ?? null;
  }

  protected choose(field: AssistanceImportField, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const column = select.value === '' ? null : Number(select.value);
    this.outcome.set('');
    const taken =
      column === null
        ? undefined
        : this.record().fields.find(
            (spec) => spec.field !== field && this.draft()[spec.field] === column,
          );
    if (taken !== undefined) {
      this.problem.set(this.copy.taken(taken.label));
      select.value = String(this.columnOf(field) ?? '');
      return;
    }
    this.problem.set('');
    this.pristine.set(false);
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
          this.pristine.set(true);
          this.saved.emit(answer);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          this.problem.set(
            [failureReason(failure) ?? this.noAnswer, ...refusalLines(failure)].join(' '),
          );
        },
      });
  }
}
