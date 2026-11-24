import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  ASSISTANCE_STATUS_CATALOG,
  barangayName,
  GOVERNANCE_REPOSITORY,
  WAITS_ON,
  type AuditRow,
  type CursorPage,
  type DashboardPayouts,
  type DashboardPeriod,
  type DecisionCounts,
  type WaitingRequest,
  type WaitingSide,
  type WaitsOn,
} from '@domain/index';
import { DisplayDatePipe } from '@shared/pipes/display-date.pipe';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DASHBOARD_HEALTH_COPY } from './dashboard-health.copy';
import type { DrillDown } from './dashboard-drill-down';

/** What the recent-activity panel re-reads on: a row added to the office's audit trail. */
export const ACTIVITY_TOPICS: readonly LiveTopic[] = ['audit'];

/**
 * "Waiting longest" (`DL-248`): the open requests that have stood longest at their stage, in two
 * tabs by whose move it is, each row with its stage, the reason in words and the wait in days —
 * never "overdue", because no service standard has been set (`DL-101`). Presentational: the
 * figures are the summary's, re-read with it.
 */
@Component({
  selector: 'app-dashboard-waiting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DisplayDatePipe, RouterLink, StatusBadge],
  host: { class: 'health health--waiting', role: 'region', 'aria-labelledby': 'waiting-heading' },
  template: `
    <div class="health__head">
      <h2 id="waiting-heading" class="health__title">{{ copy.waitingHeading }}</h2>
      <p class="health__lead">{{ copy.waitingLead }}</p>
    </div>
    <div class="tabs" role="tablist" [attr.aria-label]="copy.waitingTabs">
      @for (side of sides; track side) {
        <button
          type="button"
          role="tab"
          class="tab"
          [id]="'waiting-tab-' + side"
          [attr.aria-selected]="side === current()"
          aria-controls="waiting-panel"
          [tabIndex]="side === current() ? 0 : -1"
          (click)="current.set(side)"
          (keydown)="onKey($event)"
        >
          {{ copy.waitsOn[side] }}
          <span class="tab__count">{{ waiting()[side].count }}</span>
        </button>
      }
    </div>
    <div
      id="waiting-panel"
      role="tabpanel"
      class="health__panel"
      [attr.aria-labelledby]="'waiting-tab-' + current()"
    >
      @if (shown().longest.length === 0) {
        <p class="health__note">{{ copy.waitingEmpty[current()] }}</p>
      } @else {
        <ol class="soft-list">
          @for (row of shown().longest; track row.id) {
            <li class="soft-row waiting__row">
              <span class="waiting__what">
                <a [routerLink]="['/assistance-requests', row.id]">{{ row.referenceNumber }}</a>
                <app-status-badge [catalog]="catalog" [status]="row.status" />
                <span class="soft-row__meta">{{ barangay(row) }}</span>
              </span>
              <span class="waiting__why">{{ reason(row) }}</span>
              <span class="waiting__days">
                <strong>{{ copy.waitingDays(row.days) }}</strong>
                <span class="soft-row__meta">
                  {{ copy.waitingSince((row.since | displayDate: 'date') ?? '') }}
                </span>
              </span>
            </li>
          }
        </ol>
      }
    </div>
    <p class="health__foot">
      <span>{{ copy.waitingShown(shown().longest.length, shown().count) }}</span>
      @if (open() > 0) {
        <a class="record-link" [routerLink]="all().route" [queryParams]="all().queryParams">{{
          copy.waitingAll(open())
        }}</a>
      }
    </p>
  `,
  styleUrl: './dashboard-health.scss',
})
export class DashboardWaiting {
  readonly waiting = input.required<Readonly<Record<WaitsOn, WaitingSide>>>();
  /** Every open request, both sides: what "View all" opens. */
  readonly open = input.required<number>();
  readonly all = input.required<DrillDown>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly copy = DASHBOARD_HEALTH_COPY;
  protected readonly catalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly sides = WAITS_ON;
  protected readonly current = signal<WaitsOn>('office');
  protected readonly shown = computed(() => this.waiting()[this.current()]);

  protected barangay(row: WaitingRequest): string {
    return barangayName(row.barangayId);
  }

  protected reason(row: WaitingRequest): string {
    const words = this.copy.reason[row.status];
    return row.documentsOwed ? `${words} ${this.copy.documentsOwed}` : words;
  }

