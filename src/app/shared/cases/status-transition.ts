import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { nextStatuses, type StatusCatalog, type StatusTransitions } from '@domain/index';

import { CASE_COPY } from './case.copy';

export interface StatusTransitionRequest<TStatus extends string> {
  readonly to: TStatus;
  readonly reason: string;
}

/**
 * What one destination means, said before anybody confirms it (`DL-167`).
 *
 * For a lifecycle whose moves do something outside the record — a resident is told, an account
 * changes, a card is issued — the consequences are shown between the choice and the button, and
 * the reason's label names who will read it. Said after the click, the same sentences are an
 * apology; said before, they are information somebody can act on.
 */
export interface TransitionGuidance {
  /** Replaces the generic reason label — above all to say who will read these words. */
  readonly reasonLabel: string;
  readonly reasonHint: string;
  /** What the system of record does on this move, in the order it happens. */
  readonly consequences: readonly string[];
}

/**
 * The only sanctioned way to move a record through a lifecycle.
 *
 * Three things it refuses to let a screen do wrong:
 *
 *  - **Offer an illegal move.** The destinations come from the domain's own
 *    transition map, so a screen cannot invent a shortcut, and a change to the
 *    lifecycle reaches every screen at once.
 *  - **Record a move without a reason.** The reason field is not optional and
 *    not decorative: the confirm button stays disabled until there are enough
 *    words to be worth reading. Everything else in this application treats a
 *    status change as an audit event, and an audit event with no *why* answers
 *    "was this allowed?" and never "was this right?".
 *  - **Hide why a move is unavailable.** A user whose role cannot make any move
 *    is told so in words, rather than shown an empty box.
 *
 * Generic over the status union, so the assistance-request screen can use the
 * same control against its own catalog without either of them re-implementing
 * reason capture.
 */
