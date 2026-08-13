import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, switchMap } from 'rxjs';

import {
  ASSISTANCE_STATUS_CATALOG,
  DASHBOARD_REPOSITORY,
  PROGRAM_CATEGORY_LABELS,
  type DashboardSummary,
  type ProgramCategory,
} from '@domain/index';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { BarangayNamePipe } from '@shared/pipes/barangay-name.pipe';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

/**
 * Office overview. Reads through `DASHBOARD_REPOSITORY` only, so it renders
 * identically against the mock and HTTP adapters.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, BarangayNamePipe, PageHeader, PesoPipe, StatusBadge],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly repository = inject(DASHBOARD_REPOSITORY);
  private readonly reload = new BehaviorSubject<void>(undefined);

  protected readonly statusCatalog = ASSISTANCE_STATUS_CATALOG;

  protected categoryLabel(category: ProgramCategory): string {
    return PROGRAM_CATEGORY_LABELS[category];
  }

  protected readonly state = toSignal(
    this.reload.pipe(switchMap(() => toViewState(this.repository.summary()))),
    { initialValue: LOADING as ViewState<DashboardSummary> },
  );

  protected refresh(): void {
    this.reload.next();
  }
}
