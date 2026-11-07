import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import {
  ACCOUNT_ROLE_CATALOG,
  ACCOUNT_VERIFICATION_STATUSES,
  APP_ACCOUNT_REPOSITORY,
  isOwnAccount,
  OFFICE_REPOSITORY,
  takesAnOffice,
  type AccountVerificationStatus,
  type AppAccount,
  type AppAccountFilter,
  type CursorPage,
} from '@domain/index';
import { officeDirectory } from '@shared/offices/office-directory';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { AccountPanel } from './account-panel';
import { ACCOUNTS_COPY } from './accounts.copy';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/**
 * Users and roles (`DL-168`): every residents' app account, and the administrator deciding who is
 * staff.
 *
 * **The minimum, because most rows are residents.** Name, email, role and office — what deciding
 * who is staff needs. Nothing else is read (`AppAccount`).
 *
 * **A browsable list, a page at a time** (`DL-161`): "more are available", never "page 1 of N".
 *
 * **No record by address.** The API has no read of one account, so an account is managed in a
 * drawer beside the list, as an ID review is, and after a change the list is read again from the
 * server rather than patched.
 */
@Component({
  selector: 'app-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountPanel, AsyncContent, DataTable, Drawer, PageHeader, StatusBadge],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {
  private readonly repository = inject(APP_ACCOUNT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = ACCOUNTS_COPY.list;
  protected readonly verificationStatuses = ACCOUNT_VERIFICATION_STATUSES;

  /**
   * `?verification=` — a dashboard row, or the box below. The URL is the filter (`DL-36`), so each
   * verification figure opens exactly the accounts it counted (`DL-186`).
   */
  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readAccountFilter)), {
    initialValue: readAccountFilter(this.route.snapshot.queryParamMap),
  });

  /**
   * The verification the list is narrowed to, or `null`. A narrowing of the list, never a column:
   * a row still shows name, email, role and office only (`DL-168`).
   */
  protected readonly narrowedTo = computed(() => this.filter().verificationStatus ?? null);
  protected readonly catalog = ACCOUNT_ROLE_CATALOG;
  protected readonly directory = officeDirectory(inject(OFFICE_REPOSITORY).list());

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('nameCell');
  private readonly roleCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('roleCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('actionCell');

  /** Bumped to read the list again — after a change, or on "Try again". */
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<AppAccount>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(computed(() => ({ generation: this.generation(), filter: this.filter() }))).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ filter }) =>
        toViewState(this.repository.list({ limit: PAGE_SIZE, cursor: null }, filter)),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AppAccount>> },
  );

  protected readonly rows = computed<readonly AppAccount[]>(() => [
    ...(valueOf(this.first())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.first()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly rowKey = (account: AppAccount): string => account.id;

  protected readonly columns = computed<readonly TableColumn<AppAccount>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    {
      key: 'email',
      header: this.copy.columnEmail,
      value: (account) => account.email ?? this.copy.noEmail,
    },
    { key: 'role', header: this.copy.columnRole, cell: this.roleCell() },
    { key: 'office', header: this.copy.columnOffice, value: (account) => this.officeOf(account) },
    {
      key: 'manage',
      header: this.copy.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly selected = signal<AppAccount | null>(null);

  protected isOwn(account: AppAccount): boolean {
    const user = this.session.user();
    return isOwnAccount(account, user === null ? null : String(user.id));
  }

  protected officeOf(account: AppAccount): string {
    if (account.officeId === null) {
      return this.copy.noOffice;
    }
    const name = this.directory.name(account.officeId, account.officeId);
    return takesAnOffice(account) ? name : this.copy.officeUnused(name);
  }

  protected manageLabel(account: AppAccount): string {
    return this.copy.manageLabel(account.name ?? account.email ?? this.copy.noName);
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const generation = this.generation();
    const filter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);

    this.repository
      .list({ limit: PAGE_SIZE, cursor }, filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // Read again meanwhile: this page continues a list nobody is looking at.
          if (generation === this.generation() && filter === this.filter()) {
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

  protected onVerification(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { verification: value === '' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected open(account: AppAccount): void {
    this.selected.set(account);
  }

  protected close(): void {
    this.selected.set(null);
  }

  /** Keeps the changed account in the drawer, and reads the list again from the server. */
  protected onChanged(account: AppAccount): void {
    this.selected.set(account);
    this.reload();
  }
}

/** `?verification=` read as one of the four statuses; anything else narrows nothing. */
export function readAccountFilter(params: { get(name: string): string | null }): AppAccountFilter {
  const status: AccountVerificationStatus | undefined = ACCOUNT_VERIFICATION_STATUSES.find(
    (value) => value === params.get('verification'),
  );
  return status === undefined ? {} : { verificationStatus: status };
}
