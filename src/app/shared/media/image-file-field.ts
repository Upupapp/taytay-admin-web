import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import {
  APP_IMAGE_POLICY,
  describeImageRefusal,
  IMAGE_SIGNATURE_BYTES,
  imageRefusalFor,
  megabytes,
} from '@domain/index';

import { ObjectUrls } from './object-urls';

/** The first bytes of a file, through `FileReader`, which every browser and the test DOM have. */
function headOf(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(
        reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : new Uint8Array(),
      );
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(file.slice(0, IMAGE_SIGNATURE_BYTES));
  });
}

/**
 * Choosing an image for the residents' app — an office banner, a Tulong page's picture, a home
 * banner (`DL-170`). Shared because three screens upload one, and each must refuse the same files the
 * same way.
 *
 * ## It refuses before anything is sent
 *
 * The file is held to `APP_IMAGE_POLICY` **as the server holds it**: five megabytes, and JPEG, PNG
 * or WebP recognised by its first bytes rather than its name. A refused file is said in words, in an
 * alert, and never handed on — so no screen can upload a file this field turned away.
 *
 * ## It shows what residents will see
 *
 * An accepted file is previewed from an object URL made by `ObjectUrls`, the one holder in the
 * console that makes them, and given back when the choice changes or the field is destroyed. The
 * bytes never leave the tab until the screen sends them.
 */
@Component({
  selector: 'app-image-file-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field image-field">
      <label class="field__label" [for]="inputId()">{{ label() }}</label>
      <p class="field__hint" [id]="inputId() + '-hint'">{{ hint() }} {{ limits }}</p>
      <input
        #picker
        type="file"
        class="image-field__input"
        [id]="inputId()"
        [attr.aria-describedby]="inputId() + '-hint'"
        [accept]="accept"
        [disabled]="disabled()"
        (change)="choose(picker)"
      />
      @if (refusal(); as message) {
        <p class="image-field__problem" role="alert">{{ message }}</p>
      }
      @if (preview(); as url) {
        <figure class="image-field__preview">
          <img [src]="url" [alt]="previewAlt" />
          <figcaption>{{ chosenName() }}</figcaption>
        </figure>
        <button
          type="button"
          class="btn btn--secondary"
          [disabled]="disabled()"
          (click)="clear(picker)"
        >
          {{ clearLabel }}
        </button>
      }
    </div>
  `,
  styles: `
    .image-field__input {
      display: block;
    }
    .image-field__problem {
      margin: var(--space-2) 0 0;
      color: var(--tone-danger-fg);
      font-size: 13px;
    }
    .image-field__preview {
      margin: var(--space-3) 0 var(--space-2);
    }
    .image-field__preview img {
      display: block;
      max-inline-size: 100%;
      max-block-size: 192px;
      border: 1px solid var(--c-border);
      border-radius: var(--radius-sm);
    }
    .image-field__preview figcaption {
      color: var(--c-text-muted);
      font-size: 12px;
    }
  `,
})
export class ImageFileField {
  readonly label = input.required<string>();
  /** Unique on the page: the label, the hint and the input are tied together by it. */
  readonly inputId = input.required<string>();
  /** What the image is for, said before the limits. */
  readonly hint = input('');
  readonly disabled = input(false);

  /** The accepted image, or `null` when the choice was refused or cleared. */
  readonly chosen = output<Blob | null>();

  protected readonly accept = APP_IMAGE_POLICY.mimeTypes.join(',');
  protected readonly limits = `JPEG, PNG or WebP, up to ${megabytes(APP_IMAGE_POLICY.maxBytes)}.`;
  protected readonly previewAlt = 'Preview of the chosen image';
  protected readonly clearLabel = 'Choose no image';

  protected readonly refusal = signal<string | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly chosenName = signal('');

  private readonly urls = new ObjectUrls();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.urls.revokeAll());
  }

  protected async choose(picker: HTMLInputElement): Promise<void> {
    this.release();
    const file = picker.files?.item(0) ?? null;
    if (file === null) {
      this.chosen.emit(null);
      return;
    }

    let head: Uint8Array;
    try {
      head = await headOf(file);
    } catch {
      this.refuse(picker, 'That file could not be read. Choose it again, or choose another.');
      return;
    }

    const refusal = imageRefusalFor(file, head);
    if (refusal !== null) {
      this.refuse(picker, describeImageRefusal(refusal));
      return;
    }

    this.preview.set(this.urls.make(file));
    this.chosenName.set(`${file.name}, ${megabytes(file.size)}`);
    this.chosen.emit(file);
  }

  protected clear(picker: HTMLInputElement): void {
    picker.value = '';
    this.release();
    this.chosen.emit(null);
  }

  private refuse(picker: HTMLInputElement, message: string): void {
    picker.value = '';
    this.refusal.set(message);
    this.chosen.emit(null);
  }

  private release(): void {
    this.refusal.set(null);
    this.chosenName.set('');
    this.urls.revokeAll();
    this.preview.set(null);
  }
}
