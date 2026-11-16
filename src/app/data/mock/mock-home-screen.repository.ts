import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  APP_IMAGE_POLICY,
  asId,
  asIsoDateTime,
  type ArchiveEvent,
  type BannerDraft,
  type BannerImageChange,
  type HomeBanner,
  type HomeBannerId,
  type HomePreview,
  type HomeScreenRepository,
  type LinkDraft,
  type MediaId,
  type QuickLink,
  type QuickLinkId,
} from '@domain/index';

import { MockArchiveLog, refuseArchiveState, refuseIfReadOnly, refuseReason } from './mock-archive';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_HOTLINES, MOCK_TULONG_SERVICES } from './seed/directory.seed';
import { MOCK_HOME_BANNERS, MOCK_QUICK_LINKS, sampleBannerImage } from './seed/home.seed';

let created = 0;
const nextId = (prefix: string): string => `${prefix}-new-${++created}`;

const byOrder = <T extends { readonly sortOrder: number; readonly createdAt: string }>(
  a: T,
  b: T,
) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

/**
 * The home screen, in memory (`DL-170`), as the API keeps it: every write re-checks `home.manage`
 * (rule 4); an image is refused as the server refuses it; the preview carries shown banners and every
 * link in use, each by order then age. Nothing is deleted: a banner or a link is archived and
 * restored with a reason, and takes no change while archived (`DL-225`).
 */
