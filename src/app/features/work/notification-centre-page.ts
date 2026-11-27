import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { map } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  filterNotifications,
  localDayOf,
  groupNotifications,
  kindsPresent,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KINDS,
  NOTIFICATION_PERIOD_LABELS,
  NOTIFICATION_PERIODS,
  type AppNotification,
  type NotificationAction,
  type NotificationFilter,
  type NotificationId,
  type NotificationKind,
  type NotificationPeriod,
} from '@domain/index';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { debouncedTerm } from '@shared/state/debounced';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { SEVERITY_ICONS } from '@shared/ui/icon/severity-icons';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { WORK_COPY } from './work.copy';

/** A value from the address bar that names nothing we know is read as "no filter", never guessed. */
function readFilter(params: ParamMap): NotificationFilter {
  const show = params.get('show') === 'unread' ? 'unread' : 'all';
  const kind = params.get('category');
  const period = params.get('when');
  const day = params.get('on');
  return {
    show,
    kind: NOTIFICATION_KINDS.includes(kind as NotificationKind) ? (kind as NotificationKind) : null,
    period: NOTIFICATION_PERIODS.includes(period as NotificationPeriod)
      ? (period as NotificationPeriod)
      : 'any',
    day: day !== null && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    term: (params.get('q') ?? '').trim(),
  };
}

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
 * Three filters and a search, held in the address bar like every other list's (DL-291, DL-293):
 * read or not, what it is about, when (a span, or one picked day), and the words it says. The whole inbox is already in hand (the store reads every page, `DL-161`), so
 * filtering is a view over it and sends nothing.
 */
@Component({
  selector: 'app-notification-centre-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, Icon, PageHeader, RelativeTimePipe, RouterLink],
  templateUrl: './notification-centre-page.html',
  styleUrl: './notification-centre-page.scss',
})
export class NotificationCentrePage {
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = WORK_COPY.centre;
  protected readonly severityIcons = SEVERITY_ICONS;
  protected readonly periods = NOTIFICATION_PERIODS;
  protected readonly periodLabels = NOTIFICATION_PERIOD_LABELS;

  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readFilter)), {
    initialValue: readFilter(this.route.snapshot.queryParamMap),
  });

  private readonly inbox = this.notifications.inbox;
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly total = computed(() => this.inbox().length);
  protected readonly hasAny = computed(() => this.total() > 0);

  /** Only categories the inbox holds — plus the chosen one, so the select never misstates the URL. */
  protected readonly categories = computed(() => {
    const present = kindsPresent(this.inbox());
    const chosen = this.filter().kind;
    return chosen === null || present.some((entry) => entry.kind === chosen)
      ? present
      : [...present, { kind: chosen, label: NOTIFICATION_KIND_LABELS[chosen], count: 0 }];
  });

  protected readonly shown = computed(() =>
    filterNotifications(this.inbox(), this.filter(), new Date()),
  );
  protected readonly groups = computed(() => groupNotifications(this.shown()));

  protected readonly narrowed = computed(() => {
    const filter = this.filter();
    return filter.kind !== null || filter.period !== 'any' || (filter.term ?? '') !== '';
  });

  /** What is typed, shown at once; the address bar takes it once typing settles (DL-119). */
  protected readonly searchText = signal(this.filter().term ?? '');
  private readonly settledTerm = debouncedTerm(this.searchText);

  /** A day after today can hold no notice, so the calendar stops there. */
  protected readonly today = localDayOf(new Date().toISOString());

  constructor() {
    this.notifications.refresh();
    effect(() => {
      const term = this.settledTerm();
      if (term !== (this.filter().term ?? '')) {
        this.patch({ q: term === '' ? null : term });
      }
    });
  }

  protected onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  protected onDay(event: Event): void {
    this.patch({ on: (event.target as HTMLInputElement).value || null });
  }

  /** A link is offered only while the reader still holds what its destination asks for (rule 8). */
  protected canFollow(action: NotificationAction): boolean {
    return action.permission === undefined || this.permissions.has(action.permission);
  }

  protected onCategory(event: Event): void {
    this.patch({ category: (event.target as HTMLSelectElement).value || null });
  }

  protected onPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    // A picked day belongs to "On a date"; any other choice lets it go.
    this.patch(
      value === 'day' ? { when: value } : { when: value === 'any' ? null : value, on: null },
    );
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      // The card's own filters only: the All | Unread tabs above are their own control.
      queryParams: { category: null, when: null, on: null, q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected showAll(): void {
    this.patch({ show: null });
  }

  protected markRead(notification: AppNotification): void {
    if (notification.readAt === null) {
      this.notifications.markRead(notification.id as NotificationId);
    }
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
