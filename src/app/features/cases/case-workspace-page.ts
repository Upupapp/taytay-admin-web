import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap, type Observable } from 'rxjs';

import { NotConnected } from '@core/access/not-connected';
import { PermissionService } from '@core/access/permission.service';
import { ServedPorts } from '@core/access/served-ports';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  CASE_NOTE_SENSITIVITIES,
  CASE_REPOSITORY,
  CASE_STATUS_CATALOG,
  CASE_STATUS_TRANSITIONS,
  CASE_TASK_KINDS,
  CASE_TASK_STATUS_CATALOG,
  UNNAMED_STAFF,
  asId,
  asIsoDate,
  assignsCases,
  daysUntil,
  isCaseFieldWithheld,
  isCaseWritable,
  isTaskOpen,
  isValidCaseReason,
  isValidNoteBody,
  nextStatuses,
  openTaskCount,
  permissionForCaseTransition,
  taskAssigneeChoices,
  todayAsIsoDate,
  unreadLinkedRequestCount,
  withheldNoteCount,
  type AssistanceRequest,
  type AssistanceRequestId,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseStatus,
  type CaseTask,
  type CaseTaskId,
  type CaseTaskKind,
  type CaseWorkspace,
  type CursorPage,
  type SocialWorker,
  type StaffUserId,
} from '@domain/index';
import { CaseTimeline } from '@shared/cases/case-timeline';
import { CASE_COPY } from '@shared/cases/case.copy';
import { StatusTransition, type StatusTransitionRequest } from '@shared/cases/status-transition';
import { VulnerabilitySnapshotPanel } from '@shared/households/vulnerability-snapshot';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { CASES_COPY } from './cases.copy';

/** The most of a person's filed requests offered at once — the API's largest page. */
const REQUEST_CHOICES = 50;

/** One choice of who owes a task, worded for the reader. */
interface OwerChoice {
  readonly id: StaffUserId;
  readonly label: string;
}

/**
 * The case workspace.
 *
 * TAB 10's first acceptance criterion is that a caseworker can understand the
 * context **and the next action** without opening another module, and this
 * screen is where that is either true or not. Everything on it arrives in one
 * `getById` call: the person, the household and why it looks exposed, the
 * family, the assistance attached to the case, the running record, the tasks
 * and the merged timeline.
 *
 * What the screen refuses to do:
 *
 *  - **Change a status without a reason.** The move is made through the shared
 *    `StatusTransition` control, which will not enable its button until there
 *    are enough words, and the repository refuses the call regardless.
 *  - **Render a withheld word.** It never receives one: the data layer withholds
 *    a protected note's body, and on a protected person's case every word, and
 *    the screen says "withheld" where they would be (`DL-38`, `DL-179`).
 *  - **Offer a write the server refuses** (`DL-179`): nothing on a closed case,
 *    nothing to a reader whose words are withheld, no assignment to a caseload,
 *    and no closure while a task is open — each said in a sentence instead.
 */