@Injectable()
export class MockHomeScreenRepository implements HomeScreenRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private bannerRows: readonly HomeBanner[] = MOCK_HOME_BANNERS;
  private linkRows: readonly QuickLink[] = MOCK_QUICK_LINKS;
  private readonly bannerLog = new MockArchiveLog<HomeBannerId>();
  private readonly linkLog = new MockArchiveLog<QuickLinkId>();
  private readonly images = new Map<MediaId, string>(
    MOCK_HOME_BANNERS.flatMap((banner) =>
      banner.mediaId === null ? [] : [[banner.mediaId, banner.title] as const],
    ),
  );

  banners(archived: boolean): Observable<readonly HomeBanner[]> {
    const denied = denyUnless<readonly HomeBanner[]>(this.access.currentUser(), 'home.manage');
    return (
      denied ??
      this.latency.respond(
        this.bannerRows.filter((banner) => (banner.archived !== null) === archived).sort(byOrder),
      )
    );
  }

  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner> {
    const denied = denyUnless<HomeBanner>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const refused = this.refusal(image);
    if (refused) return throwError(() => refused);
    const banner: HomeBanner = {
      ...draft,
      id: asId<HomeBannerId>(nextId('banner')),
      mediaId: image === null ? null : this.store(draft.title),
      createdAt: asIsoDateTime(new Date()),
      archived: null,
    };
    this.bannerRows = [...this.bannerRows, banner];
    return this.latency.respond(banner);
  }

  updateBanner(
    id: HomeBannerId,
    draft: BannerDraft,
    image: BannerImageChange,
  ): Observable<HomeBanner> {
    const denied = denyUnless<HomeBanner>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const existing = this.bannerRows.find((banner) => banner.id === id);
    if (existing === undefined) return throwError(() => new Error('That banner was not found.'));
    const readOnly = refuseIfReadOnly<HomeBanner>(existing.archived, 'That banner');
    if (readOnly) return readOnly;
    const refused = image.kind === 'replace' ? this.refusal(image.image) : null;
    if (refused) return throwError(() => refused);
    const mediaId =
      image.kind === 'keep'
        ? existing.mediaId
        : image.kind === 'remove'
          ? null
          : this.store(draft.title);
    const banner: HomeBanner = { ...existing, ...draft, mediaId };
    this.bannerRows = this.bannerRows.map((candidate) =>
      candidate.id === id ? banner : candidate,
    );
    return this.latency.respond(banner);
  }

  archiveBanner(id: HomeBannerId, reason: string): Observable<HomeBanner> {
    return this.moveBanner(id, 'archive', reason);
  }

  restoreBanner(id: HomeBannerId, reason: string): Observable<HomeBanner> {
    return this.moveBanner(id, 'restore', reason);
  }

  bannerHistory(id: HomeBannerId): Observable<readonly ArchiveEvent[]> {
    const denied = denyUnless<readonly ArchiveEvent[]>(this.access.currentUser(), 'home.manage');
    return denied ?? this.latency.respond(this.bannerLog.history(id));
  }

  bannerImage(banner: HomeBanner): Observable<Blob> {
    const title = banner.mediaId === null ? undefined : this.images.get(banner.mediaId);
    return title === undefined
      ? throwError(() => new Error('This banner has no image.'))
      : this.latency.respond(sampleBannerImage(title));
  }

  links(archived: boolean): Observable<readonly QuickLink[]> {
    const denied = denyUnless<readonly QuickLink[]>(this.access.currentUser(), 'home.manage');
    return (
      denied ??
      this.latency.respond(
        this.linkRows.filter((link) => (link.archived !== null) === archived).sort(byOrder),
      )
    );
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    const denied = denyUnless<QuickLink>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const link: QuickLink = {
      ...draft,
      id: asId<QuickLinkId>(nextId('link')),
      createdAt: asIsoDateTime(new Date()),
      archived: null,
    };
    this.linkRows = [...this.linkRows, link];
    return this.latency.respond(link);
  }

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    const denied = denyUnless<QuickLink>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const existing = this.linkRows.find((link) => link.id === id);
    if (existing === undefined) return throwError(() => new Error('That link was not found.'));
    const readOnly = refuseIfReadOnly<QuickLink>(existing.archived, 'That link');
    if (readOnly) return readOnly;
    const link: QuickLink = { ...existing, ...draft };
    this.linkRows = this.linkRows.map((candidate) => (candidate.id === id ? link : candidate));
    return this.latency.respond(link);
  }

  archiveLink(id: QuickLinkId, reason: string): Observable<QuickLink> {
    return this.moveLink(id, 'archive', reason);
  }

  restoreLink(id: QuickLinkId, reason: string): Observable<QuickLink> {
    return this.moveLink(id, 'restore', reason);
  }

  linkHistory(id: QuickLinkId): Observable<readonly ArchiveEvent[]> {
    const denied = denyUnless<readonly ArchiveEvent[]>(this.access.currentUser(), 'home.manage');
    return denied ?? this.latency.respond(this.linkLog.history(id));
  }

  /** Public on the server, so no key is checked: what any resident's app is given. */
  preview(): Observable<HomePreview> {
    return this.latency.respond({
      banners: this.bannerRows
        .filter((banner) => banner.active && banner.archived === null)
        .sort(byOrder),
      links: this.linkRows.filter((link) => link.archived === null).sort(byOrder),
      // An archived page or line is in no public read, whatever `featured` or `active` says.
      featuredServices: MOCK_TULONG_SERVICES.filter(
        (service) => service.featured && service.archived === null,
      )
        .slice(0, 6)
        .map((service) => service.name),
      hotlines: MOCK_HOTLINES.filter((hotline) => hotline.active && hotline.archived === null)
        .length,
      news: 0,
    });
  }

  private moveBanner(
    id: HomeBannerId,
    act: 'archive' | 'restore',
    reason: string,
  ): Observable<HomeBanner> {
    const user = this.access.currentUser();
    const denied = denyUnless<HomeBanner>(user, 'home.manage');
    if (denied) return denied;
    const bad = refuseReason<HomeBanner>(reason);
    if (bad) return bad;
    const existing = this.bannerRows.find((banner) => banner.id === id);
    if (existing === undefined) return throwError(() => new Error('That banner was not found.'));
    const already = refuseArchiveState<HomeBanner>(existing.archived, act, 'That banner');
    if (already) return already;
    const banner: HomeBanner = {
      ...existing,
      archived: this.bannerLog.record(
        id,
        act === 'archive' ? 'archived' : 'restored',
        reason.trim(),
        user,
      ),
    };
    this.bannerRows = this.bannerRows.map((candidate) =>
      candidate.id === id ? banner : candidate,
    );
    return this.latency.respond(banner);
  }

  private moveLink(
    id: QuickLinkId,
    act: 'archive' | 'restore',
    reason: string,
  ): Observable<QuickLink> {
    const user = this.access.currentUser();
    const denied = denyUnless<QuickLink>(user, 'home.manage');
    if (denied) return denied;
    const bad = refuseReason<QuickLink>(reason);
    if (bad) return bad;
    const existing = this.linkRows.find((link) => link.id === id);
    if (existing === undefined) return throwError(() => new Error('That link was not found.'));
    const already = refuseArchiveState<QuickLink>(existing.archived, act, 'That link');
    if (already) return already;
    const link: QuickLink = {
      ...existing,
      archived: this.linkLog.record(
        id,
        act === 'archive' ? 'archived' : 'restored',
        reason.trim(),
        user,
      ),
    };
    this.linkRows = this.linkRows.map((candidate) => (candidate.id === id ? link : candidate));
    return this.latency.respond(link);
  }

  private refusal(image: Blob | null): Error | null {
    if (image === null) return null;
    if (image.size > APP_IMAGE_POLICY.maxBytes) return new Error('That file is larger than 5 MB.');
    return APP_IMAGE_POLICY.mimeTypes.includes(image.type)
      ? null
      : new Error('Upload a JPEG, PNG, or WebP image.');
  }

  private store(title: string): MediaId {
    const media = asId<MediaId>(nextId('media'));
    this.images.set(media, title);
    return media;
  }
}
