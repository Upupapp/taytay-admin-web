import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { describeFailure, isApiFailure } from '@core/http/api-failure';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  asIsoDate,
  barangayName,
  FAMILY_MEMBERS_MAX,
  FAMILY_NAME_MAX_LENGTH,
  FAMILY_REPOSITORY,
  FAMILY_ROLES,
  HOUSEHOLD_REPOSITORY,
  isFamilyDraftInvalid,
  validateFamilyDraft,
  type CursorPage,
  type FamilyDraft,
  type FamilyRole,
  type HouseholdSummary,
  type ResidentView,
} from '@domain/index';
import { RELATIONSHIP_COPY } from '@shared/families/relationship.copy';
import { PersonPicker } from '@shared/residents/person-picker';
import { debouncedTerm } from '@shared/state/debounced';
import { toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { FAMILIES_COPY } from './families.copy';

/** A few households at a time: the chooser narrows by typing, it is not a second register. */
const HOUSEHOLD_RESULTS = 5;

interface ListedMember {
  readonly view: ResidentView;
  readonly role: FamilyRole;
}

/**
 * Records a family: its name, its members each with a role, the household it lives in — or none —
 * and why it is being recorded.
 *
 * Members are found with the shared `PersonPicker`, so a person is somebody already on the registry
 * and never retyped. The household is chosen from the household register or left as none, and the
 * form says beside that choice that a family between addresses is ordinary (`DL-47`): a reader who
 * believes a family must have an address will invent one.
 *
 * The reason is asked for, and the API keeps it with the family's forming and each member's joining
 * (`DL-48`). What is still missing is said in words beside the button, never as a disabled button
 * with no explanation; the server's refusal is shown in its own words.
 */
@Component({
  selector: 'app-family-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, PersonPicker, RouterLink],
  templateUrl: './family-form-page.html',
  styleUrl: './family-form-page.scss',
})
export class FamilyFormPage {
  private readonly repository = inject(FAMILY_REPOSITORY);
  private readonly households = inject(HOUSEHOLD_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  protected readonly copy = FAMILIES_COPY.create;
  protected readonly roles = FAMILY_ROLES;
  protected readonly roleLabels = RELATIONSHIP_COPY.roleLabel;
  protected readonly nameMax = FAMILY_NAME_MAX_LENGTH;
  protected readonly membersMax = FAMILY_MEMBERS_MAX;

  protected readonly name = signal('');
  protected readonly formedOn = signal('');
  protected readonly reason = signal('');
  protected readonly members = signal<readonly ListedMember[]>([]);
  protected readonly household = signal<HouseholdSummary | null>(null);

  /** Bumped after each person is added, so the picker comes back empty for the next one. */
  protected readonly pickerRound = signal(0);
  /** What the last add did, said politely for a screen reader. */
  protected readonly memberNotice = signal('');

  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  /** The server's refusal, in its words. */
  protected readonly refusal = signal<string | null>(null);

  /* ── choosing a household ───────────────────────────────────────────────── */

  protected readonly householdTerm = signal('');
  private readonly settledTerm = debouncedTerm(this.householdTerm);

  protected readonly householdResults = toSignal(
    toObservable(this.settledTerm).pipe(
      switchMap((term) =>
        term.length < 2
          ? of<ViewState<CursorPage<HouseholdSummary>> | null>(null)
          : toViewState(
              this.households.list(
                { search: term },
                { limit: HOUSEHOLD_RESULTS, cursor: null },
              ),
            ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly householdOptions = computed<readonly HouseholdSummary[]>(() => {
    const state = this.householdResults();
    return state === null ? [] : (valueOf(state)?.items ?? []);
  });

  protected readonly householdState = computed(() => this.householdResults()?.kind ?? 'idle');

  protected readonly householdHasMore = computed(() => {
    const state = this.householdResults();
    return state === null ? false : (valueOf(state)?.hasMore ?? false);
  });

  /* ── what is still missing ──────────────────────────────────────────────── */

  private readonly draft = computed<FamilyDraft>(() => {
    const formed = this.formedOn().trim();
    return {
      name: this.name(),
      householdId: this.household()?.household.id ?? null,
      formedOn: formed.length > 0 ? asIsoDate(formed) : null,
      members: this.members().map((member) => ({
        residentId: member.view.resident.id,
        role: member.role,
      })),
    };
  });

  /** In words, beside the button — the domain's own rules, as both adapters apply them. */
  protected readonly missing = computed(() =>
    [
      ...new Set(
        validateFamilyDraft(this.draft(), this.reason()).map(
          (problem) => FAMILIES_COPY.draftProblem[problem.code],
        ),
      ),
    ],
  );

  /* ── members ────────────────────────────────────────────────────────────── */

  protected addMember(view: ResidentView): void {
    this.pickerRound.update((round) => round + 1);
    if (this.members().some((member) => member.view.resident.id === view.resident.id)) {
      this.memberNotice.set(this.copy.alreadyListed);
      return;
    }
    // The first person added is taken as head until somebody says otherwise; anyone after, as a
    // member whose role is still to be said. Either is one choice away.
    const role: FamilyRole = this.members().length === 0 ? 'head' : 'other-member';
    this.members.update((members) => [...members, { view, role }]);
    this.memberNotice.set(`${view.listedName}: ${this.roleLabels[role]}.`);
  }

  protected onRole(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const role = this.roles.find((candidate) => candidate === value);
    if (role === undefined) {
      return;
    }
    this.members.update((members) =>
      members.map((member, position) => (position === index ? { ...member, role } : member)),
    );
  }

  protected removeMember(index: number): void {
    this.members.update((members) => members.filter((_, position) => position !== index));
  }

  /* ── household ──────────────────────────────────────────────────────────── */

  protected onHouseholdTerm(event: Event): void {
    this.householdTerm.set((event.target as HTMLInputElement).value);
  }

  protected chooseHousehold(summary: HouseholdSummary): void {
    this.household.set(summary);
    this.householdTerm.set('');
  }

  protected clearHousehold(): void {
    this.household.set(null);
  }

  protected householdLabel(summary: HouseholdSummary): string {
    return `${summary.household.referenceNumber} · ${summary.headName} · ${barangayName(
      summary.household.address.barangayId,
    )}`;
  }

  /* ── the rest ───────────────────────────────────────────────────────────── */

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onFormedOn(event: Event): void {
    this.formedOn.set((event.target as HTMLInputElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    this.refusal.set(null);
    if (this.missing().length > 0 || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.repository.create(this.draft(), this.reason().trim()).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.notifications.success(this.copy.saved);
        void this.router.navigate(['/families', created.family.id]);
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        this.refusal.set(this.describe(failure));
      },
    });
  }

  private describe(failure: unknown): string {
    if (isFamilyDraftInvalid(failure)) {
      return [
        ...new Set(failure.problems.map((problem) => FAMILIES_COPY.draftProblem[problem.code])),
      ].join(' ');
    }
    if (failure instanceof Error) {
      return failure.message;
    }
    return isApiFailure(failure) ? describeFailure(failure) : this.copy.failed;
  }
}
