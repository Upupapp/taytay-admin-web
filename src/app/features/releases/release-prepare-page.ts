import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { failureReason } from '@shared/state/failure-reason';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { NotConnected } from '@core/access/not-connected';
import { ServedPorts } from '@core/access/served-ports';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  PAYOUT_METHOD_LABELS,
  PROGRAM_REPOSITORY,
  RELEASE_KIND_LABELS,
  RELEASE_REPOSITORY,
  RELEASE_STATUS_CATALOG,
  WriteIntent,
  asId,
  parsePesos,
  pesosForInput,
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
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELEASES_COPY } from './releases.copy';

/** How money is paid. Goods are always handed over in kind. */
const MONEY_METHODS: readonly PayoutMethod[] = ['cash', 'check', 'e-wallet', 'bank-transfer'];

/**
 * A field that starts from what the records say and is the officer's once they type into it: a
 * later read of the same source (the programme arriving after the request) fills it only while it
 * still holds what was filled in, never over something typed.
 */
function startingFrom<T>(previous: { source: T; value: T } | undefined, next: T): T {
  return previous === undefined || previous.value === previous.source ? next : previous.value;
}

/**
 * Preparing the release for an approved request (`DL-180`).
 *
 * The office states what is handed over — an amount in pesos, read into whole centavos, or the goods
 * described with no amount at all (`DL-93`) — how, and the label and reference it was given. Who the
 * release is for and who approved it are the request's, read by the data layer; nothing here posts
 * to an account (`DL-89`). One release per request at a time: a request that already has one shows
 * it rather than a second form.
 *
 * The form starts from the records (`DL-235`): the approved amount, or the approved goods, and the
 * funding source the programme's record names, held as the text it is. The officer changes either
 * before recording; the approval stays the ceiling, checked by the domain and by the server.
 */
@Component({
  selector: 'app-release-prepare-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    EmptyState,
    Icon,
    NotConnected,
    PageHeader,
    PesoPipe,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './release-prepare-page.html',
})
export class ReleasePreparePage {
  private readonly releases = inject(RELEASE_REPOSITORY);
  private readonly requests = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly programs = inject(PROGRAM_REPOSITORY);

  /**
   * The programme's record only starts a field, so a set of adapters that does not serve it keeps the
   * page: nothing is asked, the field is typed, and the notice says why it starts empty (`DL-175`).
   */
  protected readonly servesPrograms = inject(ServedPorts).serves('program');
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  /**
   * The request, from `?request=` (`withComponentInputBinding`). The router sets the input to
   * `undefined` when the parameter is absent, which once reached the API as
   * `/assistance-requests/undefined` (a 422 shown as a broken page, UI audit F010).
   */
  readonly request = input<string | undefined>(undefined);

  /** The request id, or `''` when the page was opened without one: then nothing is read. */
  protected readonly requestId = computed(() => (this.request() ?? '').trim());

  protected readonly copy = RELEASES_COPY.prepare;
  protected readonly requestCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly releaseCatalog = RELEASE_STATUS_CATALOG;
  protected readonly kinds: readonly ReleaseKind[] = ['money', 'in-kind'];
  protected readonly moneyMethods = MONEY_METHODS;

  /** Bumped by "Try again", to ask the same question again. */
  private readonly reloads = signal(0);

  protected readonly requestState = toSignal(
    toObservable(computed(() => ({ id: this.requestId(), nonce: this.reloads() }))).pipe(
      switchMap(({ id }) =>
        toViewState(id === '' ? of(null) : this.requests.getById(asId<AssistanceRequestId>(id))),
      ),
    ),
    { initialValue: LOADING as ViewState<AssistanceRequest | null> },
  );

  /** Opened without a request: the approved requests are where one is chosen. */
  protected chooseRequest(): void {
    void this.router.navigate(['/assistance-requests'], { queryParams: { status: 'approved' } });
  }

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
  }

  protected readonly assistance = computed(() => valueOf(this.requestState()) ?? null);

  /** The request's releases, whole; `null` when they could not be read, which is not "none". */
  protected readonly existing = toSignal(
    toObservable(this.requestId).pipe(
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

  /**
   * The funding source the request's programme names, to start the field from; `null` while it is
   * read, when it could not be, and when the record names none. The field is typed then, as before.
   */
  protected readonly programFunding = toSignal(
    toObservable(computed(() => this.assistance()?.programId ?? null)).pipe(
      switchMap((id) =>
        id === null || id === '' || !this.servesPrograms
          ? of(null)
          : this.programs.getById(id).pipe(
              map((program) => program?.fundingSource.trim() || null),
              catchError(() => of(null)),
            ),
      ),
    ),
    { initialValue: null as string | null },
  );

  /** Goods when the approval described goods and recorded no amount; money otherwise. */
  private readonly approvedKind = computed<ReleaseKind>(() => {
    const approved = this.assistance();
    return approved !== null && approved.approvedAmount === null && approved.approvedInKindDescription !== null
      ? 'in-kind'
      : 'money';
  });

  /** The approved amount as a field value, from its integer centavos; empty for goods or none. */
  private readonly approvedAmountText = computed(() => {
    const amount = this.assistance()?.approvedAmount ?? null;
    return amount === null ? '' : pesosForInput(amount);
  });

  private readonly approvedGoods = computed(() => this.assistance()?.approvedInKindDescription ?? '');
  private readonly startingFunding = computed(() => this.programFunding() ?? '');

  protected readonly kind = linkedSignal<ReleaseKind, ReleaseKind>({
    source: this.approvedKind,
    computation: (next, previous) => startingFrom(previous, next),
  });
  protected readonly method = signal<PayoutMethod>('cash');
  protected readonly amountText = linkedSignal<string, string>({
    source: this.approvedAmountText,
    computation: (next, previous) => startingFrom(previous, next),
  });
  protected readonly goods = linkedSignal<string, string>({
    source: this.approvedGoods,
    computation: (next, previous) => startingFrom(previous, next),
  });
  protected readonly fundingSource = linkedSignal<string, string>({
    source: this.startingFunding,
    computation: (next, previous) => startingFrom(previous, next),
  });

  /** Whether a field still holds what the records filled in, so the hint can say where it came from. */
  protected readonly amountFromApproval = computed(
    () => this.approvedAmountText() !== '' && this.amountText() === this.approvedAmountText(),
  );
  protected readonly goodsFromApproval = computed(
    () => this.approvedGoods() !== '' && this.goods() === this.approvedGoods(),
  );
  protected readonly fundingFromProgram = computed(
    () => this.startingFunding() !== '' && this.fundingSource() === this.startingFunding(),
  );
  protected readonly approvingReference = signal('');
  protected readonly remarks = signal('');
  protected readonly saving = signal(false);

  private intent = new WriteIntent();

  protected readonly draft = computed<ReleaseDraft | null>(() => {
    const id = this.requestId();
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

  protected onText(
    target: 'amount' | 'goods' | 'funding' | 'reference' | 'remarks',
    event: Event,
  ): void {
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
      this.notifications.error(failureReason(failure) ?? this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
