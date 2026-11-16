import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  APP_IMAGE_POLICY,
  ArchiveRefusedError,
  asId,
  asIsoDateTime,
  activeCommandCenter,
  commandCenterHolder,
  HOTLINE_LIST_CAP,
  HotlineCommandCenterTakenError,
  type ArchiveEvent,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineRepository,
  type OfficeChanges,
  type OfficeDraft,
  type OfficeId,
  type ServiceChanges,
  type ServiceDraft,
  type TulongService,
  type TulongServiceId,
  type TulongServiceRepository,
} from '@domain/index';

import {
  MockArchiveLog,
  MockOfficeRegistry,
  refuseArchiveState,
  refuseIfReadOnly,
  refuseReason,
} from './mock-archive';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_DIRECTORY_OFFICES, MOCK_HOTLINES, MOCK_TULONG_SERVICES } from './seed/directory.seed';

/** The server's refusal of an image, in its own words (`src/http/error-handler.ts`). */
function imageRefusal(image: Blob | null): Error | null {
  if (image === null) return null;
  if (image.size > APP_IMAGE_POLICY.maxBytes) return new Error('That file is larger than 5 MB.');
  return APP_IMAGE_POLICY.mimeTypes.includes(image.type)
    ? null
    : new Error('Upload a JPEG, PNG, or WebP image.');
}

/** The API's 503 past a whole list's ceiling, in its own words. */
function tooLong<T>(rows: readonly T[], ceiling: number, noun: string): Observable<never> | null {
  return rows.length > ceiling
    ? throwError(() => new Error(`There are more ${noun} than this read returns whole.`))
    : null;
}

let created = 0;
const nextId = (prefix: string): string => `${prefix}-new-${++created}`;
const now = () => asIsoDateTime(new Date());
const byName = <T extends { readonly name: string }>(rows: readonly T[]): readonly T[] =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));

/**
 * The office directory, in memory (`DL-170`), refusing the way the API does: a taken address — an
 * archived office's included, which stays reserved — an image the API would not take, a change to
 * an archived office, and an archive while a staff account, a live Tulong page or an active document
 * type still uses the office, with the counts (`DL-225`). Every act re-checks `office.manage`
 * (rule 4), the list included, as `GET admin/offices` does.
 */
