import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  WORK_PRIORITY_CATALOG,
  WORK_REPOSITORY,
  WORK_SOURCE_LABELS,
  describeLateness,
  describeWaiting,
  todayAsIsoDate,
  type TeamQueue,
  type WorkItem,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { WORK_COPY } from './work.copy';

/**
 * Who is carrying what, and where it is late.
 *
 * Grouped **by person** rather than pooled, because a supervisor's question is
 * about people and a pooled list answers a different one. Whoever is most
 * behind sorts first; unassigned work sorts last and is labelled as a gap
 * rather than as somebody's caseload — work nobody picked up is the office's
 * most common failure, and burying it in a pool is how it stays that way.
 *
 * Behind `staff.view`, because seeing a colleague's caseload is supervision
 * rather than a default. The route guard and the adapter both say so.
 */
@Component({
  selector: 'app-team-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink, StatusBadge],
  templateUrl: './team-queue-page.html',
  styleUrl: './team-queue-page.scss',
})
export class TeamQueuePage {
  private readonly work = inject(WORK_REPOSITORY);

  protected readonly copy = WORK_COPY.team;
  protected readonly queueCopy = WORK_COPY.queue;
  protected readonly priorityCatalog = WORK_PRIORITY_CATALOG;
  protected readonly today = todayAsIsoDate();

  protected readonly state = toSignal(toViewState(this.work.teamQueue(this.today)), {
    initialValue: LOADING as ViewState<TeamQueue>,
  });

  protected readonly members = computed(() => valueOf(this.state())?.members ?? []);
  protected readonly hasAny = computed(() => this.members().length > 0);

  protected lateness(item: WorkItem): string | null {
    return describeLateness(item, this.today);
  }

  protected waiting(item: WorkItem): string | null {
    return describeWaiting(item, this.today);
  }

  protected sourceLabel(item: WorkItem): string {
    return WORK_SOURCE_LABELS[item.source];
  }
}
