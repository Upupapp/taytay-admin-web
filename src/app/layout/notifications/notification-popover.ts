import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import { Icon } from '@shared/ui/icon/icon';

import { LAYOUT_COPY } from '../layout.copy';
import { NotificationList } from './notification-list';

/**
 * The bell's notifications, as a panel that drops from the bell rather than a drawer from the
 * side (DL-293): the list stays where the eye already is, and the page behind stays in view.
 *
 * A non-modal dialog. Opening it moves focus into it; Escape and the close button put focus back
 * on the bell; a press anywhere outside the panel and the bell closes it, as a menu does; following
 * a link closes it so the destination shows. The page behind is never made inert, because nothing
 * here needs to hold the reader the way a confirmation does.
 */
@Component({
  selector: 'app-notification-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, NotificationList, RouterLink],
  host: {
    '(document:pointerdown)': 'onDocumentPointer($event)',
    '(document:keydown.escape)': 'dismiss()',
  },
  template: `
    <section
      #panel
      id="notification-popover"
      class="popover"
      role="dialog"
      aria-labelledby="notification-popover-heading"
      tabindex="-1"
    >
      <header class="popover__head">
        <h2 id="notification-popover-heading" class="popover__heading">
          {{ copy.notificationsHeading }}
        </h2>
        @if (notifications.unreadCount() > 0) {
          <button
            type="button"
            class="btn btn--subtle popover__mark"
            (click)="notifications.markAllRead()"
          >
            {{ copy.markAllRead }}
          </button>
        }
        <button type="button" class="icon-button popover__close" (click)="dismiss()">
          <app-icon name="close" [size]="16" [stroke]="2.2" />
          <span class="visually-hidden">{{ copy.closeNotifications }}</span>
        </button>
      </header>

      <div class="popover__body">
        <app-notification-list (followed)="closed.emit()" />
      </div>

      <!-- The way to the full page, offered only where its guard lets the reader in (rule 8). -->
      @if (canOpenPage()) {
        <footer class="popover__foot">
          <a class="btn popover__all" routerLink="/notifications" (click)="closed.emit()">
            {{ copy.seeAllNotifications }}
          </a>
        </footer>
      }
    </section>
  `,
  styleUrl: './notification-popover.scss',
})
export class NotificationPopover {
  protected readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly copy = LAYOUT_COPY;

  /** The bell: a press on it is the bell's own toggle, not a press outside. Focus returns to it. */
  readonly anchor = input.required<HTMLElement>();
  readonly closed = output();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  /** The Notifications page's own guard, so the panel never offers a link that bounces (rule 8). */
  protected readonly canOpenPage = computed(() => this.permissions.has('dashboard.view'));

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus());
  }

  protected onDocumentPointer(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.host.nativeElement.contains(target) || this.anchor().contains(target)) return;
    this.closed.emit();
  }

  protected dismiss(): void {
    this.anchor().focus();
    this.closed.emit();
  }
}