@Component({
  selector: 'app-status-transition',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="transition" [attr.aria-labelledby]="headingId()">
      <h3 class="transition__heading" [id]="headingId()">{{ heading() }}</h3>

      <p class="transition__current">
        {{ copy.current }}: <strong>{{ currentLabel() }}</strong>
        <span class="transition__describes">{{ currentDescription() }}</span>
      </p>

      @if (options().length === 0) {
        <p class="transition__none">{{ noMovesMessage() }}</p>
      } @else {
        <div class="transition__field">
          <label class="transition__label" [attr.for]="destinationId()">
            {{ destinationLabel() }}
          </label>
          <select
            class="transition__select"
            [id]="destinationId()"
            [value]="destination() ?? ''"
            (change)="onDestination($event)"
          >
            <option value="">—</option>
            @for (option of options(); track option) {
              <option [value]="option">{{ labelFor(option) }}</option>
            }
          </select>
          @if (destinationDescription(); as description) {
            <p class="transition__hint">{{ description }}</p>
          }
        </div>

        @if (chosenGuidance(); as guide) {
          <div class="transition__consequences" [id]="consequencesId()">
            <p class="transition__label">{{ copy.consequences }}</p>
            <ul class="transition__effects">
              @for (line of guide.consequences; track $index) {
                <li>{{ line }}</li>
              }
            </ul>
          </div>
        }

        <div class="transition__field">
          <label class="transition__label" [attr.for]="reasonId()">{{
            chosenGuidance()?.reasonLabel ?? copy.reason
          }}</label>
          <textarea
            class="transition__reason"
            rows="3"
            [id]="reasonId()"
            [attr.aria-describedby]="reasonHintId()"
            [attr.aria-invalid]="showReasonProblem() ? 'true' : null"
            [placeholder]="chosenGuidance() ? '' : copy.reasonPlaceholder"
            [attr.maxlength]="maximumReasonLength()"
            [value]="reason()"
            (input)="onReason($event)"
          ></textarea>
          <p class="transition__hint" [id]="reasonHintId()">
            {{ chosenGuidance()?.reasonHint ?? copy.reasonHint }}
          </p>
          @if (showReasonProblem()) {
            <p class="transition__problem" role="alert">{{ copy.reasonTooShort }}</p>
          }
        </div>

        <div class="transition__actions">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="!canConfirm()"
            [attr.aria-describedby]="chosenGuidance() ? consequencesId() : null"
            (click)="submit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './status-transition.scss',
})
export class StatusTransition<TStatus extends string> {
  readonly catalog = input.required<StatusCatalog<TStatus>>();
  readonly transitions = input.required<StatusTransitions<TStatus>>();
  readonly current = input.required<TStatus>();
  /**
   * The destinations this user may actually reach. Supplied by the caller,
   * which knows the permissions; the component intersects it with what the
   * lifecycle allows so neither list alone can offer something wrong.
   */
  readonly permitted = input<readonly TStatus[] | null>(null);
  /** Widened past the default's literal type: other lifecycles word this differently. */
  readonly heading = input<string>(CASE_COPY.transition.heading);
  readonly minimumReasonLength = input(8);
  /** A server's limit, when it has one: words cut off by a 422 are words nobody reads. */
  readonly maximumReasonLength = input<number | null>(null);
  /** Per destination; a destination with none keeps the generic wording. */
  readonly guidance = input<Partial<Record<TStatus, TransitionGuidance>>>({});
  readonly destinationLabel = input<string>(CASE_COPY.transition.destination);
  readonly confirmLabel = input<string>(CASE_COPY.transition.confirm);
  readonly busy = input(false);
  /** Unique per instance so two controls on one page keep distinct labels. */
  readonly idPrefix = input('status-transition');

  readonly confirmed = output<StatusTransitionRequest<TStatus>>();

  protected readonly copy = CASE_COPY.transition;

  protected readonly destination = signal<TStatus | null>(null);
  protected readonly reason = signal('');
  protected readonly reasonTouched = signal(false);

  protected readonly headingId = computed(() => `${this.idPrefix()}-heading`);
  protected readonly destinationId = computed(() => `${this.idPrefix()}-destination`);
  protected readonly reasonId = computed(() => `${this.idPrefix()}-reason`);
  protected readonly reasonHintId = computed(() => `${this.idPrefix()}-reason-hint`);
  protected readonly consequencesId = computed(() => `${this.idPrefix()}-consequences`);

  protected readonly legal = computed(() => nextStatuses(this.transitions(), this.current()));

  protected readonly options = computed<readonly TStatus[]>(() => {
    const permitted = this.permitted();
    return permitted === null
      ? this.legal()
      : this.legal().filter((status) => permitted.includes(status));
  });

  /** Told apart so the message can say "not from here" versus "not by you". */
  protected readonly noMovesMessage = computed(() =>
    this.legal().length === 0 ? this.copy.noMoves : this.copy.noPermission,
  );

  protected readonly currentLabel = computed(
    () => this.catalog()[this.current()]?.label ?? this.current(),
  );
  protected readonly currentDescription = computed(
    () => this.catalog()[this.current()]?.description ?? '',
  );
  protected readonly destinationDescription = computed(() => {
    const to = this.destination();
    return to === null ? null : (this.catalog()[to]?.description ?? null);
  });

  protected readonly chosenGuidance = computed<TransitionGuidance | null>(() => {
    const to = this.destination();
    return to === null ? null : (this.guidance()[to] ?? null);
  });

  protected readonly reasonOk = computed(() => {
    const length = this.reason().trim().length;
    const maximum = this.maximumReasonLength();
    return length >= this.minimumReasonLength() && (maximum === null || length <= maximum);
  });
  protected readonly showReasonProblem = computed(() => this.reasonTouched() && !this.reasonOk());
  protected readonly canConfirm = computed(
    () => this.destination() !== null && this.reasonOk() && !this.busy(),
  );

  protected labelFor(status: TStatus): string {
    return this.catalog()[status]?.label ?? status;
  }

  protected onDestination(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.destination.set(value === '' ? null : (value as TStatus));
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.reasonTouched.set(true);
  }

  protected submit(): void {
    const to = this.destination();
    if (to === null || !this.canConfirm()) {
      return;
    }
    this.confirmed.emit({ to, reason: this.reason().trim() });
  }

  /** Called by the host after a successful move, so the form does not repeat it. */
  reset(): void {
    this.destination.set(null);
    this.reason.set('');
    this.reasonTouched.set(false);
  }
}
