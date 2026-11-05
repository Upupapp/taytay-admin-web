import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asId,
  asIsoDateTime,
  BANNER_NO_DESCRIPTION,
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
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

import { BannersSection } from './banners-section';
import { HomeScreenPage } from './home-screen-page';
import { LinksSection } from './links-section';
import { PreviewSection } from './preview-section';

const STAMP = asIsoDateTime('2026-11-05T00:00:00.000Z');

function banner(key: string, values: Partial<HomeBanner> = {}): HomeBanner {
  return {
    id: asId<HomeBannerId>(`banner-${key}`),
    title: `Banner ${key}`,
    mediaId: asId<MediaId>(`media-${key}`),
    href: null,
    sortOrder: 1,
    active: true,
    createdAt: STAMP,
    ...values,
  };
}

const LINK: QuickLink = {
  id: asId<QuickLinkId>('link-tulong'),
  label: 'Tulong',
  href: 'https://home.example.test/tulong',
  sortOrder: 1,
  createdAt: STAMP,
};

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingHome implements HomeScreenRepository {
  readonly createdBanners: { draft: BannerDraft; image: Blob | null }[] = [];
  readonly updatedBanners: { id: HomeBannerId; draft: BannerDraft; image: BannerImageChange }[] =
    [];
  readonly removedBanners: HomeBannerId[] = [];
  readonly removedLinks: QuickLinkId[] = [];
  readonly imagesRead: HomeBannerId[] = [];
  previews = 0;

  banners(): Observable<readonly HomeBanner[]> {
    return of([banner('a'), banner('b', { active: false, mediaId: null, sortOrder: 2 })]);
  }

  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner> {
    this.createdBanners.push({ draft, image });
    return of(banner('new', draft));
  }

  updateBanner(
    id: HomeBannerId,
    draft: BannerDraft,
    image: BannerImageChange,
  ): Observable<HomeBanner> {
    this.updatedBanners.push({ id, draft, image });
    return of(banner('a', draft));
  }

  removeBanner(id: HomeBannerId): Observable<void> {
    this.removedBanners.push(id);
    return of(undefined);
  }

  bannerImage(shown: HomeBanner): Observable<Blob> {
    this.imagesRead.push(shown.id);
    return of(new Blob(['x'], { type: 'image/png' }));
  }

  links(): Observable<readonly QuickLink[]> {
    return of([LINK]);
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    return of({ ...LINK, ...draft });
  }

  updateLink(_id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    return of({ ...LINK, ...draft });
  }

  removeLink(id: QuickLinkId): Observable<void> {
    this.removedLinks.push(id);
    return of(undefined);
  }

  preview(): Observable<HomePreview> {
    this.previews++;
    return of({
      banners: [banner('a')],
      links: [LINK],
      featuredServices: ['Senior citizen ID'],
      hotlines: 4,
      news: 5,
    });
  }
}

function configure(): RecordingHome {
  const home = new RecordingHome();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: HOME_SCREEN_REPOSITORY, useValue: home }],
  });
  return home;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function buttonNamed(name: string, root: ParentNode = document): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
    ) ?? null
  );
}

function type(selector: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (input === null) throw new Error(`No ${selector}.`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the screen makes and gives back.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('HomeScreenPage (DL-170)', () => {
  it('says residents see it, and reads the preview again after a save', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(HomeScreenPage);
    const element = await settle(fixture);

    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Residents see this in the Taytay app',
    );
    expect(home.previews).toBe(1);

    buttonNamed('Edit the banner Banner a')?.click();
    await settle(fixture);
    type('#banner-title', 'Banner a, renamed');
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(home.previews).toBe(2);
  });
});

