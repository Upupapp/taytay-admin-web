import { inject, Injectable } from '@angular/core';
import { map, throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  APP_IMAGE_POLICY,
  asId,
  asIsoDateTime,
  activeCommandCenter,
  commandCenterHolder,
  HOTLINE_LIST_CAP,
  HotlineCommandCenterTakenError,
  type CursorPage,
  type CursorRequest,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineListing,
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

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { MOCK_DIRECTORY_OFFICES, MOCK_HOTLINES, MOCK_TULONG_SERVICES } from './seed/directory.seed';
import { MOCK_OFFICE_THREADS } from './seed/office-threads.seed';

/** The API's own ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

function pageOf<T>(rows: readonly T[], page: CursorRequest): CursorPage<T> {
  const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
  const end = start + Math.min(Math.max(1, page.limit), LARGEST_PAGE);
  const hasMore = end < rows.length;
  return { items: rows.slice(start, end), hasMore, nextCursor: hasMore ? String(end) : null };
}

/** The server's refusal of an image, in its own words (`src/http/error-handler.ts`). */
function imageRefusal(image: Blob | null): Error | null {
  if (image === null) return null;
  if (image.size > APP_IMAGE_POLICY.maxBytes) return new Error('That file is larger than 5 MB.');
  return APP_IMAGE_POLICY.mimeTypes.includes(image.type)
    ? null
    : new Error('Upload a JPEG, PNG, or WebP image.');
}

let created = 0;
const nextId = (prefix: string): string => `${prefix}-new-${++created}`;
const now = () => asIsoDateTime(new Date());

/**
 * The office directory, in memory (`DL-170`), refusing the way the API does: a taken address, an
 * image the API would not take, and a delete while a staff account or a conversation still names the
 * office (`OFFICE_EFFECTS.remove`). Reads check no key, because `GET offices` is public; every write
 * re-checks `office.manage` (rule 4).
 */
@Injectable()
export class MockDirectoryOfficeRepository implements DirectoryOfficeRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private offices: readonly DirectoryOffice[] = MOCK_DIRECTORY_OFFICES;

  list(page: CursorRequest): Observable<CursorPage<DirectoryOffice>> {
    return this.latency.respond(pageOf(this.offices, page));
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
    };
    this.offices = [office, ...this.offices];
    return this.latency.respond(office);
  }

  update(id: OfficeId, changes: OfficeChanges, banner: Blob | null): Observable<DirectoryOffice> {
    const denied = denyUnless<DirectoryOffice>(this.access.currentUser(), 'office.manage');
    if (denied) return denied;
    const existing = this.offices.find((office) => office.id === id);
    if (existing === undefined) return throwError(() => new Error('That office was not found.'));
    const refused =
      (changes.slug === undefined ? null : this.slugTaken(changes.slug, id)) ??
      imageRefusal(banner);
    if (refused) return throwError(() => refused);

    const office: DirectoryOffice = {
      ...existing,
      ...changes,
      hasBanner: existing.hasBanner || banner !== null,
      updatedAt: now(),
    };
    this.offices = this.offices.map((candidate) => (candidate.id === id ? office : candidate));
    return this.latency.respond(office);
  }

  remove(id: OfficeId): Observable<void> {
    const denied = denyUnless<void>(this.access.currentUser(), 'office.manage');
    if (denied) return denied;
    if (!this.offices.some((office) => office.id === id)) {
      return throwError(() => new Error('That office was not found.'));
    }
    const named =
      MOCK_APP_ACCOUNTS.some((account) => account.officeId === id) ||
      MOCK_OFFICE_THREADS.some((thread) => thread.officeId === id) ||
      MOCK_TULONG_SERVICES.some((service) => service.officeId === id);
    if (named) {
      return throwError(() => new Error('That office still has staff or other records.'));
    }
    this.offices = this.offices.filter((office) => office.id !== id);
    return this.latency.respond(undefined);
  }

  private slugTaken(slug: string, except: OfficeId | null): Error | null {
    return this.offices.some((office) => office.slug === slug && office.id !== except)
      ? new Error('An office with that slug already exists.')
      : null;
  }
}

