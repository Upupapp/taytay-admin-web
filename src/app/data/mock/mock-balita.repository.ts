import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  balitaProblem,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type BalitaChanges,
  type BalitaDraft,
  type BalitaRepository,
  type CursorPage,
  type CursorRequest,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_OFFICE_HEALTH, MOCK_OFFICE_MSWDO } from './seed/offices.seed';
import { samplePlaceholder } from './seed/verification-requests.seed';

/** Printed in every seed article's title, and a `check:bundle` seed marker: it must never ship. */
export const SAMPLE_BALITA_MARKER = 'SAMPLE BALITA - ';

const LARGEST_PAGE = 50;

const CATEGORIES: readonly BalitaCategory[] = [
  { slug: 'abiso', label: 'Abiso' },
  { slug: 'advisory', label: 'Advisory' },
  { slug: 'negosyo', label: 'Negosyo' },
  { slug: 'safety', label: 'Safety' },
  { slug: 'events', label: 'Events' },
];

function sample(n: number, published: string | null, pinned = false): BalitaArticle {
  return {
    id: asId<BalitaArticleId>(`balita-${String(n).padStart(4, '0')}`),
    title: `${SAMPLE_BALITA_MARKER}Advisory ${n}`,
    body: 'A fictional article for the local-mock configuration. No resident reads it.',
    category: n % 2 === 0 ? 'advisory' : 'abiso',
    officeId: n % 3 === 0 ? MOCK_OFFICE_HEALTH : MOCK_OFFICE_MSWDO,
    status: published === null ? 'draft' : 'published',
    publishedAt: published === null ? null : asIsoDateTime(published),
    pinned,
    hasCover: n === 1,
    updatedAt: asIsoDateTime(published ?? '2026-11-01T00:00:00.000Z'),
  };
}

const SEED: readonly BalitaArticle[] = [
  sample(1, '2026-10-30T01:00:00.000Z', true),
  ...Array.from({ length: 24 }, (_, index) =>
    sample(index + 2, new Date(Date.UTC(2026, 9, 28 - index, 1)).toISOString()),
  ),
  sample(99, null),
];

/**
 * Balita for the `local-mock` configuration (`DL-171`), behaving as the API's handlers do: the list
 * holds published articles only, pinned first and then newest; a draft is read by its id; every
 * write re-checks `news.write` (rule 4); a republished article keeps its first publication date.
 * The mock does not know a signed-in account's office, so it does not refuse another office's
 * article as the API does.
 */
@Injectable()
export class MockBalitaRepository implements BalitaRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private articles: readonly BalitaArticle[] = SEED;
  private created = 0;

  list(page: CursorRequest): Observable<CursorPage<BalitaArticle>> {
    const published = this.articles
      .filter((article) => article.status === 'published')
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const end = start + Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const hasMore = end < published.length;
    return this.latency.respond({
      items: published.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  get(id: BalitaArticleId): Observable<BalitaArticle | null> {
    const denied = denyUnless<BalitaArticle | null>(this.access.currentUser(), 'news.write');
    if (denied) return denied;
    return this.latency.respond(this.articles.find((article) => article.id === id) ?? null);
  }

  categories(): Observable<readonly BalitaCategory[]> {
    return this.latency.respond(CATEGORIES);
  }

  create(draft: BalitaDraft, cover: Blob | null): Observable<BalitaArticle> {
    const denied = denyUnless<BalitaArticle>(this.access.currentUser(), 'news.write');
    if (denied) return denied;
    const problem = balitaProblem(draft.title, draft.body);
    if (problem !== null) return throwError(() => new Error(problem));

    const now = asIsoDateTime(new Date());
    const article: BalitaArticle = {
      id: asId<BalitaArticleId>(`balita-new-${++this.created}`),
      title: draft.title.trim(),
      body: draft.body.trim(),
      category: draft.category,
      officeId: draft.officeId ?? MOCK_OFFICE_MSWDO,
      status: draft.status,
      publishedAt: draft.status === 'published' ? now : null,
      pinned: false,
      hasCover: cover !== null,
      updatedAt: now,
    };
    this.articles = [article, ...this.articles];
    return this.latency.respond(article);
  }

  update(id: BalitaArticleId, changes: BalitaChanges, cover: Blob | null): Observable<BalitaArticle> {
    return this.change(id, (article) => ({
      ...article,
      title: changes.title?.trim() ?? article.title,
      body: changes.body?.trim() ?? article.body,
      category: changes.category ?? article.category,
      status: changes.status ?? article.status,
      publishedAt:
        changes.status === 'published'
          ? (article.publishedAt ?? asIsoDateTime(new Date()))
          : article.publishedAt,
      hasCover: article.hasCover || cover !== null,
    }));
  }

  pin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.change(id, (article) => ({ ...article, pinned: true }));
  }

  unpin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.change(id, (article) => ({ ...article, pinned: false }));
  }

  openCover(id: BalitaArticleId): Observable<Blob> {
    const article = this.articles.find((candidate) => candidate.id === id);
    if (article === undefined || !article.hasCover) {
      return throwError(() => new Error('That article was not found.'));
    }
    return this.latency.respond(samplePlaceholder('id-front'));
  }

  private change(
    id: BalitaArticleId,
    apply: (article: BalitaArticle) => BalitaArticle,
  ): Observable<BalitaArticle> {
    const denied = denyUnless<BalitaArticle>(this.access.currentUser(), 'news.write');
    if (denied) return denied;
    const article = this.articles.find((candidate) => candidate.id === id);
    if (article === undefined) return throwError(() => new Error('That article was not found.'));

    const changed = { ...apply(article), updatedAt: asIsoDateTime(new Date()) };
    this.articles = this.articles.map((candidate) => (candidate.id === id ? changed : candidate));
    return this.latency.respond(changed);
  }
}
