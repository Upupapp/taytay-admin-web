import { DOCUMENT, Location } from '@angular/common';
import { Directive, inject, input } from '@angular/core';

/**
 * A link to a section of the page it is on — a headline figure that summarises a section below it
 * (`DL-273`). `<a class="tally" appJumpTo="payouts-heading">`.
 *
 * Following it moves **focus** to the section's heading, not only the scroll position, so a
 * keyboard or screen-reader user continues from there (WCAG 2.4.3); the heading takes
 * `tabindex="-1"` for that and stays out of the tab order, and the shared scroll margin keeps it
 * clear of the topbar (2.4.11). The `href` is this page's own address with the fragment, so a
 * modified click or "open in new tab" still names the page; a plain click stays on it and changes
 * nothing in the address, because the section is part of a page that reads its filter from there.
 */
@Directive({
  selector: 'a[appJumpTo]',
  host: {
    '[attr.href]': 'href()',
    '(click)': 'jump($event)',
  },
})
export class JumpLink {
  /** The `id` of the heading the link moves to. */
  readonly target = input.required<string>({ alias: 'appJumpTo' });

  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);

  protected href(): string {
    return `${this.location.prepareExternalUrl(this.location.path())}#${this.target()}`;
  }

  protected jump(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    const heading = this.document.getElementById(this.target());
    if (heading === null) return;
    event.preventDefault();
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}
