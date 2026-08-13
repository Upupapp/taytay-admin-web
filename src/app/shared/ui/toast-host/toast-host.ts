import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationStore } from '@core/notifications/notification.store';
import type { NotificationId } from '@domain/index';

/**
 * Renders the transient notification stack. Mounted once by the app shell —
 * features raise messages through `NotificationStore`, never by placing toast
 * markup of their own.
 */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="toasts" role="region" aria-label="Notifications">
      @for (toast of notifications.toasts(); track toast.id) {
        <article
          class="toast"
          [class]="'toast--' + toast.severity"
          [attr.role]="toast.severity === 'error' ? 'alert' : 'status'"
        >
          <div class="toast__content">
            <h3 class="toast__title">{{ toast.title }}</h3>
            @if (toast.body; as body) {
              <p class="toast__body">{{ body }}</p>
            }
            @if (toast.action; as action) {
              <a class="toast__action" [routerLink]="action.routerLink" (click)="dismiss(toast.id)">
                {{ action.label }}
              </a>
            }
          </div>
          <button type="button" class="icon-button toast__close" (click)="dismiss(toast.id)">
            <span aria-hidden="true">✕</span>
            <span class="visually-hidden">Dismiss notification</span>
          </button>
        </article>
      }
    </div>
  `,
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  protected readonly notifications = inject(NotificationStore);

  protected dismiss(id: NotificationId): void {
    this.notifications.dismissToast(id);
  }
}
