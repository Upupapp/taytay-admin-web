import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AppImage } from './app-image';
import { BrandMark } from './brand-mark';
import { BRAND_COPY } from './brand.copy';
import { MunicipalSeal } from './municipal-seal';
import { SealPlaceholder } from './seal-placeholder';
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

  it('records the seal as vendored, with its source, its bytes and what is still open (DL-199)', () => {
    const seal = findAsset(MUNICIPAL_SEAL_ID);
    expect(seal?.provenance).toBe('vendored');
    expect(seal?.optimizedPath).toBe('brand/taytay-seal.png');
    expect(seal?.mediaType).toBe('image/png');
    expect(seal?.dimensions).toEqual({ width: 360, height: 360 });
    expect(seal?.source).toContain('taytay-website');
    const evidence = seal?.evidence.join(' ') ?? '';
    // The hash pins the exact file, so a recompressed copy contradicts its own record.
    expect(evidence).toContain('2fbd93b1c49993dbee7e75bfcef841700f128b9315b4e43c18e750707c80f2b9');
    // The open permission is said, not smoothed over.
    expect(evidence).toMatch(/written permission is not on file/);
  });

  it('never claims attribution that was not supplied', () => {
    for (const asset of BRAND_ASSETS) {
      if (asset.provenance !== 'vendored') {
        expect(asset.attribution).toBeNull();
      }
    }
    // Nobody at the Municipality has supplied attribution text for the seal.
    expect(findAsset(MUNICIPAL_SEAL_ID)?.attribution).toBeNull();
  });

  it('protects the seal from alteration at the manifest level', () => {
    expect(findAsset(MUNICIPAL_SEAL_ID)?.alterationPolicy).toBe('scale-only');
  });

  it('renders the seal, and treats an unacquired asset as not renderable', () => {
    expect(asRenderable(findAsset(MUNICIPAL_SEAL_ID))?.optimizedPath).toBe('brand/taytay-seal.png');

    const withdrawn: BrandAsset = {
      id: 'x',
      kind: 'seal',
      title: 'x',
      provenance: 'not-acquired',
      source: null,
      mediaType: 'image/png',
      dimensions: { width: 360, height: 360 },
      optimizedPath: 'brand/x.png',
      attribution: null,
      alterationPolicy: 'scale-only',
      evidence: [],
    };
    expect(isRenderable(withdrawn)).toBe(false);
    expect(asRenderable(withdrawn)).toBeNull();
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

  it('draws the vendored seal from the manifest, not the placeholder (DL-199)', async () => {
    const element = await render();
    const img = element.querySelector('img');
    expect(img?.getAttribute('src')).toBe('brand/taytay-seal.png');
    expect(img?.getAttribute('alt')).toBe(BRAND_COPY.sealAlt);
    expect(element.querySelector('.seal-placeholder')).toBeNull();
  });

  it('draws it into a square box at every size, so it scales uniformly or not at all', async () => {
    for (const [size, px] of [
      ['sm', '32px'],
      ['md', '48px'],
      ['lg', '96px'],
      ['xl', '160px'],
    ] as const) {
      const element = await render({ size });
      const box = element.querySelector<HTMLElement>('.img');
      expect(box?.style.width).toBe(px);
      expect(box?.style.height).toBe(px);
    }
  });

  it('hides itself from assistive technology when decorative', async () => {
    const img = (await render({ decorative: true })).querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SealPlaceholder', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SealPlaceholder);
    fixture.componentRef.setInput('pixels', 48);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('never presents itself as the official seal', async () => {
    const placeholder = (await render()).querySelector('.seal-placeholder');
    expect(placeholder?.getAttribute('aria-label')).toBe(BRAND_COPY.sealPlaceholderLabel);
    expect(placeholder?.getAttribute('aria-label')).not.toContain('Official');
  });

  it('reserves the box it is given, the same box the seal would take', async () => {
    const placeholder = (await render({ pixels: 96 })).querySelector<HTMLElement>(
      '.seal-placeholder',
    );
    expect(placeholder?.style.width).toBe('96px');
    expect(placeholder?.style.height).toBe('96px');
  });

  it('hides itself from assistive technology when decorative', async () => {
    const placeholder = (await render({ decorative: true })).querySelector('.seal-placeholder');
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
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('src')).toBe('brand/taytay-seal.png');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });
});
