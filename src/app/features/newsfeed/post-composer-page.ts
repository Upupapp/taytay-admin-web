import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  ALL_RESIDENTS,
  NEWSFEED_REPOSITORY,
  POST_CATEGORY_LABELS,
  POST_PROBLEM_MESSAGES,
  TAYTAY_BARANGAYS,
  asId,
  asIsoDateTime,
  postProblems,
  type BarangayId,
  type PostCategory,
  type PostDraft,
  type PostId,
} from '@domain/index';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { NEWSFEED_COPY } from './newsfeed.copy';

/**
 * The composer.
 *
 * Familiar and social-media-like, as the command asks, with one departure that
 * is not decoration: **alt text sits beside the image, not behind a toggle.**
 *
 * A composer that hides the description field until somebody expands "advanced"
 * is a composer where the field is empty most of the time, and a municipal
 * advisory whose only content is a poster image is unreachable to the residents
 * most likely to need it read aloud (`DL-125`).
 *
 * Saving a draft is deliberately lenient — a half-written post with an image
 * and no description yet is somebody working, not a failure. The rule bites at
 * publication, which is where it means something.
 */
@Component({
  selector: 'app-post-composer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink],
  templateUrl: './post-composer-page.html',
  styleUrl: './post-composer-page.scss',
})
export class PostComposerPage {
  private readonly repository = inject(NEWSFEED_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  protected readonly copy = NEWSFEED_COPY.composer;
  protected readonly categories = Object.keys(POST_CATEGORY_LABELS) as PostCategory[];
  protected readonly barangays = TAYTAY_BARANGAYS;

  protected readonly headline = signal('');
  protected readonly body = signal('');
  protected readonly category = signal<PostCategory>('announcement');
  protected readonly imageUrl = signal('');
  protected readonly altText = signal('');
  protected readonly linkUrl = signal('');
  protected readonly audienceAll = signal(true);
  protected readonly selectedBarangays = signal<readonly BarangayId[]>([]);
  protected readonly commentsEnabled = signal(true);
  protected readonly saving = signal(false);

  /**
   * Fixed for the lifetime of the screen.
   *
   * A validation message that changes while somebody reads it is worse than one
   * that is a minute stale, and nothing here is time-sensitive to the second.
   */
  private readonly now = asIsoDateTime(new Date());

  protected readonly draft = computed<PostDraft>(() => ({
    headline: this.headline().trim() || null,
    body: this.body(),
    category: this.category(),
    image:
      this.imageUrl().trim() === ''
        ? null
        : { url: this.imageUrl().trim(), altText: this.altText() },
    linkUrl: this.linkUrl().trim() || null,
    audience: this.audienceAll()
      ? ALL_RESIDENTS
      : { scope: 'selected-barangays' as const, barangayIds: this.selectedBarangays() },
    scheduledFor: null,
    commentsEnabled: this.commentsEnabled(),
  }));

  /**
   * What would stop this going out, shown while it is being written.
   *
   * Computed with the publishing intent even on a draft, so the composer can
   * *tell* somebody what is still needed without *refusing* to save.
   */
  protected readonly publishProblems = computed(() =>
    postProblems(this.draft(), this.now, 'publish').map(
      (problem) => POST_PROBLEM_MESSAGES[problem],
    ),
  );

  protected readonly canSave = computed(
    () => this.body().trim().length > 0 && !this.saving(),
  );

  protected categoryLabel(category: PostCategory): string {
    return POST_CATEGORY_LABELS[category];
  }

  protected onHeadline(event: Event): void {
    this.headline.set((event.target as HTMLInputElement).value);
  }

  protected onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected onCategory(event: Event): void {
    this.category.set((event.target as HTMLSelectElement).value as PostCategory);
  }

  protected onImageUrl(event: Event): void {
    this.imageUrl.set((event.target as HTMLInputElement).value);
  }

  protected onAltText(event: Event): void {
    this.altText.set((event.target as HTMLInputElement).value);
  }

  protected onLink(event: Event): void {
    this.linkUrl.set((event.target as HTMLInputElement).value);
  }

  protected onAudience(all: boolean): void {
    this.audienceAll.set(all);
  }

  protected toggleBarangay(id: BarangayId): void {
    this.selectedBarangays.update((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  protected isSelected(id: BarangayId): boolean {
    return this.selectedBarangays().includes(id);
  }

  protected onCommentsEnabled(event: Event): void {
    this.commentsEnabled.set((event.target as HTMLInputElement).checked);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      const post = await firstValueFrom(this.repository.saveDraft(this.draft(), null));
      this.notifications.success(this.copy.saved);
      // Straight to the post, which is where publishing happens: the composer
      // writes, the detail screen decides.
      await this.router.navigate(['/newsfeed', asId<PostId>(post.id)]);
    } catch {
      this.notifications.error(this.copy.saveFailed);
    } finally {
      this.saving.set(false);
    }
  }
}
