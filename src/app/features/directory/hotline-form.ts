import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  HOTLINE_EFFECTS,
  HOTLINE_REPOSITORY,
  hotlineProblems,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
} from '@domain/index';
import { readChecked, readText, wholeNumberOf } from '@shared/forms/form-values';
import { failureReason } from '@shared/state/failure-reason';

import { DIRECTORY_COPY } from './directory.copy';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * One hotline, added or changed (`DL-170`). A wrong digit here is a resident in an emergency calling
 * a stranger, so a changed number says what it was and what it becomes before it is saved, and
 * whether the line is shown in the app is a choice made in the form rather than a default.
 */
@Component({
  selector: 'app-hotline-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hotline-form.html',
  styleUrl: './directory-form.scss',
})
export class HotlineForm {
  private readonly repository = inject(HOTLINE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The line to change, or `null` to add one. */
  readonly hotline = input<Hotline | null>(null);
  readonly saved = output<Hotline>();

  protected readonly copy = DIRECTORY_COPY.hotlineForm;
  protected readonly effectsLead = DIRECTORY_COPY.list.effectsLead;

  protected readonly name = signal('');
  protected readonly number = signal('');
  protected readonly category = signal('');
  protected readonly sortOrder = signal('0');
  protected readonly active = signal(true);

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  protected readonly creating = computed(() => this.hotline() === null);

  private readonly draft = computed<HotlineDraft>(() => ({
    name: this.name().trim(),
    number: this.number().trim(),
    category: this.category().trim(),
    sortOrder: wholeNumberOf(this.sortOrder()),
    active: this.active(),
  }));

  private readonly changes = computed<HotlineChanges>(() => {
    const hotline = this.hotline();
    if (hotline === null) {
      return {};
    }
    const draft = this.draft();
    const changes: Mutable<HotlineChanges> = {};
    if (draft.name !== hotline.name) changes.name = draft.name;
    if (draft.number !== hotline.number) changes.number = draft.number;
    if (draft.category !== hotline.category) changes.category = draft.category;
    if (draft.sortOrder !== hotline.sortOrder) changes.sortOrder = draft.sortOrder;
    if (draft.active !== hotline.active) changes.active = draft.active;
    return changes;
  });

  protected readonly unchanged = computed(
    () => !this.creating() && Object.keys(this.changes()).length === 0,
  );

  protected readonly problems = computed<readonly string[]>(() =>
    hotlineProblems(this.creating() ? this.draft() : this.changes()).map((p) => p.message),
  );

  protected readonly effects = computed<readonly string[]>(() => {
    if (this.creating()) {
      return this.active() ? HOTLINE_EFFECTS.createShown : HOTLINE_EFFECTS.createHidden;
    }
    const changes = this.changes();
    return [
      ...(changes.number === undefined ? [] : HOTLINE_EFFECTS.number),
      ...(changes.active === false ? HOTLINE_EFFECTS.hide : []),
      ...(changes.active === true ? HOTLINE_EFFECTS.show : []),
      ...HOTLINE_EFFECTS.update,
    ];
  });

  /** The number before and after, when it changes — read back before it is saved. */
  protected readonly numberChange = computed(() => {
    const hotline = this.hotline();
    const number = this.changes().number;
    return hotline === null || number === undefined ? null : { from: hotline.number, to: number };
  });

  constructor() {
    effect(() => {
      const hotline = this.hotline();
      untracked(() => {
        this.name.set(hotline?.name ?? '');
        this.number.set(hotline?.number ?? '');
        this.category.set(hotline?.category ?? '');
        this.sortOrder.set(String(hotline?.sortOrder ?? 0));
        this.active.set(hotline?.active ?? true);
        this.attempted.set(false);
        this.outcome.set('');
      });
    });
  }

  protected text(event: Event): string {
    return readText(event);
  }

  protected checked(event: Event): boolean {
    return readChecked(event);
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const hotline = this.hotline();
    const work =
      hotline === null
        ? this.repository.create(this.draft())
        : this.repository.update(hotline.id, this.changes());

    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.saved.emit(result);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(
          DIRECTORY_COPY.list.notDone(failureReason(failure) ?? DIRECTORY_COPY.list.failed),
        );
      },
    });
  }
}
