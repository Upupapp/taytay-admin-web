import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  BENEFICIARY_REPOSITORY,
  DUPLICATE_STRENGTH_LABELS,
  IDENTITY_VERDICT_LABELS,
  MATCH_ATTRIBUTE_LABELS,
  isResolutionInvalid,
  resolutionProblems,
  type CursorPage,
  type DuplicateCandidate,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type IdentityVerdict,
  type MergePreview,
  type ResidentId,
} from '@domain/index';
import { IdentityComparison } from '@shared/beneficiaries/identity-comparison';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Icon } from '@shared/ui/icon/icon';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';

/** One cursor page of pairs at a time; "Show more" follows the cursor (`DL-161`). */
const PAGE_SIZE = 20;

/** The pairs, the findings that answer them, and the names each pair is shown by (`DL-222`). */
export const DUPLICATE_QUEUE_TOPICS: readonly LiveTopic[] = ['beneficiaries', 'residents'];

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
/**
 * What one record of the pair holds, read from the preview that would supersede it: the counts
 * that would move and whether an app account reads it. Both records carry the same masked name, so
 * this is how a reviewer tells them apart without a compared value (DL-73, UI audit F021).
 */
type Holding =
  | { readonly state: 'reading' }
  | { readonly state: 'unread' }
  | { readonly state: 'read'; readonly preview: MergePreview };

const READING: Holding = { state: 'reading' };

@Component({
  selector: 'app-duplicate-review-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollRegion,
    AsyncContent,
    FormsModule,
    Icon,
    IdentityComparison,
    ListChangedNotice,
    Modal,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './duplicate-review-page.html',
  styleUrl: './duplicate-review-page.scss',
})
export class DuplicateReviewPage {
  private readonly repository = inject(BENEFICIARY_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = BENEFICIARIES_COPY.duplicates;
  protected readonly strengthLabels = DUPLICATE_STRENGTH_LABELS;
  protected readonly verdictLabels = IDENTITY_VERDICT_LABELS;

  /** Bumped after a finding, so the answered pair actually leaves the queue. */
  private readonly reloadToken = signal(0);

  /** Further pages of the reading the first page began; emptied whenever the queue is read again. */
  private readonly further = signal<readonly CursorPage<DuplicateCandidate>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  /**
   * A colleague's finding or a detection run re-reads the first page quietly, unless more is loaded
   * (`DL-222`). The open review keeps its own pair, verdict and reason, so a re-read never touches a
   * finding being written.
   */
  protected readonly state = toSignal(
    toObservable(this.reloadToken).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
        this.listChanged.set(false);
      }),
      switchMap(() =>
        liveViewState(
          () => this.repository.duplicateQueue({ limit: PAGE_SIZE, cursor: null }),
          unlessPaged(
            this.live.changes(DUPLICATE_QUEUE_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<DuplicateCandidate>> },
  );

  protected readonly rows = computed<readonly DuplicateCandidate[]>(() => [
    ...(valueOf(this.state())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);
  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.state()) ?? null,
  );
  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  /** The person's reload after a held hint: the queue from its first page. */
  protected reloadList(): void {
    this.reloadToken.update((token) => token + 1);
  }

  /** Follows the cursor one page further, for the reading the first page began. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const reading = this.reloadToken();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .duplicateQueue({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The queue was read again meanwhile: this page continues a reading nobody is looking at.
          if (reading === this.reloadToken()) {
            this.further.update((pages) => [...pages, page]);
          }
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  /* ── the open review ────────────────────────────────────────────────────── */

  protected readonly openCandidate = signal<DuplicateCandidate | null>(null);
  protected readonly preview = signal<MergePreview | null>(null);
  /** First: the record the pair was opened from; second: the one it resembles. */
  protected readonly holdings = signal<{ readonly first: Holding; readonly second: Holding }>({
    first: READING,
    second: READING,
  });
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
    this.holdings.set({ first: READING, second: READING });

    // A preview changes nothing; it is safe to fetch on open. Each record's holdings are the
    // preview that would supersede it, so the two reads also say what keeping either would do.
    const [first, second] = await Promise.all([
      this.readHolding(candidate, candidate.otherResidentId, candidate.residentId),
      this.readHolding(candidate, candidate.residentId, candidate.otherResidentId),
    ]);
    if (this.openCandidate() !== candidate) {
      return;
    }
    this.holdings.set({ first, second });
    if (this.canonicalId() === candidate.residentId && second.state === 'read') {
      this.preview.set(second.preview);
    }
  }

  /** One record's holdings, in words: counts and whether an app account reads it. */
  protected holdingText(holding: Holding): string {
    if (holding.state === 'reading') {
      return this.copy.recordReading;
    }
    if (holding.state === 'unread') {
      return this.copy.recordUnread;
    }
    const preview = holding.preview;
    const holds = this.copy.recordHolds(
      preview.movingRequestCount,
      preview.movingReleaseCount,
      preview.movingCaseCount,
    );
    return `${holds} ${preview.appAccount === null ? this.copy.recordNoAccount : this.copy.recordAccount}`;
  }

  private readHolding(
    candidate: DuplicateCandidate,
    kept: ResidentId,
    superseded: ResidentId,
  ): Promise<Holding> {
    return firstValueFrom(
      this.repository.previewResolution(candidate.pairId, kept, superseded).pipe(
        map((preview): Holding => ({ state: 'read', preview })),
        catchError(() => of<Holding>({ state: 'unread' })),
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
    this.canonicalId.set(verdict === 'same-person' ? (candidate?.residentId ?? null) : null);
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
      const finding = await firstValueFrom(
        this.repository.resolveIdentity(this.draftFrom(candidate)),
      );
      this.announce(finding);
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

  /** What the finding would do to an app account linked to the record superseded (`DL-226`). */
  protected accountEffect(preview: MergePreview): string {
    const account = preview.appAccount;
    if (account === null) {
      return this.copy.previewAccountNone;
    }
    return account.outcome === 'relinked'
      ? this.copy.previewAccountRelinked
      : this.copy.previewAccountNotRelinked;
  }

  /**
   * The finding, and what it did to a resident's app account (`DL-226`). An account left where it
   * was means one person has two, which only the office can settle: that stays on screen until
   * dismissed and is kept in the inbox, rather than fading with a toast nobody was looking at.
   */
  private announce(finding: IdentityResolution): void {
    const account = finding.appAccount;
    if (account?.outcome === 'not-relinked') {
      this.notifications.notify({
        severity: 'warning',
        title: this.copy.recordedAccountNotMoved,
        body: this.copy.recordedAccountNotMovedBody,
        channel: 'both',
        autoDismissMs: null,
      });
      return;
    }
    this.notifications.success(
      this.copy.recorded,
      account?.outcome === 'relinked' ? this.copy.recordedAccountRelinked : undefined,
    );
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
