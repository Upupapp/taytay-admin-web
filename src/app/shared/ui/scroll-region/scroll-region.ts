import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * A box that may scroll sideways — a wide table inside its card — made reachable from the
 * keyboard while, and only while, it actually scrolls.
 *
 * A region a keyboard user cannot focus is a region whose hidden columns they cannot reach
 * (axe `scrollable-region-focusable`, WCAG 2.1.1). Making it a focusable, labelled region always
 * would add a tab stop and a landmark to every table that fits, so the attributes come and go
 * with the overflow, measured by a ResizeObserver on the box and on what it holds.
 *
 * `<div class="table-scroll" [appScrollRegion]="copy.caption">` — the label names the region
 * as the table's caption names the table.
 *
 * While it scrolls the box also carries `scroll-region--scrolls`, which pins the table's first
 * column (the name a row is read by) at the box's start edge, so a row scrolled sideways still says
 * whose it is (`DL-259`). Only then: a pinned column needs a solid background, which would show as
 * a band on the glass card of a table that fits.
 */
@Directive({
  selector: '[appScrollRegion]',
  host: {
    '[attr.role]': "scrolls() ? 'region' : null",
    '[attr.aria-label]': 'scrolls() ? label() : null',
    '[attr.tabindex]': 'scrolls() ? 0 : null',
    '[class.scroll-region--scrolls]': 'scrolls()',
  },
})
export class ScrollRegion {
  readonly label = input.required<string>({ alias: 'appScrollRegion' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Whether the box is narrower than what it holds. */
  protected readonly scrolls = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const box = this.host.nativeElement;
      const measure = (): void => this.scrolls.set(box.scrollWidth > box.clientWidth + 1);
      const observer = new ResizeObserver(measure);
      observer.observe(box);
      // The box keeps its size when rows arrive; what it holds does not.
      for (const child of Array.from(box.children)) {
        observer.observe(child);
      }
      measure();
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
