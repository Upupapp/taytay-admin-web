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
  BANNER_NO_DESCRIPTION,
  bannerProblems,
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
  type BannerDraft,
  type BannerImageChange,
  type HomeBanner,
} from '@domain/index';
import { blankToNull, readChecked, readText, wholeNumberOf } from '@shared/forms/form-values';
import { ImageFileField } from '@shared/media/image-file-field';
import { ObjectUrls } from '@shared/media/object-urls';
import { failureReason } from '@shared/state/failure-reason';

import { HOME_SCREEN_COPY } from './home-screen.copy';

/**
 * One banner, added or changed (`DL-170`).
 *
 * ## No description of the image, said rather than collected
 *
 * The API keeps no words for a banner's image (`BANNER_NO_DESCRIPTION`), so the form asks for none:
 * a box whose words the server dropped would be a description somebody believes residents hear
 * (`DL-125`). It says so beside the image instead.
 *
 * ## What it does, before the button
 *
 * `HOME_EFFECTS`, read from the backend, between the fields and the button — including that the image
 * is stored before the banner is saved, and that an old image is never removed from storage.
 */
@Component({
  selector: 'app-banner-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFileField],
  templateUrl: './banner-form.html',
  styleUrl: './home-screen.scss',
})
export class BannerForm {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The banner to change, or `null` to add one. */
  readonly banner = input<HomeBanner | null>(null);
  readonly saved = output<HomeBanner>();

  protected readonly copy = HOME_SCREEN_COPY.bannerForm;
  protected readonly common = HOME_SCREEN_COPY.common;
  protected readonly noDescription = BANNER_NO_DESCRIPTION;

  protected readonly title = signal('');
  protected readonly href = signal('');
  protected readonly sortOrder = signal('0');
  protected readonly active = signal(true);
  protected readonly image = signal<Blob | null>(null);
  protected readonly removeImage = signal(false);

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  /** The current image, shown only when asked for. */
  protected readonly currentImage = signal<string | null>(null);
  protected readonly currentLoading = signal(false);
  protected readonly currentFailed = signal(false);
  private readonly urls = new ObjectUrls();

  protected readonly creating = computed(() => this.banner() === null);

  private readonly draft = computed<BannerDraft>(() => ({
    title: this.title().trim(),
    href: blankToNull(this.href()),
    sortOrder: wholeNumberOf(this.sortOrder()),
    active: this.active(),
  }));

  private readonly imageChange = computed<BannerImageChange>(() => {
    const image = this.image();
    if (image !== null) return { kind: 'replace', image };
    return this.removeImage() ? { kind: 'remove' } : { kind: 'keep' };
  });

  protected readonly unchanged = computed(() => {
    const banner = this.banner();
    if (banner === null) return false;
    const draft = this.draft();
    return (
      draft.title === banner.title &&
      draft.href === banner.href &&
      draft.sortOrder === banner.sortOrder &&
      draft.active === banner.active &&
      this.imageChange().kind === 'keep'
    );
  });

  protected readonly problems = computed<readonly string[]>(() =>
    bannerProblems(this.draft()).map((problem) => problem.message),
  );

  protected readonly effects = computed<readonly string[]>(() => {
    const banner = this.banner();
    const draft = this.draft();
    const change = this.imageChange();
    const upload = change.kind === 'replace' ? HOME_EFFECTS.imageUpload : [];
    const href = draft.href !== null && draft.href !== banner?.href ? HOME_EFFECTS.href : [];
    if (banner === null) {
      return [
        ...(draft.active ? HOME_EFFECTS.bannerCreateShown : HOME_EFFECTS.bannerCreateHidden),
        ...upload,
        ...href,
      ];
    }
    return [
      ...(draft.active && !banner.active ? HOME_EFFECTS.bannerShow : []),
      ...(!draft.active && banner.active ? HOME_EFFECTS.bannerHide : []),
      ...(change.kind === 'replace' && banner.mediaId !== null ? HOME_EFFECTS.imageReplaced : []),
      ...(change.kind === 'remove' ? HOME_EFFECTS.imageRemoved : []),
      ...upload,
      ...href,
      ...HOME_EFFECTS.bannerUpdate,
    ];
  });

  constructor() {
    effect(() => {
      const banner = this.banner();
      untracked(() => {
        this.title.set(banner?.title ?? '');
        this.href.set(banner?.href ?? '');
        this.sortOrder.set(String(banner?.sortOrder ?? 0));
        this.active.set(banner?.active ?? true);
        this.image.set(null);
        this.removeImage.set(false);
        this.attempted.set(false);
        this.outcome.set('');
        this.hideCurrent();
      });
    });
    this.destroyRef.onDestroy(() => this.urls.revokeAll());
  }

  protected text(event: Event): string {
    return readText(event);
  }

  protected checked(event: Event): boolean {
    return readChecked(event);
  }

  /** Reads the current image through the data layer, only when asked. */
  protected showCurrent(): void {
    const banner = this.banner();
    if (banner === null || banner.mediaId === null || this.currentLoading()) {
      return;
    }
    this.currentLoading.set(true);
    this.currentFailed.set(false);
    this.repository
      .bannerImage(banner)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bytes) => {
          this.currentLoading.set(false);
          this.currentImage.set(this.urls.make(bytes));
        },
        error: () => {
          this.currentLoading.set(false);
          this.currentFailed.set(true);
        },
      });
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const banner = this.banner();
    const work =
      banner === null
        ? this.repository.createBanner(this.draft(), this.image())
        : this.repository.updateBanner(banner.id, this.draft(), this.imageChange());

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

  private hideCurrent(): void {
    this.urls.revokeAll();
    this.currentImage.set(null);
    this.currentFailed.set(false);
    this.currentLoading.set(false);
  }
}
