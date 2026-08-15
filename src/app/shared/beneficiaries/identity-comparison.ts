import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import {
  DUPLICATE_STRENGTH_LABELS,
  MATCH_ATTRIBUTE_LABELS,
  MATCH_OUTCOME_LABELS,
  type DuplicateCandidate,
  type MatchSignal,
} from '@domain/index';

/**
 * What two records have in common — and nothing about what they contain.
 *
 * This component renders `MatchSignal`s, which carry an attribute, an outcome
 * and the rule that produced it. It **cannot** display a birth date or a
 * PhilSys fragment because it is never handed one: the comparison arrives from
 * the data layer already reduced to agreement (`DL-73`).
 *
 * That is deliberate defence in depth. A reviewer clearing a queue is looking at
 * somebody who is not their client, and a template with the values in scope is
 * one careless binding away from disclosing them.
 *
 * Each row also states the rule that was applied, so a reviewer can disagree
 * with the machine on its own terms rather than deferring to it — the same
 * reasoning as the intake advisory (`DL-60`).
 */
@Component({
  selector: 'app-identity-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="comparison" [attr.aria-labelledby]="headingId()">
      <h3 class="comparison__heading" [id]="headingId()">{{ heading() }}</h3>
      <p class="comparison__hint">{{ hint() }}</p>

      <p class="comparison__strength">
        <span class="comparison__strength-label">{{ strengthLabel() }}</span>
        <span class="comparison__strength-note">{{ strengthHint() }}</span>
      </p>

      @if (candidate().holdsSensitiveRecord) {
        <p class="comparison__sensitive" role="note">{{ sensitiveNotice() }}</p>
      }

      <table class="comparison__table">
        <caption class="comparison__caption">
          {{ heading() }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ attributeHeader() }}</th>
            <th scope="col">{{ outcomeHeader() }}</th>
            <th scope="col">{{ ruleHeader() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (signal of candidate().signals; track signal.attribute) {
            <tr>
              <th scope="row" class="comparison__attribute">{{ attributeLabel(signal) }}</th>
              <!-- The outcome is a word first. The tone attribute only tints it,
                   so nothing here depends on colour alone (WCAG 1.4.1). -->
              <td class="comparison__outcome" [attr.data-outcome]="signal.outcome">
                {{ outcomeLabel(signal) }}
              </td>
              <td class="comparison__rule">{{ signal.rule }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styleUrl: './identity-comparison.scss',
})
export class IdentityComparison {
  readonly candidate = input.required<DuplicateCandidate>();
  readonly heading = input.required<string>();
  readonly hint = input.required<string>();
  readonly strengthHint = input.required<string>();
  readonly sensitiveNotice = input.required<string>();
  readonly attributeHeader = input('Detail');
  readonly outcomeHeader = input('Agreement');
  readonly ruleHeader = input('How it was compared');
  readonly headingId = input('identity-comparison-heading');

  protected strengthLabel(): string {
    return DUPLICATE_STRENGTH_LABELS[this.candidate().strength];
  }

  protected attributeLabel(signal: MatchSignal): string {
    return MATCH_ATTRIBUTE_LABELS[signal.attribute];
  }

  protected outcomeLabel(signal: MatchSignal): string {
    return MATCH_OUTCOME_LABELS[signal.outcome];
  }
}
