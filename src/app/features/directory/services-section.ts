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

import {
  listingOf,
  OFFICE_REPOSITORY,
  SERVICE_EFFECTS,
  SERVICE_LISTING_CATALOG,
  TULONG_SERVICE_REPOSITORY,
  type TulongService,
} from '@domain/index';
import { readText } from '@shared/forms/form-values';
import { officeDirectory } from '@shared/offices/office-directory';
import { failureReason } from '@shared/state/failure-reason';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { cursorList } from './cursor-list';
import { DIRECTORY_COPY } from './directory.copy';
import { ServiceForm } from './service-form';

/**
 * Tulong pages (`DL-170`): the app's catalogue a page at a time, and one page by its address.
 *
 * The API lists only what residents can browse, so a page hidden from the catalogue and not featured
 * is in no list — the section says so, and offers the one read that finds it, `GET services/{slug}`,
 * rather than letting a hidden page read as a deleted one.
 */
@Component({
  selector: 'app-services-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, Drawer, Modal, ServiceForm, StatusBadge],
  templateUrl: './services-section.html',
  styleUrl: './directory-section.scss',
})
export class ServicesSection {
  private readonly repository = inject(TULONG_SERVICE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = DIRECTORY_COPY.services;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly removeEffects = SERVICE_EFFECTS.remove;
  protected readonly listingCatalog = SERVICE_LISTING_CATALOG;
  protected readonly listingOf = listingOf;
  protected readonly offices = officeDirectory(inject(OFFICE_REPOSITORY).list());

  protected readonly list = cursorList((page) => this.repository.list(page));

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('nameCell');
  private readonly listingCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('listingCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('actionCell');

  protected readonly rowKey = (service: TulongService): string => service.id;

  protected readonly columns = computed<readonly TableColumn<TulongService>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'listing', header: this.copy.columnListing, cell: this.listingCell() },
    {
      key: 'home',
      header: this.copy.columnHome,
      value: (service) => (service.featured ? this.copy.featured : this.copy.notFeatured),
    },
    {
      key: 'office',
      header: this.copy.columnOffice,
      value: (service) =>
        service.officeId === null
          ? this.copy.noOffice
          : this.offices.name(service.officeId, service.officeId),
    },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<TulongService | 'new' | null>(null);
  protected readonly removing = signal<TulongService | null>(null);
  protected readonly removeBusy = signal(false);
  protected readonly removeProblem = signal('');
  protected readonly outcome = signal('');

  protected readonly address = signal('');
  protected readonly finding = signal(false);
  protected readonly findProblem = signal('');

  protected readonly drawerService = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  protected text(event: Event): string {
    return readText(event);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(service: TulongService): void {
    this.editing.set(service);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  /**
   * A new page stays open in the drawer, as the server answered it, so its picture can be added and
   * it can be featured — the two acts that need it to exist.
   */
  protected onSaved(service: TulongService): void {
    const previous = this.editing();
    this.outcome.set(
      previous === 'new'
        ? this.copy.created(service.name)
        : previous !== null && previous.hasImage !== service.hasImage
          ? this.copy.imageSaved(service.name)
          : this.copy.saved(service.name),
    );
    this.editing.set(service);
    this.list.reload();
  }

  protected find(): void {
    const slug = this.address().trim();
    if (slug === '' || this.finding()) {
      return;
    }
    this.finding.set(true);
    this.findProblem.set('');
    this.repository
      .find(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (service) => {
          this.finding.set(false);
          if (service === null) {
            this.findProblem.set(this.copy.notFound(slug));
          } else {
            this.editing.set(service);
          }
        },
        error: () => {
          this.finding.set(false);
          this.findProblem.set(this.copy.findFailed);
        },
      });
  }

  protected askRemove(service: TulongService): void {
    this.removeProblem.set('');
    this.removing.set(service);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected confirmRemove(): void {
    const service = this.removing();
    if (service === null || this.removeBusy()) {
      return;
    }
    this.removeBusy.set(true);
    this.removeProblem.set('');
    this.repository
      .remove(service.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeBusy.set(false);
          this.removing.set(null);
          if (this.drawerService()?.id === service.id) {
            this.editing.set(null);
          }
          this.outcome.set(this.copy.removed(service.name));
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
