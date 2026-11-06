import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, switchMap } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  PAYOUT_METHOD_LABELS,
  RELEASE_KIND_LABELS,
  RELEASE_REPOSITORY,
  RELEASE_STATUS_CATALOG,
  WriteIntent,
  asId,
  parsePesos,
  releaseDraftProblems,
  type AssistanceRequest,
  type AssistanceRequestId,
  type PayoutMethod,
  type Release,
  type ReleaseDraft,
  type ReleaseKind,
} from '@domain/index';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELEASES_COPY } from './releases.copy';

/** How money is paid. Goods are always handed over in kind. */
const MONEY_METHODS: readonly PayoutMethod[] = ['cash', 'check', 'e-wallet', 'bank-transfer'];

/**
 * Preparing the release for an approved request (`DL-180`).
 *
 * The office states what is handed over — an amount in pesos, read into whole centavos, or the goods
 * described with no amount at all (`DL-93`) — how, and the label and reference it was given. Who the
 * release is for and who approved it are the request's, read by the data layer; nothing here posts
 * to an account (`DL-89`). One release per request at a time: a request that already has one shows
 * it rather than a second form.
 */
@Component({
  selector: 'app-release-prepare-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './release-prepare-page.html',
})
export class ReleasePreparePage {
  private readonly releases = inject(RELEASE_REPOSITORY);
  private readonly requests = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  /** The request, from `?request=` (`withComponentInputBinding`). */
  readonly request = input<string>('');

  protected readonly copy = RELEASES_COPY.prepare;
  protected readonly requestCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly releaseCatalog = RELEASE_STATUS_CATALOG;
  protected readonly kinds: readonly ReleaseKind[] = ['money', 'in-kind'];
  protected readonly moneyMethods = MONEY_METHODS;

  /** Bumped by "Try again", to ask the same question again. */
  private readonly reloads = signal(0);

  protected readonly requestState = toSignal(
    toObservable(computed(() => ({ id: this.request(), nonce: this.reloads() }))).pipe(
      switchMap(({ id }) =>
        toViewState(
          id === '' ? of(null) : this.requests.getById(asId<AssistanceRequestId>(id)),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<AssistanceRequest | null> },
  );

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
  }

  protected readonly assistance = computed(() => valueOf(this.requestState()) ?? null);

  /** The request's releases, whole; `null` when they could not be read, which is not "none". */
  protected readonly existing = toSignal(
    toObservable(this.request).pipe(
      switchMap((id) =>
        id === ''
          ? of([] as readonly Release[])
          : this.releases
              .listForRequest(asId<AssistanceRequestId>(id))
              .pipe(catchError(() => of(null))),
      ),
    ),
    { initialValue: null as readonly Release[] | null },
  );

  protected readonly openRelease = computed(
    () => (this.existing() ?? []).find((release) => release.status !== 'voided') ?? null,
  );

  protected readonly isApproved = computed(() => {
    const status = this.assistance()?.status;
    return status === 'approved' || status === 'scheduled';
  });

  protected readonly kind = signal<ReleaseKind>('money');
  protected readonly method = signal<PayoutMethod>('cash');
  protected readonly amountText = signal('');
  protected readonly goods = signal('');
  protected readonly fundingSource = signal('');
  protected readonly approvingReference = signal('');
  protected readonly remarks = signal('');
  protected readonly saving = signal(false);

  private intent = new WriteIntent();

  protected readonly draft = computed<ReleaseDraft | null>(() => {
    const id = this.request();
    if (id === '') {
      return null;
    }
    const money = this.kind() === 'money';
    return {
      requestId: asId<AssistanceRequestId>(id),
      kind: this.kind(),
      method: money ? this.method() : 'in-kind',
      amount: money ? parsePesos(this.amountText()) : null,
      inKindDescription: money ? null : this.goods().trim() || null,
      fundingSourceLabel: this.fundingSource().trim() || null,
      approvingReference: this.approvingReference().trim() || null,
      remarks: this.remarks().trim() || null,
    };
  });

  protected readonly problems = computed(() => {
    const draft = this.draft();
    return draft === null ? [] : releaseDraftProblems(draft);
  });

  protected readonly canPrepare = computed(
    () =>
      this.draft() !== null &&
      this.problems().length === 0 &&
      this.isApproved() &&
      this.existing() !== null &&
      this.openRelease() === null &&
      !this.saving(),
  );

  protected kindLabel(kind: ReleaseKind): string {
    return RELEASE_KIND_LABELS[kind];
  }

  protected methodLabel(method: PayoutMethod): string {
    return PAYOUT_METHOD_LABELS[method];
  }

  protected onKind(kind: ReleaseKind): void {
    this.kind.set(kind);
  }

  protected onMethod(event: Event): void {
    this.method.set((event.target as HTMLSelectElement).value as PayoutMethod);
  }

  protected onText(target: 'amount' | 'goods' | 'funding' | 'reference' | 'remarks', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    const field = {
      amount: this.amountText,
      goods: this.goods,
      funding: this.fundingSource,
      reference: this.approvingReference,
      remarks: this.remarks,
    }[target];
    field.set(value);
  }

  /**
   * The intent is held across a retry and replaced only once the release is recorded: a second
   * press after a failure is the same act, and the API replays its answer rather than preparing a
   * second payout.
   */
  protected async prepare(): Promise<void> {
    const draft = this.draft();
    if (draft === null || !this.canPrepare()) {
      return;
    }
    this.saving.set(true);
    try {
      const release = await firstValueFrom(this.releases.prepare(draft, this.intent));
      this.intent = new WriteIntent();
      this.notifications.success(this.copy.prepared);
      void this.router.navigate(['/releases', release.id]);
    } catch (failure: unknown) {
      // Reported, never swallowed: an officer who believes a release exists will not prepare it.
      this.notifications.error(failure instanceof Error ? failure.message : this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
