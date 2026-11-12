import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  barangayName,
  IMPORT_REASON_MAX_LENGTH,
  type BarangayId,
  type ImportAction,
  type ImportResolution,
  type ImportRow,
  type ResidentId,
} from '@domain/index';

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
  readonly row = input.required<ImportRow>();
  /** The labels of the row's cells, in the server's words. */
  readonly labels = input.required<Readonly<Record<string, string>>>();
  readonly resolved = output<ImportResolution>();

  protected readonly copy = RESIDENT_IMPORT_COPY.finding;
  protected readonly check = RESIDENT_IMPORT_COPY.check;
  protected readonly maxLength = IMPORT_REASON_MAX_LENGTH;

  protected readonly editing = signal(false);
  protected readonly action = signal<ImportAction | null>(null);
  protected readonly residentId = signal<ResidentId | null>(null);
  protected readonly reason = signal('');
  protected readonly problem = signal('');

  protected readonly open = computed(() => this.row().resolution === null || this.editing());
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
    this.resolved.emit(this.resolution(action, reason));
    this.editing.set(false);
    this.reason.set('');
    this.action.set(null);
  }
}
