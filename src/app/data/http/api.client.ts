import { WriteIntent } from '@domain/index';

// Re-exported so the transport seam's own callers need not reach past it for a domain type.
export { WriteIntent };
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, throwError, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import type { Page, PageRequest } from '@domain/index';

import {
  MAX_PER_PAGE,
  toPage,
  toQueryParams,
  type ApiItemResponse,
  type ApiListResponse,
} from './api.contract';

/**
 * How many pages `everyPage` will read before refusing.
 *
 * 20 × the API's maximum page size. A catalogue past that is not something a dropdown should be
 * rendering, and the number exists so the refusal is a decision rather than a hang.
 */
const PAGE_CEILING = 20;

/**
 * Thin transport helper shared by every HTTP adapter. It owns the base URL and
 * the response envelope so individual repositories stay one-liners.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl.replace(/\/+$/, '');

  page<TItem>(
    path: string,
    request: PageRequest<string>,
    filter: Record<string, unknown> = {},
  ): Observable<Page<TItem>> {
    return this.http
      .get<ApiListResponse<TItem>>(this.url(path), { params: toQueryParams(request, filter) })
      .pipe(map(toPage));
  }

  /**
   * Every page of a paginated route, or an error — **never a partial list**.
   *
   * ## Why this exists
   *
   * Every list this API serves is a `page`, and 25 rows is what it gives an unasked-for request
   * (`DL-156`). For a screen somebody browses that is a missing page. For a **picker** it is a
   * wrong answer: an intake officer who cannot see a programme in a dropdown concludes the office
   * does not run it, and files the request under something else. Nothing on the screen looks
   * broken. That is `DL-112`'s failure — a wrong answer delivered with confidence — arriving
   * through a scrollbar rather than a search box.
   *
   * ## It refuses rather than truncating
   *
   * Reading stops at `PAGE_CEILING` pages and **throws**. A catalogue that large is not something a
   * dropdown should be rendering anyway, and the alternatives are worse: fetching without bound
   * hangs a screen on a registry-sized answer, and stopping quietly is the defect this method
   * exists to remove, reintroduced at a higher number.
   *
   * ## It asks for the largest page the server allows
   *
   * `toQueryParams` already clamps to the API's `MAX_PER_PAGE`, so one request usually suffices and
   * the loop is the exception rather than the plan.
   */
  everyPage<TItem>(
    path: string,
    filter: Record<string, unknown> = {},
  ): Observable<readonly TItem[]> {
    const size = MAX_PER_PAGE;

    const readFrom = (page: number, seen: readonly TItem[]): Observable<readonly TItem[]> =>
      this.page<TItem>(path, { page, pageSize: size }, filter).pipe(
        switchMap((answer) => {
          const gathered = [...seen, ...answer.items];

          if (page >= answer.totalPages || answer.items.length === 0) {
            return of(gathered);
          }

          if (page >= PAGE_CEILING) {
            return throwError(
              () =>
                new Error(
                  `That list is longer than this screen can read in one go (${answer.totalItems} ` +
                    `entries). Nothing is shown rather than part of it, because a partial list ` +
                    `here reads as the whole of it.`,
                ),
            );
          }

          return readFrom(page + 1, gathered);
        }),
      );

    return readFrom(1, []);
  }

  collection<TItem>(
    path: string,
    params: Record<string, string> = {},
  ): Observable<readonly TItem[]> {
    return this.http
      .get<ApiListResponse<TItem>>(this.url(path), { params })
      .pipe(map((response) => response.data));
  }

  /** `params` for the reads that are a query rather than a record by id. */
  item<TItem>(path: string, params: Record<string, string> = {}): Observable<TItem> {
    return this.http
      .get<ApiItemResponse<TItem>>(this.url(path), { params })
      .pipe(map((r) => r.data));
  }

  /**
   * `GET` for a resource that legitimately may not exist.
   *
   * **`null` means the server told us it is not there.** It does not mean the
   * request failed.
   *
   * This previously mapped any empty body to `null`, so a transport failure and
   * a genuine absence became the same answer — and a screen would render "no
   * record found" when the truth was "we could not ask". For a caseworker
   * looking up whether a household has an open referral, those are opposite
   * conclusions, and only one of them is safe to act on.
   *
   * A `404` is the server's answer and becomes `null`. Everything else — a
   * `500`, a refused cross-origin request, a dropped connection — propagates,
   * so the screen shows a failure rather than an absence.
   *
   * Note that `404` is also what the API returns when the actor may not know
   * the record exists (`conventions.md` §4). That is deliberate on both sides:
   * the console cannot distinguish them either, which is the point.
   */
  optionalItem<TItem>(path: string): Observable<TItem | null> {
    return this.http.get<ApiItemResponse<TItem>>(this.url(path)).pipe(
      map((response) => response.data),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * A write.
   *
   * `intent` makes it **replayable**: the key is generated once, when the
   * officer commits the intent, and reused for every attempt at that same act.
   * Generating one per HTTP attempt would defeat the purpose entirely — a retry
   * would carry a new key and the server would treat it as a second, genuine
   * request. On money, that is a second payout.
   *
   * Omitting `intent` sends no key, which is correct for a write that is not
   * safely replayable and must fail rather than silently repeat.
   */
  post<TItem, TBody = unknown>(path: string, body: TBody, intent?: WriteIntent): Observable<TItem> {
    return this.http
      .post<ApiItemResponse<TItem>>(this.url(path), body, { headers: idempotency(intent) })
      .pipe(map((r) => r.data));
  }

  postVoid<TBody = unknown>(path: string, body: TBody, intent?: WriteIntent): Observable<void> {
    return this.http
      .post<void>(this.url(path), body, { headers: idempotency(intent) })
      .pipe(map(() => undefined));
  }

  deleteVoid(path: string): Observable<void> {
    return this.http.delete<void>(this.url(path)).pipe(map(() => undefined));
  }

  /**
   * A DELETE that returns the record it changed, and may carry a reason.
   *
   * ## Why a body on a DELETE
   *
   * Several of this API's removals are **recorded acts, not erasures** — ending a relationship,
   * withdrawing a vulnerability correction, removing a staff assignment. The row survives; what
   * the request removes is the *standing*, and the server requires the reason in the same act so
   * there is no window in which a removal exists without one (`DL-48`, `DL-54`).
   *
   * That reason has to travel in the body. Putting it in the query string would place a
   * caseworker's sentence about a family into a URL, which is logged by every proxy on the path
   * and is the failure `DL-109` already refused for search terms.
   *
   * ## Why this did not exist before
   *
   * There was only `deleteVoid`, which sends no body and returns nothing — so **every DELETE route
   * the API serves was unreachable from this console**, and the adapters had quietly invented POST
   * routes instead (`.../factors/{code}/clear`, `.../relationships/{id}/end`). Those 404. The verb
   * was missing from the transport, so the mismatch could never surface as a type error.
   */
  delete<TItem, TBody = unknown>(
    path: string,
    body?: TBody,
    intent?: WriteIntent,
  ): Observable<TItem> {
    return this.http
      .delete<ApiItemResponse<TItem>>(this.url(path), {
        body,
        headers: idempotency(intent),
      })
      .pipe(map((r) => r.data));
  }

  patch<TItem, TBody = unknown>(path: string, body: TBody): Observable<TItem> {
    return this.http.patch<ApiItemResponse<TItem>>(this.url(path), body).pipe(map((r) => r.data));
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }
}

function idempotency(intent: WriteIntent | undefined): Record<string, string> {
  return intent === undefined ? {} : { 'Idempotency-Key': intent.key };
}
