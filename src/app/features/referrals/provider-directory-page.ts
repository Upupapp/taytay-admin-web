import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  REFERRAL_CHANNEL_LABELS,
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_REPOSITORY,
  SERVICE_PROVIDER_STATUS_LABELS,
  isAcceptingReferrals,
  type ReferralChannel,
  type ServiceProvider,
  type ServiceProviderStatus,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';

import { REFERRALS_COPY } from './referrals.copy';

/** The API announces a provider's change under `referrals` (`DL-222`). */
export const PROVIDER_DIRECTORY_TOPICS: readonly LiveTopic[] = ['referrals'];

/**
 * The directory of offices this one refers people to.
 *
 * Suspended and retired entries are **listed, not hidden**. A worker who cannot
 * see that the shelter is full will keep sending families there, and a retired
 * entry still has to be readable or the referrals attached to it stop making
 * sense — the same reason a superseded document version is kept (`DL-77`).
 */
@Component({
  selector: 'app-provider-directory-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, EmptyState, Icon, PageHeader, RouterLink],
  templateUrl: './provider-directory-page.html',
  styleUrl: './provider-directory-page.scss',
})
export class ProviderDirectoryPage {
  private readonly repository = inject(REFERRAL_REPOSITORY);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = REFERRALS_COPY.directory;
  protected readonly statuses = Object.keys(
    SERVICE_PROVIDER_STATUS_LABELS,
  ) as ServiceProviderStatus[];

  protected readonly search = signal('');

  /**
   * The term the data layer actually sees.
   *
   * Debounced so typing a surname is one read rather than one per keystroke
   * (`DL-119`). The other filters are not debounced: choosing from a dropdown
   * is a single deliberate act and should take effect at once.
   */
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly status = signal<ServiceProviderStatus | null>(null);

  /** Bumped by "Try again", to ask the same question again. */
  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(
      computed(() => ({
        search: this.settledSearch(),
        status: this.status(),
        nonce: this.reloads(),
      })),
    ).pipe(
      switchMap((query) =>
        liveViewState(
          () =>
            this.repository.listProviders({
              ...(query.search ? { search: query.search } : {}),
              ...(query.status ? { status: query.status } : {}),
            }),
          this.live.changes(PROVIDER_DIRECTORY_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly ServiceProvider[]> },
  );

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
  }

  protected readonly providers = computed(() => valueOf(this.state()) ?? []);

  protected statusLabel(status: ServiceProviderStatus): string {
    return SERVICE_PROVIDER_STATUS_LABELS[status];
  }

  protected destinationLabel(provider: ServiceProvider): string {
    return REFERRAL_DESTINATION_LABELS[provider.destination];
  }

  protected channelLabel(channel: ReferralChannel): string {
    return REFERRAL_CHANNEL_LABELS[channel];
  }

  protected accepting(provider: ServiceProvider): boolean {
    return isAcceptingReferrals(provider);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value === '' ? null : (value as ServiceProviderStatus));
  }
}
