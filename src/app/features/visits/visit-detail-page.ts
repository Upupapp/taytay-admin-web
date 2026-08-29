import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  FIELD_VISIT_REPOSITORY,
  OBSERVATION_KIND_DESCRIPTIONS,
  OBSERVATION_KIND_LABELS,
  OBSERVATION_KINDS,
  VISIT_PURPOSE_LABELS,
  VISIT_STATUS_CATALOG,
  asId,
  isAllJudgement,
  isVisitOpen,
  needsAttribution,
  observationProblems,
  type FieldVisit,
  type FieldVisitId,
  type ObservationKind,
  type VisitObservation,
  type VisitStatus,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { VISITS_COPY } from './visits.copy';

/**
 * One visit, and the record of what was found there.
 *
 * The entry form makes the **kind** the first choice rather than a detail at
 * the end. A worker who has already written a paragraph will not go back and
 * reclassify it; asking first is what makes the distinction real rather than
 * decorative (`DL-85`).
 */
@Component({
  selector: 'app-visit-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink, StatusBadge],
  templateUrl: './visit-detail-page.html',
  styleUrl: './visit-detail-page.scss',
})
export class VisitDetailPage {
  private readonly repository = inject(FIELD_VISIT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  readonly id = input.required<string>();

  protected readonly copy = VISITS_COPY.detail;
  protected readonly statusCatalog = VISIT_STATUS_CATALOG;
  protected readonly kinds = OBSERVATION_KINDS;

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<FieldVisitId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<FieldVisit | null> },
  );

  protected readonly visit = computed(() => valueOf(this.state()) ?? null);
  protected readonly canManage = computed(() => this.permissions.has('case.manage'));
  protected readonly isOpen = computed(() => {
    const visit = this.visit();
    return visit !== null && isVisitOpen(visit.status);
  });

  /** Surfaced, never blocked: a record of only judgements is worth noticing. */
  protected readonly allJudgement = computed(() =>
    isAllJudgement(this.visit()?.observations ?? []),
  );

  /* ── recording an observation ───────────────────────────────────────────── */

  protected readonly kind = signal<ObservationKind>('observed');
  protected readonly body = signal('');
  protected readonly attribution = signal('');

  protected readonly needsWho = computed(() => needsAttribution(this.kind()));

  protected readonly canAddObservation = computed(() => {
    if (this.saving()) {
      return false;
    }
    return (
      observationProblems({
        kind: this.kind(),
        body: this.body(),
        attributedTo: this.needsWho() ? this.attribution() : null,
      }).length === 0
    );
  });

  protected kindLabel(kind: ObservationKind): string {
    return OBSERVATION_KIND_LABELS[kind];
  }

  protected kindDescription(kind: ObservationKind): string {
    return OBSERVATION_KIND_DESCRIPTIONS[kind];
  }

  protected observationLabel(observation: VisitObservation): string {
    return OBSERVATION_KIND_LABELS[observation.kind];
  }

  protected purposeLabel(visit: FieldVisit): string {
    return VISIT_PURPOSE_LABELS[visit.purpose];
  }

  protected onKind(kind: ObservationKind): void {
    this.kind.set(kind);
    if (!needsAttribution(kind)) {
      // Clearing it keeps the form from carrying a value the domain would then
      // reject as "not applicable".
      this.attribution.set('');
    }
  }

  protected onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected onAttribution(event: Event): void {
    this.attribution.set((event.target as HTMLInputElement).value);
  }

  protected async addObservation(): Promise<void> {
    if (!this.canAddObservation()) {
      return;
    }
    await this.run(
      this.repository.recordObservations(asId<FieldVisitId>(this.id()), [
        {
          kind: this.kind(),
          body: this.body(),
          attributedTo: this.needsWho() ? this.attribution() : null,
        },
      ]),
      this.copy.observationSaved,
      () => {
        this.body.set('');
        this.attribution.set('');
      },
    );
  }

  /* ── the checklist ──────────────────────────────────────────────────────── */

  private readonly ticked = signal<readonly string[] | null>(null);

  protected checked(code: string): boolean {
    const local = this.ticked();
    if (local !== null) {
      return local.includes(code);
    }
    return this.visit()?.checklist.find((item) => item.code === code)?.checked ?? false;
  }

  protected onTick(code: string, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    const current =
      this.ticked() ??
      (this.visit()?.checklist ?? []).filter((item) => item.checked).map((item) => item.code);
    this.ticked.set(on ? [...current, code] : current.filter((entry) => entry !== code));
  }

  protected async saveChecklist(): Promise<void> {
    const codes = this.ticked();
    const visit = this.visit();

    if (codes === null || visit === null || this.saving()) {
      return;
    }

    /*
     * Every line, with the state it should end in — not just the ticks.
     *
     * The API records one line per call and touches nothing else, so sending only the ticked codes
     * could never clear one. A worker who removed a tick would have found it still there.
     */
    const items = visit.checklist.map((item) => ({
      code: item.code,
      checked: codes.includes(item.code),
    }));

    await this.run(
      this.repository.setChecklist(asId<FieldVisitId>(this.id()), items),
      this.copy.checklistSaved,
      () => this.ticked.set(null),
    );
  }

  /* ── closing ────────────────────────────────────────────────────────────── */

  protected readonly outcomeStatus = signal<Exclude<VisitStatus, 'scheduled'>>('completed');
  protected readonly outcomeText = signal('');
  protected readonly serviceNeeds = signal('');
  protected readonly declinedReason = signal('');

  protected readonly closingStatuses: readonly Exclude<VisitStatus, 'scheduled'>[] = [
    'completed',
    'not-found',
    'refused',
    'cancelled',
  ];

  protected readonly isRefusal = computed(() => this.outcomeStatus() === 'refused');
  protected readonly canClose = computed(
    () => this.outcomeText().trim().length > 0 && !this.saving(),
  );

  protected onOutcomeStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Exclude<VisitStatus, 'scheduled'>;
    this.outcomeStatus.set(value);
    if (value !== 'refused') {
      // A declined reason on any other outcome would put words in a
      // household's mouth, and the domain refuses it.
      this.declinedReason.set('');
    }
  }

  protected onOutcomeText(event: Event): void {
    this.outcomeText.set((event.target as HTMLTextAreaElement).value);
  }

  protected onServiceNeeds(event: Event): void {
    this.serviceNeeds.set((event.target as HTMLTextAreaElement).value);
  }

  protected onDeclinedReason(event: Event): void {
    this.declinedReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected async closeVisit(): Promise<void> {
    if (!this.canClose()) {
      return;
    }
    await this.run(
      this.repository.close(asId<FieldVisitId>(this.id()), {
        status: this.outcomeStatus(),
        outcome: this.outcomeText(),
        serviceNeeds: this.serviceNeeds().trim() || null,
        declinedReason: this.isRefusal() ? this.declinedReason().trim() || null : null,
      }),
      this.copy.closed,
      () => {
        this.outcomeText.set('');
        this.serviceNeeds.set('');
        this.declinedReason.set('');
      },
    );
  }

  private async run(
    call: ReturnType<typeof this.repository.setChecklist>,
    message: string,
    onSuccess: () => void,
  ): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      onSuccess();
      this.notifications.success(message);
      this.reloads.update((value) => value + 1);
    } catch {
      // Reported, never swallowed: a worker who believes an observation was
      // recorded will not write it again.
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
