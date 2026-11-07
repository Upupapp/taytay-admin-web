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
import type { Observable } from 'rxjs';

import {
  catalogueReasonProblem,
  feeEntryText,
  fieldsOf,
  ISSUANCE_REPOSITORY,
  ISSUANCE_TYPE_LIMITS,
  issuanceTypeChanges,
  issuanceTypeProblems,
  officeLabel,
  readFeeEntry,
  suggestRequirementCode,
  UPDATE_EFFECTS,
  type IssuanceType,
  type IssuanceTypeFields,
  type Office,
  type OfficeId,
} from '@domain/index';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { valueOf, type ViewState } from '@shared/state/view-state';

import { ISSUANCE_COPY } from './issuance.copy';

/** One requirement as the form holds it. `key` tracks the row; `codeTyped` stops the suggestion. */
interface RequirementRow {
  readonly key: number;
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly hint: string;
  readonly codeTyped: boolean;
}

type DaysEntry =
  { readonly kind: 'value'; readonly days: number | null } | { readonly kind: 'invalid' };

function readDays(text: string): DaysEntry {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'value', days: null };
  }
  return /^\d{1,3}$/.test(trimmed)
    ? { kind: 'value', days: Number.parseInt(trimmed, 10) }
    : { kind: 'invalid' };
}

function blankToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Adds a document to the office's catalogue, or changes one (`DL-184`).
 *
 * **The fee is typed in pesos and kept in centavos** without floating-point arithmetic
 * (`readFeeEntry`, rule 6), and the form says back what residents will be shown — through
 * `PesoPipe`, at render time — before anything is saved. An empty fee is "not stated", which the
 * resident is told; zero is no fee.
 *
 * **A change sends only what moved** (`issuanceTypeChanges`), with a reason, and a form that changes
 * nothing says so rather than sending a change that records nothing. What saving does — requests
 * already filed keep what they were filed with — is said above the button.
 *
 * **Requirements are an ordered list.** Each is one file the resident sends from the app; its code
 * names that file, and is suggested from the label until somebody types their own.
 */
