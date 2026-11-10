import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ServedPorts } from '@core/access/served-ports';
import { NotificationStore } from '@core/notifications/notification.store';
import { Icon } from '@shared/ui/icon/icon';

import { AppBreadcrumb } from '../breadcrumb/app-breadcrumb';
import { GlobalSearchTrigger } from '../search/global-search-trigger';
import { LAYOUT_COPY } from '../layout.copy';

/**
 * The topbar: navigation toggle, breadcrumb, global-search trigger and the
 * notification inbox. It scrolls with the page, as the console mock-ups draw
 * it (`DL-201`): a row on the page wash, not a bar over the content.
 *
 * Identity and sign-out deliberately live in the sidebar footer instead. Put
 * in the topbar they would have to be hidden on a narrow screen, which strands
 * a mobile user with no way to sign out.
 *
 * It is presentational — it emits intent and holds no state of its own, so the
 * shell stays the single owner of "is the drawer open".
 */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppBreadcrumb, GlobalSearchTrigger, Icon],
  template: `
    <header class="topbar">
      <button
        type="button"
        class="icon-button topbar__nav-toggle"
        [attr.aria-label]="navOpen() ? copy.navToggleClose : copy.navToggleOpen"
        [attr.aria-expanded]="navOpen()"
        aria-controls="app-sidebar"
        (click)="navToggled.emit()"
      >
        <app-icon name="menu" [size]="20" [stroke]="2" />
      </button>

      <app-breadcrumb class="topbar__crumbs" />

      @if (searchServed) {
        <app-global-search-trigger class="topbar__search" (activated)="searchActivated.emit()" />
      }

      <button
        type="button"
        class="icon-button topbar__inbox"
        [attr.aria-label]="inboxLabel()"
        (click)="inboxOpened.emit()"
      >
        <app-icon name="bell" [size]="20" />
        @if (notifications.unreadCount(); as unread) {
          <span class="topbar__badge" aria-hidden="true">{{ unread }}</span>
        }
      </button>
    </header>
  `,
  styleUrl: './app-topbar.scss',
})
export class AppTopbar {
  protected readonly notifications = inject(NotificationStore);

  /**
   * The trigger, and its Ctrl+K shortcut with it, is withheld when the API serves no search
   * (`DL-167`): it leads to one screen, and that screen could only refuse.
   */
  protected readonly searchServed = inject(ServedPorts).servesAll(['search']);

  readonly navOpen = input(false);

  readonly navToggled = output<void>();
  readonly searchActivated = output<void>();
  readonly inboxOpened = output<void>();

  protected readonly copy = LAYOUT_COPY;

  /** The badge is aria-hidden, so the count has to reach the accessible name. */
  protected readonly inboxLabel = computed(() => {
    const unread = this.notifications.unreadCount();
    return unread === 0
      ? this.copy.notificationsLabel
      : `${this.copy.notificationsLabel}, ${this.copy.unreadCountLabel(unread)}`;
  });
}
