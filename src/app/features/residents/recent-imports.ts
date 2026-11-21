import { ChangeDetectionStrategy, Component, inject, LOCALE_ID, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  RESIDENT_IMPORT_REPOSITORY,
  type CursorPage,
  type ResidentImportSummary,
} from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Icon } from '@shared/ui/icon/icon';

import { REGISTRY_PANELS_COPY } from './registry-panels.copy';

/** What the recent-imports panel re-reads on: a list imported, and the registry it changed. */
export const RECENT_IMPORTS_TOPICS: readonly LiveTopic[] = ['imports', 'residents'];

/** "Recent imports": the newest four lists, from the import list's first page (`DL-161`). */
@Component({
  selector: 'app-recent-imports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, Icon, RouterLink],
  template: `
    <div class="registry-panel__head">
      <h2 id="registry-imports" class="registry-panel__title">{{ copy.importsHeading }}</h2>
      <a class="registry-panel__link" routerLink="/residents/import">{{ copy.importsLink }}</a>
    </div>
    <app-async-content
      [state]="state()"
      [content]="list"
      [skeletonLines]="3"
      [errorHeading]="copy.importsError"
      [retryLabel]="copy.importsRetry"
      (retryRequested)="retry()"
    />
    <ng-template #list let-page>
      @if (page.items.length === 0) {
        <p class="registry-panel__note">{{ copy.importsEmpty }}</p>
      } @else {
        <ul class="registry-imports">
          @for (item of page.items.slice(0, 4); track item.id) {
            <li class="registry-imports__item">
              <span class="registry-imports__tile" aria-hidden="true">
                <app-icon name="file" [size]="16" [stroke]="2" />
              </span>
              <span class="registry-imports__words">
                <span class="registry-imports__name">{{ item.fileName }}</span>
                <span class="registry-imports__meta">{{ meta(item) }}</span>
                <span class="registry-imports__source">{{ sourceOf(item) }}</span>
              </span>
              <span class="registry-imports__outcome">
                @if (item.result; as result) {
                  <span>{{ copy.importAdded(result.created, result.attached) }}</span>
                  <span class="registry-imports__other">{{
                    copy.importOther(result.skipped, result.errors)
                  }}</span>
                } @else {
                  <span class="registry-imports__other">{{ copy.importOpen }}</span>
                }
              </span>
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
  styleUrl: './registry-panels.scss',
})
export class RecentImports {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly locale = inject(LOCALE_ID);

  protected readonly copy = REGISTRY_PANELS_COPY;

  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      switchMap(() =>
        liveViewState(
          () => this.repository.list({ limit: 4, cursor: null }),
          this.live.changes(RECENT_IMPORTS_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<ResidentImportSummary>> },
  );

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected meta(item: ResidentImportSummary): string {
    const when = formatDisplayDate(item.committedAt ?? item.createdAt, 'date', this.locale) ?? '';
    return this.copy.importMeta(when, item.committedBy ?? item.createdBy, item.rowCount);
  }

  protected sourceOf(item: ResidentImportSummary): string {
    return item.source === null ? this.copy.importSourceNotSaid : this.copy.sources[item.source];
  }
}