  /** Left and right move between the two tabs, as a tablist does (WAI-ARIA APG). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const next: WaitsOn = this.current() === 'office' ? 'resident' : 'office';
    this.current.set(next);
    this.host.nativeElement.querySelector<HTMLElement>(`#waiting-tab-${next}`)?.focus();
  }
}

/**
 * "Outcomes" (`DL-248`): what the office decided and handed over in the period, as plain counts —
 * "38 of 50", never a rate, a score or anybody's figure (`DL-107`). Nothing here decides anything.
 */
@Component({
  selector: 'app-dashboard-outcomes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'health health--outcomes', role: 'region', 'aria-labelledby': 'outcomes-heading' },
  template: `
    <div class="health__head">
      <h2 id="outcomes-heading" class="health__title">{{ copy.outcomesHeading }}</h2>
      <p class="health__lead">{{ copy.outcomesLead(period()) }}</p>
    </div>
    <dl class="outcomes">
      <div class="outcomes__item">
        <dt>{{ copy.approvals }}</dt>
        <dd class="outcomes__value">
          {{ copy.approvalsValue(decided().approved, decided().approved + decided().rejected) }}
        </dd>
        <dd class="outcomes__hint">
          {{ copy.approvalsHint(decided().approved, decided().rejected) }}
        </dd>
      </div>
      <div class="outcomes__item">
        <dt>{{ copy.returned }}</dt>
        <dd class="outcomes__value">{{ decided().returned }}</dd>
        <dd class="outcomes__hint">{{ copy.returnedHint }}</dd>
      </div>
      @if (payouts(); as payouts) {
        <div class="outcomes__item">
          <dt>{{ copy.handOver }}</dt>
          <dd class="outcomes__value">{{ copy.handOverValue(payouts.averageDaysToHandOver) }}</dd>
          <dd class="outcomes__hint">{{ copy.handOverHint }}</dd>
        </div>
      }
    </dl>
  `,
  styleUrl: './dashboard-health.scss',
})
export class DashboardOutcomes {
  readonly decided = input.required<DecisionCounts>();
  readonly period = input.required<DashboardPeriod>();
  /** `null` for a reader the release list refuses: the hand-over figure is left out, not zeroed. */
  readonly payouts = input.required<DashboardPayouts | null>();

  protected readonly copy = DASHBOARD_HEALTH_COPY;
}

/**
 * "Recent activity" (`DL-248`): the newest rows of the office's audit trail, for a reader the
 * trail's route lets in (`audit.view`; the page decides), with a link to the trail. The rows are
 * the trail's own words — who, what, when — never a value (`DL-114`). A side panel with its own
 * read: live on the trail's topic (`DL-222`), and its own loading, empty and error states.
 */
@Component({
  selector: 'app-dashboard-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DisplayDatePipe, RouterLink],
  host: { class: 'health health--activity', role: 'region', 'aria-labelledby': 'activity-heading' },
  template: `
    <div class="health__head health__head--row">
      <div>
        <h2 id="activity-heading" class="health__title">{{ copy.activityHeading }}</h2>
        <p class="health__lead">{{ copy.activityLead }}</p>
      </div>
      <a class="record-link" routerLink="/administration/audit">{{ copy.activityLink }}</a>
    </div>
    <app-async-content
      [state]="state()"
      [content]="rows"
      [skeletonLines]="4"
      [errorHeading]="copy.activityError"
      [retryLabel]="copy.activityRetry"
      (retryRequested)="retry()"
    />
    <ng-template #rows let-page>
      @if (page.items.length === 0) {
        <p class="health__note">{{ copy.activityEmpty }}</p>
      } @else {
        <ol class="soft-list">
          @for (row of page.items; track row.id) {
            <li class="soft-row activity__row">
              <span class="activity__what">
                <span class="activity__actor">{{ row.actorName }}</span>
                {{ row.summary }}
              </span>
              <time class="soft-row__meta" [attr.datetime]="row.occurredAt">{{
                row.occurredAt | displayDate: 'date-time'
              }}</time>
            </li>
          }
        </ol>
      }
    </ng-template>
  `,
  styleUrl: './dashboard-health.scss',
})
export class DashboardActivity {
  private readonly repository = inject(GOVERNANCE_REPOSITORY);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = DASHBOARD_HEALTH_COPY;

  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      switchMap(() =>
        liveViewState(
          () => this.repository.auditRows({}, { limit: 6, cursor: null }),
          this.live.changes(ACTIVITY_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AuditRow>> },
  );

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }
}
