import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_VALIDITY_LABELS,
  currentVersion,
  documentValidity,
  maskDocumentNumber,
  sourceHoldsAFile,
  supersededVersions,
  type DocumentVersion,
  type RequirementDocument,
  DOCUMENT_UPLOAD_POLICY,
  refusalFor,
  type DocumentVersionDraft,
} from '@domain/index';

import { REQUIREMENTS_COPY } from './requirements.copy';

/**
 * What was presented against one requirement, and everything it replaced.
 *
 * Three rules this component exists to keep visible:
 *
 *  - **The history is shown, not hidden behind an "advanced" toggle.** A
 *    replaced document is the evidence of what the office read when it decided
 *    (`DL-77`), and a reader who cannot see that a certificate was replaced
 *    will read the current one as the only one there has ever been.
 *  - **The number is masked.** `maskDocumentNumber` is applied here rather than
 *    trusted to a template binding; the full number needs its own permission
 *    and its own deliberate act.
 *  - **Opening a file is a request, not a link.** The component emits an intent
 *    and the page asks the data layer, which may refuse. A component holding a
 *    URL it may not follow is one copy-paste from an unauthorised download.
 */
@Component({
  selector: 'app-document-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <section class="document">
      @if (current(); as version) {
        <p class="document__line">
          <span class="document__source">{{ sourceLabel(version) }}</span>
          <span class="document__validity" [attr.data-validity]="validity(version)">
            {{ validityLabel(version) }}
          </span>
        </p>

        @if (version.file) {
          <p class="document__file">
            <span class="document__name">{{ version.file.fileName }}</span>
            <span class="document__size">{{ sizeLabel(version) }}</span>
          </p>
        } @else {
          <p class="document__no-file">{{ copy.noFileHeld }}</p>
        }

        <dl class="document__facts">
          @if (maskedNumber(version); as masked) {
            <div class="document__fact">
              <dt>{{ copy.documentNumber }}</dt>
              <dd class="document__masked">
                {{ masked }}
                <span class="document__masked-note">{{ copy.maskedNote }}</span>
              </dd>
            </div>
          }
          @if (version.issuedOn) {
            <div class="document__fact">
              <dt>{{ copy.issuedOn }}</dt>
              <dd>{{ version.issuedOn }}</dd>
            </div>
          }
          @if (version.expiresOn) {
            <div class="document__fact">
              <dt>{{ copy.expiresOn }}</dt>
              <dd>{{ version.expiresOn }}</dd>
            </div>
          }
          <div class="document__fact">
            <dt>{{ copy.received }}</dt>
            <dd>{{ version.receivedAt | date: 'd MMM y' }}</dd>
          </div>
        </dl>

        @if (canOpen(version)) {
          <button type="button" class="btn btn--small" (click)="openRequested.emit(version.id)">
            {{ copy.open }}
          </button>
        }
      } @else {
        <p class="document__none">{{ copy.nothingPresented }}</p>
      }

      <!-- Replaced versions are listed, never dropped. -->
      @if (history().length > 0) {
        <details class="document__history">
          <summary class="document__history-summary">
            {{ copy.replacedCount(history().length) }}
          </summary>
          <ol class="document__history-list">
            @for (version of history(); track version.id) {
              <li class="document__history-item">
                <p class="document__history-head">
                  <span class="document__history-version">
                    {{ copy.versionLabel(version.version) }}
                  </span>
                  <span class="document__history-date">
                    {{ version.receivedAt | date: 'd MMM y' }}
                  </span>
                </p>
                @if (version.supersededReason) {
                  <p class="document__history-reason">
                    <span class="document__history-reason-label">{{ copy.replacedBecause }}</span>
                    {{ version.supersededReason }}
                  </p>
                }
                @if (canOpen(version)) {
                  <button
                    type="button"
                    class="btn btn--small"
                    (click)="openRequested.emit(version.id)"
                  >
                    {{ copy.openReplaced }}
                  </button>
                }
              </li>
            }
          </ol>
        </details>
      }

      <!--
        The upload sits BELOW the history, not above it.

        Replacing a document is the act this whole model exists to make safe (DL-77), and the
        person doing it should have read what is already there first. A file input at the top is
        one somebody uses before they have seen the version they are about to supersede.
      -->
      @if (canUpload()) {
        <form class="document__upload" (submit)="submit($event)">
          <label class="field" [attr.for]="'document-file'">
            <span class="field__label">{{ copy.uploadLabel }}</span>
            <input
              id="document-file"
              class="field__control"
              type="file"
              [accept]="acceptAttribute"
              (change)="onFile($event)"
            />
            <span class="field__hint">{{ copy.uploadHint }}</span>
          </label>

          @if (refusal() !== null) {
            <p class="field__error" role="alert">{{ refusalMessage() }}</p>
          }

          @if (isReplacement()) {
            <label class="field" [attr.for]="'document-because'">
              <span class="field__label">{{ copy.replacesBecauseLabel }}</span>
              <input
                id="document-because"
                class="field__control"
                type="text"
                [value]="replacesBecause()"
                (input)="onReason($event)"
              />
              <span class="field__hint">{{ copy.replacesBecauseHint }}</span>
            </label>
          }

          <!--
            A real bar, with the figure beside it.

            The progress element is the platform's own and is announced by a screen reader without
            any ARIA of ours. The number is shown too: a bar communicates roughly, and somebody
            deciding whether to keep waiting on a slow connection wants a figure.
          -->
          @if (percent() !== null) {
            <p class="document__progress">
              <progress [value]="percent()" max="100"></progress>
              <span>{{ copy.uploadingPercent(percent() ?? 0) }}</span>
            </p>
          }

          <button type="submit" class="btn btn--primary" [disabled]="!canSubmit()">
            {{ uploading() ? copy.uploading : copy.uploadAction }}
          </button>
        </form>
      }
    </section>
  `,
  styleUrl: './document-panel.scss',
})
export class DocumentPanel {
  readonly document = input<RequirementDocument | null>(null);
  /** Whether this reader may open the file at all. */
  readonly canDownload = input(false);
  readonly today = input<Date>(new Date());

  /** Whether this reader may add a version. Hiding it is usability, never protection. */
  readonly canUpload = input(false);
  /** Set while the parent's request is in flight, so the button cannot be pressed twice. */
  readonly uploading = input(false);
  /** Whole percent while bytes are moving; `null` when nothing is in flight. */
  readonly percent = input<number | null>(null);

  readonly openRequested = output<DocumentVersion['id']>();
  readonly versionSubmitted = output<DocumentVersionDraft>();

  protected readonly copy = REQUIREMENTS_COPY.document;
  protected readonly acceptAttribute = DOCUMENT_UPLOAD_POLICY.mimeTypes.join(',');

  protected readonly chosen = signal<File | null>(null);
  protected readonly replacesBecause = signal('');

  /**
   * Refused **before** the request, by the transport's own rule.
   *
   * A caseworker on a slow connection should learn their scan is too large without waiting for the
   * whole of it to arrive and be rejected. The server refuses independently; this is the courtesy,
   * not the boundary.
   */
  protected readonly refusal = computed(() => {
    const file = this.chosen();

    return file === null ? null : refusalFor(file);
  });

  /** Replacing needs a reason; a first version does not (`DL-77`). */
  protected readonly isReplacement = computed(() => this.current() !== null);

  protected readonly canSubmit = computed(() => {
    if (this.chosen() === null || this.refusal() !== null || this.uploading()) {
      return false;
    }

    return !this.isReplacement() || this.replacesBecause().trim().length > 0;
  });

  protected refusalMessage(): string {
    const refusal = this.refusal();

    if (refusal === null) {
      return '';
    }

    return refusal.reason === 'too-large'
      ? this.copy.tooLarge(refusal.maxBytes, refusal.actualBytes)
      : this.copy.wrongType(refusal.accepted);
  }

  protected onFile(event: Event): void {
    this.chosen.set((event.target as HTMLInputElement).files?.item(0) ?? null);
  }

  protected onReason(event: Event): void {
    this.replacesBecause.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();

    const file = this.chosen();

    if (file === null || !this.canSubmit()) {
      return;
    }

    this.versionSubmitted.emit({
      file,
      // `uploaded` is what this control does. A scan taken on a device, or a document seen and
      // handed back, are different sources and are recorded by different acts.
      source: 'uploaded',
      documentNumber: null,
      issuedOn: null,
      expiresOn: null,
      replacesBecause: this.isReplacement() ? this.replacesBecause().trim() : null,
    });
  }

  protected readonly current = computed(() => {
    const record = this.document();
    return record === null ? null : currentVersion(record);
  });

  protected readonly history = computed(() => {
    const record = this.document();
    return record === null ? [] : supersededVersions(record);
  });

  protected sourceLabel(version: DocumentVersion): string {
    return DOCUMENT_SOURCE_LABELS[version.source];
  }

  protected validity(version: DocumentVersion): string {
    return documentValidity(version, this.today());
  }

  protected validityLabel(version: DocumentVersion): string {
    return DOCUMENT_VALIDITY_LABELS[documentValidity(version, this.today())];
  }

  protected maskedNumber(version: DocumentVersion): string | null {
    return maskDocumentNumber(version.documentNumber);
  }

  protected canOpen(version: DocumentVersion): boolean {
    return this.canDownload() && version.file !== null && sourceHoldsAFile(version.source);
  }

  protected sizeLabel(version: DocumentVersion): string {
    const bytes = version.file?.byteSize ?? 0;
    return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
  }
}
