import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

/**
 * Where the import stands, as a numbered list (`DL-214`): the five steps of the board, the current
 * one marked in words for a screen reader (`aria-current="step"`) as well as by its fill. Not
 * buttons — a step is reached by finishing the one before it, and each page links onward itself.
 */
@Component({
  selector: 'app-import-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollRegion],
  template: `
    <nav [attr.aria-label]="copy.stepsLabel">
      <div class="steps__scroll" [appScrollRegion]="copy.stepsLabel">
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
      </div>
    </nav>
  `,
  // The steps are not controls, so the strip cannot be scrolled by moving through them: the box
  // around it scrolls instead, and becomes a focusable region while it does (DL-227). It takes the
  // row's width and no more, so five steps never make the page wider than a phone.
  styles: `
    .steps__scroll {
      position: relative;
      inline-size: 0;
      min-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .steps__scroll > .tabs {
      inline-size: max-content;
      min-inline-size: 0;
      max-inline-size: none;
      overflow: visible;
    }
  `,
})
export class ImportSteps {
  /** From 1. */
  readonly current = input.required<number>();

  protected readonly copy = RESIDENT_IMPORT_COPY;
}