@Component({
  selector: 'app-case-workspace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    CaseTimeline,
    DatePipe,
    Modal,
    NotConnected,
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
  private readonly requestRepository = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  /** Naming a request reads the person's requests; where they are not served, that is said (`DL-175`). */
  protected readonly servesRequests = inject(ServedPorts).serves('assistance-request');

  protected readonly copy = CASES_COPY.workspace;
  protected readonly noteCopy = CASES_COPY.noteForm;
  protected readonly taskCopy = CASES_COPY.taskForm;
  protected readonly handOverCopy = CASES_COPY.handOverForm;
  protected readonly rescheduleCopy = CASES_COPY.rescheduleForm;
  protected readonly completeCopy = CASES_COPY.completeForm;
  protected readonly cancelTaskCopy = CASES_COPY.cancelTaskForm;
  protected readonly endLinkCopy = CASES_COPY.endLinkForm;
  protected readonly linkCopy = CASES_COPY.linkForm;
  protected readonly shared = CASE_COPY;
  protected readonly statusCatalog = CASE_STATUS_CATALOG;
  protected readonly transitions = CASE_STATUS_TRANSITIONS;
  protected readonly taskStatusCatalog = CASE_TASK_STATUS_CATALOG;
  protected readonly requestCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly taskKinds = CASE_TASK_KINDS;
  protected readonly sensitivities = CASE_NOTE_SENSITIVITIES;

  private readonly reloads = signal(0);

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
  }

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<CaseId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<CaseWorkspace | null> },
  );

  protected readonly submitting = signal(false);

  protected readonly canManage = computed(() => this.permissions.has('case.manage'));
  /** Scheduling a home visit is the visit module's own key, not a case key (`DL-181`). */
  protected readonly canScheduleVisit = computed(() => this.permissions.has('visit.manage'));
  protected readonly canNote = computed(() => this.permissions.has('case.note'));
  protected readonly canWriteProtected = computed(() =>
    this.permissions.has('case-note.view-protected'),
  );
  /** Giving cases out, and opening them, is intake's and the head's — not a caseload's (`DL-179`). */
  protected readonly assigns = computed(() =>
    assignsCases(this.permissions.scope(), this.permissions.has('case.manage')),
  );
  /** The registry is refused to a caseload, so the person is not offered as a link it would bounce. */
  protected readonly readsRegistry = computed(
    () => this.permissions.scope() !== 'assigned-cases' && this.permissions.has('resident.view'),
  );

  protected readonly me = computed(() => this.session.user()?.id ?? null);
  protected readonly myName = computed(() => this.session.user()?.displayName ?? null);

  /* ── what this reader may do here ───────────────────────────────────────── */

  /** Open, and not a file whose words are withheld from this reader (`DL-53`, `DL-179`). */
  protected writable(workspace: CaseWorkspace): boolean {
    return isCaseWritable(workspace.record);
  }

  protected wordsWithheld(workspace: CaseWorkspace): boolean {
    return isCaseFieldWithheld(workspace.record, 'summary');
  }

  /**
   * Destinations this user may actually reach. Intersecting the lifecycle with the permissions here
   * — rather than showing everything and refusing later — keeps a user from being offered a move
   * that bounces them. Closing is held back while a task is open, because the office record refuses
   * it then (`DL-179`); `closeBlocked` says why.
   */
  protected permittedMoves(workspace: CaseWorkspace): readonly CaseStatus[] {
    const open = openTaskCount(workspace.tasks);
    return nextStatuses(CASE_STATUS_TRANSITIONS, workspace.record.status).filter(
      (to) =>
        this.permissions.has(permissionForCaseTransition(to)) && (to !== 'closed' || open === 0),
    );
  }

  /** How many open tasks stand between this reader and a closure they could otherwise make. */
  protected closeBlocked(workspace: CaseWorkspace): number {
    const closable =
      nextStatuses(CASE_STATUS_TRANSITIONS, workspace.record.status).includes('closed') &&
      this.permissions.has(permissionForCaseTransition('closed'));
    return closable ? openTaskCount(workspace.tasks) : 0;
  }

  protected continueParams(workspace: CaseWorkspace): Record<string, string> {
    return { continues: workspace.record.id, subject: workspace.record.subjectResidentId };
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

  protected unreadRequests(workspace: CaseWorkspace): number {
    return unreadLinkedRequestCount(workspace);
  }

  /** "Withheld" where the words would be — never a blank that reads as nothing written. */
  protected summaryText(workspace: CaseWorkspace): string {
    return workspace.record.summary ?? this.copy.withheld;
  }

  protected taskTitle(task: CaseTask): string {
    return task.title ?? this.copy.withheld;
  }

  protected taskOwner(task: CaseTask): string {
    if (task.assignedTo === null) {
      return this.copy.taskOwedByNobody;
    }
    return task.assignedToName ?? UNNAMED_STAFF;
  }

  protected outcomeText(task: CaseTask, workspace: CaseWorkspace): string | null {
    if (task.outcome !== null) {
      return task.outcome;
    }
    return !isTaskOpen(task) && isCaseFieldWithheld(workspace.record, 'taskWords')
      ? this.copy.withheld
      : null;
  }

  /**
   * "9 days overdue" / "Due in 3 days". Words, never a colour alone.
   *
   * A task that is finished is not late, however long ago its deadline was —
   * saying otherwise would put a permanent red mark against work that was done.
   */
  protected dueLabel(task: CaseTask): string {
    if (!isTaskOpen(task)) {
      return task.status === 'cancelled' ? this.copy.taskCancelled : this.copy.taskDone;
    }
    const days = daysUntil(task.dueOn, todayAsIsoDate());
    return days < 0 ? CASES_COPY.list.overdueBy(Math.abs(days)) : CASES_COPY.list.dueIn(days);
  }

  protected isLate(task: CaseTask): boolean {
    return isTaskOpen(task) && daysUntil(task.dueOn, todayAsIsoDate()) < 0;
  }

  /**
   * Who a task may be owed by, worded: the writer, whoever holds the case, or nobody (`DL-179`).
   * "Nobody" is the form's own first option.
   */
  protected owerChoices(workspace: CaseWorkspace): readonly OwerChoice[] {
    return taskAssigneeChoices(this.me(), workspace.record.assignedTo).map((id) => ({
      id,
      label:
        id === this.me()
          ? this.taskCopy.you(this.myName() ?? UNNAMED_STAFF)
          : this.taskCopy.holder(workspace.assignedToName ?? UNNAMED_STAFF),
    }));
  }

  /* ── status ─────────────────────────────────────────────────────────────── */

  protected onTransition(event: StatusTransitionRequest<CaseStatus>): void {
    this.run(this.repository.changeStatus(asId<CaseId>(this.id()), event.to, event.reason), {
      message: CASES_COPY.moved,
    });
  }

  /* ── assignment ─────────────────────────────────────────────────────────── */

  /**
   * To a named social worker, or to nobody (`DL-179`, superseding `DL-59`'s "take it or return
   * it"). The names come from the office's own list of open social-worker accounts, read when the
   * dialog opens; a caseload is never offered the dialog, as the server never offers it the list.
   */
  protected readonly assigning = signal(false);
  protected readonly assignee = signal<StaffUserId | null>(null);
  protected readonly assignReason = signal('');
  protected readonly assigneeState = signal<ViewState<readonly SocialWorker[]>>(LOADING);

  protected readonly canAssign = computed(
    () =>
      isValidCaseReason(this.assignReason()) &&
      this.assigneeState().kind === 'ready' &&
      !this.submitting(),
  );

  protected openAssign(workspace: CaseWorkspace): void {
    this.assignee.set(workspace.record.assignedTo);
    this.assignReason.set('');
    this.assigneeState.set(LOADING);
    this.assigning.set(true);
    this.load(this.repository.listAssignees(), (state) => this.assigneeState.set(state));
  }

  protected assignees(): readonly SocialWorker[] {
    const state = this.assigneeState();
    return state.kind === 'ready' ? state.value : [];
  }

  protected onAssignee(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.assignee.set(value ? asId<StaffUserId>(value) : null);
  }

  protected onAssignReason(event: Event): void {
    this.assignReason.set((event.target as HTMLTextAreaElement).value);
  }

  /**
   * Said before the assignment's button (`DL-183`): the open tasks the present holder owes go with
   * the case to whoever is chosen, or to nobody. `null` when nothing would move.
   */
  protected assignMovesTasks(workspace: CaseWorkspace): string | null {
    const holder = workspace.record.assignedTo;
    const chosen = this.assignee();
    if (holder === null || chosen === holder) {
      return null;
    }
    const owed = workspace.tasks.filter((task) => isTaskOpen(task) && task.assignedTo === holder);
    if (owed.length === 0) {
      return null;
    }
    const to =
      chosen === null
        ? null
        : (this.assignees().find((worker) => worker.id === chosen)?.name ?? UNNAMED_STAFF);
    return this.copy.assignMovesTasks(owed.length, workspace.assignedToName ?? UNNAMED_STAFF, to);
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

  /* ── naming a request ───────────────────────────────────────────────────── */

  protected readonly linking = signal(false);
  protected readonly linkChoice = signal<AssistanceRequestId | null>(null);
  protected readonly linkReason = signal('');
  protected readonly linkState = signal<ViewState<CursorPage<AssistanceRequest>>>(LOADING);

  protected readonly canLink = computed(
    () => this.linkChoice() !== null && isValidCaseReason(this.linkReason()) && !this.submitting(),
  );

  /** The subject's filed requests, read through the request port (`DL-179`). */
  protected openLink(workspace: CaseWorkspace): void {
    this.linkChoice.set(null);
    this.linkReason.set('');
    this.linkState.set(LOADING);
    this.linking.set(true);
    this.load(
      this.requestRepository.list(
        { residentId: workspace.record.subjectResidentId },
        { limit: REQUEST_CHOICES, cursor: null },
      ),
      (state) => this.linkState.set(state),
    );
  }

  /** The person's filed requests this case does not already name. */
  protected linkOptions(workspace: CaseWorkspace): readonly AssistanceRequest[] {
    const state = this.linkState();
    return state.kind === 'ready'
      ? state.value.items.filter(
          (request) => !workspace.record.linkedRequestIds.includes(request.id),
        )
      : [];
  }

  protected moreRequests(): boolean {
    const state = this.linkState();
    return state.kind === 'ready' && state.value.hasMore;
  }

  protected onLinkChoice(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.linkChoice.set(value ? asId<AssistanceRequestId>(value) : null);
  }

  protected onLinkReason(event: Event): void {
    this.linkReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmLink(): void {
    const requestId = this.linkChoice();
    if (requestId === null || !this.canLink()) {
      return;
    }
    this.run(
      this.repository.linkRequest(asId<CaseId>(this.id()), requestId, this.linkReason().trim()),
      { message: this.linkCopy.saved, close: () => this.linking.set(false) },
    );
  }

  /* ── notes ──────────────────────────────────────────────────────────────── */

  protected readonly noting = signal(false);
  protected readonly noteBody = signal('');
  protected readonly noteSensitivity = signal<CaseNoteSensitivity>('routine');
  protected readonly noteReason = signal('');

  protected readonly canSaveNote = computed(
    () =>
      isValidNoteBody(this.noteBody()) &&
      isValidCaseReason(this.noteReason()) &&
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
  protected readonly taskTitleText = signal('');
  protected readonly taskKind = signal<CaseTaskKind>('follow-up');
  protected readonly taskDueOn = signal(todayAsIsoDate());
  protected readonly taskOwer = signal<StaffUserId | null>(null);
  protected readonly taskReason = signal('');

  protected readonly canSaveTask = computed(
    () =>
      this.taskTitleText().trim().length > 0 &&
      isValidCaseReason(this.taskReason()) &&
      !this.submitting(),
  );

  protected openTask(workspace: CaseWorkspace): void {
    this.taskTitleText.set('');
    this.taskKind.set('follow-up');
    this.taskDueOn.set(todayAsIsoDate());
    // Whoever holds the case, as before — one of the choices the server accepts.
    this.taskOwer.set(workspace.record.assignedTo);
    this.taskReason.set('');
    this.tasking.set(true);
  }

  protected onTaskTitle(event: Event): void {
    this.taskTitleText.set((event.target as HTMLInputElement).value);
  }

  protected onTaskKind(event: Event): void {
    this.taskKind.set((event.target as HTMLSelectElement).value as CaseTaskKind);
  }

  protected onTaskDueOn(event: Event): void {
    this.taskDueOn.set(asIsoDate((event.target as HTMLInputElement).value));
  }

  protected onTaskOwer(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.taskOwer.set(value ? asId<StaffUserId>(value) : null);
  }

  protected onTaskReason(event: Event): void {
    this.taskReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmTask(): void {
    if (!this.canSaveTask()) {
      return;
    }
    this.run(
      this.repository.addTask(
        asId<CaseId>(this.id()),
        {
          title: this.taskTitleText().trim(),
          kind: this.taskKind(),
          dueOn: this.taskDueOn(),
          assignedTo: this.taskOwer(),
        },
        this.taskReason().trim(),
      ),
      { message: this.taskCopy.saved, close: () => this.tasking.set(false) },
    );
  }

  /* ── handing a task over ────────────────────────────────────────────────── */

  protected readonly handingOver = signal<CaseTaskId | null>(null);
  protected readonly handOverOwer = signal<StaffUserId | null>(null);
  protected readonly handOverReason = signal('');

  protected readonly canHandOver = computed(
    () => isValidCaseReason(this.handOverReason()) && !this.submitting(),
  );

  protected openHandOver(task: CaseTask): void {
    this.handOverOwer.set(task.assignedTo);
    this.handOverReason.set('');
    this.handingOver.set(task.id);
  }

  protected onHandOverOwer(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.handOverOwer.set(value ? asId<StaffUserId>(value) : null);
  }

  protected onHandOverReason(event: Event): void {
    this.handOverReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmHandOver(): void {
    const taskId = this.handingOver();
    if (taskId === null || !this.canHandOver()) {
      return;
    }
    this.run(
      this.repository.assignTask(
        asId<CaseId>(this.id()),
        taskId,
        this.handOverOwer(),
        this.handOverReason().trim(),
      ),
      { message: this.handOverCopy.saved, close: () => this.handingOver.set(null) },
    );
  }

  /* ── moving a task's date ───────────────────────────────────────────────── */

  protected readonly rescheduling = signal<CaseTaskId | null>(null);
  protected readonly rescheduleDueOn = signal(todayAsIsoDate());
  protected readonly rescheduleReason = signal('');

  protected readonly canReschedule = computed(
    () => isValidCaseReason(this.rescheduleReason()) && !this.submitting(),
  );

  protected openReschedule(task: CaseTask): void {
    this.rescheduleDueOn.set(task.dueOn);
    this.rescheduleReason.set('');
    this.rescheduling.set(task.id);
  }

  protected onRescheduleDueOn(event: Event): void {
    this.rescheduleDueOn.set(asIsoDate((event.target as HTMLInputElement).value));
  }

  protected onRescheduleReason(event: Event): void {
    this.rescheduleReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmReschedule(): void {
    const taskId = this.rescheduling();
    if (taskId === null || !this.canReschedule()) {
      return;
    }
    this.run(
      this.repository.rescheduleTask(
        asId<CaseId>(this.id()),
        taskId,
        this.rescheduleDueOn(),
        this.rescheduleReason().trim(),
      ),
      { message: this.rescheduleCopy.saved, close: () => this.rescheduling.set(null) },
    );
  }

  /* ── completing a task ──────────────────────────────────────────────────── */

  protected readonly completing = signal<CaseTaskId | null>(null);
  protected readonly outcome = signal('');

  protected readonly canComplete = computed(
    () => isValidCaseReason(this.outcome()) && !this.submitting(),
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

  /* ── cancelling a task ───────────────────────────────────────────────── */

  /**
   * A task no longer needed is cancelled with the reason, kept, never deleted (`DL-183`). Offered
   * on every open task, and listed again where closing is held back, so the way to a closable case
   * is on the screen that says it is blocked.
   */
  protected readonly cancellingTask = signal<CaseTaskId | null>(null);
  protected readonly cancelTaskReason = signal('');

  protected readonly canCancelTask = computed(
    () => isValidCaseReason(this.cancelTaskReason()) && !this.submitting(),
  );

  protected openCancelTask(task: CaseTask): void {
    this.cancelTaskReason.set('');
    this.cancellingTask.set(task.id);
  }

  protected onCancelTaskReason(event: Event): void {
    this.cancelTaskReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmCancelTask(): void {
    const taskId = this.cancellingTask();
    if (taskId === null || !this.canCancelTask()) {
      return;
    }
    this.run(
      this.repository.cancelTask(asId<CaseId>(this.id()), taskId, this.cancelTaskReason().trim()),
      { message: this.cancelTaskCopy.saved, close: () => this.cancellingTask.set(null) },
    );
  }

  /** The open tasks standing between this reader and a closure they could otherwise make. */
  protected openTasks(workspace: CaseWorkspace): readonly CaseTask[] {
    return workspace.tasks.filter((task) => isTaskOpen(task));
  }

  /* ── ending a request's link ──────────────────────────────────────────── */

  /**
   * A request named in error is no longer part of the case: the link is ended with a reason and
   * kept in the history, never removed (`DL-183`).
   */
  protected readonly endingLink = signal<AssistanceRequestId | null>(null);
  protected readonly endLinkReason = signal('');

  protected readonly canEndLink = computed(
    () => isValidCaseReason(this.endLinkReason()) && !this.submitting(),
  );

  protected openEndLink(request: AssistanceRequest): void {
    this.endLinkReason.set('');
    this.endingLink.set(request.id);
  }

  protected onEndLinkReason(event: Event): void {
    this.endLinkReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirmEndLink(): void {
    const requestId = this.endingLink();
    if (requestId === null || !this.canEndLink()) {
      return;
    }
    this.run(
      this.repository.endRequestLink(
        asId<CaseId>(this.id()),
        requestId,
        this.endLinkReason().trim(),
      ),
      { message: this.endLinkCopy.saved, close: () => this.endingLink.set(null) },
    );
  }

  protected cancel(): void {
    this.assigning.set(false);
    this.linking.set(false);
    this.noting.set(false);
    this.tasking.set(false);
    this.handingOver.set(null);
    this.rescheduling.set(null);
    this.completing.set(null);
    this.cancellingTask.set(null);
    this.endingLink.set(null);
  }

  /** A read a dialog needs, held as a view state so a refusal is said in the dialog. */
  private load<TValue>(call: Observable<TValue>, into: (state: ViewState<TValue>) => void): void {
    toViewState(call).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(into);
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
    call: Observable<CaseWorkspace>,
    options: { message: string; close?: () => void },
  ): void {
    this.submitting.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
