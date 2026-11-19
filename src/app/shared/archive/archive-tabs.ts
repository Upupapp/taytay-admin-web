import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ARCHIVE_COPY } from './archive.copy';

/**
 * "In use | Archived" above a list whose records are archived rather than deleted (`DL-225`), held in
 * the URL like every other list filter (`DL-36`), so a reload or a colleague's link opens the same
 * one. The rest of the address is kept (`queryParamsHandling: merge`): a page's own `?section=`
 * survives the choice. Drawn as the residents list's `.tabs`, marked by words and underline, never
 * colour alone.
 */
@Component({
  selector: 'app-archive-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav [attr.aria-label]="label()">
      <ul class="tabs tabs--sub">
        <li>
          <a
            class="tab"
            [routerLink]="[]"
            [queryParams]="inUseParams()"
            queryParamsHandling="merge"
            [class.tab--active]="!archived()"
            [attr.aria-current]="archived() ? null : 'true'"
            >{{ copy.inUse }}</a
          >
        </li>
        <li>
          <a
            class="tab"
            [routerLink]="[]"
            [queryParams]="archivedParams()"
            queryParamsHandling="merge"
            [class.tab--active]="archived()"
            [attr.aria-current]="archived() ? 'true' : null"
            >{{ copy.archived }}</a
          >
        </li>
      </ul>
    </nav>
  `,
})
export class ArchiveTabs {
  /** Whether the archived records are the ones shown. */
  readonly archived = input.required<boolean>();
  /** The query parameter this list holds its choice in: `archived=true`, or absent. */
  readonly param = input('archived');
  /** Names the pair for a screen reader: "Offices: in use or archived". */
  readonly label = input.required<string>();

  protected readonly copy = ARCHIVE_COPY.tabs;
  protected readonly inUseParams = computed(() => ({ [this.param()]: null }));
  protected readonly archivedParams = computed(() => ({ [this.param()]: 'true' }));
}
