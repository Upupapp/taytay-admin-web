import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { filter, map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { refusalFor as domainRefusalFor } from '@domain/index';
import type { DocumentAccessGrant } from '@domain/index';

/**
 * The file transport. **Built once, here, rather than per screen.**
 *
 * TAB 09: *"the console currently has no file-transport contract at all. This must be built once,
 * correctly, rather than per screen."* Everything about moving bytes to and from the API lives in
 * this file, and adapters call it — a second upload written for a second screen is how one of them
 * ends up without the size check, or without cancellation, or caching the download.
 */

/** What the server told us it accepts. Never a copy this console maintains — see below. */
export interface UploadPolicy {
  readonly mimeTypes: readonly string[];
  readonly maxBytes: number;
}

export type UploadProgress =
  | { readonly kind: 'uploading'; readonly sentBytes: number; readonly totalBytes: number }
  | { readonly kind: 'done'; readonly response: unknown };

/** Why an upload was refused, in terms a screen can turn into a sentence. */
export type UploadRefusal =
  | { readonly reason: 'too-large'; readonly maxBytes: number; readonly actualBytes: number }
  | { readonly reason: 'wrong-type'; readonly accepted: readonly string[]; readonly actual: string }
  | { readonly reason: 'rejected-by-server'; readonly status: number }
  | { readonly reason: 'network' };

export class UploadRefusedError extends Error {
  readonly refusal: UploadRefusal;

  constructor(refusal: UploadRefusal) {
    super('That file was not uploaded.');
    this.name = 'UploadRefusedError';
    this.refusal = refusal;
  }
}

@Injectable({ providedIn: 'root' })
export class FileTransport {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;

  /**
   * The **courtesy** check, run before a byte leaves the machine.
   *
   * The command is explicit about the hierarchy: *"the server's is the enforcement, the client's
   * is the courtesy."* This exists so somebody on a municipal connection learns that a 40 MB scan
   * is too large in the first second rather than the ninetieth — not to decide anything. The
   * server re-checks the size, the declared type, and the leading bytes, which is the check that
   * actually matters: a `.php` renamed to `.pdf` passes everything a browser can see.
   *
   * `policy` comes from the API's own `accepts` block on the requirements response. It is
   * deliberately a **parameter rather than a constant here**: a copy of the ceiling maintained in
   * this repository is a second description of the boundary that decides, and it drifts the first
   * time the server's changes.
   */
  refusalFor(file: File, policy: UploadPolicy): UploadRefusal | null {
    /*
     * The pre-send rule now lives in the domain.
     *
     * "A document is a PDF, a JPEG or a PNG, and no more than ten megabytes" is a rule of the
     * office rather than a fact about HTTP, and a screen needed to state it before anybody waited
     * on an upload — which `shared/` cannot do by reaching into an adapter. This keeps the two
     * post-hoc refusals, which genuinely are transport events.
     */
    return domainRefusalFor(file, policy);
  }

  /**
   * Uploads one file, reporting progress, cancellable by unsubscribing.
   *
   * Cancellation is the subscription's: Angular aborts the underlying request when the observable
   * is unsubscribed, so a screen that navigates away or offers a Cancel button gets it by doing
   * nothing special. There is no separate `cancel()` to forget to call.
   */
  upload(
    path: string,
    file: File,
    policy: UploadPolicy,
    fields: Record<string, string> = {},
  ): Observable<UploadProgress> {
    const body = new FormData();
    body.append('file', file, file.name);

    for (const [key, value] of Object.entries(fields)) {
      body.append(key, value);
    }

    return this.#http
      .post(`${this.#baseUrl}/${path}`, body, { observe: 'events', reportProgress: true })
      .pipe(
        map((event): UploadProgress | null => {
          if (event.type === HttpEventType.UploadProgress) {
            return {
              kind: 'uploading',
              sentBytes: event.loaded,
              // `total` is absent on some transports. Falling back to the file's own size is
              // honest — it is the number we are sending — where 0 would render as a bar that
              // never moves.
              totalBytes: event.total ?? file.size,
            };
          }

          return event.type === HttpEventType.Response
            ? { kind: 'done', response: event.body }
            : null;
        }),
        // Dropped, not cast away. The other HTTP events are real and simply have no progress
        // meaning; mapping them to a fake figure would make a bar jump.
        filter((progress): progress is UploadProgress => progress !== null),
        catchError((error: unknown) =>
          throwError(() => new UploadRefusedError(this.#refusalFrom(error, file, policy))),
        ),
      );
  }

  /**
   * Exchanges a grant for the bytes.
   *
   * **The URL is the server's, not this client's** (TAB 09 guardrail). The grant carries an opaque
   * handle; this appends nothing to it and constructs no path from a document id. A screen holding
   * a URL it assembled is a screen one edit away from fetching a file it may not read.
   *
   * The blob is returned and **never written to `localStorage`, `sessionStorage`, IndexedDB or a
   * cache**. A downloaded medical abstract sitting in browser storage outlives the session, the
   * grant, and the permission that allowed it.
   */
  openGranted(grant: DocumentAccessGrant): Observable<Blob> {
    return this.#http.get(`${this.#baseUrl}/documents/${grant.handle}`, { responseType: 'blob' });
  }

  /**
   * Turning a transport failure into something a person can act on.
   *
   * ## The 413 that does not look like one
   *
   * TAB 09 step 2, and the reason this method exists at all. If nginx rejects a body before
   * Laravel sees it, the response carries **no CORS headers**, so the browser refuses to expose
   * it and reports `status: 0` — indistinguishable, to naive code, from the server being down.
   *
   * A console that says "could not reach the server" there sends somebody to check their wifi
   * over a file that is simply too big. So `status === 0` on an upload is reported as
   * **too-large**, which is what it almost always is.
   *
   * That is a guess, and it is the right one: the alternative failure — a genuine network drop
   * mid-upload — leads the user to retry, which is what they would do anyway. Being wrong here
   * costs a retry; being wrong the other way costs a support call. The deployment side of this is
   * `client_max_body_size` set **above** the application limit, so Laravel answers first and this
   * path stops being reachable — recorded in the hosting notes, because it cannot be fixed here.
   */
  #refusalFrom(error: unknown, file: File, policy: UploadPolicy): UploadRefusal {
    if (!(error instanceof HttpErrorResponse)) {
      return { reason: 'network' };
    }

    if (error.status === 413 || error.status === 0) {
      // Carries the real numbers, so the screen can say "12 MB, and the limit is 10" rather than
      // "too large" with nothing to act on.
      return { reason: 'too-large', maxBytes: policy.maxBytes, actualBytes: file.size };
    }

    return { reason: 'rejected-by-server', status: error.status };
  }
}
