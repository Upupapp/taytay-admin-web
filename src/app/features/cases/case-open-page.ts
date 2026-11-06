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
import { Router, RouterLink } from '@angular/router';
import { of, switchMap, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  CASE_CATEGORIES,
  CASE_REPOSITORY,
  CASE_SUMMARY_MAX_LENGTH,
  RESIDENT_REPOSITORY,
  asId,
  assignsCases,
  caseOpenProblems,
  isValidCaseReason,
  type AssistanceRequest,
  type AssistanceRequestId,
  type CaseCategory,
  type CaseId,
  type CaseWorkspace,
  type CursorPage,
  type ResidentId,
  type ResidentView,
} from '@domain/index';
import { CASE_COPY } from '@shared/cases/case.copy';
import { PersonPicker } from '@shared/residents/person-picker';
import { LOADING, ready, toViewState, type ViewState } from '@shared/state/view-state';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { CASES_COPY } from './cases.copy';

/** The most of a person's filed requests offered at once — the API's largest page. */
const REQUEST_CHOICES = 50;

/**
 * Opening a case (`DL-179`).
 *
 * A case opens at intake, assigned to nobody, about **one person** found with the shared
 * `PersonPicker` — the only sanctioned resident search — so the subject is somebody already on the
 * registry. It may name the person's filed requests it covers, and it may continue a **closed**
 * case: `?continues=` and `?subject=` arrive from a closed case's workspace, which is the only way a
 * recurrence is recorded (`DL-53`).
 *
 * Opening is an assigner's act — intake's and the head's. An account that works its own caseload is
 * told so in a sentence rather than shown a form the server refuses.
 */
@Component({
  selector: 'app-case-open-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, PersonPicker, RouterLink],
  templateUrl: './case-open-page.html',
  styleUrl: './case-open-page.scss',
})
export class CaseOpenPage {
  private readonly repository = inject(CASE_REPOSITORY);
  private readonly requestRepository = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly residents = inject(RESIDENT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** The closed case this one continues, from the query string. */
  readonly continues = input<string | undefined>();
  /** The person, preset from the query string when continuing a case. */
  readonly subject = input<string | undefined>();

  protected readonly copy = CASES_COPY.openForm;
  protected readonly categories = CASE_CATEGORIES;
  protected readonly requestCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly summaryMax = CASE_SUMMARY_MAX_LENGTH;

  protected readonly opensCases = computed(() =>
    assignsCases(this.permissions.scope(), this.permissions.has('case.manage')),
  );

  protected readonly subjectView = signal<ResidentView | null>(null);
  protected readonly category = signal<CaseCategory | null>(null);
  protected readonly summary = signal('');
  protected readonly reason = signal('');
  protected readonly chosenRequests = signal<readonly AssistanceRequestId[]>([]);
  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** The person named in the query string, read once and put in the picker. */
  protected readonly presetState = toSignal(
    toObservable(this.subject).pipe(
      switchMap((id) =>
        id === undefined || id === ''
          ? of(ready<ResidentView | null>(null))
          : toViewState(this.residents.getById(asId<ResidentId>(id))),
      ),
      tap((state) => {
        if (state.kind === 'ready' && state.value !== null) {
          this.subjectView.set(state.value);
        }
      }),
    ),
    { initialValue: LOADING as ViewState<ResidentView | null> },
  );

  /** The closed case being continued, for its reference. */
  protected readonly priorState = toSignal(
    toObservable(this.continues).pipe(
      switchMap((id) =>
        id === undefined || id === ''
          ? of(ready<CaseWorkspace | null>(null))
          : toViewState(this.repository.getById(asId<CaseId>(id))),
      ),
    ),
    { initialValue: LOADING as ViewState<CaseWorkspace | null> },
  );

  /** The chosen person's filed requests, read again whenever the person changes. */
  protected readonly requestState = toSignal(
    toObservable(computed(() => this.subjectView()?.resident.id ?? null)).pipe(
      tap(() => this.chosenRequests.set([])),
      switchMap((residentId) =>
        residentId === null
          ? of(ready<CursorPage<AssistanceRequest> | null>(null))
          : toViewState(
              this.requestRepository.list({ residentId }, { limit: REQUEST_CHOICES, cursor: null }),
            ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AssistanceRequest> | null> },
  );

  protected readonly requestPage = computed(() => {
    const state = this.requestState();
    return state.kind === 'ready' ? state.value : null;
  });

  protected readonly summaryProblem = computed(() => {
    const written = this.summary().trim();
    if (written === '') {
      return null;
    }
    const problem = caseOpenProblems({ summary: written })[0];
    return problem === 'summary-too-short'
      ? this.copy.summaryTooShort
      : problem === 'summary-too-long'
        ? this.copy.summaryTooLong
        : null;
  });

  protected readonly canOpen = computed(
    () =>
      this.subjectView() !== null &&
      this.category() !== null &&
      caseOpenProblems({ summary: this.summary() }).length === 0 &&
      isValidCaseReason(this.reason()) &&
      !this.submitting(),
  );

  protected categoryLabel(category: CaseCategory): string {
    return CASE_COPY.categoryLabel[category];
  }

  protected priorReference(): string | null {
    const state = this.priorState();
    return state.kind === 'ready' && state.value !== null
      ? state.value.record.referenceNumber
      : null;
  }

  protected isChosen(id: AssistanceRequestId): boolean {
    return this.chosenRequests().includes(id);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.category.set(CASE_CATEGORIES.find((candidate) => candidate === value) ?? null);
  }

  protected onSummary(event: Event): void {
    this.summary.set((event.target as HTMLTextAreaElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRequest(id: AssistanceRequestId, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.chosenRequests.update((chosen) =>
      checked
        ? [...chosen.filter((entry) => entry !== id), id]
        : chosen.filter((entry) => entry !== id),
    );
  }

  protected submit(): void {
    const subject = this.subjectView();
    const category = this.category();
    if (subject === null || category === null || !this.canOpen()) {
      return;
    }
    const continues = this.continues();
    this.submitting.set(true);
    this.failure.set(null);
    this.repository
      .open(
        {
          subjectResidentId: subject.resident.id,
          category,
          summary: this.summary().trim(),
          continuesCaseId:
            continues === undefined || continues === '' ? null : asId<CaseId>(continues),
          linkedRequestIds: this.chosenRequests(),
        },
        this.reason().trim(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opened) => {
          this.submitting.set(false);
          this.notifications.success(this.copy.opened);
          void this.router.navigate(['/cases', opened.record.id]);
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          // The server's own sentence where it gave one: it names the rule that refused.
          this.failure.set(failure instanceof Error ? failure.message : this.copy.failed);
        },
      });
  }
}
