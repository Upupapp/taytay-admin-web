import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageFileField } from './image-file-field';

@Component({
  imports: [ImageFileField],
  template: `<app-image-file-field
    inputId="test-image"
    label="Banner"
    (chosen)="chosen.set($event)"
  />`,
})
class Host {
  readonly chosen = signal<Blob | null | 'unset'>('unset');
}

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const PDF_HEAD = [...'%PDF-1.7'].map((char) => char.charCodeAt(0));

function file(name: string, head: readonly number[], size: number, type: string): File {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return new File([bytes], name, { type });
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the field makes and gives back.
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

async function choose(chosen: File) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('No file input.');
  Object.defineProperty(input, 'files', { value: { item: () => chosen, length: 1 } });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(fixture.componentInstance.chosen()).not.toBe('unset'));
  fixture.detectChanges();
  return { fixture, element, input };
}

describe('ImageFileField (DL-170)', () => {
  it('says what it takes, tied to the input', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input');

    expect(input?.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(element.querySelector('#test-image-hint')?.textContent).toContain(
      'JPEG, PNG or WebP, up to 5 MB.',
    );
    expect(input?.getAttribute('aria-describedby')).toBe('test-image-hint');
  });

  it('hands on an image the API would take, and previews it from an object URL', async () => {
    const png = file('banner.png', PNG_HEAD, 4096, 'image/png');
    const { fixture, element } = await choose(png);

    expect(fixture.componentInstance.chosen()).toBe(png);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('blob:test/1');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('refuses a file too large before anything is sent, and says so in an alert', async () => {
    const { fixture, element } = await choose(
      file('big.png', PNG_HEAD, 5 * 1024 * 1024 + 1, 'image/png'),
    );

    expect(fixture.componentInstance.chosen()).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('up to 5 MB');
    expect(created).toEqual([]);
  });

  it('refuses a file that is not an image whatever its name says', async () => {
    const { fixture, element, input } = await choose(
      file('scan.jpg', PDF_HEAD, 2048, 'image/jpeg'),
    );

    expect(fixture.componentInstance.chosen()).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'not a JPEG, PNG or WebP',
    );
    expect(input.value).toBe('');
  });

  it('gives the preview back when the choice is cleared, and when it is destroyed', async () => {
    const { fixture, element } = await choose(file('banner.png', PNG_HEAD, 4096, 'image/png'));
    const clear = [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Choose no image',
    );

    clear?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.chosen()).toBeNull();
    expect(revoked).toEqual(['blob:test/1']);
    fixture.destroy();
  });
});
