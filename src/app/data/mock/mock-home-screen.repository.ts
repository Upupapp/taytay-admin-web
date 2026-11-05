import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  APP_IMAGE_POLICY,
  asId,
  asIsoDateTime,
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
 * link, each by order then age.
 */
@Injectable()
export class MockHomeScreenRepository implements HomeScreenRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private bannerRows: readonly HomeBanner[] = MOCK_HOME_BANNERS;
  private linkRows: readonly QuickLink[] = MOCK_QUICK_LINKS;
  private readonly images = new Map<MediaId, string>(
    MOCK_HOME_BANNERS.flatMap((banner) =>
      banner.mediaId === null ? [] : [[banner.mediaId, banner.title] as const],
    ),
  );

  banners(): Observable<readonly HomeBanner[]> {
    const denied = denyUnless<readonly HomeBanner[]>(this.access.currentUser(), 'home.manage');
    return denied ?? this.latency.respond([...this.bannerRows].sort(byOrder));
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

  removeBanner(id: HomeBannerId): Observable<void> {
    const denied = denyUnless<void>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    if (!this.bannerRows.some((banner) => banner.id === id)) {
      return throwError(() => new Error('That banner was not found.'));
    }
    this.bannerRows = this.bannerRows.filter((banner) => banner.id !== id);
    return this.latency.respond(undefined);
  }

  bannerImage(banner: HomeBanner): Observable<Blob> {
    const title = banner.mediaId === null ? undefined : this.images.get(banner.mediaId);
    return title === undefined
      ? throwError(() => new Error('This banner has no image.'))
      : this.latency.respond(sampleBannerImage(title));
  }

  links(): Observable<readonly QuickLink[]> {
    const denied = denyUnless<readonly QuickLink[]>(this.access.currentUser(), 'home.manage');
    return denied ?? this.latency.respond([...this.linkRows].sort(byOrder));
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    const denied = denyUnless<QuickLink>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const link: QuickLink = {
      ...draft,
      id: asId<QuickLinkId>(nextId('link')),
      createdAt: asIsoDateTime(new Date()),
    };
    this.linkRows = [...this.linkRows, link];
    return this.latency.respond(link);
  }

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    const denied = denyUnless<QuickLink>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    const existing = this.linkRows.find((link) => link.id === id);
    if (existing === undefined) return throwError(() => new Error('That link was not found.'));
    const link: QuickLink = { ...existing, ...draft };
    this.linkRows = this.linkRows.map((candidate) => (candidate.id === id ? link : candidate));
    return this.latency.respond(link);
  }

  removeLink(id: QuickLinkId): Observable<void> {
    const denied = denyUnless<void>(this.access.currentUser(), 'home.manage');
    if (denied) return denied;
    if (!this.linkRows.some((link) => link.id === id)) {
      return throwError(() => new Error('That link was not found.'));
    }
    this.linkRows = this.linkRows.filter((link) => link.id !== id);
    return this.latency.respond(undefined);
  }

  /** Public on the server, so no key is checked: what any resident's app is given. */
  preview(): Observable<HomePreview> {
    return this.latency.respond({
      banners: this.bannerRows.filter((banner) => banner.active).sort(byOrder),
      links: [...this.linkRows].sort(byOrder),
      featuredServices: MOCK_TULONG_SERVICES.filter((service) => service.featured)
        .slice(0, 6)
        .map((service) => service.name),
      hotlines: MOCK_HOTLINES.filter((hotline) => hotline.active).length,
      news: 0,
    });
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
