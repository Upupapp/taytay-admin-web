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

  post<TItem, TBody = unknown>(path: string, body: TBody): Observable<TItem> {
    return this.http.post<ApiItemResponse<TItem>>(this.url(path), body).pipe(map((r) => r.data));
  }

  postVoid<TBody = unknown>(path: string, body: TBody): Observable<void> {
    return this.http.post<void>(this.url(path), body).pipe(map(() => undefined));
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
