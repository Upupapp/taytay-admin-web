import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  filterNotifications,
  kindsPresent,
  NOTIFICATION_KINDS,
  type AppNotification,
  type NotificationAction,
  type NotificationKind,
  type NotificationShow,
} from '@domain/index';
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
 *
 * The drawer is a quick look, so it carries the two filters a person reaches for at a glance —
 * read or not, and what it is about — and hands the rest (when) to the Notifications page, with
 * what was chosen here carried over (DL-291). They are held for the drawer, not the address bar:
 * the drawer opens over whatever page is in the address bar.
 */
@Component({
  selector: 'app-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, Icon, RelativeTimePipe, RouterLink],
  template: `
    @if (notifications.inbox().length > 0) {
      <div class="inbox__filters">
        <div class="tabs inbox__tabs" role="group" [attr.aria-label]="copy.inboxShowLabel">
          <button
            type="button"
            class="tab"
            [class.tab--active]="show() === 'all'"
            [attr.aria-pressed]="show() === 'all'"
            (click)="show.set('all')"
          >
            {{ copy.inboxShowAll }}
            <span class="tab__count">{{ notifications.inbox().length }}</span>
          </button>
          <button
            type="button"
            class="tab"
            [class.tab--active]="show() === 'unread'"
            [attr.aria-pressed]="show() === 'unread'"
            (click)="show.set('unread')"
          >
            {{ copy.inboxShowUnread }}
            <span class="tab__count">{{ notifications.unreadCount() }}</span>
          </button>
        </div>

        <label class="field inbox__category">
          <span class="field__label">{{ copy.inboxCategory }}</span>
          <select class="field__input field__input--pill" (change)="onCategory($event)">
            <option value="" [selected]="kind() === null">{{ copy.inboxAllCategories }}</option>
            @for (category of categories(); track category.kind) {
              <option [value]="category.kind" [selected]="kind() === category.kind">
                {{ category.label }} ({{ category.count }})
              </option>
            }
          </select>
        </label>

        <p class="inbox__summary">
          <span role="status">{{
            copy.inboxShowing(shown().length, notifications.inbox().length)
          }}</span>
          @if (canOpenPage()) {
            <a
              class="record-link"
              routerLink="/notifications"
              [queryParams]="pageQuery()"
              (click)="followed.emit()"
            >
              {{ copy.inboxMoreFilters }}
            </a>
          }
        </p>
      </div>
    }

    @for (item of shown(); track item.id) {
      <!-- Unread is a tint, a weight and a dot, as in a social network's list, and said in words to
           a screen reader (DL-294). The dot is the mark-as-read control; following the notice's
           link marks it read as well. -->
      <article class="inbox__item" [class.inbox__item--unread]="item.readAt === null">
        <div class="inbox__main">
          <div class="inbox__meta">
            <span
              class="inbox__severity"
              [class]="'inbox__severity--' + item.severity"
              aria-hidden="true"
            >
              <app-icon [name]="severityIcons[item.severity]" [size]="14" [stroke]="2" />
            </span>
            <time [attr.datetime]="item.createdAt">{{ item.createdAt | relativeTime }}</time>
          </div>
          <h3 class="inbox__title">
            @if (item.readAt === null) {
              <span class="visually-hidden">{{ copy.unreadPrefix }}</span>
            }
            {{ item.title }}
          </h3>
          @if (item.body; as body) {
            <p class="inbox__body">{{ body }}</p>
          }
          @if (item.action; as action) {
            @if (canFollow(action)) {
              <p class="inbox__actions">
                <a class="record-link" [routerLink]="action.routerLink" (click)="follow(item)">
                  {{ action.label }}
                </a>
              </p>
            }
          }
        </div>
        @if (item.readAt === null) {
          <button
            type="button"
            class="unread-dot"
            [attr.aria-label]="copy.markReadNamed(item.title)"
            [title]="copy.markRead"
            (click)="markRead(item)"
          ></button>
        }
      </article>
    } @empty {
      @if (notifications.inbox().length === 0) {
        <app-empty-state
          [heading]="copy.notificationsEmptyHeading"
          [message]="copy.notificationsEmptyBody"
        />
      } @else if (kind() !== null) {
        <!-- "Nothing here" and "nothing matches" are different answers, never merged. -->
        <app-empty-state
          variant="no-results"
          [heading]="copy.inboxNoMatchHeading"
          [message]="copy.inboxNoMatchBody"
          [actionLabel]="copy.inboxAllCategories"
          (actionSelected)="kind.set(null)"
        />
      } @else {
        <app-empty-state
          [heading]="copy.inboxCaughtUpHeading"
          [message]="copy.inboxCaughtUpBody"
          [actionLabel]="copy.inboxShowAll"
          (actionSelected)="show.set('all')"
        />
      }
    }
  `,
  styleUrl: './notification-list.scss',
})
export class NotificationList {
  protected readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  protected readonly copy = LAYOUT_COPY;
  protected readonly severityIcons = SEVERITY_ICONS;

  /** A link in the drawer was followed: the shell closes the drawer so the destination shows. */
  readonly followed = output();

  protected readonly show = signal<NotificationShow>('all');
  protected readonly kind = signal<NotificationKind | null>(null);

  protected readonly categories = computed(() => kindsPresent(this.notifications.inbox()));
  protected readonly shown = computed(() =>
    filterNotifications(
      this.notifications.inbox(),
      { show: this.show(), kind: this.kind(), period: 'any' },
      new Date(),
    ),
  );

  /** The page's own guard, so the link is never one that bounces (rule 8). */
  protected readonly canOpenPage = computed(() => this.permissions.has('dashboard.view'));
  protected readonly pageQuery = computed(() => ({
    show: this.show() === 'unread' ? 'unread' : null,
    category: this.kind(),
  }));

  protected canFollow(action: NotificationAction): boolean {
    return action.permission === undefined || this.permissions.has(action.permission);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.kind.set(NOTIFICATION_KINDS.find((kind) => kind === value) ?? null);
  }

  protected follow(item: AppNotification): void {
    this.markRead(item);
    this.followed.emit();
  }

  protected markRead(item: AppNotification): void {
    if (item.readAt === null) {
      this.notifications.markRead(item.id);
    }
  }
}
