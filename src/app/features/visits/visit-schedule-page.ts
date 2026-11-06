import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  CASE_REPOSITORY,
  FIELD_VISIT_REPOSITORY,
  VISIT_CHECKLIST_PROMPTS,
  VISIT_PURPOSES,
  VISIT_PURPOSE_LABELS,
  asId,
  asIsoDate,
  todayAsIsoDate,
  visitDraftProblems,
  type CaseId,
  type CaseWorkspace,
  type FieldVisitDraft,
  type StaffUserId,
  type VisitPurpose,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { VISITS_COPY } from './visits.copy';

interface Worker {
  readonly id: StaffUserId;
  readonly name: string;
}

/**
 * Scheduling a home visit on a case (`DL-181`), reached from the case with `?case=`.
 *
 * What a visit is for, who goes, on what day and roughly when, and the address it is made to —
 * copied from the person's record and editable, because a family between addresses is visited where
 * it is. There is no field for where anybody will be or was (`DL-86`).
 *
 * The worker offered is one who can open the visit afterwards: the case's own worker, or the
 * signed-in account when it is not confined to a caseload. The server refuses anyone else, so the
 * screen does not offer them.
 */
@Component({
  selector: 'app-visit-schedule-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink],
  templateUrl: './visit-schedule-page.html',
  styleUrl: './visit-schedule-page.scss',
})
export class VisitSchedulePage {
  private readonly visits = inject(FIELD_VISIT_REPOSITORY);
  private readonly cases = inject(CASE_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  /** The case, from `?case=` (`withComponentInputBinding`). */
  readonly case = input<string>('');

  protected readonly copy = VISITS_COPY.schedule;
  protected readonly purposes = VISIT_PURPOSES;
  protected readonly prompts = VISIT_CHECKLIST_PROMPTS;
  protected readonly today = todayAsIsoDate();

  /** Bumped by "Try again", to ask the same question again. */
  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.case(), nonce: this.reloads() }))).pipe(
      switchMap(({ id }) =>
        toViewState(id === '' ? of(null) : this.cases.getById(asId<CaseId>(id))),
      ),
    ),
    { initialValue: LOADING as ViewState<CaseWorkspace | null> },
  );

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
  }

  protected readonly workspace = computed(() => valueOf(this.state()) ?? null);

  protected readonly purpose = signal<VisitPurpose>('follow-up');
  protected readonly scheduledFor = signal<string>(this.today);
  protected readonly scheduledWindow = signal('');
  /** `null` until somebody edits it: until then it is the address on the person's record. */
  private readonly addressEdit = signal<string | null>(null);
  private readonly chosenWorker = signal<StaffUserId | null>(null);
  protected readonly saving = signal(false);

  /** The street and purok on the person's record, unless the registry withheld them from this reader. */
  private readonly recordedAddress = computed(() => {
    const workspace = this.workspace();
    if (workspace === null || workspace.subject.withheld.includes('exactAddress')) {
      return '';
    }
    const address = workspace.subject.resident.address;
    return [address.streetAddress, address.purokOrSitio]
      .filter((part): part is string => part !== null && part.trim() !== '')
      .join(', ');
  });

  protected readonly address = computed(() => this.addressEdit() ?? this.recordedAddress());

  /** Who may be sent: somebody who can open the visit afterwards (`DL-179`). */
  protected readonly workers = computed<readonly Worker[]>(() => {
    const workspace = this.workspace();
    const me = this.session.user();
    const offered: Worker[] = [];
    const caseWorker = workspace?.record.assignedTo ?? null;
    if (caseWorker !== null) {
      offered.push({ id: caseWorker, name: workspace?.assignedToName ?? this.copy.caseWorker });
    }
    if (me !== null && me.id !== caseWorker && me.scope !== 'assigned-cases') {
      offered.push({ id: me.id, name: this.copy.you(me.displayName) });
    }
    return offered;
  });

  protected readonly worker = computed(() => this.chosenWorker() ?? this.workers()[0]?.id ?? null);

  private readonly draft = computed<FieldVisitDraft | null>(() => {
    const workspace = this.workspace();
    const worker = this.worker();
    if (workspace === null || worker === null || this.scheduledFor() === '') {
      return null;
    }
    return {
      caseId: workspace.record.id,
      residentId: workspace.record.subjectResidentId,
      householdId: workspace.record.householdId,
      purpose: this.purpose(),
      assignedTo: worker,
      scheduledFor: asIsoDate(this.scheduledFor()),
      scheduledWindow: this.scheduledWindow().trim() || null,
      addressVisited: this.address(),
      checklist: this.prompts.map((prompt) => ({ ...prompt, checked: false, note: null })),
    };
  });

  protected readonly canSchedule = computed(() => {
    const draft = this.draft();
    return (
      draft !== null &&
      visitDraftProblems(draft, this.today).length === 0 &&
      this.workspace()?.record.status !== 'closed' &&
      !this.saving()
    );
  });

  protected purposeLabel(purpose: VisitPurpose): string {
    return VISIT_PURPOSE_LABELS[purpose];
  }

  protected onPurpose(event: Event): void {
    this.purpose.set((event.target as HTMLSelectElement).value as VisitPurpose);
  }

  protected onDate(event: Event): void {
    this.scheduledFor.set((event.target as HTMLInputElement).value);
  }

  protected onWindow(event: Event): void {
    this.scheduledWindow.set((event.target as HTMLInputElement).value);
  }

  protected onAddress(event: Event): void {
    this.addressEdit.set((event.target as HTMLInputElement).value);
  }

  protected onWorker(event: Event): void {
    this.chosenWorker.set(asId<StaffUserId>((event.target as HTMLSelectElement).value));
  }

  /**
   * Schedules it, and goes to it. The server answers with the visit as the office record holds it,
   * or refuses — and a refusal leaves nothing scheduled, which the message says (`DL-87`).
   */
  protected async schedule(): Promise<void> {
    const draft = this.draft();
    if (draft === null || !this.canSchedule()) {
      return;
    }
    this.saving.set(true);
    try {
      const visit = await firstValueFrom(this.visits.schedule(draft));
      this.notifications.success(this.copy.scheduled);
      void this.router.navigate(['/visits', visit.id]);
    } catch (failure: unknown) {
      this.notifications.error(
        failure instanceof Error && failure.message !== '' ? failure.message : this.copy.notScheduled,
      );
    } finally {
      this.saving.set(false);
    }
  }
}
