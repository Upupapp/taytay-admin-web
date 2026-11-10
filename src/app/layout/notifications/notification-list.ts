import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationStore } from '@core/notifications/notification.store';
import type { NotificationId } from '@domain/index';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { SEVERITY_ICONS } from '@shared/ui/icon/severity-icons';

import { LAYOUT_COPY } from '../layout.copy';

/**
 * The account's notifications, listed in the shell's inbox drawer.
 *
 * Its own component only so its styles are counted on their own: the shell's
 * stylesheet would otherwise run over the component-style budget. The shell
 * still owns the drawer, when it opens and "mark all as read".
 */
@Component({
  selector: 'app-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, Icon, RelativeTimePipe],
  template: `
    @for (item of notifications.inbox(); track item.id) {
      <article class="inbox__item" [class.inbox__item--unread]="item.readAt === null">
        <div class="inbox__meta">
          <span
            class="inbox__severity"
            [class]="'inbox__severity--' + item.severity"
            aria-hidden="true"
          >
            <app-icon [name]="severityIcons[item.severity]" [size]="14" [stroke]="2" />
          </span>
          <time>{{ item.createdAt | relativeTime }}</time>
        </div>
        <h3 class="inbox__title">{{ item.title }}</h3>
        @if (item.body; as body) {
          <p class="inbox__body">{{ body }}</p>
        }
        @if (item.readAt === null) {
          <button type="button" class="btn btn--subtle inbox__read" (click)="markRead(item.id)">
            {{ copy.markRead }}
          </button>
        }
      </article>
    } @empty {
      <app-empty-state
        [heading]="copy.notificationsEmptyHeading"
        [message]="copy.notificationsEmptyBody"
      />
    }
  `,
  styleUrl: './notification-list.scss',
})
export class NotificationList {
  protected readonly notifications = inject(NotificationStore);
  protected readonly copy = LAYOUT_COPY;
  protected readonly severityIcons = SEVERITY_ICONS;

  protected markRead(id: NotificationId): void {
    this.notifications.markRead(id);
  }
}