/**
 * Tulong pages, in memory (`DL-170`). The list leaves out a page hidden from the catalogue, exactly
 * as `GET services` does, so the screen's way back to one — by its address — is exercised here too.
 */
@Injectable()
export class MockTulongServiceRepository implements TulongServiceRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private services: readonly TulongService[] = MOCK_TULONG_SERVICES;

  list(page: CursorRequest): Observable<CursorPage<TulongService>> {
    return this.latency.respond(
      pageOf(
        this.services.filter((s) => !s.hiddenFromList),
        page,
      ),
    );
  }

  find(slug: string): Observable<TulongService | null> {
    return this.latency.respond(this.services.find((service) => service.slug === slug) ?? null);
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    if (this.services.some((service) => service.slug === draft.slug)) {
      return throwError(() => new Error('A service with that slug already exists.'));
    }
    const service: TulongService = {
      ...draft,
      id: asId<TulongServiceId>(nextId('service')),
      featured: false,
      hasImage: false,
      updatedAt: now(),
    };
    this.services = [service, ...this.services];
    return this.latency.respond(service);
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    return this.replace(id, (service) => ({ ...service, ...changes }));
  }

  replaceImage(id: TulongServiceId, image: Blob): Observable<TulongService> {
    const denied = denyUnless<TulongService>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    const refused = imageRefusal(image);
    if (refused) return throwError(() => refused);
    return this.replace(id, (service) => ({ ...service, hasImage: true }));
  }

  remove(id: TulongServiceId): Observable<void> {
    const denied = denyUnless<void>(this.access.currentUser(), 'service.manage');
    if (denied) return denied;
    if (!this.services.some((service) => service.id === id)) {
      return throwError(() => new Error('That service was not found.'));
    }
    this.services = this.services.filter((service) => service.id !== id);
    return this.latency.respond(undefined);
  }

  private replace(
    id: TulongServiceId,
    change: (service: TulongService) => TulongService,
  ): Observable<TulongService> {
    const existing = this.services.find((service) => service.id === id);
    if (existing === undefined) return throwError(() => new Error('That service was not found.'));
    const service = { ...change(existing), updatedAt: now() };
    this.services = this.services.map((candidate) => (candidate.id === id ? service : candidate));
    return this.latency.respond(service);
  }
}

/** Hotlines, in memory (`DL-170`), ordered and capped as the API orders and caps them. */
@Injectable()
export class MockHotlineRepository implements HotlineRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private hotlines: readonly Hotline[] = MOCK_HOTLINES;

  list(): Observable<HotlineListing> {
    const denied = denyUnless<HotlineListing>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    const ordered = [...this.hotlines]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .slice(0, HOTLINE_LIST_CAP);
    return this.latency
      .respond(ordered)
      .pipe(
        map((hotlines) => ({ hotlines, mayBeIncomplete: hotlines.length >= HOTLINE_LIST_CAP })),
      );
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    const denied = denyUnless<Hotline>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    const hotline: Hotline = { ...draft, id: asId<HotlineId>(nextId('hotline')), updatedAt: now() };
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
    const hotline = { ...existing, ...changes, updatedAt: now() };
    const refused = this.secondCommandCenter(hotline);
    if (refused) return refused;
    this.hotlines = this.hotlines.map((candidate) => (candidate.id === id ? hotline : candidate));
    return this.latency.respond(hotline);
  }

  /** Refused as the API's partial unique index refuses it: a second active command center, 409. */
  private secondCommandCenter(line: Hotline): Observable<never> | null {
    return commandCenterHolder(line, activeCommandCenter(this.hotlines)) === null
      ? null
      : throwError(
          () =>
            new HotlineCommandCenterTakenError('An active command-center hotline already exists.'),
        );
  }

  remove(id: HotlineId): Observable<void> {
    const denied = denyUnless<void>(this.access.currentUser(), 'hotline.manage');
    if (denied) return denied;
    if (!this.hotlines.some((hotline) => hotline.id === id)) {
      return throwError(() => new Error('That hotline was not found.'));
    }
    this.hotlines = this.hotlines.filter((hotline) => hotline.id !== id);
    return this.latency.respond(undefined);
  }
}
