import { Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import { type NewsfeedRepository, type DataPort } from '@domain/index';

/**
 * THE PORTS THE API DOES NOT SERVE, AND WHAT THEY SAY INSTEAD.
 *
 * The Node API that replaced the Laravel one on 2026-10-20 began as the back office of the
 * residents' app (`DL-164`, `docs/integration/node-api-gap-map.md`). The casework has moved onto it
 * a phase at a time since — the registry, programmes, requests, cases, releases, referrals, visits
 * the dashboard, the beneficiary registry, search, the work queues, reports, governance and events
 * (`DL-174` to `DL-192`). What is left has no route yet: the newsfeed. In the `http` configuration
 * its port is bound to the class here.
 *
 * ## What an unserved adapter does
 *
 * Every method fails at once with a sentence a person can read, and **makes no request**. It does
 * not inject `ApiClient` or `HttpClient`, so it cannot: there is no route to call, and a request to
 * a path that does not exist would come back as a 404 the screen reads as "not found" — an absence
 * of records, when the truth is an absence of a server.
 *
 * ## What it must never do
 *
 * - **Answer with an empty list.** An officer who sees no cases concludes none was ever opened
 *   (`DL-112`). An error is the only answer that does not assert something about the office.
 * - **Fall back to the mock.** Sample data in a configuration that claims to be a real API is the
 *   misconfiguration `check:environments` and `check:bundle` exist to stop (`DL-136`).
 *
 * ## Why every method takes no parameters
 *
 * A method that declares fewer parameters than its port's is assignable to it, and one that ignores
 * everything it is given has nothing to declare. `Observable<never>` is assignable to every
 * `Observable<T>` the ports return, so the classes implement their ports with no cast — and a port
 * that gains a method fails to compile here until somebody decides what it says.
 */

/**
 * The refusal every unserved method answers with. An `Error`, so `toViewState` shows its message
 * rather than a generic failure.
 */
export class UnservedError extends Error {
  /** Which part of the console, in the words the sentence uses. */
  readonly module: string;

  constructor(module: string) {
    super(
      `This part of the console has no server yet: the API it is connected to does not serve ` +
        `${module}. Nothing was sent, and nothing shown here is a record of the office.`,
    );
    this.name = 'UnservedError';
    this.module = module;
  }
}

export function unserved(module: string): Observable<never> {
  return throwError(() => new UnservedError(module));
}

@Injectable()
export class UnservedNewsfeedRepository implements NewsfeedRepository {
  static readonly port: DataPort = 'newsfeed';

  list(): Observable<never> {
    return unserved('the newsfeed');
  }

  getById(): Observable<never> {
    return unserved('the newsfeed');
  }

  saveDraft(): Observable<never> {
    return unserved('the newsfeed');
  }

  publish(): Observable<never> {
    return unserved('the newsfeed');
  }

  schedule(): Observable<never> {
    return unserved('the newsfeed');
  }

  archive(): Observable<never> {
    return unserved('the newsfeed');
  }

  setPinned(): Observable<never> {
    return unserved('the newsfeed');
  }

  setCommentsEnabled(): Observable<never> {
    return unserved('the newsfeed');
  }

  comments(): Observable<never> {
    return unserved('the newsfeed');
  }

  moderate(): Observable<never> {
    return unserved('the newsfeed');
  }

  history(): Observable<never> {
    return unserved('the newsfeed');
  }
}

/**
 * The ports this adapter set says it cannot serve, bound to `UNSERVED_PORTS` by
 * `data-access.providers.ts` (`DL-167`).
 *
 * Read from the classes rather than written out as words, so an entry cannot name a port its class
 * does not stand in for. That this list and the `useClass: Unserved…` bindings name the same ports
 * is `check:unserved`'s rule 1: a port bound here and missing from the list would keep its
 * navigation entry, and every officer who followed it would meet a refusal.
 *
 * Here rather than in `data-access.providers.ts` because the test build swaps that file for the
 * mock one: a spec can import this list, and could not import the binding.
 */
export const UNSERVED_HTTP_PORTS: readonly DataPort[] = [UnservedNewsfeedRepository.port];