@Component({
  selector: 'app-issuance-type-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PesoPipe],
  templateUrl: './issuance-type-editor.html',
  styleUrl: './issuance-type-editor.scss',
})
export class IssuanceTypeEditor {
  private readonly repository = inject(ISSUANCE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The type being changed, or `null` to add one. */
  readonly type = input<IssuanceType | null>(null);
  /** The office directory, for an administrator's choice of office. */
  readonly offices = input.required<ViewState<readonly Office[]>>();

  readonly saved = output<IssuanceType>();
  readonly cancelled = output();

  protected readonly copy = ISSUANCE_COPY.catalogue;
  protected readonly limits = ISSUANCE_TYPE_LIMITS;
  protected readonly updateEffects = UPDATE_EFFECTS;

  protected readonly office = signal<OfficeId | null>(null);
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly feeText = signal('');
  protected readonly daysText = signal('');
  protected readonly claimInstructions = signal('');
  protected readonly requirements = signal<readonly RequirementRow[]>([]);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly outcome = signal('');
  private nextKey = 0;

  protected readonly creating = computed(() => this.type() === null);
  protected readonly officeList = computed(() => valueOf(this.offices()) ?? []);

  protected readonly feeEntry = computed(() => readFeeEntry(this.feeText()));
  private readonly daysEntry = computed(() => readDays(this.daysText()));

  /** The form as fields, or `null` while the fee or the days are not readable. */
  private readonly fields = computed<IssuanceTypeFields | null>(() => {
    const fee = this.feeEntry();
    const days = this.daysEntry();
    if (fee.kind === 'invalid' || days.kind === 'invalid') {
      return null;
    }
    return {
      name: this.name().trim(),
      description: blankToNull(this.description()),
      requirements: this.requirements().map((row) => ({
        code: row.code.trim(),
        label: row.label.trim(),
        required: row.required,
        hint: blankToNull(row.hint),
      })),
      fee: fee.kind === 'amount' ? fee.fee : null,
      processingDays: days.days,
      claimInstructions: blankToNull(this.claimInstructions()),
    };
  });

  protected readonly problems = computed<readonly string[]>(() => {
    const fields = this.fields();
    const unreadable = [
      ...(this.feeEntry().kind === 'invalid' ? [this.copy.feeInvalid] : []),
      ...(this.daysEntry().kind === 'invalid' ? [this.copy.daysInvalid] : []),
    ];
    return fields === null ? unreadable : issuanceTypeProblems(fields);
  });

  protected readonly reasonProblem = computed(() => catalogueReasonProblem(this.reason()));

  /** In an edit, `true` when nothing differs from the type as it stands. */
  protected readonly unchanged = computed(() => {
    const type = this.type();
    const fields = this.fields();
    return (
      type !== null && fields !== null && issuanceTypeChanges(fieldsOf(type), fields, '') === null
    );
  });

  protected readonly canSave = computed(
    () =>
      this.fields() !== null &&
      this.problems().length === 0 &&
      this.reasonProblem() === null &&
      !this.unchanged() &&
      !this.busy(),
  );

  constructor() {
    // The form starts from the type it edits, and again whenever another one is opened.
    effect(() => {
      const type = this.type();
      untracked(() => this.fill(type));
    });
  }

  protected officeName(office: Office): string {
    return officeLabel(office);
  }

  protected text(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
      ? target.value
      : '';
  }

  protected onOffice(event: Event): void {
    const value = this.text(event);
    this.office.set(this.officeList().find((office) => office.id === value)?.id ?? null);
  }

  protected addRequirement(): void {
    if (this.requirements().length >= this.limits.requirements) {
      return;
    }
    this.requirements.update((rows) => [
      ...rows,
      { key: this.nextKey++, code: '', label: '', required: true, hint: '', codeTyped: false },
    ]);
  }

  protected removeRequirement(index: number): void {
    this.requirements.update((rows) => rows.filter((_, at) => at !== index));
  }

  protected moveRequirement(index: number, by: -1 | 1): void {
    this.requirements.update((rows) => {
      const target = index + by;
      const moving = rows[index];
      const other = rows[target];
      if (moving === undefined || other === undefined) {
        return rows;
      }
      const next = rows.slice();
      next[index] = other;
      next[target] = moving;
      return next;
    });
  }

  protected onLabel(index: number, event: Event): void {
    const label = this.text(event);
    this.patchRow(index, (row) => ({
      ...row,
      label,
      code: row.codeTyped ? row.code : suggestRequirementCode(label),
    }));
  }

  protected onCode(index: number, event: Event): void {
    const code = this.text(event);
    this.patchRow(index, (row) => ({ ...row, code, codeTyped: code.trim() !== '' }));
  }

  protected onHint(index: number, event: Event): void {
    const hint = this.text(event);
    this.patchRow(index, (row) => ({ ...row, hint }));
  }

  protected onRequired(index: number, event: Event): void {
    const required = event.target instanceof HTMLInputElement && event.target.checked;
    this.patchRow(index, (row) => ({ ...row, required }));
  }

  protected save(): void {
    const fields = this.fields();
    if (fields === null || !this.canSave()) {
      return;
    }
    const type = this.type();
    let call: Observable<IssuanceType>;
    if (type === null) {
      call = this.repository.createType({
        ...fields,
        officeId: this.office(),
        reason: this.reason(),
      });
    } else {
      const changes = issuanceTypeChanges(fieldsOf(type), fields, this.reason());
      if (changes === null) {
        this.outcome.set(this.copy.unchanged);
        return;
      }
      call = this.repository.updateType(type.id, changes);
    }
    this.busy.set(true);
    this.outcome.set('');
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (answered) => {
        this.busy.set(false);
        this.outcome.set(this.copy.saved);
        this.saved.emit(answered);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(this.copy.notSaved(failureReason(failure) ?? this.copy.failed));
      },
    });
  }

  private patchRow(index: number, change: (row: RequirementRow) => RequirementRow): void {
    this.requirements.update((rows) => rows.map((row, at) => (at === index ? change(row) : row)));
  }

  private fill(type: IssuanceType | null): void {
    this.office.set(null);
    this.name.set(type?.name ?? '');
    this.description.set(type?.description ?? '');
    this.feeText.set(feeEntryText(type?.fee ?? null));
    this.daysText.set(
      type?.processingDays === null || type === null ? '' : String(type.processingDays),
    );
    this.claimInstructions.set(type?.claimInstructions ?? '');
    this.requirements.set(
      (type?.requirements ?? []).map((requirement) => ({
        key: this.nextKey++,
        code: requirement.code,
        label: requirement.label,
        required: requirement.required,
        hint: requirement.hint ?? '',
        codeTyped: true,
      })),
    );
    this.reason.set('');
    this.outcome.set('');
  }
}
