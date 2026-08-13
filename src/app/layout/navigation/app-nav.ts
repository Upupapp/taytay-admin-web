import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
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
      } @empty {
        <p class="nav__empty">{{ copy.navEmpty }}</p>
      }
    </nav>
  `,
  styleUrl: './app-nav.scss',
})
export class AppNav {
  private readonly permissions = inject(PermissionService);

  /** Emitted after a link is chosen, so a mobile shell can close its drawer. */
  readonly navigated = output<void>();

  protected readonly copy = LAYOUT_COPY;

  /** Sections with no permitted entry are dropped rather than rendered empty. */
  protected readonly sections = computed<readonly NavSection[]>(() =>
    NAVIGATION.map((section) => ({
      title: section.title,
      items: section.items.filter((item) => this.permissions.hasAny(item.permissions)),
    })).filter((section) => section.items.length > 0),
  );
}
