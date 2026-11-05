import { DatePipe } from '@angular/common';
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
import type { Observable } from 'rxjs';

import {
  BALITA_CATEGORY_SLUGS,
  BALITA_COVER_EFFECTS,
  BALITA_EFFECTS,
  BALITA_REPOSITORY,
  BALITA_STATUS_CATALOG,
  balitaProblem,
  officeLabel,
  type BalitaArticle,
  type BalitaCategory,
  type BalitaCategorySlug,
  type BalitaChanges,
  type BalitaStatus,
  type Office,
  type OfficeId,
} from '@domain/index';
import { readText } from '@shared/forms/form-values';
import { ImageFileField } from '@shared/media/image-file-field';
import { ObjectUrls } from '@shared/media/object-urls';
import { failureReason } from '@shared/state/failure-reason';
import { valueOf, type ViewState } from '@shared/state/view-state';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { BALITA_COPY } from './balita.copy';

type Outcome = keyof typeof BALITA_COPY.editor.outcome;

/**
 * Writing and changing one Balita article (`news.write`, `DL-171`).
 *
 * **Publishing goes outward, and is warned about before its button** (`DL-124`'s doctrine). What
 * publishing does — every resident can read it at once, nothing recalls it from those who have,
 * no notification is sent — stands above the publish button, as does what saving a draft, taking
 * an article off the app and pinning do. Every request leaves from `send`, and only from a button
 * whose effects are shown above it.
 *
 * **The cover is said to have no description** (`DL-125`): the API keeps none, so the form has no
 * box for one and says what that means for a resident who cannot see it.
 *
 * After every act the article is the server's answer, never a patched copy.
 */
@Component({
  selector: 'app-balita-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ImageFileField, StatusBadge],
  templateUrl: './balita-editor.html',
  styleUrl: './balita.scss',
})
export class BalitaEditor {
  private readonly repository = inject(BALITA_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls = new ObjectUrls();

  /** `null` for a new article. */
  readonly article = input.required<BalitaArticle | null>();
  readonly categories = input.required<ViewState<readonly BalitaCategory[]>>();
  readonly offices = input.required<ViewState<readonly Office[]>>();

  /** The article as the server answered after an act. */
  readonly saved = output<BalitaArticle>();

  protected readonly copy = BALITA_COPY.editor;
  protected readonly catalog = BALITA_STATUS_CATALOG;
  protected readonly effects = BALITA_EFFECTS;
  protected readonly coverEffects = BALITA_COVER_EFFECTS;

  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly category = signal<BalitaCategorySlug | null>(null);
  protected readonly office = signal<OfficeId | null>(null);
  protected readonly cover = signal<Blob | null>(null);

  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  /** The live region's text: the outcome of the last act. */
  protected readonly outcome = signal('');

  protected readonly coverUrl = signal<string | null>(null);
  protected readonly coverState = signal<'closed' | 'loading' | 'failed'>('closed');

  protected readonly categoryList = computed(() => valueOf(this.categories()) ?? []);
  protected readonly officeList = computed(() => valueOf(this.offices()) ?? []);

  /** What would be sent as a change of an existing article; empty when nothing has changed. */
  protected readonly changes = computed<BalitaChanges>(() => {
    const article = this.article();
    if (article === null) return {};
    const category = this.category();
    return {
      ...(this.title().trim() !== article.title ? { title: this.title() } : {}),
      ...(this.body().trim() !== article.body ? { body: this.body() } : {}),
      ...(category !== null && category !== article.category ? { category } : {}),
    };
  });

  protected readonly changed = computed(
    () => Object.keys(this.changes()).length > 0 || this.cover() !== null,
  );

  protected readonly invalid = computed(() => balitaProblem(this.title(), this.body()));

  constructor() {
    // Another article opened in the same drawer starts from its own words, never the last one's.
    effect(() => {
      const article = this.article();
      untracked(() => {
        this.title.set(article?.title ?? '');
        this.body.set(article?.body ?? '');
        this.category.set(article?.category ?? null);
        this.office.set(null);
        this.cover.set(null);
        this.problem.set('');
        this.hideCover();
      });
    });
    this.destroyRef.onDestroy(() => this.objectUrls.revokeAll());
  }

  protected officeName(office: Office): string {
    return officeLabel(office);
  }

  protected setTitle(event: Event): void {
    this.title.set(readText(event));
  }

  protected setBody(event: Event): void {
    this.body.set(readText(event));
  }

  protected setCategory(event: Event): void {
    const value = readText(event);
    this.category.set(BALITA_CATEGORY_SLUGS.find((slug) => slug === value) ?? null);
  }

  protected setOffice(event: Event): void {
    const value = readText(event);
    this.office.set(this.officeList().find((office) => office.id === value)?.id ?? null);
  }

  /** A new article, published or kept as a draft. */
  protected create(status: BalitaStatus): void {
    const problem = this.invalid();
    if (problem !== null) {
      this.problem.set(problem);
      return;
    }
    this.send(
      this.repository.create(
        {
          title: this.title(),
          body: this.body(),
          category: this.category(),
          officeId: this.office(),
          status,
        },
        this.cover(),
      ),
      status === 'published' ? 'published' : 'created',
    );
  }

  /** The words, category or cover of an existing article; its status is left as it is. */
  protected save(): void {
    const article = this.article();
    const problem = this.invalid();
    if (article === null) return;
    if (problem !== null) {
      this.problem.set(problem);
      return;
    }
    this.send(this.repository.update(article.id, this.changes(), this.cover()), 'saved');
  }

  /** Publishes a draft, or takes a published article off the app, with any change made meanwhile. */
  protected move(status: BalitaStatus): void {
    const article = this.article();
    const problem = this.invalid();
    if (article === null) return;
    if (problem !== null) {
      this.problem.set(problem);
      return;
    }
    this.send(
      this.repository.update(article.id, { ...this.changes(), status }, this.cover()),
      status === 'published' ? 'published' : 'unpublished',
    );
  }

  protected pin(pinned: boolean): void {
    const article = this.article();
    if (article === null) return;
    this.send(
      pinned ? this.repository.pin(article.id) : this.repository.unpin(article.id),
      pinned ? 'pinned' : 'unpinned',
    );
  }

  protected showCover(): void {
    const article = this.article();
    if (article === null || !article.hasCover) return;
    this.hideCover();
    this.coverState.set('loading');
    this.repository
      .openCover(article.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          // Answered after another article was opened: this is not its cover.
          if (this.article()?.id !== article.id) return;
          this.coverState.set('closed');
          this.coverUrl.set(this.objectUrls.make(blob));
        },
        error: () => this.coverState.set('failed'),
      });
  }

  protected hideCover(): void {
    this.objectUrls.revokeAll();
    this.coverUrl.set(null);
    this.coverState.set('closed');
  }

  /** The one place a request leaves: every button above calls it with its own act. */
  private send(request: Observable<BalitaArticle>, outcome: Outcome): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.problem.set('');
    this.outcome.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (article) => {
        this.busy.set(false);
        this.outcome.set(this.copy.outcome[outcome]);
        this.saved.emit(article);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.problem.set(this.copy.notDone(failureReason(failure) ?? this.copy.noAnswer));
      },
    });
  }
}
