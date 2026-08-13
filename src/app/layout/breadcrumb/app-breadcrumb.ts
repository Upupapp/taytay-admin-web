import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { NAVIGATION } from '@core/navigation/navigation';

import { LAYOUT_COPY } from '../layout.copy';

export interface Crumb {
  readonly label: string;
  /** `null` for the current page, which is text rather than a link. */
  readonly route: string | null;
}

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
                <span class="crumbs__current" [attr.aria-current]="last ? 'page' : null">
                  {{ crumb.label }}
                </span>
              }
              @if (!last) {
                <span class="crumbs__sep" aria-hidden="true">›</span>
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

  protected readonly copy = LAYOUT_COPY;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly crumbs = computed<readonly Crumb[]>(() => buildCrumbs(this.url()));
}

/**
 * Exported for test, and because the mapping is the interesting part: the
 * longest matching navigation route wins, so `/administration/audit` resolves
 * to the audit entry rather than to a parent that merely shares a prefix.
 */
export function buildCrumbs(url: string): readonly Crumb[] {
  const path = url.split('?')[0]?.split('#')[0] ?? '/';
  const home: Crumb = { label: LAYOUT_COPY.breadcrumbHome, route: '/dashboard' };

  let bestSection: string | null = null;
  let bestItem: { label: string; route: string } | null = null;

  for (const section of NAVIGATION) {
    for (const item of section.items) {
      const matches = path === item.route || path.startsWith(`${item.route}/`);
      if (matches && (bestItem === null || item.route.length > bestItem.route.length)) {
        bestSection = section.title;
        bestItem = { label: item.label, route: item.route };
      }
    }
  }

  if (bestItem === null) {
    return [home];
  }
  if (bestItem.route === home.route) {
    // Dashboard is the root; showing "Dashboard › Dashboard" helps nobody.
    return [home];
  }

  const trail: Crumb[] = [home];
  if (bestSection !== null) {
    // The section is a grouping, not a destination, so it is never a link.
    trail.push({ label: bestSection, route: null });
  }
  trail.push({ label: bestItem.label, route: bestItem.route });
  return trail;
}
