import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_STATUS_CATALOG,
  CASE_NOTE_SENSITIVITIES,
  CASE_REPOSITORY,
  CASE_STATUS_CATALOG,
  CASE_STATUS_TRANSITIONS,
  CASE_TASK_KINDS,
  CASE_TASK_STATUS_CATALOG,
  asId,
  asIsoDate,
  daysUntil,
  isTaskOpen,
  nextStatuses,
  permissionForCaseTransition,
  todayAsIsoDate,
  withheldNoteCount,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseStatus,
  type CaseTask,
  type CaseTaskId,
  type CaseTaskKind,
  type CaseWorkspace,
  type StaffUserId,
} from '@domain/index';
import { CaseTimeline } from '@shared/cases/case-timeline';
import { CASE_COPY } from '@shared/cases/case.copy';
import { StatusTransition, type StatusTransitionRequest } from '@shared/cases/status-transition';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { VulnerabilitySnapshotPanel } from '@shared/households/vulnerability-snapshot';
import { PesoPipe } from '@shared/pipes/peso.pipe';

import { CASES_COPY } from './cases.copy';

/**
 * The case workspace.
 *
 * TAB 10's first acceptance criterion is that a caseworker can understand the
 * context **and the next action** without opening another module, and this
 * screen is where that is either true or not. Everything on it arrives in one
 * `getById` call: the person, the household and why it looks exposed, the
 * family, the assistance attached to the case, the running record, the tasks
 * and the merged timeline. Nothing is fetched a second time, so nothing on the
 * page can be describing a different moment from anything else on it.
 *
 * What the screen refuses to do:
 *
 *  - **Change a status without a reason.** The move is made through the shared
 *    `StatusTransition` control, which will not enable its button until there
 *    are enough words, and the repository refuses the call regardless.
 *  - **Render a protected note.** It never receives one: the data layer
 *    withholds the body and the screen reports how many were withheld (`DL-38`).
 *  - **Offer a move the role cannot make.** Destinations are intersected with
 *    the permissions the user actually holds.
 */
