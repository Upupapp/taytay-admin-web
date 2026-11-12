import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

/**
 * Where the import stands, as a numbered list (`DL-214`): the five steps of the board, the current
 * one marked in words for a screen reader (`aria-current="step"`) as well as by its fill. Not
 * buttons — a step is reached by finishing the one before it, and each page links onward itself.
 */
@Component({
  selector: 'app-import-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="copy.stepsLabel">
      <ol class="tabs tabs--scroll">
        @for (label of copy.steps; track $index) {
          <li>
            <span
              class="tab"
              [class.tab--active]="$index + 1 === current()"
              [attr.aria-current]="$index + 1 === current() ? 'step' : null"
            >
              <span class="step-number" aria-hidden="true">{{ $index + 1 }}</span>
              {{ label }}
            </span>
          </li>
        }
      </ol>
    </nav>
  `,
})
export class ImportSteps {
  /** From 1. */
  readonly current = input.required<number>();

  protected readonly copy = RESIDENT_IMPORT_COPY;
}
