import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { notConnectedSentence, type DataPort } from '@domain/index';

/**
 * What a secondary panel shows in its own place when the API does not serve its port (`DL-175`).
 *
 *   @if (served.serves('field-visit')) { …the panel… } @else {
 *     <app-not-connected port="field-visit" />
 *   }
 *
 * In `core/` rather than `shared/` because it belongs to `ServedPorts` — the screen asks one, and
 * shows the other — and `shared/` may not import `core/`.
 *
 * `role="note"`, never `alert`: nothing went wrong while the officer watched, and an announcement
 * on every visit to a record is one a screen-reader user learns to talk over. The sentence is the
 * domain's, so this and the withheld-modules page describe one gap in the same words.
 */
@Component({
  selector: 'app-not-connected',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="not-connected" role="note">{{ sentence() }}</p>`,
  styles: `
    .not-connected {
      margin: 0;
      padding: var(--space-3);
      border-left: 3px solid var(--c-border-strong);
      background: var(--c-surface-muted);
      color: var(--c-text);
      font-size: 13px;
    }
  `,
})
export class NotConnected {
  readonly port = input.required<DataPort>();

  protected readonly sentence = computed(() => notConnectedSentence(this.port()));
}
