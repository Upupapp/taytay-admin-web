import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { ServedPorts } from '@core/access/served-ports';
import { activeNavRoute, NAVIGATION, pathOf, type NavItem } from '@core/navigation/navigation';

import { LAYOUT_COPY } from '../layout.copy';

export interface Crumb {
  readonly label: string;
  /** `null` for the current page, which is text rather than a link. */
  readonly route: string | null;
}

/** The root of every trail, when the dashboard is served. */
export const HOME_CRUMB: Crumb = { label: LAYOUT_COPY.breadcrumbHome, route: '/dashboard' };

/**
 * Route-derived breadcrumb.
 *
 * Built from the navigation model rather than from route data, so a module gets
 * a correct trail the moment it is added to `NAVIGATION` — there is no second
 * place to keep in step. The trail is at most three deep (Dashboard › section ›
 * page), which is a direct consequence of the flat navigation in `AppNav`.
 */
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (crumbs().length > 1) {
      <nav class="crumbs" [attr.aria-label]="copy.breadcrumbLandmark">
        <ol class="crumbs__list">
          @for (crumb of crumbs(); track crumb.label; let last = $last) {
            <li class="crumbs__item">
              @if (crumb.route && !last) {
                <a class="crumbs__link" [routerLink]="crumb.route">{{ crumb.label }}</a>
              } @else {
                <span
                  class="crumbs__current"
                  [class.crumbs__section]="!last"
                  [attr.aria-current]="last ? 'page' : null"
                >
                  {{ crumb.label }}
                </span>
              }
              @if (!last) {
                <span class="crumbs__sep" aria-hidden="true">/</span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
  styleUrl: './app-breadcrumb.scss',
})
export class AppBreadcrumb {
  private readonly router = inject(Router);
  private readonly served = inject(ServedPorts);

  /**
   * The dashboard crumb, or none when the API cannot serve the dashboard (`DL-167`): a link
   * labelled Dashboard that lands on a page explaining there is no dashboard is the bounce
   * rule 8 forbids, in a quieter place.
   */
  private readonly home: Crumb | null = this.served.servesAll(
    NAVIGATION.flatMap((section) => section.items).find((item) => item.route === HOME_CRUMB.route)
      ?.reads ?? [],
  )
    ? HOME_CRUMB
    : null;

  protected readonly copy = LAYOUT_COPY;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly crumbs = computed<readonly Crumb[]>(() => buildCrumbs(this.url(), this.home));
}

/**
 * Exported for test, and because the mapping is the interesting part: the
 * longest matching navigation route wins, so `/administration/audit` resolves
 * to the audit entry rather than to a parent that merely shares a prefix.
 */
export function buildCrumbs(url: string, home: Crumb | null = HOME_CRUMB): readonly Crumb[] {
  const path = pathOf(url) || '/';

  // The same longest-route rule the menu marks its current entry by, so the two always agree.
  const route = activeNavRoute(
    path,
    NAVIGATION.flatMap((section) => section.items.map((item) => item.route)),
  );
  let bestSection: string | null = null;
  let bestItem: NavItem | null = null;
  for (const section of NAVIGATION) {
    const item = section.items.find((candidate) => candidate.route === route);
    if (item !== undefined) {
      bestSection = section.title;
      bestItem = item;
      break;
    }
  }

  if (bestItem === null) {
    return home === null ? [] : [home];
  }
  if (home !== null && bestItem.route === home.route) {
    // Dashboard is the root; showing "Dashboard › Dashboard" helps nobody.
    return [home];
  }

  const trail: Crumb[] = home === null ? [] : [home];
  if (bestSection !== null) {
    // The section is a grouping, not a destination, so it is never a link.
    trail.push({ label: bestSection, route: null });
  }
  trail.push({ label: bestItem.label, route: bestItem.route });
  // A page under the entry with a heading of its own ends the trail with that heading.
  const pageRoute = activeNavRoute(
    path,
    (bestItem.pages ?? []).map((page) => page.path),
  );
  const page = bestItem.pages?.find((candidate) => candidate.path === pageRoute);
  if (page !== undefined) {
    trail.push({ label: page.label, route: page.path });
  }
  return trail;
}
