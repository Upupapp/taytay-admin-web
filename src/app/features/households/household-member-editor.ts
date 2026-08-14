import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  applyMembershipChanges,
  HOUSEHOLD_ROLE_LABELS,
  HOUSEHOLD_ROLES,
  validateComposition,
  type HouseholdDetail,
  type HouseholdProblem,
  type HouseholdRole,
  type MembershipChange,
  type ResidentId,
  type ResidentView,
} from '@domain/index';
import { PersonPicker } from '@shared/residents/person-picker';

import { HOUSEHOLDS_COPY } from './households.copy';

/** What the editor is about to do, once someone gives a reason for it. */
export interface MembershipSubmission {
  readonly changes: readonly MembershipChange[];
  readonly reason: string;
}

interface Row {
  readonly residentId: ResidentId;
  readonly role: HouseholdRole;
  readonly isHead: boolean;
  readonly name: string;
  readonly isNew: boolean;
}

/**
 * The family relationship editor.
 *
 * It collects **intents**, not a replacement member list, and shows what the
 * household would look like if they were applied. Two things fall out of that
 * which matter more than they look:
 *
 *  - the audit trail can say "made Marilou the head" instead of "members
 *    changed", because the intent survives all the way to the record;
 *  - the invariants are checked against the proposed composition *before*
 *    anything is sent, using the same `validateComposition` the adapter uses,
 *    so the screen and the server cannot disagree about what is legal.
 *
 * Nothing is saved without a reason. Composition changes are how a family
 * silently loses a member, and "who said so, and why" is the only thing that
 * makes that recoverable.
 */
@Component({
  selector: 'app-household-member-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PersonPicker],
  template: `
    <section class="editor" aria-labelledby="member-editor-heading">
      <h3 class="editor__heading" id="member-editor-heading">{{ copy.editHeading }}</h3>

      <ul class="editor__rows">
        @for (row of rows(); track row.residentId) {
          <li class="editor__row" [class.editor__row--new]="row.isNew">
            <span class="editor__name">
              {{ row.name }}
              @if (row.isNew) {
                <span class="editor__pending-tag">{{ copy.pending }}</span>
              }
            </span>

            <label class="editor__role">
              <span class="visually-hidden">{{ copy.role }} — {{ row.name }}</span>
              <select
                class="editor__select"
                [disabled]="row.isHead"
                (change)="changeRole(row.residentId, $event)"
              >
                @for (role of roles; track role) {
                  <option [value]="role" [selected]="row.role === role">{{ label(role) }}</option>
                }
              </select>
            </label>

            <button
              type="button"
              class="btn btn--subtle editor__action"
              [disabled]="row.isHead"
              (click)="makeHead(row.residentId)"
            >
              {{ copy.makeHead }}
            </button>

            <button
              type="button"
              class="btn btn--subtle editor__action"
              [disabled]="row.isHead"
              (click)="remove(row.residentId)"
            >
              {{ copy.remove }}
            </button>
          </li>
        }
      </ul>

      <div class="editor__add">
        <h4 class="editor__subheading">{{ copy.addHeading }}</h4>
        <app-person-picker [(selected)]="picked" (chosen)="add($event)" />
      </div>

      @if (problems().length > 0) {
        <div class="editor__problems" role="alert">
          <h4 class="editor__problems-heading">{{ copy.problemsHeading }}</h4>
          <ul>
            @for (problem of problems(); track problem.code + (problem.residentId ?? '')) {
              <li>{{ problemText(problem) }}</li>
            }
          </ul>
        </div>
      }

      @if (pending().length > 0) {
        <div class="editor__commit">
          <h4 class="editor__subheading">{{ copy.pendingHeading }}</h4>
          <ul class="editor__pending">
            @for (change of pending(); track $index) {
              <li>{{ describe(change) }}</li>
            }
          </ul>

          <label class="editor__reason">
            <span class="editor__reason-label">{{ copy.reason }}</span>
            <input
              class="editor__reason-input"
              type="text"
              [placeholder]="copy.reasonPlaceholder"
              [value]="reason()"
              (input)="onReason($event)"
            />
            <span class="editor__reason-hint">{{ copy.reasonHint }}</span>
          </label>

          <div class="editor__buttons">
            <button type="button" class="btn" (click)="discard()">{{ copy.discard }}</button>
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!canSave()"
              (click)="submit()"
            >
              {{ saving() ? copy.saving : copy.save }}
            </button>
          </div>
        </div>
      } @else {
        <p class="editor__idle">{{ copy.noPending }}</p>
      }
    </section>
  `,
  styleUrl: './household-member-editor.scss',
})
export class HouseholdMemberEditor {
  readonly detail = input.required<HouseholdDetail>();
  readonly saving = input(false);

