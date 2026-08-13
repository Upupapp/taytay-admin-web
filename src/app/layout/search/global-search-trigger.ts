import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, output } from '@angular/core';

import { LAYOUT_COPY } from '../layout.copy';

/**
 * Global search **trigger only**.
 *
 * This is the interaction seam, not the feature. It owns the button, the
 * accessible name and the Ctrl/Cmd+K shortcut, and it emits `activated`. What
 * happens next is a later TAB's business — deliberately so, because search
 * spans residents, requests and programmes and needs its own permission story.
 *
 * Building the seam now means the shell can be finished and keyboard-tested
 * without pulling an unbuilt feature forward.
 */
@Component({
  selector: 'app-global-search-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="search-trigger"
      [attr.aria-label]="copy.searchLabel"
      aria-keyshortcuts="Control+K Meta+K"
      (click)="activate()"
    >
      <span class="search-trigger__glyph" aria-hidden="true">⌕</span>
      <span class="search-trigger__text">{{ copy.searchPlaceholder }}</span>
      <kbd class="search-trigger__kbd" aria-hidden="true">{{ copy.searchShortcutHint }}</kbd>
    </button>
  `,
  styleUrl: './global-search-trigger.scss',
})
export class GlobalSearchTrigger {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly activated = output<void>();

  protected readonly copy = LAYOUT_COPY;

  constructor() {
    const onKeydown = (event: KeyboardEvent): void => {
      // Ctrl+K on Windows/Linux, Cmd+K on macOS — the convention users already
      // have from other consoles.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.activate();
      }
    };

    this.document.addEventListener('keydown', onKeydown);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('keydown', onKeydown));
  }

  protected activate(): void {
    this.activated.emit();
  }
}
