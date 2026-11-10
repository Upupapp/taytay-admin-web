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
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
  linkProblems,
  type LinkDraft,
  type QuickLink,
} from '@domain/index';
import { readText, wholeNumberOf } from '@shared/forms/form-values';
import { failureReason } from '@shared/state/failure-reason';

import { HOME_SCREEN_COPY } from './home-screen.copy';

/** One quick link, added or changed (`DL-170`), with what it does before the button. */
@Component({
  selector: 'app-link-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-form.html',
  styleUrl: './home-form.scss',
})
export class LinkForm {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The link to change, or `null` to add one. */
  readonly link = input<QuickLink | null>(null);
  readonly saved = output<QuickLink>();

  protected readonly copy = HOME_SCREEN_COPY.linkForm;
  protected readonly common = HOME_SCREEN_COPY.common;

  protected readonly label = signal('');
  protected readonly href = signal('');
  protected readonly sortOrder = signal('0');

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  protected readonly creating = computed(() => this.link() === null);

  private readonly draft = computed<LinkDraft>(() => ({
    label: this.label().trim(),
    href: this.href().trim(),
    sortOrder: wholeNumberOf(this.sortOrder()),
  }));

  protected readonly unchanged = computed(() => {
    const link = this.link();
    const draft = this.draft();
    return (
      link !== null &&
      draft.label === link.label &&
      draft.href === link.href &&
      draft.sortOrder === link.sortOrder
    );
  });

  protected readonly problems = computed<readonly string[]>(() =>
    linkProblems(this.draft()).map((problem) => problem.message),
  );

  protected readonly effects = computed<readonly string[]>(() => {
    const link = this.link();
    const href = this.draft().href !== link?.href ? HOME_EFFECTS.href : [];
    return link === null
      ? [...HOME_EFFECTS.linkCreate, ...href]
      : [...href, ...HOME_EFFECTS.linkUpdate];
  });

  constructor() {
    effect(() => {
      const link = this.link();
      untracked(() => {
        this.label.set(link?.label ?? '');
        this.href.set(link?.href ?? '');
        this.sortOrder.set(String(link?.sortOrder ?? 0));
        this.attempted.set(false);
        this.outcome.set('');
      });
    });
  }

  protected text(event: Event): string {
    return readText(event);
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const link = this.link();
    const work =
      link === null
        ? this.repository.createLink(this.draft())
        : this.repository.updateLink(link.id, this.draft());

    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.saved.emit(result);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(this.common.notDone(failureReason(failure) ?? this.common.failed));
      },
    });
  }
}
