import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import {
  REQUIREMENT_OBLIGATION_LABELS,
  REQUIREMENT_OBLIGATIONS,
  type ProgramRequirement,
  type RequirementObligation,
} from '@domain/index';

import { blankRequirement } from './program-form';
import { PROGRAMS_COPY } from './programs.copy';

/**
 * A list of documents, written one at a time — a template's, or a programme's own.
 *
 * The circumstances box appears only for a conditional document, and a document moved off
 * conditional loses its circumstances in the same act (`DL-76`): a sentence left behind on a
 * required document would read as a condition nobody is asked to rule on, and the server refuses
 * it. The box asks for words, because nothing in this console evaluates the condition.
 *
 * Presentational: the list in, each edit out — an edit, not a whole new list, so that two edits
 * made before the next render cannot overwrite each other with a list read before either. Whoever
 * holds the list applies it (`applyRequirementEdit`) and decides what saving it means.
 */
@Component({
  selector: 'app-requirement-list-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (requirement of requirements(); track $index; let index = $index) {
      <fieldset class="documents-editor__row">
        <legend class="documents-editor__legend">{{ copy.group(index + 1) }}</legend>
        <div class="documents-editor__grid">
          <label class="field">
            <span class="field__label">{{ copy.code }}</span>
            <input
              type="text"
              class="field__input"
              autocomplete="off"
              spellcheck="false"
              [attr.aria-describedby]="idPrefix() + '-code-hint'"
              [value]="requirement.code"
              (input)="set(index, { code: valueOf($event) })"
            />
          </label>
          <label class="field">
            <span class="field__label">{{ copy.label }}</span>
            <input
              type="text"
              class="field__input"
              [value]="requirement.label"
              (input)="set(index, { label: valueOf($event) })"
            />
          </label>
          <label class="field">
            <span class="field__label">{{ copy.obligation }}</span>
            <select class="field__input" (change)="onObligation(index, $event)">
              @for (obligation of obligations; track obligation) {
                <option [value]="obligation" [selected]="requirement.obligation === obligation">
                  {{ obligationLabels[obligation] }}
                </option>
              }
            </select>
          </label>
        </div>
        @if (requirement.obligation === 'conditional') {
          <label class="field">
            <span class="field__label">{{ copy.appliesWhen }}</span>
            <textarea
              class="field__input"
              rows="2"
              [attr.aria-describedby]="idPrefix() + '-applies-hint'"
              [value]="requirement.appliesWhen ?? ''"
              (input)="set(index, { appliesWhen: valueOf($event) })"
            ></textarea>
          </label>
        }
        <label class="field">
          <span class="field__label">{{ copy.notes }}</span>
          <input
            type="text"
            class="field__input"
            [value]="requirement.notes ?? ''"
            (input)="set(index, { notes: valueOf($event) })"
          />
        </label>
        <button type="button" class="btn btn--subtle btn--small" (click)="remove(index)">
          {{ copy.remove }}
        </button>
      </fieldset>
    } @empty {
      <p class="documents-editor__none">{{ copy.none }}</p>
    }
    <p class="field__hint" [id]="idPrefix() + '-code-hint'">{{ copy.codeHint }}</p>
    <p class="field__hint" [id]="idPrefix() + '-applies-hint'">{{ copy.appliesWhenHint }}</p>
    <button type="button" class="btn" (click)="add()">{{ copy.add }}</button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
      align-items: flex-start;
    }
    .documents-editor__row {
      display: flex;
      flex-direction: column;
      gap: var(--space-compact);
      align-self: stretch;
      padding: var(--space-card);
      border: 1px solid var(--c-border);
    }
    .documents-editor__legend {
      padding-inline: var(--space-compact);
      font-weight: 600;
    }
    .documents-editor__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-base);
    }
    .documents-editor__none {
      margin: 0;
      color: var(--c-text-muted);
    }
  `,
})
export class RequirementListEditor {
  readonly requirements = input.required<readonly ProgramRequirement[]>();
  /** Keeps the hint ids unique when two editors share a page. */
  readonly idPrefix = input('documents');
  readonly edited = output<RequirementListEdit>();

  protected readonly copy = PROGRAMS_COPY.documentsEditor;
  protected readonly obligations = REQUIREMENT_OBLIGATIONS;
  protected readonly obligationLabels = REQUIREMENT_OBLIGATION_LABELS;

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected set(index: number, changes: Partial<ProgramRequirement>): void {
    this.edited.emit({ kind: 'set', index, changes });
  }

  protected onObligation(index: number, event: Event): void {
    const obligation = (event.target as HTMLSelectElement).value as RequirementObligation;
    // Off conditional, the circumstances go in the same act; they would otherwise be refused.
    this.set(
      index,
      obligation === 'conditional' ? { obligation } : { obligation, appliesWhen: null },
    );
  }

  protected add(): void {
    this.edited.emit({ kind: 'add' });
  }

  protected remove(index: number): void {
    this.edited.emit({ kind: 'remove', index });
  }
}

/** One change to a list of documents, as the editor reports it. */
export type RequirementListEdit =
  | {
      readonly kind: 'set';
      readonly index: number;
      readonly changes: Partial<ProgramRequirement>;
    }
  | { readonly kind: 'add' }
  | { readonly kind: 'remove'; readonly index: number };

/** Applies an edit to the list as it stands now, not as it stood when the editor last rendered. */
export function applyRequirementEdit(
  requirements: readonly ProgramRequirement[],
  edit: RequirementListEdit,
): readonly ProgramRequirement[] {
  switch (edit.kind) {
    case 'set':
      return requirements.map((requirement, at) =>
        at === edit.index ? { ...requirement, ...edit.changes } : requirement,
      );
    case 'add':
      return [...requirements, blankRequirement()];
    case 'remove':
      return requirements.filter((_, at) => at !== edit.index);
  }
}
