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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DIRECTORY_OFFICE_REPOSITORY, OFFICE_EFFECTS, type DirectoryOffice } from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

import { cursorList } from './cursor-list';
import { DIRECTORY_COPY } from './directory.copy';
import { OfficeForm } from './office-form';

/**
 * The offices of the residents' app directory (`DL-170`): a page at a time, added and changed in a
 * drawer, deleted behind a confirmation that lists what deleting does — including that the server
 * refuses while anything still names the office.
 */
@Component({
  selector: 'app-offices-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, Icon, Modal, OfficeForm],
  templateUrl: './offices-section.html',
  styleUrl: './directory-section.scss',
})
export class OfficesSection {
  private readonly repository = inject(DIRECTORY_OFFICE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = DIRECTORY_COPY.offices;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly removeEffects = OFFICE_EFFECTS.remove;

  protected readonly list = cursorList((page) => this.repository.list(page));

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: DirectoryOffice }>>('nameCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: DirectoryOffice }>>('actionCell');

  protected readonly rowKey = (office: DirectoryOffice): string => office.id;

  protected readonly columns = computed<readonly TableColumn<DirectoryOffice>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'slug', header: this.copy.columnAddress, value: (office) => office.slug },
    {
      key: 'category',
      header: this.copy.columnCategory,
      value: (office) => office.category ?? this.copy.noCategory,
    },
    {
      key: 'banner',
      header: this.copy.columnBanner,
      value: (office) => (office.hasBanner ? this.copy.hasBanner : this.copy.noBanner),
    },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  /** The office in the drawer: one to change, `'new'` to add one, or nothing. */
  protected readonly editing = signal<DirectoryOffice | 'new' | null>(null);
  protected readonly removing = signal<DirectoryOffice | null>(null);
  protected readonly removeBusy = signal(false);
  protected readonly removeProblem = signal('');
  /** The live region's text: what the last act did. */
  protected readonly outcome = signal('');

  protected readonly drawerOffice = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(office: DirectoryOffice): void {
    this.editing.set(office);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  protected onSaved(office: DirectoryOffice): void {
    const wasNew = this.editing() === 'new';
    this.outcome.set(wasNew ? this.copy.created(office.name) : this.copy.saved(office.name));
    this.editing.set(null);
    this.list.reload();
  }

  protected askRemove(office: DirectoryOffice): void {
    this.removeProblem.set('');
    this.removing.set(office);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected confirmRemove(): void {
    const office = this.removing();
    if (office === null || this.removeBusy()) {
      return;
    }
    this.removeBusy.set(true);
    this.removeProblem.set('');
    this.repository
      .remove(office.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeBusy.set(false);
          this.removing.set(null);
          this.outcome.set(this.copy.removed(office.name));
          this.list.reload();
        },
        error: (failure: unknown) => {
          this.removeBusy.set(false);
          this.removeProblem.set(
            this.listCopy.notDone(failureReason(failure) ?? this.listCopy.failed),
          );
        },
      });
  }
}
