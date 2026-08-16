import { Injectable } from '@angular/core';

import {
  asId,
  asIsoDateTime,
  EMPTY_CASE_SUBJECT,
  todayAsIsoDate,
  type CaseEvent,
  type CaseEventId,
  type CaseEventKind,
  type CaseEventSubject,
  type CaseId,
  type CaseNote,
  type CaseNoteId,
  type CaseNoteSensitivity,
  type CaseStatus,
  type CaseTask,
  type CaseTaskDraft,
  type CaseTaskId,
  type IsoDate,
  type ResidentId,
  type SocialCase,
  type StaffUserId,
} from '@domain/index';

import { MOCK_CASE_EVENTS, MOCK_CASE_NOTES, MOCK_CASE_TASKS, MOCK_CASES } from './seed/cases.seed';

export interface CaseActor {
  readonly id: StaffUserId | null;
  readonly name: string;
}

/**
 * Mutable mock state for cases, their notes, their tasks and their history.
 *
 * The one property this store exists to guarantee: **every material change
 * appends an event, in the same act as the change** (`DL-54`). There is no
 * method here that edits or deletes history, and none that changes a case
 * without calling `append`. `tools/check-case-audit.mjs` fails the build if
 * either becomes untrue, because a comment saying "always write an event" does
 * not survive the third hurried change that forgets.
 *
 * Notes are stored whole. Redaction happens on the way out, in the repository,
 * so the store never has to know who is asking (`DL-38`).
 */
@Injectable({ providedIn: 'root' })
export class MockCaseStore {
  private cases: readonly SocialCase[] = [...MOCK_CASES];
  private notes: readonly CaseNote[] = [...MOCK_CASE_NOTES];
  private tasks: readonly CaseTask[] = [...MOCK_CASE_TASKS];
  private events: readonly CaseEvent[] = [...MOCK_CASE_EVENTS];
  private sequence = MOCK_CASE_EVENTS.length;

  allCases(): readonly SocialCase[] {
    return this.cases;
  }

  findCase(id: CaseId): SocialCase | undefined {
    return this.cases.find((record) => record.id === id);
  }

  casesForResident(residentId: ResidentId): readonly SocialCase[] {
    return this.cases.filter((record) => record.subjectResidentId === residentId);
  }

  findTask(id: CaseTaskId): CaseTask | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  notesFor(id: CaseId): readonly CaseNote[] {
    return this.notes.filter((note) => note.caseId === id);
  }

  tasksFor(id: CaseId): readonly CaseTask[] {
    return this.tasks.filter((task) => task.caseId === id);
  }

  allTasks(): readonly CaseTask[] {
    return this.tasks;
  }

  allEvents(): readonly CaseEvent[] {
    return this.events;
  }

  eventsFor(id: CaseId): readonly CaseEvent[] {
    return this.events.filter((event) => event.caseId === id);
  }

  /* ── Lifecycle ──────────────────────────────────────────────────────────── */

