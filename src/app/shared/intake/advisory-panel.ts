import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { cautions, EMPTY_ADVISORY, type IntakeAdvisory, type IntakeSignal } from '@domain/index';

import { INTAKE_COPY } from './intake.copy';

/**
 * Duplicate and previous-assistance context, shown as evidence.
 *
 * The same argument as `VulnerabilitySnapshotPanel` (`DL-42`), applied to
 * intake: every signal states **the rule it applied, what it found and the
 * records it read**, so a caseworker can check it rather than believe it. There
 * is no total, no score and no recommendation, and the panel says in words that
 * it decides nothing (`DL-60`).
 *
 * What it deliberately does not do: hide a control, disable a button, or colour
 * a row red enough to read as a refusal. A caution asks the encoder to write a
 * sentence; the sentence is the only thing that changes.
 */
@Component({
  selector: 'app-advisory-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = advisory();

    <section class="advisory" aria-labelledby="advisory-heading">
      <header class="advisory__header">
        <h3 class="advisory__heading" id="advisory-heading">{{ copy.heading }}</h3>
        <p class="advisory__statement">{{ copy.advisory }}</p>
      </header>

      @if (current.signals.length === 0) {
        <!-- "Not checked" is the empty advisory, never a count of nought: a first-time applicant
             has no records to read, and the check still ran (DL-177). -->
        <p class="advisory__clear">
          {{ checked() ? copy.nothingFound : copy.notCheckedYet }}
          @if (checked()) {
            <span class="advisory__read">{{ copy.recordsRead(current.recordsRead) }}</span>
          }
        </p>
      } @else {
        <p class="advisory__count">
          {{ copy.found(current.signals.length, cautionCount()) }}
          <span class="advisory__read">{{ copy.recordsRead(current.recordsRead) }}</span>
        </p>

        <ul class="advisory__list">
          @for (signal of current.signals; track signal.code) {
            <li
              class="advisory__signal"
              [class.advisory__signal--caution]="signal.tone === 'caution'"
            >
              <p class="advisory__signal-head">
                <!-- The tone is a word before it is a colour. -->
                <span class="advisory__tone">{{ toneLabel(signal) }}</span>
                <span class="advisory__finding">{{ signal.finding }}</span>
              </p>
              <p class="advisory__rule">
                <span class="advisory__label">{{ copy.ruleLabel }}</span>
                {{ signal.rule }}
              </p>
              @if (signal.references.length > 0) {
                <p class="advisory__references">
                  <span class="advisory__label">{{ copy.recordsLabel }}</span>
                  {{ signal.references.join(' · ') }}
                </p>
              }
            </li>
          }
        </ul>
      }

      @if (current.unread.length > 0) {
        <!-- Beside the signals, never folded away: silence about a source nobody read would
             read as "never helped" (DL-112, DL-177). -->
        <div class="advisory__unread" role="note">
          <p class="advisory__label">{{ copy.unreadHeading }}</p>
          <ul class="advisory__unread-list">
            @for (gap of current.unread; track gap.source) {
              <li>{{ gap.because }}</li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styleUrl: './advisory-panel.scss',
})
export class AdvisoryPanel {
  readonly advisory = input.required<IntakeAdvisory>();

  protected readonly copy = INTAKE_COPY.advisory;

  protected readonly cautionCount = computed(() => cautions(this.advisory()).length);
  /** Whether a check has run at all — the empty advisory is the only "not yet". */
  protected readonly checked = computed(() => this.advisory() !== EMPTY_ADVISORY);

  protected toneLabel(signal: IntakeSignal): string {
    return INTAKE_COPY.toneLabel[signal.tone];
  }
}