@Injectable()
export class MockDirectoryOfficeRepository implements DirectoryOfficeRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly registry = inject(MockOfficeRegistry);
  private readonly log = new MockArchiveLog<OfficeId>();

  private offices: readonly DirectoryOffice[] = MOCK_DIRECTORY_OFFICES;

  list(archived: boolean): Observable<readonly DirectoryOffice[]> {
    const denied = denyUnless<readonly DirectoryOffice[]>(
      this.access.currentUser(),
      'office.manage',
    );
    if (denied) return denied;
    const rows = this.offices.filter((office) => (office.archived !== null) === archived);
    return tooLong(rows, 500, 'offices') ?? this.latency.respond(byName(rows));
  }

  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice> {
    const denied = denyUnless<DirectoryOffice>(this.access.currentUser(), 'office.manage');
    if (denied) return denied;
    const refused = this.slugTaken(draft.slug, null) ?? imageRefusal(banner);
    if (refused) return throwError(() => refused);

    const office: DirectoryOffice = {
      ...draft,
      id: asId<OfficeId>(nextId('office')),
      hasBanner: banner !== null,
      updatedAt: now(),
      archived: null,
    };
    this.offices = [office, ...this.offices];
    return this.latency.respond(office);
  }

  update(id: OfficeId, changes: OfficeChanges, banner: Blob | null): Observable<DirectoryOffice> {
    const denied = denyUnless<DirectoryOffice>(this.access.currentUser(), 'office.manage');
    if (denied) return denied;
    const existing = this.offices.find((office) => office.id === id);
    if (existing === undefined) return throwError(() => new Error('That office was not found.'));
    const readOnly = refuseIfReadOnly<DirectoryOffice>(existing.archived, 'That office');
    if (readOnly) return readOnly;
    const refused =
      (changes.slug === undefined ? null : this.slugTaken(changes.slug, id)) ??
      imageRefusal(banner);
    if (refused) return throwError(() => refused);

    return this.put({
      ...existing,
      ...changes,
      hasBanner: existing.hasBanner || banner !== null,
      updatedAt: now(),
    });
  }

  archive(id: OfficeId, reason: string): Observable<DirectoryOffice> {
    const user = this.access.currentUser();
    const denied = denyUnless<DirectoryOffice>(user, 'office.manage');
    if (denied) return denied;
    const bad = refuseReason<DirectoryOffice>(reason);
    if (bad) return bad;
    const existing = this.offices.find((office) => office.id === id);
    if (existing === undefined) return throwError(() => new Error('That office was not found.'));
    const already = refuseArchiveState<DirectoryOffice>(
      existing.archived,
      'archive',
      'That office',
    );
    if (already) return already;
    const inUse = this.registry.inUse(id);
    if (inUse.staffAccounts + inUse.services + inUse.issuanceTypes > 0) {
      return throwError(
        () =>
          new ArchiveRefusedError(
            'office-in-use',
            'That office still has staff accounts, Tulong services or document types. Move or ' +
              'archive them first.',
            inUse,
          ),
      );
    }
    this.registry.setArchived(id, true);
    return this.put({
      ...existing,
      archived: this.log.record(id, 'archived', reason.trim(), user),
    });
  }

  restore(id: OfficeId, reason: string): Observable<DirectoryOffice> {
    const user = this.access.currentUser();
    const denied = denyUnless<DirectoryOffice>(user, 'office.manage');
    if (denied) return denied;
    const bad = refuseReason<DirectoryOffice>(reason);
    if (bad) return bad;
    const existing = this.offices.find((office) => office.id === id);
    if (existing === undefined) return throwError(() => new Error('That office was not found.'));
    const already = refuseArchiveState<DirectoryOffice>(
      existing.archived,
      'restore',
      'That office',
    );
    if (already) return already;
    this.registry.setArchived(id, false);
    return this.put({
      ...existing,
      archived: this.log.record(id, 'restored', reason.trim(), user),
    });
  }

  history(id: OfficeId): Observable<readonly ArchiveEvent[]> {
    const denied = denyUnless<readonly ArchiveEvent[]>(this.access.currentUser(), 'office.manage');
    return denied ?? this.latency.respond(this.log.history(id));
  }

  private put(office: DirectoryOffice): Observable<DirectoryOffice> {
    this.offices = this.offices.map((candidate) =>
      candidate.id === office.id ? office : candidate,
    );
    return this.latency.respond(office);
  }

  private slugTaken(slug: string, except: OfficeId | null): Error | null {
    const holder = this.offices.find((office) => office.slug === slug && office.id !== except);
    if (holder === undefined) return null;
    return new Error(
      holder.archived === null
        ? 'An office with that slug already exists.'
        : 'An archived office holds that slug. It stays reserved so old links never lead to a ' +
            'different office: restore that office, or choose another slug.',
    );
  }
}

/**
 * Tulong pages, in memory (`DL-170`), as `GET admin/services` lists them: every page in use, hidden
 * ones included, or every archived one (`DL-225`). Refuses a change to an archived page, a page put
 * under an archived office, and a restore while the page's office is archived.
 */
