import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, type ElementRef, type Signal } from '@angular/core';

import { OverlayService } from './overlay.service';

export interface OverlayBinding {
  readonly isOpen: Signal<boolean>;
  readonly dismissible: Signal<boolean>;
  readonly panel: Signal<ElementRef<HTMLElement> | undefined>;
  readonly onDismiss: () => void;
}

/**
 * Shared open/close behaviour for the modal and drawer primitives: scroll lock,
 * Escape to dismiss, focus moved into the surface on open and returned to the
 * trigger on close.
 *
 * Must be called from an injection context (a component constructor or field
 * initialiser).
 */
export function bindOverlay(binding: OverlayBinding): void {
  const overlays = inject(OverlayService);
  const destroyRef = inject(DestroyRef);
  const document = inject(DOCUMENT);

  let locked = false;
  let previouslyFocused: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && binding.dismissible()) {
      event.stopPropagation();
      binding.onDismiss();
    }
  };

  const release = (): void => {
    if (!locked) {
      return;
    }
    locked = false;
    overlays.unlockScroll();
    document.removeEventListener('keydown', onKeydown, true);
    previouslyFocused?.focus();
    previouslyFocused = null;
  };

  effect((onCleanup) => {
    const open = binding.isOpen();

    if (open && !locked) {
      locked = true;
      previouslyFocused = document.activeElement as HTMLElement | null;
      overlays.lockScroll();
      document.addEventListener('keydown', onKeydown, true);
      // The panel is rendered in the same change-detection pass, so defer the
      // focus move to the next frame.
      queueMicrotask(() => binding.panel()?.nativeElement.focus());
    } else if (!open) {
      release();
    }

    onCleanup(() => {
      if (!binding.isOpen()) {
        release();
      }
    });
  });

  destroyRef.onDestroy(release);
}
