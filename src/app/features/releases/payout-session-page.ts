import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import {
  RELEASE_REPOSITORY,
  batchProgress,
  describeBatch,
  type Release,
  type ReleaseBatch,
  type ReleaseBatchId,
  type ReleaseManifest,
  asId,
  asIsoDate,
  WriteIntent,
  type ReleaseId,
  type StaffUserId,
} from '@domain/index';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { RELEASES_COPY } from './releases.copy';

/**
 * Payout sessions and the list carried to the table.
 *
 * A session shows **counts, not a state** (`DL-90`): "1 of 3 released, 1
 * deferred" is a sentence a supervisor can act on, where "partially complete"
 * is not — and a batch marked released while somebody in it went home empty is
 * exactly what the counts prevent.
 *
 * The manifest comes from the data layer, composed from the batch. This screen
 * must not assemble one from records it happens to hold (`DL-92`).
 */
@Component({
  selector: 'app-payout-session-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, PesoPipe, RouterLink],
  templateUrl: './payout-session-page.html',
  styleUrl: './payout-session-page.scss',
})
export class PayoutSessionPage {
  private readonly repository = inject(RELEASE_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly session = inject(SessionStore);

  /** Bumped after a session opens, so the list re-reads rather than guessing what changed. */
  private readonly reloads = signal(0);

  protected readonly copy = RELEASES_COPY.batches;

  protected readonly state = toSignal(
    toObservable(this.reloads).pipe(switchMap(() => toViewState(this.repository.listBatches()))),
    { initialValue: LOADING as ViewState<readonly ReleaseBatch[]> },
  );

  protected readonly batches = computed(() => valueOf(this.state()) ?? []);

  /** The session whose payout list is open. `null` until one is chosen. */
  protected readonly openBatchId = signal<ReleaseBatchId | null>(null);

  protected readonly manifest = toSignal(
    toObservable(this.openBatchId).pipe(
      switchMap((id) =>
        id === null ? [null] : this.repository.manifestFor(id),
      ),
    ),
    { initialValue: null as ReleaseManifest | null },
  );

  /** Every release in every session, so a card can count its own members. */
  private readonly releases = toSignal(
    this.repository.list({}, { page: 1, pageSize: 300 }),
    { initialValue: null },
  );

  /* ── opening a session ──────────────────────────────────────────────────── */

  private readonly intent = new WriteIntent();

  protected readonly draftTitle = signal('');
  protected readonly draftVenue = signal('');
  protected readonly draftDate = signal('');
  protected readonly draftMembers = signal<readonly ReleaseId[]>([]);
  protected readonly opening = signal(false);

  protected readonly canOpen = computed(
    () =>
      this.draftTitle().trim().length > 0 &&
      this.draftVenue().trim().length > 0 &&
      this.draftDate().length > 0 &&
      !this.opening(),
  );

  /**
   * Only releases that are ready to be handed over.
   *
   * A session is a plan for a table on a day; scheduling a release that has already been paid, or
   * one nobody has approved, would put a name on a payout list that should not be there.
   */
  protected readonly schedulable = computed(() =>
    (this.releases()?.items ?? []).filter(
      (release: Release) => release.status === 'for-release' || release.status === 'scheduled',
    ),
  );

  protected isMember(id: ReleaseId): boolean {
    return this.draftMembers().includes(id);
  }

  protected onTitle(event: Event): void {
    this.draftTitle.set((event.target as HTMLInputElement).value);
  }

  protected onVenue(event: Event): void {
    this.draftVenue.set((event.target as HTMLInputElement).value);
  }

  protected onDate(event: Event): void {
    this.draftDate.set((event.target as HTMLInputElement).value);
  }

  protected toggleMember(id: ReleaseId, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.draftMembers.update((current) =>
      checked ? [...current, id] : current.filter((entry) => entry !== id),
    );
  }

  /**
   * Opens the session, then adds each chosen release.
   *
   * The intent is held on the component rather than made per attempt: a retry must carry the same
   * key, or the server treats it as a second, genuine session. `DL-90` — a batch has no status of
   * its own, so a session that opened with fewer members than intended is a countable state rather
   * than a failure, and the message says exactly which state it is in.
   */
  protected async open(): Promise<void> {
    if (!this.canOpen()) {
      return;
    }

    this.opening.set(true);
    const intended = this.draftMembers().length;

    try {
      const batch = await firstValueFrom(
        this.repository.createBatch(
          {
            title: this.draftTitle().trim(),
            scheduledFor: asIsoDate(this.draftDate()),
            venue: this.draftVenue().trim(),
            /*
             * The officer is whoever is opening it.
             *
             * The API sets `opened_by` from the authenticated actor and ignores anything a client
             * sends, so this is the console agreeing with the server rather than asserting
             * something it could get wrong. The mock reads it, which is why it is populated at all.
             */
            officerId: this.session.user()?.id ?? asId<StaffUserId>('unknown'),
            releaseIds: this.draftMembers(),
            notes: null,
          },
          this.intent,
        ),
      );

      const added = batch.releaseIds.length;

      if (intended > 0 && added < intended) {
        this.notifications.warning(this.copy.partiallyOpened(added, intended));
      } else {
        this.notifications.success(this.copy.opened);
      }

      this.draftTitle.set('');
      this.draftVenue.set('');
      this.draftDate.set('');
      this.draftMembers.set([]);
      this.reloads.update((n) => n + 1);
    } catch (failure: unknown) {
      this.notifications.error(
        failure instanceof Error ? failure.message : this.copy.notOpened,
      );
    } finally {
      this.opening.set(false);
    }
  }

  protected progressFor(batch: ReleaseBatch): string {
    const all = this.releases()?.items ?? [];
    const members = all.filter((release: Release) =>
      batch.releaseIds.includes(release.id),
    );
    return describeBatch(batchProgress(members));
  }

  protected openManifest(batch: ReleaseBatch): void {
    this.openBatchId.set(batch.id);
  }

  protected print(): void {
    globalThis.print?.();
  }
}
