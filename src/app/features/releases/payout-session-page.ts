import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import {
  RELEASE_REPOSITORY,
  batchProgress,
  describeBatch,
  type Release,
  type ReleaseBatch,
  type ReleaseBatchId,
  type ReleaseManifest,
} from '@domain/index';
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

  protected readonly copy = RELEASES_COPY.batches;

  protected readonly state = toSignal(toViewState(this.repository.listBatches()), {
    initialValue: LOADING as ViewState<readonly ReleaseBatch[]>,
  });

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
