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
  ID_DOCUMENT_TYPE_LABELS,
  ID_DOCUMENT_TYPES,
  IN_PERSON_CORRECTION_EFFECT,
  IN_PERSON_EFFECTS,
  IN_PERSON_NAME_MAX,
  inPersonProblems,
  isInPersonRefused,
  toInPersonCheck,
  VERIFICATION_REPOSITORY,
  WriteIntent,
  type IdDocumentType,
  type InPersonField,
  type InPersonOutcome,
  type InPersonSubject,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { Modal } from '@shared/ui/modal/modal';

import { VERIFY_IN_PERSON_COPY } from './verify-in-person.copy';

type FieldErrors = Readonly<Record<InPersonField, string | null>>;

/**
 * Verifies a resident's account in person, against a government ID shown at the counter (`DL-219`).
 *
 * The other way to be verified, for a resident who declines the biometric (selfie) consent: consent
 * must be freely given (RA 10173 s.3(b)), so refusing the selfie must not cost the service.
 *
 * ## Nothing biometric is taken
 *
 * There is no camera, no file field and no image anywhere in this form. What it sends is the kind of
 * ID, the last four characters of its number (`DL-183`) — the field says only those are recorded —
 * the name the account gives as the screen showed it, and, when the ID shows another, that name
 * (`DL-198`). A card photo is a separate step with its own consent, when a card is issued.
 *
 * ## It says what it does before the button, and the button waits for the statement
 *
 * The server's effects (`IN_PERSON_EFFECTS`) stand between the fields and the statement, and the
 * statement — worded as an approval words it, naming the very name (`DL-197`) — stands before the
 * button, which waits for it to be ticked. The tick clears whenever the name it names changes, so it
 * is always about the name on the screen now.
 *
 * ## A refusal goes where it belongs
 *
 * The data layer hands back the server's refusal as `InPersonRefusedError`, with any field it named
 * already in the domain's terms, so this form never reads a wire field: a field's refusal sits under
 * that field (`aria-invalid`, `aria-describedby`), and anything else — not the reader's to make,
 * already verified, the account changed — above the fields, in the server's words.
 *
 * ## One press, one act
 *
 * The press of the button is a `WriteIntent`, kept while the same check is sent again: a retry
 * after a dropped connection answers with the first record instead of a second (`5209f75`).
 */
@Component({
  selector: 'app-verify-in-person-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  templateUrl: './verify-in-person-dialog.html',
  styleUrl: './verify-in-person-dialog.scss',
})
export class VerifyInPersonDialog {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The account, and the name it gives as the screen shows it. */
  readonly subject = input.required<InPersonSubject>();

  /** What the server recorded, with what was sent. The host closes the dialog. */
  readonly verified = output<InPersonOutcome>();
  readonly dismissed = output<void>();

  protected readonly copy = VERIFY_IN_PERSON_COPY;
  protected readonly types = ID_DOCUMENT_TYPES;
  protected readonly typeLabels = ID_DOCUMENT_TYPE_LABELS;
  protected readonly nameMax = IN_PERSON_NAME_MAX;

  protected readonly idType = signal<IdDocumentType | null>(null);
  protected readonly lastFour = signal('');
  protected readonly corrected = signal('');
  protected readonly seen = signal(false);
  protected readonly busy = signal(false);
  /** The server's refusal that names no field, in its words; empty when there is none. */
  protected readonly refusal = signal('');
  /** The server's refusal of a field, until that field changes. */
  private readonly refusedFields = signal<Partial<Record<InPersonField, string>>>({});

  private readonly draft = computed(() => ({
    idType: this.idType(),
    idLastFour: this.lastFour(),
    correctedName: this.corrected(),
  }));
  private readonly problems = computed(() => inPersonProblems(this.subject(), this.draft()));
  private readonly check = computed(() => toInPersonCheck(this.subject(), this.draft()));

  /** The name the statement names: the one typed, or the account's. */
  protected readonly named = computed(() => this.corrected().trim() || this.subject().name);
  protected readonly effects = computed(() =>
    this.corrected().trim() === ''
      ? IN_PERSON_EFFECTS
      : [...IN_PERSON_EFFECTS, IN_PERSON_CORRECTION_EFFECT],
  );
  protected readonly ready = computed(() => this.seen() && this.check() !== null && !this.busy());