@Component({
  selector: 'app-case-workspace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    CaseTimeline,
    DatePipe,
    HasPermissionDirective,
    Modal,
    PageHeader,
    PesoPipe,
    ResidentSummaryCard,
    RouterLink,
    StatusBadge,
    StatusTransition,
    VulnerabilitySnapshotPanel,
  ],
  templateUrl: './case-workspace-page.html',
  styleUrl: './case-workspace-page.scss',
})
export class CaseWorkspacePage {
  private readonly repository = inject(CASE_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly session = inject(SessionStore);

  readonly id = input.required<string>();

  protected readonly copy = CASES_COPY.workspace;
  protected readonly noteCopy = CASES_COPY.noteForm;
  protected readonly taskCopy = CASES_COPY.taskForm;
  protected readonly completeCopy = CASES_COPY.completeForm;
  protected readonly shared = CASE_COPY;
  protected readonly statusCatalog = CASE_STATUS_CATALOG;
  protected readonly transitions = CASE_STATUS_TRANSITIONS;
  protected readonly taskStatusCatalog = CASE_TASK_STATUS_CATALOG;
  protected readonly requestCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly taskKinds = CASE_TASK_KINDS;
  protected readonly sensitivities = CASE_NOTE_SENSITIVITIES;

  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<CaseId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<CaseWorkspace | null> },
  );

  protected readonly submitting = signal(false);

  protected readonly canManage = computed(() => this.permissions.has('case.manage'));
  protected readonly canNote = computed(() => this.permissions.has('case.note'));
  protected readonly canWriteProtected = computed(() =>
    this.permissions.has('case-note.view-protected'),
  );

  /**
   * Destinations this user may actually reach. Intersecting the lifecycle with
   * the permissions here — rather than showing everything and refusing later —
   * is what keeps a user from being offered a move that bounces them.
   */
  protected permittedMoves(status: CaseStatus): readonly CaseStatus[] {
    return nextStatuses(CASE_STATUS_TRANSITIONS, status).filter((to) =>
      this.permissions.has(permissionForCaseTransition(to)),
    );
  }

  /* ── formatting ─────────────────────────────────────────────────────────── */

  protected categoryLabel(workspace: CaseWorkspace): string {
    return CASE_COPY.categoryLabel[workspace.record.category];
  }

  protected taskKindLabel(kind: CaseTaskKind): string {
    return CASE_COPY.taskKindLabel[kind];
  }

  protected sensitivityLabel(sensitivity: CaseNoteSensitivity): string {
    return CASE_COPY.sensitivityLabel[sensitivity];
  }

  protected sensitivityHint(sensitivity: CaseNoteSensitivity): string {
    return CASE_COPY.sensitivityHint[sensitivity];
  }

  protected withheldNotes(workspace: CaseWorkspace): number {
    return withheldNoteCount(workspace.notes);
  }

  protected openTasks(workspace: CaseWorkspace): readonly CaseTask[] {
    return workspace.tasks.filter(isTaskOpen);
  }

  protected doneTasks(workspace: CaseWorkspace): readonly CaseTask[] {
    return workspace.tasks.filter((task) => !isTaskOpen(task));
  }

  /**
   * "9 days overdue" / "Due in 3 days". Words, never a colour alone.
   *
   * A task that is finished is not late, however long ago its deadline was —
   * saying otherwise would put a permanent red mark against work that was done.
   */
  protected dueLabel(task: CaseTask): string {
    if (!isTaskOpen(task)) {
      return this.copy.taskDone;
    }
    const days = daysUntil(task.dueOn, todayAsIsoDate());
    return days < 0 ? CASES_COPY.list.overdueBy(Math.abs(days)) : CASES_COPY.list.dueIn(days);
  }

  protected isLate(task: CaseTask): boolean {
    return isTaskOpen(task) && daysUntil(task.dueOn, todayAsIsoDate()) < 0;
  }

  /* ── status ─────────────────────────────────────────────────────────────── */

  protected onTransition(event: StatusTransitionRequest<CaseStatus>): void {
    this.run(this.repository.changeStatus(asId<CaseId>(this.id()), event.to, event.reason), {
      message: CASES_COPY.moved,
    });
  }

  /* ── assignment ─────────────────────────────────────────────────────────── */

  /**
   * Two choices only: take it, or return it to the pool.
   *
   * Handing a case to a *named colleague* would need a list of staff, and the
   * roles that assign cases day to day do not hold `staff.view`. Rather than
   * widen that permission to fill a select box, this screen offers the two moves
   * that need no directory — which are also the two the queues are built around
   * (`DL-59`).
   */
  protected readonly assigning = signal(false);
  protected readonly assignee = signal<StaffUserId | null>(null);
  protected readonly assignReason = signal('');

  protected readonly me = computed(() => this.session.user()?.id ?? null);
  protected readonly myName = computed(() => this.session.user()?.displayName ?? null);

  protected readonly canAssign = computed(
    () => this.assignReason().trim().length >= 8 && !this.submitting(),
  );

  protected openAssign(workspace: CaseWorkspace): void {
    this.assignee.set(workspace.record.assignedTo);
    this.assignReason.set('');
    this.assigning.set(true);
  }

  protected onAssignee(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.assignee.set(value ? asId<StaffUserId>(value) : null);
  }

  protected onAssignReason(event: Event): void {
    this.assignReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmAssign(): void {
    if (!this.canAssign()) {
      return;
    }
    this.run(
      this.repository.assign(asId<CaseId>(this.id()), this.assignee(), this.assignReason().trim()),
      { message: CASES_COPY.assigned, close: () => this.assigning.set(false) },
    );
  }

  /* ── notes ──────────────────────────────────────────────────────────────── */

  protected readonly noting = signal(false);
  protected readonly noteBody = signal('');
  protected readonly noteSensitivity = signal<CaseNoteSensitivity>('routine');
  protected readonly noteReason = signal('');

  protected readonly canSaveNote = computed(
    () =>
      this.noteBody().trim().length >= 8 &&
      this.noteReason().trim().length >= 8 &&
      !this.submitting(),
  );

  protected openNote(): void {
    this.noteBody.set('');
    this.noteSensitivity.set('routine');
    this.noteReason.set('');
    this.noting.set(true);
  }

  protected onNoteBody(event: Event): void {
    this.noteBody.set((event.target as HTMLTextAreaElement).value);
  }

  protected onNoteSensitivity(event: Event): void {
    this.noteSensitivity.set((event.target as HTMLSelectElement).value as CaseNoteSensitivity);
  }

  protected onNoteReason(event: Event): void {
    this.noteReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmNote(): void {
    if (!this.canSaveNote()) {
      return;
    }
    this.run(
      this.repository.addNote(
        asId<CaseId>(this.id()),
        this.noteBody().trim(),
        this.noteSensitivity(),
        this.noteReason().trim(),
      ),
      { message: this.noteCopy.saved, close: () => this.noting.set(false) },
    );
  }

  /* ── tasks ──────────────────────────────────────────────────────────────── */

  protected readonly tasking = signal(false);
  protected readonly taskTitle = signal('');
  protected readonly taskKind = signal<CaseTaskKind>('follow-up');
  protected readonly taskDueOn = signal(todayAsIsoDate());
  protected readonly taskReason = signal('');

  protected readonly canSaveTask = computed(
    () =>
      this.taskTitle().trim().length > 0 &&
      this.taskReason().trim().length >= 8 &&
      !this.submitting(),
  );

  protected openTask(): void {
    this.taskTitle.set('');
    this.taskKind.set('follow-up');
    this.taskDueOn.set(todayAsIsoDate());
    this.taskReason.set('');
    this.tasking.set(true);
  }

  protected onTaskTitle(event: Event): void {
    this.taskTitle.set((event.target as HTMLInputElement).value);
  }

  protected onTaskKind(event: Event): void {
    this.taskKind.set((event.target as HTMLSelectElement).value as CaseTaskKind);
  }

  protected onTaskDueOn(event: Event): void {
    this.taskDueOn.set(asIsoDate((event.target as HTMLInputElement).value));
  }

  protected onTaskReason(event: Event): void {
    this.taskReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmTask(workspace: CaseWorkspace): void {
    if (!this.canSaveTask()) {
      return;
    }
    this.run(
      this.repository.addTask(
        asId<CaseId>(this.id()),
        {
          title: this.taskTitle().trim(),
          kind: this.taskKind(),
          dueOn: this.taskDueOn(),
          assignedTo: workspace.record.assignedTo,
        },
        this.taskReason().trim(),
      ),
      { message: this.taskCopy.saved, close: () => this.tasking.set(false) },
    );
  }

  /* ── completing a task ──────────────────────────────────────────────────── */

  protected readonly completing = signal<CaseTaskId | null>(null);
  protected readonly outcome = signal('');

  protected readonly canComplete = computed(
    () => this.outcome().trim().length >= 8 && !this.submitting(),
  );

  protected openComplete(task: CaseTask): void {
    this.outcome.set('');
    this.completing.set(task.id);
  }

  protected onOutcome(event: Event): void {
    this.outcome.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmComplete(): void {
    const taskId = this.completing();
    if (taskId === null || !this.canComplete()) {
      return;
    }
    this.run(this.repository.completeTask(asId<CaseId>(this.id()), taskId, this.outcome().trim()), {
      message: this.completeCopy.saved,
      close: () => this.completing.set(null),
    });
  }

  protected cancel(): void {
    this.assigning.set(false);
    this.noting.set(false);
    this.tasking.set(false);
    this.completing.set(null);
  }

  /**
   * One place where a mutation is submitted, reported and reloaded.
   *
   * Every repository call answers with the whole workspace, so the screen does
   * not patch anything locally: it re-reads. A locally patched status beside a
   * timeline that was not re-read is exactly the disagreement this screen is
   * supposed to make impossible.
   */
  private run(
    call: ReturnType<typeof this.repository.changeStatus>,
    options: { message: string; close?: () => void },
  ): void {
    this.submitting.set(true);
    call.subscribe({
      next: () => {
        this.submitting.set(false);
        options.close?.();
        this.notifications.success(options.message);
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        this.notifications.error(failure instanceof Error ? failure.message : CASES_COPY.failed);
      },
    });
  }
}
