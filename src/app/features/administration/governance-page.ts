import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  CLASSIFICATION_BASIS,
  CLASSIFICATION_CATALOG,
  CORRECTION_CAPTURE_IS_NOT_BUILT,
  CORRECTION_STATUS_CATALOG,
  fieldsNamed,
  GOVERNANCE_REPOSITORY,
  RETENTION_NOTICE,
  describeRetention,
  rulesAwaitingPolicy,
  type ClassifiedRecordType,
  type CorrectionRequest,
  type DataClassification,
  type RetentionRule,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { ADMIN_COPY } from './administration.copy';

/**
 * Data governance.
 *
 * Three sections, and two of them are honest about being incomplete.
 *
 * **Classification is real** — RA 10173 distinguishes personal information from
 * sensitive personal information, and an office that cannot say which of its
 * screens hold which cannot answer a data protection officer.
 *
 * **Retention is empty on purpose** (`DL-113`). No records disposition schedule
 * was supplied, so every row says "no schedule recorded" rather than a number.
 * An invented retention period is the most destructive of this project's
 * invented-policy risks: an office that believes it may delete after five
 * years, and does, cannot undo it.
 *
 * **Correction requests are read-only** until the capture screen exists, and
 * the screen says so rather than offering a form that goes nowhere.
 */
@Component({
  selector: 'app-governance-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink, StatusBadge],
  templateUrl: './governance-page.html',
  styleUrl: './governance-page.scss',
})
export class GovernancePage {
  private readonly repository = inject(GOVERNANCE_REPOSITORY);

  protected readonly copy = ADMIN_COPY.governance;
  protected readonly classificationCatalog = CLASSIFICATION_CATALOG;
  protected readonly correctionCatalog = CORRECTION_STATUS_CATALOG;
  /** Names the fields a request would change. Never their values — see the template. */
  protected readonly fieldsNamed = fieldsNamed;
  protected readonly retentionNotice = RETENTION_NOTICE;
  protected readonly correctionNotBuilt = CORRECTION_CAPTURE_IS_NOT_BUILT;

  protected readonly classificationState = toSignal(
    toViewState(this.repository.classifications()),
    { initialValue: LOADING as ViewState<readonly ClassifiedRecordType[]> },
  );

  protected readonly retentionState = toSignal(toViewState(this.repository.retention()), {
    initialValue: LOADING as ViewState<readonly RetentionRule[]>,
  });

  protected readonly correctionState = toSignal(toViewState(this.repository.corrections()), {
    initialValue: LOADING as ViewState<readonly CorrectionRequest[]>,
  });

  protected readonly classifications = computed<readonly ClassifiedRecordType[]>(
    () => valueOf(this.classificationState()) ?? [],
  );

  protected readonly retention = computed<readonly RetentionRule[]>(
    () => valueOf(this.retentionState()) ?? [],
  );

  protected readonly corrections = computed<readonly CorrectionRequest[]>(
    () => valueOf(this.correctionState()) ?? [],
  );

  protected readonly awaitingPolicy = computed(() => rulesAwaitingPolicy(this.retention()));

  /** The statutory basis for a label, so nobody takes the office's word for it. */
  protected basisFor(classification: DataClassification): string {
    return CLASSIFICATION_BASIS[classification];
  }

  /** Never a number when no schedule exists, and never a blank. */
  protected retentionFor(rule: RetentionRule): string {
    return describeRetention(rule);
  }

  /** The distinct labels in use, so the basis list shows only what is relevant. */
  protected readonly usedClassifications = computed(() => {
    const seen = new Set<DataClassification>();
    for (const type of this.classifications()) {
      seen.add(type.classification);
    }
    return [...seen];
  });
}
