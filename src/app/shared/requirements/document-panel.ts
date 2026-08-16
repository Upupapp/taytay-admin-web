import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

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
    </section>
  `,
  styleUrl: './document-panel.scss',
})
export class DocumentPanel {
  readonly document = input<RequirementDocument | null>(null);
  /** Whether this reader may open the file at all. */
  readonly canDownload = input(false);
  readonly today = input<Date>(new Date());

  readonly openRequested = output<DocumentVersion['id']>();

  protected readonly copy = REQUIREMENTS_COPY.document;

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
