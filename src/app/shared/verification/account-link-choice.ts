import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import {
  accountLinkProblems,
  barangayName,
  CIVIL_STATUS_LABELS,
  CIVIL_STATUSES,
  startAccountLinkDraft,
  toAccountLinkDecision,
  VERIFICATION_REPOSITORY,
  type AccountLinkDecision,
  type AccountLinkDecisionKind,
  type AccountLinkDraft,
  type AppAccountId,
  type CivilStatus,
  type RegistryMatch,
  type RegistryMatches,
  type RegistrySex,
  type ResidentId,
  type ResidentView,
  RESIDENT_REPOSITORY,
  SEX_LABELS,
} from '@domain/index';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { LoadingIndicator } from '@shared/ui/loading/loading-indicator';

import { ACCOUNT_LINK_COPY } from './account-link.copy';

/**
 * What the reviewer has decided so far: the account already has a record (approve without a
 * decision), a choice not yet whole (with the sentence saying what is missing), or a decision the
 * server can read, with the sentence that says what it does.
 */
export type AccountLinkState =
  | { readonly kind: 'already-linked'; readonly residentId: ResidentId }
  | { readonly kind: 'incomplete'; readonly problem: string }
  | { readonly kind: 'ready'; readonly decision: AccountLinkDecision; readonly effect: string };

/**
 * Which registry record a verified account is (`DL-228`): the registry's proposals — a label, a
 * resemblance band and signals in words, never a value (`DL-73`) — and the reviewer's choice to link
 * to one, make a record from the account, or leave it unlinked, each saying what it does before the
 * button that sends it. Used by the ID review and the in-person verification alike.
 *
 * Read once, not live: it is part of a decision being made, and a list that changed under the
 * reviewer's selection would move what they chose.
 */
@Component({
  selector: 'app-account-link-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingIndicator, RouterLink],
  templateUrl: './account-link-choice.html',
  styleUrl: './account-link-choice.scss',
})
export class AccountLinkChoice {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly residents = inject(RESIDENT_REPOSITORY);

  readonly accountId = input.required<AppAccountId>();
  /** The name as verified — the account's, or as corrected from the ID. */
  readonly verifiedName = input.required<string>();
  readonly idPrefix = input('account-link');
  /**
   * `verify`: decided with a verification, and refused with it. `later`: an account already verified
   * is linked on its own (`DL-260`) — there is no "leave unlinked", which is what it already is.
   */
  readonly mode = input<'verify' | 'later'>('verify');

  readonly changed = output<AccountLinkState>();

  protected readonly copy = ACCOUNT_LINK_COPY;
  protected readonly civilStatuses = CIVIL_STATUSES;
  protected readonly civilLabels = CIVIL_STATUS_LABELS;
  protected readonly sexLabels = SEX_LABELS;

  protected readonly matches = toSignal(
    toObservable(this.accountId).pipe(
      switchMap((id) => toViewState(this.repository.registryMatches(id))),
    ),
    { initialValue: LOADING as ViewState<RegistryMatches> },
  );

  protected readonly draft = signal<AccountLinkDraft>(startAccountLinkDraft(''));

  private readonly proposals = computed<readonly RegistryMatch[]>(() => {
    const state = this.matches();
    return state.kind === 'ready' ? state.value.matches : [];
  });

  protected readonly linkedResidentId = computed<ResidentId | null>(() => {
    const state = this.matches();
    return state.kind === 'ready' ? state.value.linkedResidentId : null;
  });

  protected readonly problems = computed(() => accountLinkProblems(this.draft(), this.proposals()));

  /** The record chosen to link to, as the registry's own read gives it under the reader's keys. */
  private readonly chosenResidentId = computed<ResidentId | null>(() => {
    const draft = this.draft();
    return draft.decision === 'link' ? draft.residentId : null;
  });

  /**
   * The chosen record side by side with the account (`DL-260`): read through the registry under the
   * reviewer's own keys, so it shows only what they may already open from the record's link — the
   * proposals themselves stay value-free (`DL-73`).
   */
  protected readonly chosenRecord = toSignal(
    toObservable(this.chosenResidentId).pipe(
      distinctUntilChanged(),
      switchMap((id) =>
        id === null
          ? of<ViewState<ResidentView | null>>({ kind: 'ready', value: null })
          : toViewState(this.residents.getById(id)),
      ),
    ),
    { initialValue: { kind: 'ready', value: null } as ViewState<ResidentView | null> },
  );

  protected readonly chosenView = computed<ResidentView | null>(() => {
    const state = this.chosenRecord();
    return state.kind === 'ready' ? state.value : null;
  });

