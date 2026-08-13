import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/**
 * Counts open overlays so nested surfaces (a confirm modal over a drawer) do
 * not unlock page scrolling when only the inner one closes.
 */
@Injectable({ providedIn: 'root' })
export class OverlayService {
  private readonly document = inject(DOCUMENT);
  private openCount = 0;

  lockScroll(): void {
    this.openCount += 1;
    if (this.openCount === 1) {
      this.document.body.style.overflow = 'hidden';
    }
  }

  unlockScroll(): void {
    this.openCount = Math.max(0, this.openCount - 1);
    if (this.openCount === 0) {
      this.document.body.style.removeProperty('overflow');
    }
  }
}
