import { inject, Injectable } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

import { DATA_PORTS, UNSERVED_PORTS, type DataPort } from '@domain/index';

/** The one page that names every module the bound API cannot serve (`DL-167`). */
export const UNSERVED_ROUTE = '/unavailable';

/**
 * What the bound adapter set can serve, read once from `UNSERVED_PORTS`.
 *
 * Features never learn which adapter answers them — rule 3 — so the question "is this module
 * reachable at all" has to be asked of a declaration the data layer makes, never inferred from an
 * error after the officer has already opened the screen.
 */
@Injectable({ providedIn: 'root' })
export class ServedPorts {
  private readonly missing: ReadonlySet<DataPort> = new Set(inject(UNSERVED_PORTS));

  /** In the order `DATA_PORTS` lists them, so the page reads the same way on every visit. */
  readonly unserved: readonly DataPort[] = DATA_PORTS.filter((port) => this.missing.has(port));

  servesAll(ports: readonly DataPort[]): boolean {
    return ports.every((port) => !this.missing.has(port));
  }
}

/** A route guard that also says which ports it stands for, so a test can hold it to its nav entry. */
export type ServedGuard = CanActivateFn & { readonly ports: readonly DataPort[] };

/**
 * Sends a screen whose ports are not all served to the page that says so (`DL-167`).
 *
 *   { path: 'residents', canActivate: [servedGuard('resident'), permissionGuard('resident.view')] }
 *
 * Listed **before** the permission guard. The router lets the first redirect in declaration order
 * win, and "this module has no server" is the truer answer than "you may not open it": nobody could.
 *
 * Every port the screen reads, not only its main one. A screen that can load its list and not the
 * people picker beside it fails half-way, which reads as a record with a missing piece.
 */
export function servedGuard(...ports: readonly DataPort[]): ServedGuard {
  const guard: CanActivateFn = (): boolean | UrlTree =>
    inject(ServedPorts).servesAll(ports) ? true : inject(Router).createUrlTree([UNSERVED_ROUTE]);

  return Object.assign(guard, { ports });
}
