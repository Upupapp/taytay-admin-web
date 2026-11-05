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
import { EMPTY, switchMap, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { APP_ACCOUNT_REPOSITORY, type AppAccount, type CursorPage } from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { CardCheck } from './card-check';
import { CardPanel } from './card-panel';
import { DIGITAL_IDS_COPY } from './digital-ids.copy';

/** The largest page the API serves: the verified residents are a fraction of the accounts read. */
const PAGE_SIZE = 50;

/**
 * Residents' digital IDs (`DL-171`): checking the card a resident shows, and keeping the cards.
 *
 * **Two grants, two sections.** A check is `digital-id.verify` — every staff account on the server;
 * keeping cards is `digital-id.manage` — administrators alone. Each section is offered only to its
 * own, and the route opens for either.
 *
 * **A card is found through its account.** The API has no list of cards, only an account's current
 * card, so the administrator's section reads the app accounts a page at a time and shows the verified
 * residents among them — saying how many accounts that was and that more are available, never
 * presenting a filtered page as the whole registry (`DL-161`).
 */
@Component({
  selector: 'app-digital-ids-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, CardCheck, CardPanel, DataTable, Drawer, PageHeader],
  templateUrl: './digital-ids-page.html',
  styleUrl: './digital-ids.scss',
})
export class DigitalIdsPage {
  private readonly accounts = inject(APP_ACCOUNT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = DIGITAL_IDS_COPY;
  protected readonly canCheck = this.permissions.can('digital-id.verify');
  protected readonly canManage = this.permissions.can('digital-id.manage');

  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('actionCell');

  /** Bumped to read the accounts again, on "Try again". */
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<AppAccount>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      // Nobody without the grant is shown the section, so nobody without it asks for the accounts.
      switchMap(() =>
        this.canManage()
          ? toViewState(this.accounts.list({ limit: PAGE_SIZE, cursor: null }))
          : EMPTY,
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AppAccount>> },
  );

  private readonly read = computed<readonly AppAccount[]>(() => [
    ...(valueOf(this.first())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  protected readonly rows = computed(() =>
    this.read().filter((account) => account.role === 'verified'),
  );

  protected readonly readCount = computed(() => this.read().length);

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.first()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly rowKey = (account: AppAccount): string => account.id;

  protected readonly columns = computed<readonly TableColumn<AppAccount>[]>(() => [
    {
      key: 'name',
      header: this.copy.manage.columnName,
      value: (account) => account.name ?? this.copy.manage.noName,
    },
    {
      key: 'email',
      header: this.copy.manage.columnEmail,
      value: (account) => account.email ?? this.copy.manage.noEmail,
    },
    {
      key: 'card',
      header: this.copy.manage.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly selected = signal<AppAccount | null>(null);

  protected nameOf(account: AppAccount): string {
    return account.name ?? account.email ?? this.copy.manage.noName;
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;

    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.accounts
      .list({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // Read again meanwhile: this page continues a list nobody is looking at.
          if (generation === this.generation()) {
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

  protected open(account: AppAccount): void {
    this.selected.set(account);
  }

  protected close(): void {
    this.selected.set(null);
  }
}
