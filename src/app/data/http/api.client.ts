import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import type { Page, PageRequest } from '@domain/index';

import { toPage, toQueryParams, type ApiItemResponse, type ApiListResponse } from './api.contract';

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

  /** `GET` for a resource that legitimately may not exist. */
  optionalItem<TItem>(path: string): Observable<TItem | null> {
    return this.http
      .get<ApiItemResponse<TItem> | null>(this.url(path))
      .pipe(map((response) => response?.data ?? null));
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

  patch<TItem, TBody = unknown>(path: string, body: TBody): Observable<TItem> {
    return this.http.patch<ApiItemResponse<TItem>>(this.url(path), body).pipe(map((r) => r.data));
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }
}

/**
 * One user intent, carried across however many attempts it takes.
 *
 * Created by the caller at the moment the officer commits — pressing Release,
 * submitting an intake — and held while the request is retried. The API replays
 * the stored response for the same key and answers `409` if the same key
 * arrives with a different body, which is what makes a double-click, a flaky
 * connection and a browser retry all resolve to one act.
 */
export class WriteIntent {
  readonly key: string;

  constructor(key?: string) {
    this.key = key ?? crypto.randomUUID();
  }
}

function idempotency(intent: WriteIntent | undefined): Record<string, string> {
  return intent === undefined ? {} : { 'Idempotency-Key': intent.key };
}