  /**
   * What each field says is wrong: the server's word first, then the console's — but a choice not
   * yet made and a box not yet typed in are not errors; the sentence above the button says what is
   * still needed.
   */
  protected readonly errors = computed<FieldErrors>(() => {
    const server = this.refusedFields();
    const local = this.problems();
    return {
      idType: server.idType ?? null,
      idLastFour:
        server.idLastFour ?? (this.lastFour().trim() === '' ? null : (local.idLastFour ?? null)),
      correctedName: server.correctedName ?? local.correctedName ?? null,
      idShowsName: server.idShowsName ?? null,
    };
  });

  protected readonly describedBy = computed(() => {
    const errors = this.errors();
    const ids = (hint: string | null, field: InPersonField, error: string): string | null =>
      [hint, errors[field] === null ? null : error].filter((id) => id !== null).join(' ') || null;
    return {
      idType: ids(null, 'idType', 'in-person-id-type-error'),
      idLastFour: ids('in-person-last-four-hint', 'idLastFour', 'in-person-last-four-error'),
      correctedName: ids('in-person-corrected-hint', 'correctedName', 'in-person-corrected-error'),
      idShowsName: ids('in-person-statement-hint', 'idShowsName', 'in-person-statement-error'),
    };
  });

  /** The press of the button, kept while the same check is sent again. */
  private sending: { readonly body: string; readonly intent: WriteIntent } | null = null;

  constructor() {
    // Another account in the same dialog starts with nothing chosen, typed or ticked.
    effect(() => {
      this.subject();
      untracked(() => {
        this.idType.set(null);
        this.lastFour.set('');
        this.corrected.set('');
        this.seen.set(false);
        this.refusal.set('');
        this.refusedFields.set({});
        this.sending = null;
      });
    });
  }

  protected chooseType(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    this.idType.set(this.types.find((type) => type === value) ?? null);
    this.forget('idType');
  }

  protected typeLastFour(event: Event): void {
    this.lastFour.set(event.target instanceof HTMLInputElement ? event.target.value : '');
    this.forget('idLastFour');
  }

  protected typeCorrected(event: Event): void {
    this.corrected.set(event.target instanceof HTMLInputElement ? event.target.value : '');
    this.forget('correctedName');
    // The statement names this name; a different one has not been checked yet.
    this.seen.set(false);
  }

  protected tick(event: Event): void {
    this.seen.set(event.target instanceof HTMLInputElement && event.target.checked);
    this.forget('idShowsName');
  }

  protected dismiss(): void {
    if (!this.busy()) {
      this.dismissed.emit();
    }
  }

  protected save(): void {
    const subject = this.subject();
    const check = this.check();
    if (!this.ready() || check === null) {
      return;
    }
    const body = JSON.stringify([subject.accountId, check]);
    const intent = this.sending?.body === body ? this.sending.intent : new WriteIntent();
    this.sending = { body, intent };

    this.busy.set(true);
    this.refusal.set('');
    this.refusedFields.set({});
    this.repository
      .verifyInPerson(subject.accountId, check, intent)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (record) => {
          this.busy.set(false);
          this.sending = null;
          this.verified.emit({ record, check });
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          if (isInPersonRefused(failure)) {
            this.refusedFields.set({ ...failure.fields });
            if (failure.fields.idShowsName !== undefined) {
              this.seen.set(false);
            }
            const named = Object.keys(failure.fields).length > 0;
            this.refusal.set(
              named
                ? ''
                : failure.kind === 'conflict'
                  ? `${this.copy.notDone(failure.message)} ${this.copy.nothingChanged}`
                  : this.copy.notDone(failure.message),
            );
            return;
          }
          this.refusal.set(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
        },
      });
  }

  private forget(field: InPersonField): void {
    if (this.refusedFields()[field] !== undefined) {
      this.refusedFields.set(
        Object.fromEntries(Object.entries(this.refusedFields()).filter(([key]) => key !== field)),
      );
    }
  }
}
