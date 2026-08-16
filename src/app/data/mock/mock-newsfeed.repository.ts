import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  POST_STATUS_TRANSITIONS,
  PermissionDeniedError,
  asId,
  asIsoDateTime,
  canTransition,
  matchesView,
  moderationProblems,
  postProblems,
  toAuditRow,
  userHasPermission,
  type AuditRow,
  type Comment,
  type CommentFilter,
  type CommentId,
  type ModerationAction,
  type NewsfeedRepository,
  type Post,
  type PostDraft,
  type PostFilter,
  type PostId,
  type PostView,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { matchesSearch } from './mock-query';
import { MockLatency } from './mock-latency';
import { MOCK_COMMENTS, MOCK_POSTS } from './seed/newsfeed.seed';

/**
 * The newsfeed adapter.
 *
 * Publishing is held apart from editing at every layer — the permission, the
 * port and here — because a published post reaches every resident and cannot be
 * recalled (`DL-124`). Saving a draft costs `newsfeed.edit`; putting it out
 * costs `newsfeed.publish`.
 *
 * Three further rules this file enforces rather than assumes:
 *
 *  - **Alt text before publication.** `postProblems` is re-run here with the
 *    publishing intent, so a screen that forgot to check cannot get a post out
 *    without a description of its image (`DL-125`).
 *  - **Every moderation act carries a reason**, and hiding is reversible while
 *    removal is not (`DL-127`). Removal nulls the body: keeping abusive words
 *    forever to satisfy an append-only rule would preserve the harm they did.
 *  - **Nothing returns who reacted.** There is no method for it, because an
 *    officer does not need to know which residents reacted to an advisory about
 *    food assistance (`DL-126`).
 */
