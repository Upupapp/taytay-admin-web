import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The page's one `h1` and its actions. A page name ("Citizen registry") is read by assistive
 * technology but not drawn, because the breadcrumb already says where the reader is (DL-246): what
 * is drawn is a slim, right-aligned row of the page's actions. `showTitle` draws the heading and its
 * subtitle as before, for a heading that is data or a message rather than a page name — a record's
 * reference ("RL-2026-000001"), a person's name, "Release not found". `lead` is a sentence the page
 * owes its reader whatever the title does ("Residents see this in the Taytay app"), drawn in the row.
 *
 * `<ng-content select="[page-actions]">` receives the actions, which callers gate with
 * `*appHasPermission`.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header" [class.page-header--shown]="showTitle()">
      @if (showTitle()) {
        <div class="page-header__text">
          <h1 class="page-header__title">{{ title() }}</h1>
          @if (subtitle(); as text) {
            <p class="page-header__subtitle">{{ text }}</p>
          }
        </div>
      } @else {
        <h1 class="visually-hidden">{{ title() }}</h1>
      }
      @if (lead(); as text) {
        <p class="page-header__lead">{{ text }}</p>
      }
      <div class="page-header__actions">
        <ng-content select="[page-actions]"></ng-content>
      </div>
    </header>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  /** Drawn only under a shown title; a page name's description is not drawn (DL-246). */
  readonly subtitle = input<string | null>(null);
  readonly showTitle = input(false, { transform: booleanAttribute });
  readonly lead = input<string | null>(null);
}
