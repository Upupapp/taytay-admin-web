import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { NAVIGATION, type NavSection } from '@core/navigation/navigation';
import { NotificationStore } from '@core/notifications/notification.store';
import { barangayName, type NotificationId } from '@domain/index';
import { BrandMark } from '@shared/brand/brand-mark';
import { Drawer } from '@shared/ui/drawer/drawer';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { EmptyState } from '@shared/ui/empty-state/empty-state';

/**
 * The authenticated application frame: identity, navigation, notification
 * inbox and the routed outlet. Feature routes render inside it and never
 * render chrome of their own.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    BrandMark,
    Drawer,
    EmptyState,
    RelativeTimePipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly session = inject(SessionStore);
  protected readonly notifications = inject(NotificationStore);
  protected readonly appName = inject(APP_ENVIRONMENT).appName;

  protected readonly inboxOpen = signal(false);
  protected readonly navOpen = signal(false);

  /** Only sections with at least one permitted entry are rendered. */
  protected readonly sections = computed<readonly NavSection[]>(() =>
    NAVIGATION.map((section) => ({
      title: section.title,
      items: section.items.filter((item) => this.permissions.hasAny(item.permissions)),
    })).filter((section) => section.items.length > 0),
  );

  protected readonly scopeLabel = computed(() => {
    const user = this.session.user();
    if (!user) {
      return '';
    }
    if (user.scope === 'own-barangay' && user.barangayId) {
      return `Barangay ${barangayName(user.barangayId)}`;
    }
    return user.scope === 'assigned-cases' ? 'Assigned cases' : 'All barangays';
  });

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

  protected signOut(): void {
    this.session.signOut().subscribe({
      next: () => void this.router.navigate(['/sign-in']),
    });
  }
}
