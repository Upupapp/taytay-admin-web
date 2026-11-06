import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, throwError, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import type { CursorPage, CursorRequest } from '@domain/index';

import {
  MAX_LIMIT,
  toCursorPage,
  toFilterParams,
  toQueryParams,
  type ApiCursorPageResponse,
  type ApiItemResponse,
  type ApiListResponse,
} from './api.contract';

/**
 * How many pages `everyPage` will read before refusing.
 *
 * 20 × the API's largest page, so a thousand rows. A catalogue past that is not something a
 * dropdown should be rendering, and the number exists so the refusal is a decision rather than a
 * hang.
 */
const PAGE_CEILING = 20;

/**
 * Thin transport helper shared by every HTTP adapter. It owns the base URL and the response
 * envelope so individual repositories stay one-liners.
 *
 * ## No `Idempotency-Key`, and why that is not an oversight
 *
 * The retired API honoured an `Idempotency-Key` on its money writes, and the writes here used to
 * carry one. The Node API implements no such header, so sending it would promise a replay safety
 * nobody provides. Worse, it would break every write outright: the API's CORS policy allows exactly
 * `Authorization`, `Content-Type`, `X-Request-Id` and `X-Client-Channel`, and a request carrying any
 * other non-safelisted header fails its preflight before the server sees it — a status `0`, not an
 * error anybody can read. So no write takes an intent until the API both implements the key and
 * allows it across origins (`DL-165`; `check:money` refuses a money write over HTTP meanwhile).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl.replace(/\/+$/, '');

  /** One cursor page of a list somebody browses. The screen says "more available", never "of N". */
  cursorPage<TItem>(
    path: string,
    request: CursorRequest,
    filter: Record<string, unknown> = {},
  ): Observable<CursorPage<TItem>> {
    return this.http
      .get<ApiCursorPageResponse<TItem>>(this.url(path), {
        params: toQueryParams(request, filter),
      })
      .pipe(map(toCursorPage));
  }

  /**
   * Every page of a cursor-paged route, or an error — **never a partial list**.
   *
   * ## Why this exists
   *
   * Twenty rows is what this API gives a request that did not ask for more. For a screen somebody
   * browses that is a missing page. For a **picker** it is a wrong answer: an intake officer who
   * cannot see a programme in a dropdown concludes the office does not run it (`DL-161`). Nothing
   * on the screen looks broken, which is `DL-112`'s failure — a wrong answer delivered with
   * confidence.
   *
   * ## It refuses rather than truncating
   *
   * Reading follows `next_cursor` and stops at `PAGE_CEILING` pages by **throwing**. Fetching
   * without bound hangs a screen on a registry-sized answer, and stopping quietly is the defect this
   * method exists to remove, reintroduced at a higher number.
   *
   * ## It asks for the largest page the server allows
   *
   * One request usually suffices, so the loop is the exception rather than the plan.
   */
  everyPage<TItem>(
    path: string,
    filter: Record<string, unknown> = {},
  ): Observable<readonly TItem[]> {
    const readFrom = (
      cursor: string | null,
      pagesRead: number,
      seen: readonly TItem[],
    ): Observable<readonly TItem[]> =>
      this.cursorPage<TItem>(path, { limit: MAX_LIMIT, cursor }, filter).pipe(
        switchMap((answer) => {
          const gathered = [...seen, ...answer.items];

          // An empty page that claims more is the server's mistake; asking again would loop.
          if (!answer.hasMore || answer.nextCursor === null || answer.items.length === 0) {
            return of(gathered);
          }

          if (pagesRead + 1 >= PAGE_CEILING) {
            return throwError(
              () =>
                new Error(
                  `That list is longer than this screen can read in one go (more than ` +
                    `${gathered.length} entries). Nothing is shown rather than part of it, because ` +
                    `a partial list here reads as the whole of it.`,
                ),
            );
          }

          return readFrom(answer.nextCursor, pagesRead + 1, gathered);
        }),
      );

    return readFrom(null, 0, []);
  }

  /**
   * A whole list the server answers at once, with `meta: {}` — barangays, news categories,
   * banners, hotlines.
   *
   * Right exactly where the spec says the route is unpaged, and wrong anywhere else: used on a
   * cursor-paged route it would read the first twenty rows and present them as the whole list.
   * `check:response-shape` holds each read to the envelope its route declares.
   */
  list<TItem>(path: string, params: Record<string, unknown> = {}): Observable<readonly TItem[]> {
    return this.http
      .get<ApiListResponse<TItem>>(this.url(path), { params: toFilterParams(params) })
      .pipe(map((response) => response.data));
  }

  /** `params` for the reads that are a query rather than a record by id. */
  item<TItem>(path: string, params: Record<string, string> = {}): Observable<TItem> {
    return this.http
      .get<ApiItemResponse<TItem>>(this.url(path), { params })
      .pipe(map((response) => response.data));
  }

  /**
   * `GET` for a resource that legitimately may not exist.
   *
   * **`null` means the server told us it is not there.** It does not mean the request failed: a
   * transport failure and a genuine absence are opposite conclusions for a caseworker, and only one
   * of them is safe to act on. A `404` becomes `null`; everything else — a `500`, a refused
   * cross-origin request, a dropped connection — propagates, so the screen shows a failure rather
   * than an absence.
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
   * Bytes the API answers with instead of an envelope — today only `GET media/{id}/content`.
   *
   * Fetched like every other request, so the bearer token travels in the `Authorization` header the
   * interceptor adds and **never in a URL** (rule 5). The alternative, an `<img src>` pointed at the
   * API, cannot carry a header at all: it would need the token in the query string, where every
   * proxy and history entry keeps it. The caller turns the blob into an object URL it must revoke.
   */
  blob(path: string): Observable<Blob> {
    return this.http.get(this.url(path), { responseType: 'blob' });
  }

  /**
   * A `POST` the API answers with bytes instead of an envelope — today only
   * `POST office/document-files`, which exchanges a single-use grant for a document's file
   * (`DL-178`).
   *
   * A `POST` because the exchange uses the grant up, and so the handle travels in a body rather
   * than a path every request log keeps. The bearer token goes in the `Authorization` header the
   * interceptor adds, exactly as for `blob`, and **never in a URL** (rule 5). The caller turns the
   * bytes into an object URL it must revoke.
   */
  postBlob<TBody = unknown>(path: string, body: TBody): Observable<Blob> {
    return this.http.post(this.url(path), body, { responseType: 'blob' });
  }

  post<TItem, TBody = unknown>(path: string, body: TBody): Observable<TItem> {
    return this.http
      .post<ApiItemResponse<TItem>>(this.url(path), body)
      .pipe(map((response) => response.data));
  }

  patch<TItem, TBody = unknown>(path: string, body: TBody): Observable<TItem> {
    return this.http
      .patch<ApiItemResponse<TItem>>(this.url(path), body)
      .pipe(map((response) => response.data));
  }

  /**
   * A `POST` whose body is a form — `multipart/form-data` — because it carries a file: an office's
   * banner, a Tulong page's picture (`DL-170`).
   *
   * The fields are a wire shape like any other body (`check:wire-adoption` holds them to the
   * operation's form schema, and holds a JSON helper away from a form route and back). A field left
   * `undefined` is not sent; a form cannot say `null`, so a field that must be cleared cannot travel
   * this way. No `Content-Type` is set here: the browser writes it, with the boundary, and the bearer
   * token is added by the interceptor exactly as for a JSON body.
   */
  postForm<TItem, TFields extends FormFields<TFields>>(
    path: string,
    fields: TFields,
  ): Observable<TItem> {
    return this.http
      .post<ApiItemResponse<TItem>>(this.url(path), this.toFormData(fields))
      .pipe(map((response) => response.data));
  }

  /** A `PATCH` whose body is a form, for the same reason as `postForm`. */
  patchForm<TItem, TFields extends FormFields<TFields>>(
    path: string,
    fields: TFields,
  ): Observable<TItem> {
    return this.http
      .patch<ApiItemResponse<TItem>>(this.url(path), this.toFormData(fields))
      .pipe(map((response) => response.data));
  }

  /**
   * A DELETE that answers with what it changed. The body is optional because some removals are
   * recorded acts that carry a reason, and a reason about a family belongs in a body rather than a
   * URL that every proxy on the path logs (`DL-109`).
   */
  delete<TItem, TBody = unknown>(path: string, body?: TBody): Observable<TItem> {
    return this.http
      .delete<ApiItemResponse<TItem>>(this.url(path), { body })
      .pipe(map((response) => response.data));
  }

  /** Text and files as form fields; anything else — `undefined` — is left out. */
  private toFormData(fields: object): FormData {
    const form = new FormData();
    const entries: [string, unknown][] = Object.entries(fields);

    for (const [name, value] of entries) {
      if (typeof value === 'string' || value instanceof Blob) {
        form.append(name, value);
      }
    }
    return form;
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }
}

/** A form body: every field text or a file, or `undefined` to leave it out. */
export type FormFields<TFields> = { readonly [K in keyof TFields]: string | Blob | undefined };
