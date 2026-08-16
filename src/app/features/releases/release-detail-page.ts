import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ACKNOWLEDGEMENT_KIND_LABELS,
  DEFERRAL_REASON_LABELS,
  DISBURSEMENT_REPOSITORY,
  DISBURSEMENT_STATUS_CATALOG,
  DISBURSEMENT_STATUS_TRANSITIONS,
  RELEASE_KIND_LABELS,
  SELF_RELEASE_WARNING,
  asId,
  canTransition,
  isSelfRelease,
  type AcknowledgementKind,
  type DeferralReason,
  type Disbursement,
  type DisbursementId,
  type StaffUserId,
} from '@domain/index';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELEASES_COPY } from './releases.copy';

/**
 * One release, and the acts that can be recorded against it.
 *
 * The self-release cue is computed against **who actually approved**, fetched
 * from the data layer rather than inferred from a role. `DL-08` separates the
 * permissions; this catches the case where the same human holds both — an
 * administrator, or a misconfigured account — and says so before the money
 * moves (`DL-91`).
 *
 * It warns rather than blocks. A small office on a bad day may genuinely have
 * one person available, and refusing the payout punishes the family for the
 * office's staffing.
 */
@Component({
  selector: 'app-release-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './release-detail-page.html',
  styleUrl: './release-detail-page.scss',
})
export class ReleaseDetailPage {
  private readonly repository = inject(DISBURSEMENT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly session = inject(SessionStore);

  readonly id = input.required<string>();

  protected readonly copy = RELEASES_COPY.detail;
  protected readonly statusCatalog = DISBURSEMENT_STATUS_CATALOG;
  protected readonly selfReleaseWarning = SELF_RELEASE_WARNING;

  protected readonly deferralReasons = Object.keys(
    DEFERRAL_REASON_LABELS,
  ) as DeferralReason[];
  protected readonly acknowledgementKinds = Object.keys(
    ACKNOWLEDGEMENT_KIND_LABELS,
  ) as AcknowledgementKind[];

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<DisbursementId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<Disbursement | null> },
  );

  protected readonly release = computed(() => valueOf(this.state()) ?? null);

  /** Who approved the request behind this release. Read, never assumed. */
  protected readonly approver = toSignal(
    toObservable(computed(() => this.id())).pipe(
      switchMap((id) => this.repository.approverFor(asId<DisbursementId>(id))),
    ),
    { initialValue: null as StaffUserId | null },
  );

  protected readonly canRelease = computed(() => this.permissions.has('disbursement.release'));

  protected readonly wouldSelfRelease = computed(() => {
    const me = this.session.user()?.id ?? null;
    return me !== null && isSelfRelease(this.approver(), me);
  });

  protected readonly canRecordRelease = computed(() => {
    const release = this.release();
    return (
      release !== null &&
      this.canRelease() &&
      canTransition(DISBURSEMENT_STATUS_TRANSITIONS, release.status, 'released')
    );
  });

  protected readonly canAcknowledge = computed(() => {
    const release = this.release();
    return (
      release !== null &&
      this.canRelease() &&
      canTransition(DISBURSEMENT_STATUS_TRANSITIONS, release.status, 'claimed')
    );
  });

  protected readonly canDefer = computed(() => {
    const release = this.release();
    return (
      release !== null &&
      this.canRelease() &&
      canTransition(DISBURSEMENT_STATUS_TRANSITIONS, release.status, 'deferred')
    );
  });

  protected kindLabel(release: Disbursement): string {
    return RELEASE_KIND_LABELS[release.kind];
  }

  protected deferralLabel(reason: DeferralReason): string {
    return DEFERRAL_REASON_LABELS[reason];
  }

  protected acknowledgementLabel(kind: AcknowledgementKind): string {
    return ACKNOWLEDGEMENT_KIND_LABELS[kind];
  }

  /* ── recording the release ──────────────────────────────────────────────── */

  protected readonly instrument = signal('');
  protected readonly releaseRemarks = signal('');

  protected onInstrument(event: Event): void {
    this.instrument.set((event.target as HTMLInputElement).value);
  }

  protected onReleaseRemarks(event: Event): void {
    this.releaseRemarks.set((event.target as HTMLTextAreaElement).value);
  }

  protected async recordRelease(): Promise<void> {
    if (!this.canRecordRelease() || this.saving()) {
      return;
    }
    await this.run(
      this.repository.markReleased(
        asId<DisbursementId>(this.id()),
        this.instrument().trim() || null,
        this.releaseRemarks().trim() || null,
      ),
      this.copy.released,
      () => {
        this.instrument.set('');
        this.releaseRemarks.set('');
      },
    );
  }

  /* ── the receipt ────────────────────────────────────────────────────────── */

  protected readonly ackKind = signal<AcknowledgementKind>('signature');
  protected readonly collectedBy = signal('');
  protected readonly authority = signal('');

  protected readonly needsAuthority = computed(() => this.ackKind() === 'representative');

  protected readonly canSaveAcknowledgement = computed(() => {
    if (!this.canAcknowledge() || this.saving()) {
      return false;
    }
    // A representative collecting on somebody's behalf must present authority.
    return !this.needsAuthority() || this.authority().trim().length > 0;
  });

  protected onAckKind(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AcknowledgementKind;
    this.ackKind.set(value);
    if (value !== 'representative') {
      this.collectedBy.set('');
      this.authority.set('');
    }
  }

  protected onCollectedBy(event: Event): void {
    this.collectedBy.set((event.target as HTMLInputElement).value);
  }

  protected onAuthority(event: Event): void {
    this.authority.set((event.target as HTMLInputElement).value);
  }

  protected async acknowledge(): Promise<void> {
    if (!this.canSaveAcknowledgement()) {
      return;
    }
    await this.run(
      this.repository.acknowledge(asId<DisbursementId>(this.id()), {
        kind: this.ackKind(),
        collectedBy: this.collectedBy().trim() || null,
        authority: this.authority().trim() || null,
      }),
      this.copy.acknowledged,
      () => {
        this.collectedBy.set('');
        this.authority.set('');
      },
    );
  }

  /* ── the deferral ───────────────────────────────────────────────────────── */

  protected readonly deferReason = signal<DeferralReason>('funds-not-yet-released-to-office');
  protected readonly deferRemarks = signal('');

  protected readonly canSaveDeferral = computed(
    () => this.canDefer() && this.deferRemarks().trim().length > 0 && !this.saving(),
  );

  protected onDeferReason(event: Event): void {
    this.deferReason.set((event.target as HTMLSelectElement).value as DeferralReason);
  }

  protected onDeferRemarks(event: Event): void {
    this.deferRemarks.set((event.target as HTMLTextAreaElement).value);
  }

  protected async defer(): Promise<void> {
    if (!this.canSaveDeferral()) {
      return;
    }
    await this.run(
      this.repository.deferRelease(
        asId<DisbursementId>(this.id()),
        this.deferReason(),
        this.deferRemarks(),
      ),
      this.copy.deferred,
      () => this.deferRemarks.set(''),
    );
  }

  private async run(
    call: ReturnType<typeof this.repository.markReleased>,
    message: string,
    onSuccess: () => void,
  ): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      onSuccess();
      this.notifications.success(message);
      this.reloads.update((value) => value + 1);
    } catch {
      // Reported, never swallowed: a disbursing officer who believes a payout
      // was recorded will not record it again, and the family goes unpaid.
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
