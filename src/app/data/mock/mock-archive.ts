import { Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ArchiveRefusedError,
  asId,
  asIsoDateTime,
  type AppAccountId,
  type ArchiveEvent,
  type ArchiveEventId,
  type ArchiveRecord,
  type AuthenticatedUser,
  type IssuanceTypeId,
  type OfficeId,
  type OfficeInUse,
  type TulongServiceId,
} from '@domain/index';

import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { MOCK_ISSUANCE_TYPES } from './seed/issuance.seed';
import { MOCK_TULONG_SERVICES } from './seed/directory.seed';

/**
 * Archive, never delete, in memory (`DL-225`): what the API's archive rules need to know across its
 * tables, held once for every mock that names an office.
 *
 * The API refuses to archive an office while a staff account, a live Tulong page or an active
 * document type names it, and refuses to put anything new under an archived one. Those rules span
 * four mocks, each holding its own records — so each tells this registry what it links to an office,
 * and asks it whether an office is archived. Seeded from the same seeds the mocks start from, so the
 * counts are right whichever mock happens to be built first.
 */
@Injectable({ providedIn: 'root' })
export class MockOfficeRegistry {
  private readonly archived = new Set<OfficeId>();
  private readonly staff = new Map<AppAccountId, OfficeId>(
    MOCK_APP_ACCOUNTS.flatMap((account) =>
      account.officeId === null ? [] : [[account.id, account.officeId] as const],
    ),
  );
  private readonly services = new Map<TulongServiceId, OfficeId>(
    MOCK_TULONG_SERVICES.flatMap((service) =>
      service.officeId === null || service.archived !== null
        ? []
        : [[service.id, service.officeId] as const],
    ),
  );
  private readonly issuanceTypes = new Map<IssuanceTypeId, OfficeId>(
    MOCK_ISSUANCE_TYPES.flatMap((type) =>
      type.active ? [[type.id, type.office.id] as const] : [],
    ),
  );

  isArchived(office: OfficeId): boolean {
    return this.archived.has(office);
  }

  setArchived(office: OfficeId, archived: boolean): void {
    if (archived) this.archived.add(office);
    else this.archived.delete(office);
  }

  /** A staff account's office, or none. */
  linkStaff(account: AppAccountId, office: OfficeId | null): void {
    if (office === null) this.staff.delete(account);
    else this.staff.set(account, office);
  }

  /** A Tulong page in use under an office, or not in use (archived, or under none). */
  useService(service: TulongServiceId, office: OfficeId | null): void {
    if (office === null) this.services.delete(service);
    else this.services.set(service, office);
  }

  /** A document type in use under an office, or not in use (retired). */
  useIssuanceType(type: IssuanceTypeId, office: OfficeId | null): void {
    if (office === null) this.issuanceTypes.delete(type);
    else this.issuanceTypes.set(type, office);
  }

  /** What still uses an office, counted as the API counts it. */
  inUse(office: OfficeId): OfficeInUse {
    const count = <T>(links: ReadonlyMap<T, OfficeId>): number =>
      [...links.values()].filter((linked) => linked === office).length;
    return {
      staffAccounts: count(this.staff),
      services: count(this.services),
      issuanceTypes: count(this.issuanceTypes),
    };
  }

  /** The API's refusal of anything new under an archived office, in its own words. */
  refuseIfArchived<T>(office: OfficeId | null, words: string): Observable<T> | null {
    return office !== null && this.archived.has(office)
      ? throwError(() => new ArchiveRefusedError('office-archived', words))
      : null;
  }
}

let logged = 0;

/** One record kind's archive history, in memory: appended in the same act as the archive. */
export class MockArchiveLog<TId extends string> {
  private readonly events = new Map<TId, readonly ArchiveEvent[]>();

  /** Appends the act and answers the record's new archive state. */
  record(
    id: TId,
    act: 'archived' | 'restored',
    reason: string | null,
    user: AuthenticatedUser | null,
  ): ArchiveRecord | null {
    const at = asIsoDateTime(new Date());
    const actorName = user?.displayName ?? 'An account with no name recorded';
    const event: ArchiveEvent = {
      id: asId<ArchiveEventId>(`archive-event-${++logged}`),
      act,
      reason,
      actorName,
      occurredAt: at,
    };
    this.events.set(id, [event, ...(this.events.get(id) ?? [])]);
    return act === 'archived' ? { at, byName: actorName, reason } : null;
  }

  history(id: TId): readonly ArchiveEvent[] {
    return this.events.get(id) ?? [];
  }
}

/** The API's two refusals of an act somebody else already did, in its own words. */
export function refuseArchiveState<T>(
  archived: ArchiveRecord | null,
  act: 'archive' | 'restore',
  subject: string,
): Observable<T> | null {
  if (act === 'archive' && archived !== null) {
    return throwError(
      () => new ArchiveRefusedError('already-archived', `${subject} is archived already.`),
    );
  }
  if (act === 'restore' && archived === null) {
    return throwError(() => new ArchiveRefusedError('not-archived', `${subject} is not archived.`));
  }
  return null;
}

/** An archived record takes no change until it is restored (`ARCHIVED`). */
export function refuseIfReadOnly<T>(
  archived: ArchiveRecord | null,
  subject: string,
): Observable<T> | null {
  return archived === null
    ? null
    : throwError(
        () =>
          new ArchiveRefusedError(
            'read-only',
            `${subject} is archived. Restore it before changing it.`,
          ),
      );
}

/** Trimmed, 1 to 500 characters — or the API's 422, in words. */
export function refuseReason<T>(reason: string): Observable<T> | null {
  const trimmed = reason.trim();
  return trimmed.length >= 1 && trimmed.length <= 500
    ? null
    : throwError(() => new Error('Give a reason of 1 to 500 characters.'));
}
