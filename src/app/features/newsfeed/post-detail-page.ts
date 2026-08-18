import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap, type Observable } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  AUDIT_ACTION_LABELS,
  COMMENT_STATE_CATALOG,
  NEWSFEED_REPOSITORY,
  POST_CATEGORY_LABELS,
  POST_STATUS_CATALOG,
  POST_STATUS_TRANSITIONS,
  asId,
  asIsoDateTime,
  barangayName,
  canTransition,
  describeModeration,
  orderComments,
  type AuditRow,
  type Comment,
  type CommentId,
  type CommentOrder,
  type ModerationAction,
  type Post,
  type PostId,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { NEWSFEED_COPY } from './newsfeed.copy';

/**
 * One post: what residents see, what the office did, and the comments.
 *
 * Publishing carries a warning **before** the act, not a confirmation after it
 * (`DL-124`): a published post reaches residents and cannot be unsent, and
 * archiving later removes it from the feed going forward without reaching
 * anybody who already read it. The office should read that sentence while
 * deciding, not discover it afterwards.
 *
 * Removing a comment is the only act on this screen behind a modal. Hiding is
 * reversible and takes a reason inline; removal deletes a resident's words for
 * good, and the difference is worth an extra deliberate click (`DL-127`).
 *
 * Reach is shown as **counts**. There is no method on the port that returns
 * which residents reacted, and no screen here that could render one (`DL-126`).
 */
@Component({
  selector: 'app-post-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, Modal, PageHeader, RouterLink, StatusBadge],
  templateUrl: './post-detail-page.html',
  styleUrl: './post-detail-page.scss',
})
export class PostDetailPage {
  private readonly repository = inject(NEWSFEED_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);

  readonly id = input.required<string>();

  protected readonly copy = NEWSFEED_COPY.detail;
  protected readonly statusCatalog = POST_STATUS_CATALOG;
  protected readonly commentCatalog = COMMENT_STATE_CATALOG;

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly canPublish = computed(() => this.permissions.has('newsfeed.publish'));
  protected readonly canSchedule = computed(() => this.permissions.has('newsfeed.schedule'));
  protected readonly canArchive = computed(() => this.permissions.has('newsfeed.archive'));
  protected readonly canPin = computed(() => this.permissions.has('newsfeed.pin'));
  protected readonly canModerate = computed(() =>
    this.permissions.has('newsfeed.moderate'),
  );

  private readonly key = computed(() => ({ id: this.id(), nonce: this.reloads() }));

  protected readonly state = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<PostId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<Post | null> },
  );

  protected readonly post = computed(() => valueOf(this.state()) ?? null);

  protected readonly commentState = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.comments(asId<PostId>(query.id), {}))),
    ),
    { initialValue: LOADING as ViewState<readonly Comment[]> },
  );

  protected readonly historyState = toSignal(
    toObservable(this.key).pipe(
      switchMap((query) => toViewState(this.repository.history(asId<PostId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<readonly AuditRow[]> },
  );

  protected readonly order = signal<CommentOrder>('newest');

  protected readonly comments = computed(() =>
    orderComments(valueOf(this.commentState()) ?? [], this.order()),
  );

  protected readonly moderationSummary = computed(() =>
    describeModeration(valueOf(this.commentState()) ?? []),
  );

  protected readonly history = computed<readonly AuditRow[]>(
    () => valueOf(this.historyState()) ?? [],
  );

  protected categoryLabel(post: Post): string {
    return POST_CATEGORY_LABELS[post.category];
  }

  protected audienceLabel(post: Post): string {
    return post.audience.scope === 'all-residents'
      ? 'Everyone in Taytay'
      : post.audience.barangayIds.map((id) => barangayName(id)).join(', ');
  }

  protected actionLabel(row: AuditRow): string {
    return AUDIT_ACTION_LABELS[row.action];
  }

  protected can(post: Post, to: Post['status']): boolean {
    return canTransition(POST_STATUS_TRANSITIONS, post.status, to);
  }

  protected onOrder(event: Event): void {
    this.order.set((event.target as HTMLSelectElement).value as CommentOrder);
  }

  /* ── Acting on the post ─────────────────────────────────────────────────── */

  protected readonly reason = signal('');
  protected readonly scheduleAt = signal('');

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected onScheduleAt(event: Event): void {
    this.scheduleAt.set((event.target as HTMLInputElement).value);
  }

  protected readonly canAct = computed(
    () => this.reason().trim().length > 0 && !this.saving(),
  );

  protected async publish(post: Post): Promise<void> {
    await this.act(this.repository.publish(asId<PostId>(post.id), this.reason().trim()));
  }

  protected async schedule(post: Post): Promise<void> {
    if (this.scheduleAt() === '') {
      return;
    }
    await this.act(
      this.repository.schedule(
        asId<PostId>(post.id),
        asIsoDateTime(new Date(this.scheduleAt())),
        this.reason().trim(),
      ),
    );
  }

  protected async archive(post: Post): Promise<void> {
    await this.act(this.repository.archive(asId<PostId>(post.id), this.reason().trim()));
  }

  protected async togglePin(post: Post): Promise<void> {
    await this.act(
      this.repository.setPinned(asId<PostId>(post.id), !post.isPinned, this.reason().trim()),
    );
  }

  protected async toggleComments(post: Post): Promise<void> {
    await this.act(
      this.repository.setCommentsEnabled(
        asId<PostId>(post.id),
        !post.commentsEnabled,
        this.reason().trim(),
      ),
    );
  }

  /* ── Moderating a comment ───────────────────────────────────────────────── */

  protected readonly openCommentId = signal<string | null>(null);
  protected readonly moderationText = signal('');
  /** Set while a permanent removal is waiting for confirmation. */
  protected readonly removing = signal<Comment | null>(null);

  protected isOpen(comment: Comment): boolean {
    return this.openCommentId() === comment.id;
  }

  protected toggleComment(comment: Comment): void {
    this.openCommentId.update((current) => (current === comment.id ? null : comment.id));
    this.moderationText.set('');
  }

  protected onModerationText(event: Event): void {
    this.moderationText.set((event.target as HTMLTextAreaElement).value);
  }

  protected readonly canModerateNow = computed(
    () => this.moderationText().trim().length > 0 && !this.saving(),
  );

  protected async moderate(comment: Comment, action: ModerationAction): Promise<void> {
    if (!this.canModerateNow()) {
      return;
    }
    await this.act(
      this.repository.moderate(
        asId<CommentId>(comment.id),
        action,
        this.moderationText().trim(),
      ),
      () => {
        this.openCommentId.set(null);
        this.moderationText.set('');
      },
    );
  }

  /** Removal asks twice: the words go for good, and hiding is the alternative. */
  protected askToRemove(comment: Comment): void {
    if (this.moderationText().trim().length === 0) {
      return;
    }
    this.removing.set(comment);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const comment = this.removing();
    this.removing.set(null);
    if (comment !== null) {
      await this.moderate(comment, 'remove');
    }
  }

  private async act(call: Observable<unknown>, onSuccess?: () => void): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      onSuccess?.();
      this.reason.set('');
      this.notifications.success(this.copy.saved);
      this.reloads.update((value) => value + 1);
    } catch {
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
