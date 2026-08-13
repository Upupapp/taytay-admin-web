import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AppImage } from './app-image';
import { BrandMark } from './brand-mark';
import { BRAND_COPY } from './brand.copy';
import { MunicipalSeal } from './municipal-seal';
import {
  asRenderable,
  BRAND_ASSETS,
  findAsset,
  isRenderable,
  MUNICIPAL_SEAL_ID,
  type BrandAsset,
} from './asset-manifest';

describe('asset manifest', () => {
  it('registers the seal and the project monogram', () => {
    expect(findAsset(MUNICIPAL_SEAL_ID)).toBeDefined();
    expect(findAsset('app-monogram')).toBeDefined();
    expect(findAsset('nope')).toBeUndefined();
  });

  it('records the seal as not acquired, with checkable evidence', () => {
    const seal = findAsset(MUNICIPAL_SEAL_ID);
    expect(seal?.provenance).toBe('not-acquired');
    expect(seal?.optimizedPath).toBeNull();
    // The point of the entry is the evidence; an empty list would make the
    // refusal unauditable.
    expect(seal?.evidence.length).toBeGreaterThanOrEqual(3);
    expect(seal?.evidence.join(' ')).toContain('taytayrizal.gov.ph');
  });

  it('never claims attribution that was not supplied', () => {
    for (const asset of BRAND_ASSETS) {
      if (asset.provenance !== 'vendored') {
        expect(asset.attribution).toBeNull();
      }
    }
  });

  it('protects the seal from alteration at the manifest level', () => {
    expect(findAsset(MUNICIPAL_SEAL_ID)?.alterationPolicy).toBe('scale-only');
  });

  it('treats an unacquired asset as not renderable', () => {
    const seal = findAsset(MUNICIPAL_SEAL_ID) as BrandAsset;
    expect(isRenderable(seal)).toBe(false);
    expect(asRenderable(seal)).toBeNull();
    expect(asRenderable(undefined)).toBeNull();
  });

  it('requires path, media type and dimensions before anything may render', () => {
    const halfComplete: BrandAsset = {
      id: 'x',
      kind: 'seal',
      title: 'x',
      provenance: 'vendored',
      source: 's',
      mediaType: 'image/svg+xml',
      dimensions: null, // no intrinsic size -> would risk layout shift
      optimizedPath: '/brand/x.svg',
      attribution: null,
      alterationPolicy: 'scale-only',
      evidence: [],
    };
    expect(isRenderable(halfComplete)).toBe(false);
  });

  it('accepts a fully specified vendored asset', () => {
    const complete: BrandAsset = {
      id: 'x',
      kind: 'seal',
      title: 'x',
      provenance: 'vendored',
      source: 's',
      mediaType: 'image/svg+xml',
      dimensions: { width: 512, height: 512 },
      optimizedPath: '/brand/x.svg',
      attribution: 'Supplied by the LGU',
      alterationPolicy: 'scale-only',
      evidence: ['written permission on file'],
    };
    expect(isRenderable(complete)).toBe(true);
    expect(asRenderable(complete)?.optimizedPath).toBe('/brand/x.svg');
  });
});

describe('MunicipalSeal', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(MunicipalSeal);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the placeholder while the seal is unacquired', async () => {
    const element = await render();
    expect(element.querySelector('.seal-placeholder')).not.toBeNull();
    expect(element.querySelector('img')).toBeNull();
  });

  it('never presents the placeholder as the official seal', async () => {
    const element = await render();
    const placeholder = element.querySelector('.seal-placeholder');
    expect(placeholder?.getAttribute('aria-label')).toBe(BRAND_COPY.sealPlaceholderLabel);
    expect(placeholder?.getAttribute('aria-label')).not.toContain('Official');
  });

  it('reserves an identical box at every size, so a later swap cannot shift layout', async () => {
    for (const [size, px] of [
      ['sm', '32px'],
      ['md', '48px'],
      ['lg', '96px'],
      ['xl', '160px'],
    ] as const) {
      const element = await render({ size });
      const placeholder = element.querySelector<HTMLElement>('.seal-placeholder');
      expect(placeholder?.style.width).toBe(px);
      expect(placeholder?.style.height).toBe(px);
    }
  });

  it('hides itself from assistive technology when decorative', async () => {
    const element = await render({ decorative: true });
    const placeholder = element.querySelector('.seal-placeholder');
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder?.getAttribute('role')).toBeNull();
  });

  it('exposes an image role when it carries meaning', async () => {
    const element = await render({ decorative: false });
    expect(element.querySelector('.seal-placeholder')?.getAttribute('role')).toBe('img');
  });
});