describe('BannersSection (DL-170)', () => {
  it('says the app has no description of a banner’s image, and asks for none', async () => {
    configure();
    const fixture = TestBed.createComponent(BannersSection);
    const element = await settle(fixture);
    expect(element.textContent).toContain(BANNER_NO_DESCRIPTION);

    buttonNamed('Add a banner')?.click();
    await settle(fixture);
    const form = document.querySelector('app-banner-form');
    expect(form?.textContent).toContain(BANNER_NO_DESCRIPTION);
    expect(form?.querySelector('textarea')).toBeNull();
    expect(
      [...(form?.querySelectorAll('label') ?? [])].map((label) => label.textContent?.trim()),
    ).not.toContain('Description');
  });

  it('adds a banner, saying the image is stored first and stays if the banner is refused', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Add a banner')?.click();
    await settle(fixture);
    type('#banner-title', 'Feeding resumes');
    type('#banner-href', 'https://home.example.test/feeding');
    await settle(fixture);

    const effects = document.querySelector('app-banner-form .home-form__effects')?.textContent;
    expect(effects).toContain(HOME_EFFECTS.bannerCreateShown[0]);
    expect(effects).toContain(HOME_EFFECTS.href[0]);
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);

    expect(home.createdBanners).toEqual([
      {
        draft: {
          title: 'Feeding resumes',
          href: 'https://home.example.test/feeding',
          sortOrder: 0,
          active: true,
        },
        image: null,
      },
    ]);
  });

  it('shows the current image only when asked, and removes it with its effect said first', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Edit the banner Banner a')?.click();
    await settle(fixture);
    expect(home.imagesRead).toEqual([]);
    buttonNamed('Show the current image')?.click();
    await settle(fixture);
    expect(home.imagesRead).toEqual(['banner-a']);
    expect(document.querySelector('app-banner-form img')?.getAttribute('src')).toBe('blob:test/1');

    const remove = [...document.querySelectorAll<HTMLLabelElement>('app-banner-form label.check')]
      .find((label) => label.textContent?.includes('Remove the image'))
      ?.querySelector('input');
    if (remove === undefined || remove === null) throw new Error('No remove box.');
    remove.checked = true;
    remove.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(document.querySelector('app-banner-form .home-form__effects')?.textContent).toContain(
      HOME_EFFECTS.imageRemoved[0],
    );
    document.querySelector<HTMLButtonElement>('app-banner-form button[type="submit"]')?.click();
    await settle(fixture);
    expect(home.updatedBanners[0]?.image).toEqual({ kind: 'remove' });
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('deletes a banner only through a confirmation that offers hiding instead', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(BannersSection);
    await settle(fixture);

    buttonNamed('Delete the banner Banner a')?.click();
    await settle(fixture);
    expect(home.removedBanners).toEqual([]);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('hide it instead');

    buttonNamed('Delete the banner', dialog ?? document)?.click();
    await settle(fixture);
    expect(home.removedBanners).toEqual(['banner-a']);
  });
});

describe('LinksSection (DL-170)', () => {
  it('says every link is shown, and deletes one only after confirming', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(LinksSection);
    const element = await settle(fixture);

    expect(element.textContent).toContain('there is no hidden link');
    buttonNamed('Delete the link Tulong')?.click();
    await settle(fixture);
    expect(home.removedLinks).toEqual([]);
    buttonNamed('Delete the link', document.querySelector('[role="dialog"]') ?? document)?.click();
    await settle(fixture);
    expect(home.removedLinks).toEqual(['link-tulong']);
  });
});

describe('PreviewSection (DL-170)', () => {
  it('shows what the app is given, with banner images read through the data layer', async () => {
    const home = configure();
    const fixture = TestBed.createComponent(PreviewSection);
    const element = await settle(fixture);

    expect(element.textContent).toContain('Banner a');
    expect(element.textContent).toContain('Senior citizen ID');
    expect(element.textContent).toContain(
      'It also carries 4 hotlines and the latest 5 Balita articles.',
    );
    expect(home.imagesRead).toEqual(['banner-a']);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Banner: Banner a');

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
  });
});