@Injectable()
export class MockTulongServiceRepository implements TulongServiceRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly registry = inject(MockOfficeRegistry);
  private readonly log = new MockArchiveLog<TulongServiceId>();

  private services: readonly TulongService[] = MOCK_TULONG_SERVICES;

  list(archived: boolean): Observable<readonly TulongService[]> {
    const denied = denyUnless<readonly TulongService[]>(
      this.access.currentUser(),
      'service.manage',
    );
    if (denied) return denied;
    const rows = this.services.filter((service) => (service.archived !== null) === archived);
    return tooLong(rows, 1000, 'services') ?? this.latency.respond(byName(rows));
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    const underArchived = this.registry.refuseIfArchived<TulongService>(
      draft.officeId,
      'That office is archived. Restore it before putting a service under it.',
    );
    if (underArchived) return underArchived;
    const holder = this.services.find((service) => service.slug === draft.slug);
    if (holder !== undefined) {
      return throwError(
        () =>
          new Error(
            holder.archived === null
              ? 'A service with that slug already exists.'
              : 'An archived service holds that slug. It stays reserved so old links never lead ' +
                  'to a different service: restore that service, or choose another slug.',
          ),
      );
    }
    const service: TulongService = {
      ...draft,
      id: asId<TulongServiceId>(nextId('service')),
      featured: false,
      hasImage: false,
      updatedAt: now(),
      archived: null,
    };
    this.services = [service, ...this.services];
    this.registry.useService(service.id, service.officeId);
    return this.latency.respond(service);
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    return this.change(id, (service) => ({ ...service, ...changes }));
  }

  replaceImage(id: TulongServiceId, image: Blob): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    const refused = imageRefusal(image);
    if (refused) return throwError(() => refused);
    return this.change(id, (service) => ({ ...service, hasImage: true }));
  }

  archive(id: TulongServiceId, reason: string): Observable<TulongService> {
    const user = this.access.currentUser();
    const denied = denyUnless<TulongService>(user, 'service.manage');
    if (denied) return denied;
    const bad = refuseReason<TulongService>(reason);
    if (bad) return bad;
    const existing = this.services.find((service) => service.id === id);
    if (existing === undefined) return throwError(() => new Error('That service was not found.'));
    const already = refuseArchiveState<TulongService>(existing.archived, 'archive', 'That service');
    if (already) return already;
    this.registry.useService(id, null);
    return this.put({
      ...existing,
      archived: this.log.record(id, 'archived', reason.trim(), user),
    });
  }

  restore(id: TulongServiceId, reason: string): Observable<TulongService> {
    const user = this.access.currentUser();
    const denied = denyUnless<TulongService>(user, 'service.manage');
    if (denied) return denied;
    const bad = refuseReason<TulongService>(reason);
    if (bad) return bad;
    const existing = this.services.find((service) => service.id === id);
    if (existing === undefined) return throwError(() => new Error('That service was not found.'));
    const already = refuseArchiveState<TulongService>(existing.archived, 'restore', 'That service');
    if (already) return already;
    const underArchived = this.registry.refuseIfArchived<TulongService>(
      existing.officeId,
      'That service’s office is archived. Restore the office first, or move the service.',
    );
    if (underArchived) return underArchived;
    this.registry.useService(id, existing.officeId);
    return this.put({
      ...existing,
      archived: this.log.record(id, 'restored', reason.trim(), user),
    });
  }

  history(id: TulongServiceId): Observable<readonly ArchiveEvent[]> {
    const denied = denyUnless<readonly ArchiveEvent[]>(this.access.currentUser(), 'service.manage');
    return denied ?? this.latency.respond(this.log.history(id));
  }

  private change(
    id: TulongServiceId,
    change: (service: TulongService) => TulongService,
  ): Observable<TulongService> {
    const existing = this.services.find((service) => service.id === id);
    if (existing === undefined) return throwError(() => new Error('That service was not found.'));
    const readOnly = refuseIfReadOnly<TulongService>(existing.archived, 'That service');
    if (readOnly) return readOnly;
    return this.put({ ...change(existing), updatedAt: now() });
  }

  private put(service: TulongService): Observable<TulongService> {
    this.services = this.services.map((candidate) =>
      candidate.id === service.id ? service : candidate,
    );
    return this.latency.respond(service);
  }
}

/**
 * Hotlines, in memory (`DL-170`), ordered as the API orders them and read whole or refused past
 * `HOTLINE_LIST_CAP` (`ca71f23`). Archived lines are their own list, take no change until restored,
 * and are not counted by the one-command-center rule (`DL-225`).
 */
