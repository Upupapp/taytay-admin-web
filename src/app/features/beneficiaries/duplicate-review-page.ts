import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  BENEFICIARY_REPOSITORY,
  DEFAULT_PAGE_REQUEST,
  DUPLICATE_STRENGTH_LABELS,
  IDENTITY_VERDICT_LABELS,
  MATCH_ATTRIBUTE_LABELS,
  emptyPage,
  isResolutionInvalid,
  resolutionProblems,
  type DuplicateCandidate,
  type IdentityResolutionDraft,
  type IdentityVerdict,
  type MergePreview,
  type Page,
  type ResidentId,
} from '@domain/index';
import { IdentityComparison } from '@shared/beneficiaries/identity-comparison';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Drawer } from '@shared/ui/drawer/drawer';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';

/**
 * The duplicate-review queue.
 *
 * The screen exists to make one act possible and one act impossible.
 *
 * **Possible:** a reviewer reads which details agree, decides, and records why.
 * The reason is required and is stored against their name (`DL-74`).
 *
 * **Impossible:** merging. There is no button that combines two people. A
 * `same-person` finding names the record the office keeps using and leaves the
 * other one on file with its whole history intact — which is why the preview
 * describes what will be *carried across* rather than what will be deleted.
 *
 * Neither is the queue allowed to decide for anybody. Resemblance orders the
 * rows; nothing acts on it.
 */
@Component({
  selector: 'app-duplicate-review-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, Drawer, FormsModule, IdentityComparison, PageHeader, RouterLink],
  templateUrl: './duplicate-review-page.html',
  styleUrl: './duplicate-review-page.scss',
})
export class DuplicateReviewPage {
  private readonly repository = inject(BENEFICIARY_REPOSITORY);
  private readonly notifications = inject(NotificationStore);

  protected readonly copy = BENEFICIARIES_COPY.duplicates;
  protected readonly strengthLabels = DUPLICATE_STRENGTH_LABELS;
  protected readonly verdictLabels = IDENTITY_VERDICT_LABELS;

  /** Bumped after a finding, so the answered pair actually leaves the queue. */
  private readonly reloadToken = signal(0);

  protected readonly state = toSignal(
    toObservable(this.reloadToken).pipe(
      switchMap(() => toViewState(this.repository.duplicateQueue(DEFAULT_PAGE_REQUEST))),
    ),
    { initialValue: LOADING as ViewState<Page<DuplicateCandidate>> },
  );

  protected readonly queue = computed(
    () => valueOf(this.state()) ?? emptyPage<DuplicateCandidate>(),
  );
  protected readonly rows = computed(() => this.queue().items);

  /* ── the open review ────────────────────────────────────────────────────── */

  protected readonly openCandidate = signal<DuplicateCandidate | null>(null);
  protected readonly preview = signal<MergePreview | null>(null);
  protected readonly verdict = signal<IdentityVerdict>('same-person');
  protected readonly canonicalId = signal<ResidentId | null>(null);
  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly detecting = signal(false);

  /**
   * Runs a detection pass, then reloads the queue.
   *
   * A pair is a record the office is holding, created by a run — not a resemblance recomputed on
   * every read. Without this the queue was read and never filled, so an empty screen meant "nobody
   * has looked" and read as "there are no duplicates" (`DL-148`).
   *
   * It reports a count and stops there. What to do about each pair stays a person's judgement,
   * recorded one at a time with a reason (`DL-74`).
   */
  protected async detect(): Promise<void> {
    if (this.detecting()) {
      return;
    }
    this.detecting.set(true);
    try {
      const open = await firstValueFrom(this.repository.detectDuplicates());
      this.notifications.success(this.copy.detected(open));
      this.reloadToken.update((token) => token + 1);
    } catch {
      this.notifications.error(this.copy.detectFailed);
    } finally {
      this.detecting.set(false);
    }
  }

  protected readonly problems = computed(() => {
    const candidate = this.openCandidate();
    if (candidate === null) {
      return [];
    }
    return resolutionProblems(this.draftFrom(candidate));
  });

  protected readonly canSubmit = computed(
    () => this.openCandidate() !== null && this.problems().length === 0 && !this.submitting(),
  );

  protected async open(candidate: DuplicateCandidate): Promise<void> {
    this.openCandidate.set(candidate);
    this.verdict.set('same-person');
    // The record the reviewer opened from is the default survivor, but it is
    // only a default: which record the office keeps is their decision.
    this.canonicalId.set(candidate.residentId);
    this.reason.set('');
    this.preview.set(null);

    // A preview changes nothing; it is safe to fetch on open.
    this.preview.set(
      await firstValueFrom(
        this.repository.previewResolution(
          candidate.pairId,
          candidate.residentId,
          candidate.otherResidentId,
        ),
      ),
    );
  }

  protected close(): void {
    this.openCandidate.set(null);
    this.preview.set(null);
  }

  protected onVerdict(verdict: IdentityVerdict): void {
    this.verdict.set(verdict);
    const candidate = this.openCandidate();
    // Naming a survivor while declaring two people unrelated is incoherent, and
    // the domain refuses it. Clearing it here keeps the form from carrying a
    // value it would then be rejected for.
    this.canonicalId.set(
      verdict === 'same-person' ? (candidate?.residentId ?? null) : null,
    );
    if (candidate !== null && verdict === 'same-person') {
      void this.refreshPreview(candidate);
    }
  }

  protected onCanonical(residentId: ResidentId): void {
    this.canonicalId.set(residentId);
    const candidate = this.openCandidate();
    if (candidate !== null) {
      void this.refreshPreview(candidate);
    }
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submit(): Promise<void> {
    const candidate = this.openCandidate();
    if (candidate === null || !this.canSubmit()) {
      return;
    }

    this.submitting.set(true);
    try {
      await firstValueFrom(this.repository.resolveIdentity(this.draftFrom(candidate)));
      this.notifications.success(this.copy.recorded);
      this.close();
      this.reloadToken.update((token) => token + 1);
    } catch (error: unknown) {
      // A rejected finding is reported as a message, never as a silent no-op:
      // a reviewer who believes they recorded something that was refused will
      // not come back to it.
      this.notifications.error(
        isResolutionInvalid(error) ? this.copy.problemReason : this.copy.failed,
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected labelFor(candidate: DuplicateCandidate, residentId: ResidentId): string {
    return residentId === candidate.residentId ? candidate.residentLabel : candidate.otherLabel;
  }

  /** The fields that agree, named without their values — for the queue row. */
  protected agreementSummary(candidate: DuplicateCandidate): string {
    const agreeing = candidate.signals
      .filter((entry) => entry.outcome === 'same' || entry.outcome === 'similar')
      .map((entry) => MATCH_ATTRIBUTE_LABELS[entry.attribute].toLowerCase());
    return agreeing.length === 0 ? '—' : agreeing.join(', ');
  }

  private draftFrom(candidate: DuplicateCandidate): IdentityResolutionDraft {
    return {
      pairId: candidate.pairId,
      verdict: this.verdict(),
      pair: [candidate.residentId, candidate.otherResidentId],
      canonicalResidentId: this.verdict() === 'same-person' ? this.canonicalId() : null,
      reason: this.reason(),
    };
  }

  private async refreshPreview(candidate: DuplicateCandidate): Promise<void> {
    const canonical = this.canonicalId();
    if (canonical === null) {
      return;
    }
    const superseded =
      canonical === candidate.residentId ? candidate.otherResidentId : candidate.residentId;
    this.preview.set(
      await firstValueFrom(
        this.repository.previewResolution(candidate.pairId, canonical, superseded),
      ),
    );
  }
}
