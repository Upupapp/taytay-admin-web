import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { ServedPorts, UNSERVED_ROUTE } from '@core/access/served-ports';
import { SessionStore } from '@core/auth/session.store';
import { NAVIGATION, type NavItem, type NavSection } from '@core/navigation/navigation';
import { Icon } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icons';

import { LAYOUT_COPY } from '../layout.copy';
import { NAV_ICONS } from './nav-icons';

/**
 * The sidebar navigation list.
 *
 * Every primary module is a direct link, which is what makes the "reachable in
 * at most two navigation actions" guarantee hold: one action on desktop (click
 * the link), two on mobile (open the drawer, then click). There are no nested
 * fly-outs, so no module is ever three levels deep. The console mock-ups fold
 * each section behind a toggle; that would make every module outside the
 * current section one action further away, so the sections stay open
 * (`DL-201`).
 *
 * Entries are filtered by permission, mirroring the route guards — a user is
 * never shown a link that would bounce them to /forbidden (`CLAUDE.md` rule 8).
 *
 * They are filtered by what the API serves too (`DL-167`). An entry whose screen
 * reads a port the bound adapter set cannot serve is withheld, and one link names
 * them all instead: the module is left out of the menu, never left unexplained,
 * because a missing link with no reason reads as a missing record (`DL-112`).
 *
 * The same link is offered to a staff account no office is linked to (`DL-168`),
 * even when every module is served, as it is since the newsfeed was retired
 * (`DL-194`): that page is where the account is told why it has no office inbox
 * and who can fix it, and with nothing withheld it would otherwise be unreachable.
 */
@Component({
  selector: 'app-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, RouterLinkActive],
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
                  @let icon = iconFor(item.route);
                  @if (icon) {
                    <app-icon class="nav__icon" [name]="icon" />
                  } @else {
                    <span class="nav__glyph" aria-hidden="true">{{ item.glyph }}</span>
                  }
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
      @if (withholding || awaitingOffice()) {
        <ul class="nav__list nav__list--unserved">
          <li>
            <a
              class="nav__link"
              [routerLink]="unservedRoute"
              routerLinkActive="nav__link--active"
              #unservedActive="routerLinkActive"
              [attr.aria-current]="unservedActive.isActive ? 'page' : null"
              [title]="
                withholding ? copy.navUnservedDescription : copy.navAwaitingOfficeDescription
              "
              (click)="navigated.emit()"
            >
              <app-icon class="nav__icon" name="unplugged" />
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
  private readonly session = inject(SessionStore);

  /** Emitted after a link is chosen, so a mobile shell can close its drawer. */
  readonly navigated = output<void>();

  protected readonly copy = LAYOUT_COPY;
  protected readonly unservedRoute = UNSERVED_ROUTE;

  /** Fixed for the life of the app: which adapter set is bound does not change at run time. */
  protected readonly withholding = this.served.unserved.length > 0;

  /** A staff account the server has linked to no office (`DL-168`). */
  protected readonly awaitingOffice = computed(() => this.session.user()?.awaitingOffice === true);

  /** Sections with no permitted, served entry are dropped rather than rendered empty. */
  protected readonly sections = computed<readonly NavSection[]>(() =>
    NAVIGATION.map((section) => ({
      title: section.title,
      items: section.items.filter(
        (item) =>
          this.permissions.hasAny(item.permissions) &&
          this.served.servesAll(item.reads) &&
          !this.closedToScope(item),
      ),
    })).filter((section) => section.items.length > 0),
  );

  protected iconFor(route: string): IconName | undefined {
    return NAV_ICONS[route];
  }

  /** The route's `scopeGuard` would refuse this reader, whatever the role holds (`DL-185`). */
  private closedToScope(item: NavItem): boolean {
    const scope = this.permissions.scope();
    return scope !== null && (item.closedTo ?? []).includes(scope);
  }
}
