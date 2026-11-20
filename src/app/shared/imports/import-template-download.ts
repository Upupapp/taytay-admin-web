import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import type { ImportTemplate } from '@domain/index';

import { ObjectUrls } from '../media/object-urls';
import { failureReason } from '../state/failure-reason';
import { IMPORT_TEMPLATE_COPY } from './imports.copy';

let downloads = 0;

/**
 * "Download the template" for an import (`DL-228`): asks the API for its header-only CSV and hands
 * it to the browser to save, as a file made here — the API answers the text, never an address.
 *
 * Nothing is uploaded and nothing is written: the template carries only column names. The object
 * address lives until the next download or until the page is left.
 */
@Component({
  selector: 'app-import-template-download',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <div>
        <button
          type="button"
          class="btn btn--secondary"
          [attr.aria-describedby]="hintId"
          [disabled]="busy()"
          (click)="download()"
        >
          {{ busy() ? copy.busy : copy.button }}
        </button>
      </div>
      <p class="field__hint" [id]="hintId">{{ copy.hint }}</p>
      @if (saved(); as message) {
        <p class="status-line" role="status">{{ message }}</p>
      }
      @if (problem(); as message) {
        <p class="callout callout--danger" role="alert">{{ message }}</p>
      }
    </div>
  `,
})
export class ImportTemplateDownload {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Asks the import's port for its template. */
  readonly load = input.required<() => Observable<ImportTemplate>>();

  protected readonly copy = IMPORT_TEMPLATE_COPY;
  protected readonly hintId = `import-template-hint-${++downloads}`;
  protected readonly busy = signal(false);
  protected readonly saved = signal('');
  protected readonly problem = signal('');

  private readonly urls = new ObjectUrls();

  constructor() {
    this.destroyRef.onDestroy(() => this.urls.revokeAll());
  }

  protected download(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.saved.set('');
    this.problem.set('');
    this.load()()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (template) => {
          this.busy.set(false);
          this.urls.revokeAll();
          const link = this.document.createElement('a');
          link.href = this.urls.makeText(template.content, `${template.contentType};charset=utf-8`);
          link.download = template.fileName;
          link.click();
          this.saved.set(this.copy.saved(template.fileName));
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.problem.set(this.copy.failed(failureReason(failure) ?? this.copy.noAnswer));
        },
      });
  }
}
