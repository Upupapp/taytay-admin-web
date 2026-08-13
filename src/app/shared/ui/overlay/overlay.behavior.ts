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
 * Elements that can hold keyboard focus. Anything explicitly removed from the
 * tab order, disabled, or hidden is excluded.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((selector) => `${selector}:not([aria-hidden="true"])`)
  .join(', ');

function focusableWithin(panel: HTMLElement): readonly HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // offsetParent is null for display:none subtrees. jsdom reports 0 for every
    // layout box, so fall back to checking the inline style only.
    (element) => !element.hasAttribute('hidden') && element.style.display !== 'none',
  );
}

/**
 * Shared open/close behaviour for the modal and drawer primitives: scroll lock,
 * Escape to dismiss, focus moved into the surface on open, focus **trapped**
 * inside it while open, and focus returned to the trigger on close.
 *
 * The trap resolves the second half of `DL-16` (superseded by `DL-25`). A
 * dialog that announces `aria-modal="true"` while letting Tab walk into the
 * page behind it is lying to assistive technology: the content behind is inert
 * to a mouse user but not to a keyboard user.
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

  const trapTab = (event: KeyboardEvent): void => {
    const panel = binding.panel()?.nativeElement;
    if (!panel) {
      return;
    }

    const focusable = focusableWithin(panel);
    if (focusable.length === 0) {
      // Nothing focusable inside: keep focus on the panel itself rather than
      // letting Tab escape to the page behind.
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (first === undefined || last === undefined) {
      return;
    }

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return;
    }

    // Focus somehow sits outside the panel (browser chrome, or a programmatic
    // move). Pull it back to the first stop.
    if (active instanceof HTMLElement && !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && binding.dismissible()) {
      event.stopPropagation();
      binding.onDismiss();
      return;
    }
    if (event.key === 'Tab') {
      trapTab(event);
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