@Injectable()
export class MockHotlineRepository implements HotlineRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly log = new MockArchiveLog<HotlineId>();

  private hotlines: readonly Hotline[] = MOCK_HOTLINES;

  list(archived: boolean): Observable<readonly Hotline[]> {
    const denied = denyUnless<readonly Hotline[]>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    const ordered = this.hotlines
      .filter((hotline) => (hotline.archived !== null) === archived)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return tooLong(ordered, HOTLINE_LIST_CAP, 'hotlines') ?? this.latency.respond(ordered);
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    const denied = denyUnless<Hotline>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    const hotline: Hotline = {
      ...draft,
      id: asId<HotlineId>(nextId('hotline')),
      updatedAt: now(),
      archived: null,
    };
    const refused = this.secondCommandCenter(hotline);
    if (refused) return refused;
    this.hotlines = [...this.hotlines, hotline];
    return this.latency.respond(hotline);
  }

  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline> {
    const denied = denyUnless<Hotline>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    const existing = this.hotlines.find((hotline) => hotline.id === id);
    if (existing === undefined) return throwError(() => new Error('That hotline was not found.'));
    const readOnly = refuseIfReadOnly<Hotline>(existing.archived, 'That hotline');
    if (readOnly) return readOnly;
    const hotline = { ...existing, ...changes, updatedAt: now() };
    const refused = this.secondCommandCenter(hotline);
    if (refused) return refused;
    return this.put(hotline);
  }

  archive(id: HotlineId, reason: string): Observable<Hotline> {
    const user = this.access.currentUser();
    const denied = denyUnless<Hotline>(user, 'hotline.manage');
    if (denied) return denied;
    const bad = refuseReason<Hotline>(reason);
    if (bad) return bad;
    const existing = this.hotlines.find((hotline) => hotline.id === id);
    if (existing === undefined) return throwError(() => new Error('That hotline was not found.'));
    const already = refuseArchiveState<Hotline>(existing.archived, 'archive', 'That hotline');
    if (already) return already;
    return this.put({
      ...existing,
      archived: this.log.record(id, 'archived', reason.trim(), user),
    });
  }

  restore(id: HotlineId, reason: string): Observable<Hotline> {
    const user = this.access.currentUser();
    const denied = denyUnless<Hotline>(user, 'hotline.manage');
    if (denied) return denied;
    const bad = refuseReason<Hotline>(reason);
    if (bad) return bad;
    const existing = this.hotlines.find((hotline) => hotline.id === id);
    if (existing === undefined) return throwError(() => new Error('That hotline was not found.'));
    const already = refuseArchiveState<Hotline>(existing.archived, 'restore', 'That hotline');
    if (already) return already;
    const refused = this.secondCommandCenter({ ...existing, archived: null });
    if (refused) return refused;
    return this.put({
      ...existing,
      archived: this.log.record(id, 'restored', reason.trim(), user),
    });
  }

  history(id: HotlineId): Observable<readonly ArchiveEvent[]> {
    const denied = denyUnless<readonly ArchiveEvent[]>(this.access.currentUser(), 'hotline.manage');
    return denied ?? this.latency.respond(this.log.history(id));
  }

  /**
   * Refused as the API's partial unique index refuses it: a second active command center, 409. The
   * index leaves archived lines out, so an archived one neither holds the role nor is refused it.
   */
  private secondCommandCenter(line: Hotline): Observable<never> | null {
    const inUse = this.hotlines.filter((hotline) => hotline.archived === null);
    return line.archived !== null || commandCenterHolder(line, activeCommandCenter(inUse)) === null
      ? null
      : throwError(
          () =>
            new HotlineCommandCenterTakenError('An active command-center hotline already exists.'),
        );
  }

  private put(hotline: Hotline): Observable<Hotline> {
    this.hotlines = this.hotlines.map((candidate) =>
      candidate.id === hotline.id ? hotline : candidate,
    );
    return this.latency.respond(hotline);
  }
}
