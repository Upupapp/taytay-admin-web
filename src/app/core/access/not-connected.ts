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
  // The global `.note-box` look (quiet note with a left rule), the same as every other gap a
  // screen names in place.
  template: `<p class="not-connected note-box" role="note">{{ sentence() }}</p>`,
})
export class NotConnected {
  readonly port = input.required<DataPort>();

  protected readonly sentence = computed(() => notConnectedSentence(this.port()));
}
