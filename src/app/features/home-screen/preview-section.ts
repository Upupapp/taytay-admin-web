import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';

import { HOME_SCREEN_REPOSITORY, type HomeBannerId, type HomePreview } from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';

import { HOME_SCREEN_COPY } from './home-screen.copy';

/**
 * The home screen as the app is given it now (`GET home`, `DL-170`): shown banners and every link in
 * the app's order, the featured Tulong pages, and how many hotlines and Balita articles it carries.
 *
 * Read again whenever a banner or a link is saved here, and on request — what residents see is the
 * server's answer, never this screen's guess at it. Banner images are public pictures, read as bytes
 * through the data layer and shown from object URLs given back when the preview is read again or
 * the page is left.
 */
@Component({
  selector: 'app-preview-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent],
  templateUrl: './preview-section.html',
  styleUrl: './home-screen.scss',
})
export class PreviewSection {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** Bumped by the page when something on the home screen was saved. */
  readonly generation = input(0);

  protected readonly copy = HOME_SCREEN_COPY.preview;

  private readonly asked = signal(0);
  protected readonly state = toSignal(
    combineLatest([toObservable(this.generation), toObservable(this.asked)]).pipe(
      switchMap(() => toViewState(this.repository.preview())),
    ),
    { initialValue: LOADING as ViewState<HomePreview> },
  );

  /** Each banner's image: an object URL, or `failed`. Absent while loading. */
  protected readonly images = signal<ReadonlyMap<HomeBannerId, string>>(new Map());
  private readonly urls = new ObjectUrls();

  protected readonly preview = computed(() => valueOf(this.state()));

  constructor() {
    effect(() => {
      const preview = this.preview();
      untracked(() => this.loadImages(preview));
    });
    this.destroyRef.onDestroy(() => this.urls.revokeAll());
  }

  protected reload(): void {
    this.asked.update((n) => n + 1);
  }

  private loadImages(preview: HomePreview | null): void {
    this.urls.revokeAll();
    this.images.set(new Map());
    for (const banner of preview?.banners ?? []) {
      if (banner.mediaId === null) {
        continue;
      }
      this.repository
        .bannerImage(banner)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (bytes) => this.remember(banner.id, this.urls.make(bytes)),
          error: () => this.remember(banner.id, 'failed'),
        });
    }
  }

  private remember(id: HomeBannerId, image: string): void {
    this.images.update((images) => new Map([...images, [id, image]]));
  }
}
