import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  groupNotifications,
  type AppNotification,
  type NotificationId,
} from '@domain/index';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { WORK_COPY } from './work.copy';

/**
 * The notification centre.
 *
 * Everything here is a record of something that **happened**. Nothing on this
 * screen is a job, and the screen says so in as many words at the top: if
 * something needs doing it is on the work list, with a date and a name against
 * it. That sentence is the whole of the "FYI versus action required"
 * distinction on this surface, and it is copy rather than styling because a
 * user who has learnt to ignore a colour has not learnt to ignore a sentence.
 *
 * Grouped by what happened rather than shown as one stream, with assignments
 * first — the only group that might mean somebody now owes something.
 *
 * The shell already has an inbox drawer for glancing. This is the surface for
 * working through: it groups, it counts unread per group, and it does not close
 * when you look away.
 */
@Component({
  selector: 'app-notification-centre-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RelativeTimePipe, RouterLink],
  templateUrl: './notification-centre-page.html',
  styleUrl: './notification-centre-page.scss',
})
export class NotificationCentrePage {
  private readonly notifications = inject(NotificationStore);

  protected readonly copy = WORK_COPY.centre;

  protected readonly groups = computed(() => groupNotifications(this.notifications.inbox()));
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly hasAny = computed(() => this.notifications.inbox().length > 0);

  constructor() {
    this.notifications.refresh();
  }

  protected markRead(notification: AppNotification): void {
    if (notification.readAt === null) {
      this.notifications.markRead(notification.id as NotificationId);
    }
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }
}
