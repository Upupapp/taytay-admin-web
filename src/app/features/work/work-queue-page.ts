import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ALERT_SEVERITY_CATALOG,
  CASE_REPOSITORY,
  WORK_PRIORITY_CATALOG,
  WORK_REPOSITORY,
  WORK_SOURCE_LABELS,
  asId,
  asIsoDate,
  bucketWork,
  describeAlerts,
  describeLateness,
  describeQueue,
  describeWaiting,
  todayAsIsoDate,
  totalWork,
  type CaseId,
  type CaseTaskId,
  type OfficeAlert,
  type WorkItem,
  type WorkQueue,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { WORK_COPY } from './work.copy';

/**
 * What the signed-in user owes.
 *
 * Bucketed by when it is due rather than presented as a sortable table: the
 * question is "what is late?", and a late item three pages down a sorted list
 * is a late item nobody saw.
 *
 * **Lateness is always in words.** Every late row carries "Late by 3 days"
 * beside its heading, and the bucket itself is headed "Late". Colour is a
 * reinforcement here, never the carrier — the master command asks for overdue
 * work to be obvious without red-only signalling, and an office printing its
 * queue on a monochrome printer is the ordinary case, not the edge one.
 *
 * Only a case task can be handed over, rescheduled or completed here, and those
 * three acts go to `CaseRepository` with a reason. Everything else on this
 * screen is the state of a record, and the screen says so rather than offering
 * a control that would quietly do nothing (`DL-97`).
 */
@Component({
  selector: 'app-work-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, NgTemplateOutlet, PageHeader, RouterLink, StatusBadge],
  templateUrl: './work-queue-page.html',
  styleUrl: './work-queue-page.scss',
})
export class WorkQueuePage {
  private readonly work = inject(WORK_REPOSITORY);
  private readonly cases = inject(CASE_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = WORK_COPY.queue;
  protected readonly alertCopy = WORK_COPY.alerts;
  protected readonly priorityCatalog = WORK_PRIORITY_CATALOG;
  protected readonly severityCatalog = ALERT_SEVERITY_CATALOG;

  /** Computed once per load and echoed on screen, so no heading can drift. */
  protected readonly today = todayAsIsoDate();

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly canSeeTeam = computed(() => this.permissions.has('staff.view'));

  protected readonly state = toSignal(
    toObservable(this.reloads).pipe(
      switchMap(() => toViewState(this.work.myQueue(this.today))),
    ),
    { initialValue: LOADING as ViewState<WorkQueue> },
  );

  protected readonly alertState = toSignal(
    toObservable(this.reloads).pipe(switchMap(() => toViewState(this.work.alerts()))),
    { initialValue: LOADING as ViewState<readonly OfficeAlert[]> },
  );

  protected readonly items = computed<readonly WorkItem[]>(() => valueOf(this.state())?.items ?? []);
  protected readonly buckets = computed(() => bucketWork(this.items(), this.today));
  protected readonly summary = computed(() => describeQueue(this.buckets()));
  protected readonly total = computed(() => totalWork(this.buckets()));

  protected readonly alerts = computed<readonly OfficeAlert[]>(
    () => valueOf(this.alertState()) ?? [],
  );
  protected readonly alertSummary = computed(() => describeAlerts(this.alerts()));

  /** Lateness as a sentence. Never only a colour (`DL-102`). */
  protected lateness(item: WorkItem): string | null {
    return describeLateness(item, this.today);
  }

  /** For work with no deadline: how long somebody has waited, never "late". */
  protected waiting(item: WorkItem): string | null {
    return describeWaiting(item, this.today);
  }

  protected sourceLabel(item: WorkItem): string {
    return WORK_SOURCE_LABELS[item.source];
  }

  /* ── Acting on a task ───────────────────────────────────────────────────── */

  /** The task whose panel is open, by work-item id. `null` when none is. */
  protected readonly openItemId = signal<string | null>(null);
  protected readonly outcome = signal('');
  protected readonly newDate = signal('');
  protected readonly reason = signal('');

  protected toggle(item: WorkItem): void {
    this.openItemId.update((current) => (current === item.id ? null : item.id));
    this.outcome.set('');
    this.newDate.set('');
    this.reason.set('');
  }

  protected isOpen(item: WorkItem): boolean {
    return this.openItemId() === item.id;
  }

  protected onOutcome(event: Event): void {
    this.outcome.set((event.target as HTMLTextAreaElement).value);
  }

  protected onNewDate(event: Event): void {
    this.newDate.set((event.target as HTMLInputElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected readonly canComplete = computed(
    () => this.outcome().trim().length > 0 && !this.saving(),
  );

  protected readonly canReschedule = computed(
    () => this.newDate().length > 0 && this.reason().trim().length > 0 && !this.saving(),
  );

  private caseIdOf(item: WorkItem): CaseId | null {
    // The link is the only place the case id is carried; a task item always
    // links to its case.
    const id = item.link.routerLink[1];
    return id === undefined ? null : asId<CaseId>(id);
  }

  protected async complete(item: WorkItem): Promise<void> {
    const caseId = this.caseIdOf(item);
    if (!this.canComplete() || caseId === null) {
      return;
    }
    await this.run(
      this.cases.completeTask(caseId, asId<CaseTaskId>(item.sourceId), this.outcome().trim()),
      this.copy.completed,
    );
  }

  protected async reschedule(item: WorkItem): Promise<void> {
    const caseId = this.caseIdOf(item);
    if (!this.canReschedule() || caseId === null) {
      return;
    }
    await this.run(
      this.cases.rescheduleTask(
        caseId,
        asId<CaseTaskId>(item.sourceId),
        asIsoDate(this.newDate()),
        this.reason().trim(),
      ),
      this.copy.rescheduled,
    );
  }

  private async run(call: ReturnType<typeof this.cases.completeTask>, message: string) {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      this.notifications.success(message);
      this.openItemId.set(null);
      this.outcome.set('');
      this.newDate.set('');
      this.reason.set('');
      this.reloads.update((value) => value + 1);
    } catch {
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