  /**
   * Moves a case and records the move in one act.
   *
   * Idempotent by outcome: a case already in the requested status is returned
   * untouched and no second event is written. A retried request on a municipal
   * connection is the ordinary case, and it must not double the history
   * (`DL-51`, carried forward).
   */
  changeStatus(record: SocialCase, to: CaseStatus, reason: string, actor: CaseActor): SocialCase {
    if (record.status === to) {
      return record;
    }
    const now = asIsoDateTime(new Date());
    const updated: SocialCase = {
      ...record,
      status: to,
      closedOn: to === 'closed' ? todayAsIsoDate() : record.closedOn,
      audit: { ...record.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.cases = this.cases.map((candidate) => (candidate.id === record.id ? updated : candidate));
    this.append('status-changed', record.id, reason, actor, EMPTY_CASE_SUBJECT, record.status, to);
    return updated;
  }

  assign(
    record: SocialCase,
    staffUserId: StaffUserId | null,
    reason: string,
    actor: CaseActor,
  ): SocialCase {
    if (record.assignedTo === staffUserId) {
      return record;
    }
    const now = asIsoDateTime(new Date());
    const updated: SocialCase = {
      ...record,
      assignedTo: staffUserId,
      audit: { ...record.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.cases = this.cases.map((candidate) => (candidate.id === record.id ? updated : candidate));
    this.append(staffUserId === null ? 'unassigned' : 'assigned', record.id, reason, actor, {
      ...EMPTY_CASE_SUBJECT,
      staffUserId,
    });
    return updated;
  }

  /* ── The running record ─────────────────────────────────────────────────── */

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
    actor: CaseActor,
  ): CaseNote {
    this.sequence += 1;
    const created: CaseNote = {
      id: asId<CaseNoteId>(`cnote-${String(1000 + this.sequence)}`),
      caseId: id,
      authorId: actor.id,
      authorName: actor.name,
      body: body.trim(),
      sensitivity,
      createdAt: asIsoDateTime(new Date()),
    };
    this.notes = [...this.notes, created];
    this.append('note-added', id, reason, actor, { ...EMPTY_CASE_SUBJECT, noteId: created.id });
    return created;
  }

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string, actor: CaseActor): CaseTask {
    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const created: CaseTask = {
      id: asId<CaseTaskId>(`task-${String(1000 + this.sequence)}`),
      caseId: id,
      title: draft.title.trim(),
      kind: draft.kind,
      status: 'open',
      dueOn: draft.dueOn,
      assignedTo: draft.assignedTo,
      completedAt: null,
      completedBy: null,
      outcome: null,
      audit: { createdAt: now, createdBy: actor.id, updatedAt: now, updatedBy: actor.id },
    };
    this.tasks = [...this.tasks, created];
    this.append('task-added', id, reason, actor, { ...EMPTY_CASE_SUBJECT, taskId: created.id });
    return created;
  }

  /**
   * Completes a task. **Marks it done; never removes the row.** What the office
   * undertook to do is part of the record even once it is finished, and the
   * outcome is where the reason lives.
   */
  completeTask(task: CaseTask, reason: string, actor: CaseActor): CaseTask {
    if (task.status !== 'open') {
      return task;
    }
    const now = asIsoDateTime(new Date());
    const completed: CaseTask = {
      ...task,
      status: 'done',
      completedAt: now,
      completedBy: actor.id,
      outcome: reason.trim(),
      audit: { ...task.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.tasks = this.tasks.map((candidate) => (candidate.id === task.id ? completed : candidate));
    this.append('task-completed', task.caseId, reason, actor, {
      ...EMPTY_CASE_SUBJECT,
      taskId: task.id,
    });
    return completed;
  }

  /**
   * Hands a task to somebody, or back to the unassigned pool.
   *
   * Appends like every other mutation here (`DL-54`). A task that changes hands
   * silently is one nobody can be asked about later, and "who was supposed to
   * do this?" is the first question after a family is missed.
   */
  assignTask(
    task: CaseTask,
    staffUserId: StaffUserId | null,
    reason: string,
    actor: CaseActor,
  ): CaseTask {
    const now = asIsoDateTime(new Date());
    const updated: CaseTask = {
      ...task,
      assignedTo: staffUserId,
      audit: { ...task.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.tasks = this.tasks.map((candidate) => (candidate.id === task.id ? updated : candidate));
    this.append('task-reassigned', task.caseId, reason, actor, {
      ...EMPTY_CASE_SUBJECT,
      taskId: task.id,
    });
    return updated;
  }

  /**
   * Moves a task's due date, with the reason recorded.
   *
   * This is what "snooze" is here. A hidden timer that quietly pushes a task a
   * week leaves a file showing nothing while a household waits a month
   * (`DL-99`).
   */
  rescheduleTask(task: CaseTask, dueOn: IsoDate, reason: string, actor: CaseActor): CaseTask {
    const now = asIsoDateTime(new Date());
    const updated: CaseTask = {
      ...task,
      dueOn,
      audit: { ...task.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.tasks = this.tasks.map((candidate) => (candidate.id === task.id ? updated : candidate));
    this.append('task-rescheduled', task.caseId, reason, actor, {
      ...EMPTY_CASE_SUBJECT,
      taskId: task.id,
    });
    return updated;
  }

  /* ── History ────────────────────────────────────────────────────────────── */

  /**
   * Appends one immutable event. There is deliberately no update or delete
   * counterpart: the only way a case's history changes is by growing.
   */
  private append(
    kind: CaseEventKind,
    caseId: CaseId,
    reason: string,
    actor: CaseActor,
    subject: CaseEventSubject,
    fromStatus: CaseStatus | null = null,
    toStatus: CaseStatus | null = null,
  ): void {
    this.sequence += 1;
    this.events = [
      ...this.events,
      {
        id: asId<CaseEventId>(`cevt-${String(this.sequence).padStart(5, '0')}`),
        caseId,
        kind,
        fromStatus,
        toStatus,
        reason: reason.trim(),
        actorId: actor.id,
        actorName: actor.name,
        occurredAt: asIsoDateTime(new Date()),
        subject,
      },
    ];
  }
}
