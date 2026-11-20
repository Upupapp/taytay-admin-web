import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CIVIL_STATUS_LABELS,
  CIVIL_STATUSES,
  DUPLICATE_STRENGTH_LABELS,
  IMPORT_REASON_MAX_LENGTH,
  MATCH_ATTRIBUTE_LABELS,
  MATCH_OUTCOME_LABELS,
  SEX_LABELS,
  SEXES,
  type AssistanceImportAction,
  type AssistanceImportCandidate,
  type AssistanceImportCreateRecord,
  type AssistanceImportResolution,
  type AssistanceImportRow,
  type CivilStatus,
  type MatchSignal,
  type ResidentId,
  type Sex,
} from '@domain/index';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';

/** What the officer types for a create, before it is trimmed into a record. */
interface CreateDraft {
  readonly sex: Sex | '';
  readonly birthDate: string;
  readonly civilStatus: CivilStatus | '';
  readonly streetAddress: string;
  readonly purokOrSitio: string;
}

const EMPTY_DRAFT: CreateDraft = {
  sex: '',
  birthDate: '',
  civilStatus: '',
  streetAddress: '',
  purokOrSitio: '',
};

/**
 * One row of a past-assistance report, and the finding a person records on it (`DL-228`), in the
 * duplicate review's pattern (`DL-73`, `DL-74`): the row's cells, the record proposed or linked,
 * the records it resembles — a masked label, a band and each signal in words, never a value — then a
 * choice — link it to one of them, make a record from it, or skip it — then a reason, then the
 * button. Nothing is chosen for the person, and nothing is merged.
 */
@Component({
  selector: 'app-assistance-import-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './assistance-import-row.html',
})
export class AssistanceImportRowFinding {
  readonly row = input.required<AssistanceImportRow>();
  /** The labels of the row's cells, in the server's words. */
  readonly labels = input.required<Readonly<Record<string, string>>>();
  readonly resolved = output<AssistanceImportResolution>();

  protected readonly copy = ASSISTANCE_IMPORT_COPY.finding;
  protected readonly review = ASSISTANCE_IMPORT_COPY.review;
  protected readonly unknownPerson = ASSISTANCE_IMPORT_COPY.unknownPerson;
  protected readonly maxLength = IMPORT_REASON_MAX_LENGTH;
  protected readonly sexes = SEXES;
  protected readonly sexLabels = SEX_LABELS;
  protected readonly civilStatuses = CIVIL_STATUSES;
  protected readonly civilLabels = CIVIL_STATUS_LABELS;

  protected readonly editing = signal(false);
  protected readonly action = signal<AssistanceImportAction | null>(null);
  protected readonly residentId = signal<ResidentId | null>(null);
  protected readonly reason = signal('');
  protected readonly draft = signal<CreateDraft>(EMPTY_DRAFT);
  protected readonly problem = signal('');

  /**
   * A row waiting for review is open; a ready or skipped row opens on "Decide again". A live re-read
   * that brings somebody else's finding does not close a finding this person has started (`DL-222`).
   */
  protected readonly open = computed(
    () =>
      this.row().group === 'needs-review' ||
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

  protected strength(candidate: AssistanceImportCandidate): string {
    return DUPLICATE_STRENGTH_LABELS[candidate.strength];
  }

  protected signalText(signal: MatchSignal): string {
    return this.review.signal(
      MATCH_ATTRIBUTE_LABELS[signal.attribute],
      MATCH_OUTCOME_LABELS[signal.outcome],
      signal.rule,
    );
  }

  protected actionLabel(action: AssistanceImportAction): string {
    return this.copy.actions[action];
  }

  protected choose(action: AssistanceImportAction, residentId: ResidentId | null = null): void {
    this.action.set(action);
    this.residentId.set(residentId);
    this.problem.set('');
  }

  protected typed(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected typedField(key: 'birthDate' | 'streetAddress' | 'purokOrSitio', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected chooseSex(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.draft.update((draft) => ({
      ...draft,
      sex: SEXES.find((sex) => sex === value) ?? '',
    }));
  }

  protected chooseCivilStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.draft.update((draft) => ({
      ...draft,
      civilStatus: CIVIL_STATUSES.find((status) => status === value) ?? '',
    }));
  }

  private record(): AssistanceImportCreateRecord {
    const draft = this.draft();
    const birthDate = draft.birthDate.trim();
    const streetAddress = draft.streetAddress.trim();
    const purokOrSitio = draft.purokOrSitio.trim();
    return {
      ...(draft.sex === '' ? {} : { sex: draft.sex }),
      ...(birthDate === '' ? {} : { birthDate }),
      ...(draft.civilStatus === '' ? {} : { civilStatus: draft.civilStatus }),
      ...(streetAddress === '' ? {} : { streetAddress }),
      ...(purokOrSitio === '' ? {} : { purokOrSitio }),
    };
  }

  protected submit(): void {
    const action = this.action();
    const reason = this.reason().trim();
    const residentId = this.residentId();
    if (action === null || (action === 'link' && residentId === null)) {
      this.problem.set(this.copy.chooseAction);
      return;
    }
    if (reason === '') {
      this.problem.set(this.copy.reasonMissing);
      return;
    }
    const resolution: AssistanceImportResolution =
      action === 'link' && residentId !== null
        ? { action, residentId, reason }
        : action === 'create'
          ? { action, record: this.record(), reason }
          : { action: 'skip', reason };
    this.resolved.emit(resolution);
    this.editing.set(false);
    this.reason.set('');
    this.action.set(null);
    this.residentId.set(null);
    this.draft.set(EMPTY_DRAFT);
  }
}