  /** The barangay signal of the chosen proposal, said in words: the account's value is not sent. */
  protected readonly barangaySignal = computed<string | null>(() => {
    const id = this.chosenResidentId();
    const match = this.proposals().find((candidate) => candidate.residentId === id);
    const signal = match?.signals.find((entry) => entry.attribute === 'barangay');
    return signal === undefined ? null : this.copy.outcome[signal.outcome];
  });

  protected readonly state = computed<AccountLinkState>(() => {
    const linked = this.linkedResidentId();
    if (linked !== null) {
      return { kind: 'already-linked', residentId: linked };
    }
    const decision = toAccountLinkDecision(this.draft(), this.proposals());
    if (decision === null) {
      const first = this.problems()[0] ?? 'choose';
      return { kind: 'incomplete', problem: this.copy.problem[first] };
    }
    return { kind: 'ready', decision, effect: this.effectOf(decision) };
  });

  protected readonly effect = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.effect : null;
  });

  /** The account the draft was started for: another account starts from nothing chosen. */
  private draftFor: AppAccountId | null = null;

  constructor() {
    // Another account starts from nothing chosen — no record, no reason, no correction carried over
    // from the last one — and its name parts from its own verified name. The same account with a
    // corrected name keeps what was chosen and only re-splits the name.
    effect(() => {
      const account = this.accountId();
      const name = this.verifiedName();
      untracked(() => {
        const fresh = startAccountLinkDraft(name);
        if (this.draftFor !== account) {
          this.draftFor = account;
          this.draft.set(fresh);
          return;
        }
        const current = this.draft();
        this.draft.set({
          ...current,
          firstName: fresh.firstName,
          middleName: fresh.middleName,
          lastName: fresh.lastName,
          suffix: fresh.suffix,
        });
      });
    });
    effect(() => {
      const state = this.state();
      untracked(() => this.changed.emit(state));
    });
  }

  protected chooseMatch(match: RegistryMatch): void {
    // Corrections are about one record: another record starts with none chosen.
    this.patch({
      decision: 'link',
      residentId: match.residentId,
      correctName: false,
      correctSex: null,
      correctBirthDate: '',
    });
  }

  protected choose(decision: AccountLinkDecisionKind): void {
    this.patch({
      decision,
      residentId: null,
      correctName: false,
      correctSex: null,
      correctBirthDate: '',
    });
  }

  protected toggleCorrectName(event: Event): void {
    this.patch({ correctName: event.target instanceof HTMLInputElement && event.target.checked });
  }

  protected chooseCorrectSex(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    this.patch({ correctSex: value === 'female' || value === 'male' ? value : null });
  }

  protected barangayLabel(view: ResidentView): string {
    return barangayName(view.resident.address.barangayId);
  }

  protected isChosen(match: RegistryMatch): boolean {
    const draft = this.draft();
    return draft.decision === 'link' && draft.residentId === match.residentId;
  }

  protected typed(
    key:
      | 'reason'
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'suffix'
      | 'birthDate'
      | 'streetAddress'
      | 'correctBirthDate',
    event: Event,
  ): void {
    const value =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
        ? event.target.value
        : '';
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected chooseSex(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const sex: RegistrySex | null = value === 'female' || value === 'male' ? value : null;
    this.patch({ sex });
  }

  protected chooseCivilStatus(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const status: CivilStatus | null =
      this.civilStatuses.find((option) => option === value) ?? null;
    this.patch({ civilStatus: status });
  }

  protected signalsOf(match: RegistryMatch): readonly string[] {
    return match.signals.map(
      (signal) =>
        `${this.copy.attribute[signal.attribute]}: ${this.copy.outcome[signal.outcome]} — ${signal.rule}`,
    );
  }

  private patch(change: Partial<AccountLinkDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }

  private effectOf(decision: AccountLinkDecision): string {
    const effects = this.mode() === 'later' ? this.copy.effectLater : this.copy.effect;
    switch (decision.decision) {
      case 'link': {
        const label =
          this.proposals().find((match) => match.residentId === decision.residentId)?.label ?? '';
        const corrections = decision.corrections;
        if (corrections === undefined) {
          return effects.link(label);
        }
        const fields = [
          ...(corrections.name === undefined ? [] : [this.copy.correctedField.name]),
          ...(corrections.sex === undefined ? [] : [this.copy.correctedField.sex]),
          ...(corrections.birthDate === undefined ? [] : [this.copy.correctedField.birthDate]),
        ];
        return `${effects.link(label)} ${this.copy.correctionEffect(fields)}`;
      }
      case 'create':
        return effects.create;
      case 'leave-unlinked':
        return this.copy.effect['leave-unlinked'];
    }
  }
}