  readonly submitted = output<MembershipSubmission>();

  protected readonly copy = HOUSEHOLDS_COPY.members;
  protected readonly roles = HOUSEHOLD_ROLES;
  protected readonly picked = signal<ResidentView | null>(null);

  protected readonly pending = signal<readonly MembershipChange[]>([]);
  protected readonly reason = signal('');
  /**
   * Names of people added but not yet saved. Held here because they are not in
   * `detail` yet, and a pending row that says `res-0143` instead of a name is a
   * row nobody can check before committing it.
   */
  private readonly addedNames = signal<ReadonlyMap<ResidentId, string>>(new Map());

  /** The household as it would be after the pending intents. */
  private readonly proposed = computed(() => {
    const detail = this.detail();
    return applyMembershipChanges(
      detail.household.members,
      detail.household.headResidentId,
      this.pending(),
    );
  });

  protected readonly problems = computed<readonly HouseholdProblem[]>(() => {
    const proposed = this.proposed();
    return validateComposition(proposed.members, proposed.headResidentId);
  });

  protected readonly rows = computed<readonly Row[]>(() => {
    const detail = this.detail();
    const proposed = this.proposed();
    const known = new Map(detail.members.map((member) => [member.view.resident.id, member]));
    const added = this.addedNames();

    return proposed.members.map((member) => ({
      residentId: member.residentId,
      role: member.role,
      isHead: member.residentId === proposed.headResidentId,
      name:
        known.get(member.residentId)?.view.listedName ??
        added.get(member.residentId) ??
        member.residentId,
      isNew: !known.has(member.residentId),
    }));
  });

  protected readonly canSave = computed(
    () =>
      this.pending().length > 0 &&
      this.problems().length === 0 &&
      this.reason().trim().length > 0 &&
      !this.saving(),
  );

  protected label(role: HouseholdRole): string {
    return HOUSEHOLD_ROLE_LABELS[role];
  }

  protected problemText(problem: HouseholdProblem): string {
    return HOUSEHOLDS_COPY.problem[problem.code];
  }

  protected describe(change: MembershipChange): string {
    const name = this.nameOf(change.residentId);
    switch (change.kind) {
      case 'add-member':
        return `Add ${name} as ${this.label(change.role)}`;
      case 'remove-member':
        return `Remove ${name}`;
      case 'change-role':
        return `Change ${name} to ${this.label(change.role)}`;
      case 'set-head':
        return `Make ${name} the household head`;
    }
  }

  /* ── intents ────────────────────────────────────────────────────────────── */

  protected add(view: ResidentView): void {
    const id = view.resident.id;
    if (this.proposed().members.some((member) => member.residentId === id)) {
      return;
    }
    this.addedNames.update((names) => new Map(names).set(id, view.listedName));
    this.queue({ kind: 'add-member', residentId: id, role: 'relative' });
    this.picked.set(null);
  }

  protected remove(residentId: ResidentId): void {
    this.queue({ kind: 'remove-member', residentId });
  }

  protected makeHead(residentId: ResidentId): void {
    this.queue({ kind: 'set-head', residentId });
  }

  protected changeRole(residentId: ResidentId, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as HouseholdRole;
    this.queue({ kind: 'change-role', residentId, role });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected discard(): void {
    this.pending.set([]);
    this.reason.set('');
    this.addedNames.set(new Map());
  }

  protected submit(): void {
    if (!this.canSave()) {
      return;
    }
    this.submitted.emit({ changes: this.pending(), reason: this.reason().trim() });
  }

  /** Clears the queue once the caller reports the save landed. */
  accept(): void {
    this.discard();
  }

  private queue(change: MembershipChange): void {
    this.pending.update((changes) => [...changes, change]);
  }

  private nameOf(residentId: ResidentId): string {
    return (
      this.detail().members.find((member) => member.view.resident.id === residentId)?.view
        .listedName ??
      this.addedNames().get(residentId) ??
      residentId
    );
  }
}