describe('AppImage', () => {
  async function render(inputs: Record<string, unknown> = {}): Promise<ComponentFixture<AppImage>> {
    const fixture = TestBed.createComponent(AppImage);
    fixture.componentRef.setInput('src', '/brand/example.svg');
    fixture.componentRef.setInput('alt', 'Example');
    fixture.componentRef.setInput('width', 120);
    fixture.componentRef.setInput('height', 80);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture;
  }

  it('reserves the box before the image resolves', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const box = element.querySelector<HTMLElement>('.img');
    expect(box?.style.width).toBe('120px');
    expect(box?.style.height).toBe('80px');
    expect(box?.style.aspectRatio).toBe('120 / 80');
  });

  it('always emits intrinsic width and height on the img element', async () => {
    // This is the attribute pair that prevents cumulative layout shift.
    const element = (await render()).nativeElement as HTMLElement;
    const img = element.querySelector('img');
    expect(img?.getAttribute('width')).toBe('120');
    expect(img?.getAttribute('height')).toBe('80');
  });

  it('marks the region busy while loading', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('.img')?.getAttribute('aria-busy')).toBe('true');
  });

  it('lazy-loads by default and eagerly when prioritised', async () => {
    const lazy = (await render()).nativeElement as HTMLElement;
    expect(lazy.querySelector('img')?.getAttribute('loading')).toBe('lazy');

    const eager = (await render({ priority: true })).nativeElement as HTMLElement;
    expect(eager.querySelector('img')?.getAttribute('loading')).toBe('eager');
    expect(eager.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
  });

  it('falls back in the same box when the image fails', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(element.querySelector('.img__fallback')).not.toBeNull();
    // Box unchanged: a failed image must not collapse the layout.
    const box = element.querySelector<HTMLElement>('.img');
    expect(box?.style.width).toBe('120px');
    expect(box?.style.height).toBe('80px');
  });

  it('announces the failure to screen readers', async () => {
    const fixture = await render({ fallbackLabel: 'Seal unavailable' });
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(element.textContent).toContain('Seal unavailable');
  });

  it('clears busy once loaded', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector('img')?.dispatchEvent(new Event('load'));
    await fixture.whenStable();

    expect(fixture.componentInstance.state()).toBe('loaded');
    expect(element.querySelector('.img')?.getAttribute('aria-busy')).toBeNull();
  });

  it('marks a decorative image as hidden with an empty alt', async () => {
    const element = (await render({ decorative: true })).nativeElement as HTMLElement;
    const img = element.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('BrandMark', () => {
  it('names the office without hard-coding the string in a template', async () => {
    const fixture = TestBed.createComponent(BrandMark);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(BRAND_COPY.organisationName);
    expect(element.textContent).toContain(BRAND_COPY.municipality);
  });

  it('can show the office unit instead of the municipality', async () => {
    const fixture = TestBed.createComponent(BrandMark);
    fixture.componentRef.setInput('secondaryLine', 'unit');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      BRAND_COPY.organisationUnit,
    );
  });

  it('treats its seal as decorative, since the wordmark already names the office', async () => {
    const fixture = TestBed.createComponent(BrandMark);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.seal-placeholder')?.getAttribute('aria-hidden')).toBe('true');
  });
});
