import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { ServedPorts, UNSERVED_ROUTE } from '@core/access/served-ports';
import { NAVIGATION, type NavSection } from '@core/navigation/navigation';

import { LAYOUT_COPY } from '../layout.copy';

/**
 * The sidebar navigation list.
 *
 * Every primary module is a direct link, which is what makes the "reachable in
 * at most two navigation actions" guarantee hold: one action on desktop (click
 * the link), two on mobile (open the drawer, then click). There are no nested
 * fly-outs, so no module is ever three levels deep.
 *
 * Entries are filtered by permission, mirroring the route guards — a user is
 * never shown a link that would bounce them to /forbidden (`CLAUDE.md` rule 8).
 *
 * They are filtered by what the API serves too (`DL-167`). An entry whose screen
 * reads a port the bound adapter set cannot serve is withheld, and one link names
 * them all instead: the module is left out of the menu, never left unexplained,
 * because a missing link with no reason reads as a missing record (`DL-112`).
 */
@Component({
  selector: 'app-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="nav" [attr.aria-label]="copy.navLandmark">
      @for (section of sections(); track section.title) {
        <div class="nav__section">
          <h2 class="nav__title" [id]="'nav-section-' + $index">{{ section.title }}</h2>
          <ul class="nav__list" [attr.aria-labelledby]="'nav-section-' + $index">
            @for (item of section.items; track item.route) {
              <li>
                <a
                  class="nav__link"
                  [routerLink]="item.route"
                  routerLinkActive="nav__link--active"
                  #active="routerLinkActive"
                  [attr.aria-current]="active.isActive ? 'page' : null"
                  [title]="item.description"
                  (click)="navigated.emit()"
                >
                  <span class="nav__glyph" aria-hidden="true">{{ item.glyph }}</span>
                  <span class="nav__label">{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        </div>
      }
      @if (sections().length === 0) {
        <p class="nav__empty">{{ withholding ? copy.navEmptyUnserved : copy.navEmpty }}</p>
      }
      @if (withholding) {
        <ul class="nav__list nav__list--unserved">
          <li>
            <a
              class="nav__link"
              [routerLink]="unservedRoute"
              routerLinkActive="nav__link--active"
              #unservedActive="routerLinkActive"
              [attr.aria-current]="unservedActive.isActive ? 'page' : null"
              [title]="copy.navUnservedDescription"
              (click)="navigated.emit()"
            >
              <span class="nav__glyph" aria-hidden="true">NC</span>
              <span class="nav__label">{{ copy.navUnserved }}</span>
            </a>
          </li>
        </ul>
      }
    </nav>
  `,
  styleUrl: './app-nav.scss',
})
export class AppNav {
  private readonly permissions = inject(PermissionService);
  private readonly served = inject(ServedPorts);

  /** Emitted after a link is chosen, so a mobile shell can close its drawer. */
  readonly navigated = output<void>();

  protected readonly copy = LAYOUT_COPY;
  protected readonly unservedRoute = UNSERVED_ROUTE;

  /** Fixed for the life of the app: which adapter set is bound does not change at run time. */
  protected readonly withholding = this.served.unserved.length > 0;

  /** Sections with no permitted, served entry are dropped rather than rendered empty. */
  protected readonly sections = computed<readonly NavSection[]>(() =>
    NAVIGATION.map((section) => ({
      title: section.title,
      items: section.items.filter(
        (item) => this.permissions.hasAny(item.permissions) && this.served.servesAll(item.reads),
      ),
    })).filter((section) => section.items.length > 0),
  );
}
