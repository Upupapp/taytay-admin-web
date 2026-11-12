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
  COMMAND_CENTER_EFFECTS,
  commandCenterEffects,
  commandCenterHolder,
  HOTLINE_EFFECTS,
  HOTLINE_KIND_LABELS,
  HOTLINE_KINDS,
  HOTLINE_REPOSITORY,
  hotlineProblems,
  isCommandCenterTaken,
  isHotlineKind,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineKind,
} from '@domain/index';
import { readChecked, readText, wholeNumberOf } from '@shared/forms/form-values';
import { failureReason } from '@shared/state/failure-reason';

import { DIRECTORY_COPY } from './directory.copy';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * One hotline, added or changed (`DL-170`). A wrong digit here is a resident in an emergency calling
 * a stranger, so a changed number says what it was and what it becomes before it is saved, and
 * whether the line is shown in the app is a choice made in the form rather than a default.
 *
 * Its kind (`DL-217`) is chosen from the API's list, and a new line's is chosen too — sent, never
 * left to the server's default. Only one active line can be the command center: choosing it while
 * another holds it says so before the button, naming that line, and the server's refusal is put
 * beside the kind. It is a warning, not a block — the list it reads is a moment old, and the server
 * decides.
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
  /** The active command center in the list as read, or `null` when no line is marked as one. */
  readonly commandCenter = input<Hotline | null>(null);
  readonly saved = output<Hotline>();

  protected readonly copy = DIRECTORY_COPY.hotlineForm;
  protected readonly effectsLead = DIRECTORY_COPY.list.effectsLead;
  protected readonly kinds = HOTLINE_KINDS;
  protected readonly kindLabels = HOTLINE_KIND_LABELS;

  protected readonly name = signal('');
  protected readonly number = signal('');
  protected readonly category = signal('');
  /**
   * The kind chosen. `null` only while an existing line's type is not set and none is chosen
   * (`DL-220`): the save then leaves the kind alone rather than inventing one.
   */
  protected readonly kind = signal<HotlineKind | null>('other');
  /** The server's refusal of the kind, in its words, until the kind or the shown box is changed. */
  protected readonly kindRefused = signal('');
  protected readonly sortOrder = signal('0');
  protected readonly active = signal(true);

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  protected readonly creating = computed(() => this.hotline() === null);

  /** The form as typed, its kind possibly not set. */
  private readonly fields = computed(() => ({
    name: this.name().trim(),
    number: this.number().trim(),
    category: this.category().trim(),
    kind: this.kind(),
    sortOrder: wholeNumberOf(this.sortOrder()),
    active: this.active(),
  }));

  /** A new line, as sent: its kind always chosen, never left to the server's default. */
  private readonly draft = computed<HotlineDraft | null>(() => {
    const fields = this.fields();
    return fields.kind === null ? null : { ...fields, kind: fields.kind };
  });

  private readonly changes = computed<HotlineChanges>(() => {
    const hotline = this.hotline();
    if (hotline === null) {
      return {};
    }
    const draft = this.fields();
    const changes: Mutable<HotlineChanges> = {};
    if (draft.name !== hotline.name) changes.name = draft.name;
    if (draft.number !== hotline.number) changes.number = draft.number;
    if (draft.category !== hotline.category) changes.category = draft.category;
    if (draft.kind !== null && draft.kind !== hotline.kind) changes.kind = draft.kind;
    if (draft.sortOrder !== hotline.sortOrder) changes.sortOrder = draft.sortOrder;
    if (draft.active !== hotline.active) changes.active = draft.active;
    return changes;
  });

  protected readonly unchanged = computed(
    () => !this.creating() && Object.keys(this.changes()).length === 0,
  );

  protected readonly problems = computed<readonly string[]>(() =>
    hotlineProblems(this.creating() ? (this.draft() ?? {}) : this.changes()).map((p) => p.message),
  );

  /** The line that is the command center, when saving this one would make a second. */
  protected readonly commandCenterTaken = computed(() =>
    commandCenterHolder(
      { id: this.hotline()?.id ?? null, kind: this.kind(), active: this.active() },
      this.commandCenter(),
    ),
  );

  protected readonly takenWarning = computed<readonly string[]>(() => {
    const holder = this.commandCenterTaken();
    return holder === null ? [] : COMMAND_CENTER_EFFECTS.taken(holder.name, holder.number);
  });

  /** The kind's hint, then the warning and the server's refusal when they are there. */
  protected readonly kindDescribedBy = computed(() =>
    [
      'hotline-kind-hint',
      this.takenWarning().length > 0 ? 'hotline-kind-taken' : null,
      this.kindRefused() === '' ? null : 'hotline-kind-error',
    ]
      .filter((id) => id !== null)
      .join(' '),
  );

  protected readonly effects = computed<readonly string[]>(() => {
    const role = commandCenterEffects(this.hotline(), this.fields());
    if (this.creating()) {
      return [
        ...role,
        ...(this.active() ? HOTLINE_EFFECTS.createShown : HOTLINE_EFFECTS.createHidden),
      ];
    }
    const changes = this.changes();
    return [
      ...role,
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
        // A line the server sent with no kind stays not set until one is chosen (`DL-220`).
        this.kind.set(hotline === null ? 'other' : hotline.kind);
        this.kindRefused.set('');
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

  protected chooseKind(event: Event): void {
    const chosen = readText(event);
    if (isHotlineKind(chosen)) this.kind.set(chosen);
    this.kindRefused.set('');
  }

  protected chooseActive(event: Event): void {
    this.active.set(readChecked(event));
    this.kindRefused.set('');
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const hotline = this.hotline();
    const draft = this.draft();
    const work =
      hotline !== null
        ? this.repository.update(hotline.id, this.changes())
        : draft !== null
          ? this.repository.create(draft)
          : null;
    if (work === null) {
      return;
    }

    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.saved.emit(result);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        // A second command center is about the kind, so it is said beside the kind (`DL-217`).
        if (isCommandCenterTaken(failure)) {
          this.kindRefused.set(this.copy.kindRefused(failure.message));
          return;
        }
        this.outcome.set(
          DIRECTORY_COPY.list.notDone(failureReason(failure) ?? DIRECTORY_COPY.list.failed),
        );
      },
    });
  }
}
