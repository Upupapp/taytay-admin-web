import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { ViewportService } from '@core/layout/viewport.service';
import { NotificationStore } from '@core/notifications/notification.store';
import { barangayName, type NotificationId } from '@domain/index';
import { BrandMark } from '@shared/brand/brand-mark';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { ConnectionBanner } from '@shared/ui/connection-banner/connection-banner';
import { Drawer } from '@shared/ui/drawer/drawer';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { RouteProgress } from '@shared/ui/route-progress/route-progress';

import { AppNav } from '../navigation/app-nav';
import { AppTopbar } from '../topbar/app-topbar';
import { LAYOUT_COPY } from '../layout.copy';

/**
 * The authenticated application frame.
 *
 * Owns exactly one piece of state — whether the navigation drawer is open —
 * and delegates everything else to `AppNav`, `AppTopbar` and the shared
 * primitives. Feature routes render inside it and never draw chrome.
 *
 * Responsive behaviour is driven by a media query the component actually
 * observes, rather than by CSS alone, because the drawer needs different
 * *semantics* at each size: an overlay dialog on a narrow screen (focus
 * trapped, Escape closes, `aria-modal`) and a plain landmark on a wide one.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    AppNav,
    AppTopbar,
    BrandMark,
    ConnectionBanner,
    Drawer,
    EmptyState,
    RelativeTimePipe,
    RouteProgress,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly session = inject(SessionStore);
  protected readonly notifications = inject(NotificationStore);
  protected readonly copy = LAYOUT_COPY;

  protected readonly navOpen = signal(false);
  protected readonly inboxOpen = signal(false);

  /** True while the viewport is narrow enough for the sidebar to be a drawer. */
  protected readonly isCompact = inject(ViewportService).isCompact;

  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');

  protected readonly scopeLabel = computed(() => {
    const user = this.session.user();
    if (!user) {
      return '';
    }
    if (user.scope === 'own-barangay' && user.barangayId) {
      return this.copy.scopeOwnBarangay(barangayName(user.barangayId));
    }
    return user.scope === 'assigned-cases'
      ? this.copy.scopeAssignedCases
      : this.copy.scopeAllBarangays;
  });

  constructor() {
    // Returning to a wide viewport must not leave a stale overlay state behind.
    effect(() => {
      if (!this.isCompact()) {
        this.navOpen.set(false);
      }
    });

    // A completed navigation always closes the drawer: on a small screen the
    // destination is behind the overlay, so leaving it open hides the result.
    const navigation = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.navOpen.set(false));
    this.destroyRef.onDestroy(() => navigation.unsubscribe());

    // Escape closes the compact drawer. The wide sidebar is not dismissible, so
    // Escape must not silently remove the only navigation.
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && this.navOpen() && this.isCompact()) {
        this.navOpen.set(false);
        this.focusNavToggle();
      }
    };
    this.document.addEventListener('keydown', onKeydown);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('keydown', onKeydown));

    // Opening the drawer moves focus into it, so a keyboard user is not left
    // tabbing through the page behind an overlay they just opened.
    effect(() => {
      if (this.navOpen() && this.isCompact()) {
        queueMicrotask(() => this.sidebar()?.nativeElement.focus());
      }
    });
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected openInbox(): void {
    this.notifications.refresh();
    this.inboxOpen.set(true);
  }

  protected markRead(id: NotificationId): void {
    this.notifications.markRead(id);
  }

  /**
   * The search feature is a later TAB. The trigger is real; the response is an
   * honest notice rather than a dead click.
   */
  protected onSearchActivated(): void {
    void this.router.navigate(['/search']);
  }

  protected signOut(): void {
    this.session.signOut().subscribe({
      next: () => void this.router.navigate(['/sign-in']),
    });
  }

  private focusNavToggle(): void {
    const toggle = this.document.querySelector<HTMLElement>('.topbar__nav-toggle');
    toggle?.focus();
  }
}