@Injectable()
export class MockNewsfeedRepository implements NewsfeedRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private posts: readonly Post[] = [...MOCK_POSTS];
  private commentState: readonly Comment[] = [...MOCK_COMMENTS];
  private trail: readonly AuditRow[] = [];

  /* ── Reading ────────────────────────────────────────────────────────────── */

  list(view: PostView, filter: PostFilter): Observable<readonly Post[]> {
    const denied = denyUnless<readonly Post[]>(this.access.currentUser(), 'newsfeed.view');
    if (denied) {
      return denied;
    }

    const matched = this.posts
      .filter((post) => matchesView(post, view))
      .filter((post) => filter.category === undefined || post.category === filter.category)
      .filter((post) => this.withinDates(post, filter))
      .filter((post) => matchesSearch([post.headline ?? '', post.body], filter.search));

    // Pinned first, then newest. A pinned advisory that sorts below a routine
    // update is a pin that does nothing.
    return this.latency.respond(
      [...matched].sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return (b.publishedAt ?? b.audit.updatedAt).localeCompare(
          a.publishedAt ?? a.audit.updatedAt,
        );
      }),
    );
  }

  getById(id: PostId): Observable<Post | null> {
    if (!userHasPermission(this.access.currentUser(), 'newsfeed.view')) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.posts.find((post) => post.id === id) ?? null);
  }

  history(id: PostId): Observable<readonly AuditRow[]> {
    const denied = denyUnless<readonly AuditRow[]>(this.access.currentUser(), 'newsfeed.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(this.trail.filter((row) => row.entityId === id));
  }

  /* ── Writing ────────────────────────────────────────────────────────────── */

  saveDraft(draft: PostDraft, id: PostId | null): Observable<Post> {
    const user = this.access.currentUser();
    const denied = denyUnless<Post>(user, id === null ? 'newsfeed.create' : 'newsfeed.edit');
    if (denied) {
      return denied;
    }

    const problems = postProblems(draft, asIsoDateTime(new Date()), 'save');
    if (problems.length > 0) {
      return throwError(() => new Error(problems.join(', ')));
    }

    const now = asIsoDateTime(new Date());
    if (id === null) {
      const created: Post = {
        id: asId<PostId>(`post-local-${this.posts.length + 1}`),
        headline: draft.headline,
        body: draft.body.trim(),
        category: draft.category,
        status: 'draft',
        image: draft.image,
        linkUrl: draft.linkUrl,
        audience: draft.audience,
        commentsEnabled: draft.commentsEnabled,
        isPinned: false,
        scheduledFor: null,
        publishedAt: null,
        publishedBy: null,
        reactionCount: 0,
        commentCount: 0,
        audit: { createdAt: now, createdBy: user?.id ?? null, updatedAt: now, updatedBy: user?.id ?? null },
      };
      this.posts = [created, ...this.posts];
      this.record(created, 'created', 'Draft created.', null);
      return this.latency.respond(created);
    }

    const existing = this.posts.find((post) => post.id === id);
    if (existing === undefined) {
      return throwError(() => new PermissionDeniedError('newsfeed.edit'));
    }
    const updated = this.save(existing, {
      headline: draft.headline,
      body: draft.body.trim(),
      category: draft.category,
      image: draft.image,
      linkUrl: draft.linkUrl,
      audience: draft.audience,
      commentsEnabled: draft.commentsEnabled,
    });
    this.record(updated, 'updated', 'Post edited.', null);
    return this.latency.respond(updated);
  }

  publish(id: PostId, reason: string): Observable<Post> {
    return this.move(id, 'published', 'newsfeed.publish', reason, (post, user) => ({
      status: 'published' as const,
      scheduledFor: null,
      publishedAt: post.publishedAt ?? asIsoDateTime(new Date()),
      publishedBy: post.publishedBy ?? user,
    }));
  }

  schedule(id: PostId, at: Post['scheduledFor'], reason: string): Observable<Post> {
    return this.move(id, 'scheduled', 'newsfeed.schedule', reason, () => ({
      status: 'scheduled' as const,
      scheduledFor: at,
    }));
  }

  archive(id: PostId, reason: string): Observable<Post> {
    return this.move(id, 'archived', 'newsfeed.archive', reason, () => ({
      status: 'archived' as const,
    }));
  }

  setPinned(id: PostId, isPinned: boolean, reason: string): Observable<Post> {
    const user = this.access.currentUser();
    const denied = denyUnless<Post>(user, 'newsfeed.pin');
    if (denied) {
      return denied;
    }
    const outcome = this.locate(id, 'newsfeed.pin', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const updated = this.save(outcome.post, { isPinned });
    this.record(updated, isPinned ? 'pinned' : 'unpinned', reason, reason);
    return this.latency.respond(updated);
  }

  setCommentsEnabled(id: PostId, enabled: boolean, reason: string): Observable<Post> {
    const user = this.access.currentUser();
    const denied = denyUnless<Post>(user, 'newsfeed.moderate-comments');
    if (denied) {
      return denied;
    }
    const outcome = this.locate(id, 'newsfeed.moderate-comments', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const updated = this.save(outcome.post, { commentsEnabled: enabled });
    this.record(updated, 'updated', enabled ? 'Comments enabled.' : 'Comments disabled.', reason);
    return this.latency.respond(updated);
  }

  /* ── Moderation ─────────────────────────────────────────────────────────── */

  comments(postId: PostId, filter: CommentFilter): Observable<readonly Comment[]> {
    const denied = denyUnless<readonly Comment[]>(this.access.currentUser(), 'newsfeed.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.commentState
        .filter((comment) => comment.postId === postId)
        .filter((comment) => filter.state === undefined || comment.state === filter.state)
        .filter((comment) => matchesSearch([comment.body ?? '', comment.authorName], filter.search)),
    );
  }

  moderate(commentId: CommentId, action: ModerationAction, text: string): Observable<Comment> {
    const user = this.access.currentUser();
    const denied = denyUnless<Comment>(user, 'newsfeed.moderate-comments');
    if (denied) {
      return denied;
    }

    const comment = this.commentState.find((entry) => entry.id === commentId);
    if (comment === undefined) {
      return throwError(() => new PermissionDeniedError('newsfeed.moderate-comments'));
    }

    // Re-checked here, not only on the screen: hiding or removing somebody's
    // words without saying why is the thing this rule exists to prevent.
    const problems = moderationProblems(comment, action, text);
    if (problems.length > 0) {
      return throwError(() => new Error(problems.join(', ')));
    }

    const now = asIsoDateTime(new Date());
    const updated: Comment = (() => {
      switch (action) {
        case 'hide':
          return { ...comment, state: 'hidden' as const, moderationReason: text.trim(), moderatedBy: user?.id ?? null, moderatedAt: now };
        case 'restore':
          return { ...comment, state: 'visible' as const, moderationReason: text.trim(), moderatedBy: user?.id ?? null, moderatedAt: now };
        case 'remove':
          // The words go. The record of the act does not.
          return { ...comment, state: 'removed' as const, body: null, moderationReason: text.trim(), moderatedBy: user?.id ?? null, moderatedAt: now };
        case 'reply':
          return {
            ...comment,
            officialReply: { body: text.trim(), repliedAt: now, repliedBy: user?.id ?? null },
          };
      }
    })();

    this.commentState = this.commentState.map((entry) =>
      entry.id === commentId ? updated : entry,
    );

    const post = this.posts.find((entry) => entry.id === comment.postId);
    if (post !== undefined) {
      this.record(post, AUDIT_FOR[action], MODERATION_SUMMARY[action], text.trim());
    }
    return this.latency.respond(updated);
  }

  /* ── Shared machinery ───────────────────────────────────────────────────── */

  private move(
    id: PostId,
    to: Post['status'],
    permission: Parameters<typeof denyUnless>[1],
    reason: string,
    change: (post: Post, user: Post['publishedBy']) => Partial<Post>,
  ): Observable<Post> {
    const user = this.access.currentUser();
    const denied = denyUnless<Post>(user, permission);
    if (denied) {
      return denied;
    }
    const outcome = this.locate(id, permission, reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    if (!canTransition(POST_STATUS_TRANSITIONS, outcome.post.status, to)) {
      return throwError(() => new Error(`A ${outcome.post.status} post cannot become ${to}.`));
    }
    // Alt text is a publication rule, not a drafting one, so it is checked at
    // exactly the moment it becomes one (`DL-125`).
    if (to === 'published' || to === 'scheduled') {
      const problems = postProblems(
        {
          headline: outcome.post.headline,
          body: outcome.post.body,
          category: outcome.post.category,
          image: outcome.post.image,
          linkUrl: outcome.post.linkUrl,
          audience: outcome.post.audience,
          commentsEnabled: outcome.post.commentsEnabled,
          scheduledFor: outcome.post.scheduledFor,
        },
        asIsoDateTime(new Date()),
        to === 'published' ? 'publish' : 'schedule',
      );
      if (problems.length > 0) {
        return throwError(() => new Error(problems.join(', ')));
      }
    }

    const updated = this.save(outcome.post, change(outcome.post, user?.id ?? null));
    this.record(updated, STATUS_AUDIT[to], STATUS_SUMMARY[to], reason);
    return this.latency.respond(updated);
  }

  private locate(
    id: PostId,
    permission: Parameters<typeof denyUnless>[1],
    reason: string,
  ): { readonly post: Post } | { readonly error: Observable<never> } {
    if (reason.trim().length === 0) {
      return { error: throwError(() => new Error('That needs a reason.')) };
    }
    const post = this.posts.find((entry) => entry.id === id);
    if (post === undefined) {
      return { error: throwError(() => new PermissionDeniedError(permission)) };
    }
    return { post };
  }

  private save(post: Post, changes: Partial<Post>): Post {
    const user = this.access.currentUser();
    const updated: Post = {
      ...post,
      ...changes,
      audit: { ...post.audit, updatedAt: asIsoDateTime(new Date()), updatedBy: user?.id ?? null },
    };
    this.posts = this.posts.map((entry) => (entry.id === post.id ? updated : entry));
    return updated;
  }

  /**
   * Appends to the one audit trail.
   *
   * Composed through `toAuditRow`, so a newsfeed row carries no recorded value
   * exactly as a resident row does not (`DL-114`). The reason is what makes the
   * trail answerable.
   */
  private record(
    post: Post,
    action: AuditRow['action'],
    summary: string,
    reason: string | null,
  ): void {
    const user = this.access.currentUser();
    this.trail = [
      toAuditRow(
        {
          id: asId<AuditRow['id']>(`aud-nf-${this.trail.length + 1}`),
          entityType: 'newsfeed-post',
          entityId: post.id,
          action,
          summary,
          reason,
          actorId: user?.id ?? null,
          actorName: user?.displayName ?? 'Unknown',
          occurredAt: asIsoDateTime(new Date()),
        },
        'Newsfeed post',
        'web',
        [],
        false,
      ),
      ...this.trail,
    ];
  }

  private withinDates(post: Post, filter: PostFilter): boolean {
    const at = post.publishedAt ?? post.audit.createdAt;
    if (filter.from !== undefined && at < filter.from) {
      return false;
    }
    return filter.to === undefined || at <= filter.to;
  }
}

const STATUS_AUDIT: Readonly<Record<Post['status'], AuditRow['action']>> = {
  draft: 'updated',
  scheduled: 'scheduled',
  published: 'published',
  archived: 'archived',
};

const STATUS_SUMMARY: Readonly<Record<Post['status'], string>> = {
  draft: 'Returned to draft.',
  scheduled: 'Scheduled to go out.',
  published: 'Published to residents.',
  archived: 'Removed from the feed going forward.',
};

const AUDIT_FOR: Readonly<Record<ModerationAction, AuditRow['action']>> = {
  hide: 'comment-hidden',
  restore: 'comment-restored',
  remove: 'deleted',
  reply: 'comment-replied',
};

const MODERATION_SUMMARY: Readonly<Record<ModerationAction, string>> = {
  hide: 'A resident’s comment was hidden.',
  restore: 'A hidden comment was restored.',
  remove: 'A resident’s comment was removed. The words are gone; this record is not.',
  reply: 'The office replied to a comment.',
};
