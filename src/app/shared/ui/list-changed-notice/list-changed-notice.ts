import { ChangeDetectionStrategy, Component, output } from '@angular/core';

export const LIST_CHANGED_COPY = {
  message: 'This list has changed.',
  hint: 'Reloading shows it again from the first page.',
  reload: 'Reload list',
} as const;

/**
 * What a list says when it has changed under somebody who loaded more of it (`DL-222`).
 *
 * A list with only its first page on screen re-reads quietly. Once a person has followed the
 * cursor, a re-read of the first page would drop the pages they loaded and move rows under their
 * pointer, so the list stays exactly as it is and this notice offers the reload instead
 * (`unlessPaged`). Reloading is the person's act, from the first page, with the skeleton like any
 * new question.
 *
 * **Not announced.** No live region and no `role="status"`: automatic updates are not read out
 * (WCAG 2.2.2), the console's live regions are capped (`check:hardening`), and the notice is in the
 * list's own reading order, before the rows, for whoever reaches it.
 *
 * ```html
 * @if (listChanged()) {
 *   <app-list-changed-notice (reload)="reloadList()" />
 * }
 * ```
 */
@Component({
  selector: 'app-list-changed-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="callout list-changed">
      <p class="list-changed__text">
        <span class="list-changed__message">{{ copy.message }}</span>
        {{ copy.hint }}
      </p>
      <button type="button" class="btn btn--secondary btn--small" (click)="reload.emit()">
        {{ copy.reload }}
      </button>
    </div>
  `,
  styles: `
    .list-changed {
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }

    .list-changed__text {
      margin: 0;
    }

    .list-changed__message {
      color: var(--ink);
      font-weight: var(--fw-semibold);
    }
  `,
})
export class ListChangedNotice {
  readonly reload = output<void>();

  protected readonly copy = LIST_CHANGED_COPY;
}
