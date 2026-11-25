import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  barangayName,
  IMPORT_REASON_MAX_LENGTH,
  RESIDENT_IMPORT_REPOSITORY,
  type BarangayId,
  type ImportAction,
  type ImportResolution,
  type ImportRow,
  type ResidentId,
  type ResidentImport,
  type ResidentImportId,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';

import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

/**
 * One match or repeat, and the finding a person records on it (`DL-214`), in the beneficiaries'
 * duplicate-review pattern (`DL-74`): the row beside the registry records it resembles, then a
 * choice — a different person, the same person as one named record, or not to be imported — then
 * a reason, then the button. Nothing is merged; nothing is chosen for the person.
 *
 * A repeat within the file has no registry record to be, so it is offered only "different person"
 * or "do not import".
 */
@Component({
  selector: 'app-import-row-finding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './import-row-finding.html',
})
export class ImportRowFinding {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly importId = input.required<ResidentImportId>();
  readonly row = input.required<ImportRow>();
  /** The labels of the row's cells, in the server's words. */
  readonly labels = input.required<Readonly<Record<string, string>>>();
  /** The import as the server answered the finding: the page shows it whole. */
  readonly answered = output<ResidentImport>();

  protected readonly copy = RESIDENT_IMPORT_COPY.finding;
  protected readonly check = RESIDENT_IMPORT_COPY.check;
  protected readonly maxLength = IMPORT_REASON_MAX_LENGTH;

  protected readonly editing = signal(false);
  protected readonly action = signal<ImportAction | null>(null);
  protected readonly residentId = signal<ResidentId | null>(null);
  protected readonly reason = signal('');
  protected readonly problem = signal('');
  /**
   * While the finding is on its way. The choice and the reason stay on the row until the server
   * has kept them, and a refusal is said on the row it is about (`DL-260`): clearing them on the
   * click lost the reason whenever the server refused, and the refusal appeared at the top of a
   * long page, away from the row.
   */
  protected readonly saving = signal(false);

  /**
   * A live re-read that brings somebody else's finding on this row does not close a finding this
   * person has started: their choice and reason stay in front of them (`DL-222`).
   */
  protected readonly open = computed(
    () =>
      this.row().resolution === null ||
      this.editing() ||
      this.action() !== null ||
      this.reason() !== '',
  );
  protected readonly cells = computed(() =>
    Object.entries(this.row().values ?? {}).map(([field, value]) => ({
      field,
      label: this.labels()[field] ?? field,
      value,
    })),
  );

  protected barangay(id: BarangayId | null): string {
    return id === null ? '' : barangayName(id);
  }

  protected actionLabel(action: ImportAction): string {
    return this.copy.actions[action];
  }

  protected choose(action: ImportAction, residentId: ResidentId | null = null): void {
    this.action.set(action);
    this.residentId.set(residentId);
    this.problem.set('');
  }

  protected typed(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  private resolution(action: ImportAction, reason: string): ImportResolution {
    const residentId = this.residentId();
    if (action === 'same-person' && residentId !== null) return { action, residentId, reason };
    return action === 'create' ? { action, reason } : { action: 'skip', reason };
  }

  protected submit(): void {
    const action = this.action();
    const reason = this.reason().trim();
    if (action === null) {
      this.problem.set(this.copy.legend);
      return;
    }
    if (action === 'same-person' && this.residentId() === null) {
      this.problem.set(this.copy.chooseRecord);
      return;
    }
    if (reason === '') {
      this.problem.set(this.copy.reasonMissing);
      return;
    }
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.problem.set('');
    this.repository
      .resolve(this.importId(), this.row().row, this.resolution(action, reason))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => {
          this.saving.set(false);
          this.editing.set(false);
          this.reason.set('');
          this.action.set(null);
          this.answered.emit(answer);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          this.problem.set(
            this.copy.refused(failureReason(failure) ?? RESIDENT_IMPORT_COPY.noAnswer),
          );
        },
      });
  }
}
