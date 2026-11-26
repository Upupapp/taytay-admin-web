import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { NotConnected } from '@core/access/not-connected';
import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  RESIDENT_REPOSITORY,
  type BarangayId,
  type ResidentSummary,
  type SummaryFigure,
} from '@domain/index';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ChartTable } from '@shared/ui/chart-table/chart-table';
import { Icon } from '@shared/ui/icon/icon';
import { JumpLink } from '@shared/ui/jump-link/jump-link';
import type { IconName } from '@shared/ui/icon/icons';

import { SectorAttentionPanel, SectorCoveragePanel } from './registry-panels';
import { REGISTRY_PANELS_COPY } from './registry-panels.copy';
import type { SectorPageSector } from './residents.copy';

/**
 * What a sector's figures count (`DL-222`): its members on the registry, and — for the coverage
 * and the funnel's app and card figures — the residents' app accounts' verification and cards.
 */
export const SECTOR_FIGURES_TOPICS: readonly LiveTopic[] = [
  'residents',
  'verification',
  'digital-ids',
];

interface SectorKpi {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly icon: IconName;
  readonly tone: string;
  /** The heading of the part of the page that shows what it counts, or `null` (`DL-273`). */
  readonly jump: string | null;
  /** Where the jump goes, in words, read after the figure. */
  readonly says: string;
}

const SECTOR_ICON: Readonly<Record<SectorPageSector, { icon: IconName; tone: string }>> = {
  'senior-citizen': { icon: 'senior', tone: 'navy' },
  pwd: { icon: 'accessible', tone: 'sky' },
  'solo-parent': { icon: 'soloParent', tone: 'gold' },
};

/**
 * A sector page's figures, above its list, as the three sector boards draw them (`DL-232`): four
 * counts, the members by barangay, the sector's own breakdown, its benefits and IDs, and what
 * needs attention — every figure the server's, from `GET office/residents/summary?sector=`, under
 * the same barangay as the list. A withheld figure says so (`DL-105`); nothing is summed here.
 */
@Component({
  selector: 'app-sector-figures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    ChartTable,
    Icon,
    JumpLink,
    NgTemplateOutlet,
    NotConnected,
    SectorAttentionPanel,
    SectorCoveragePanel,
  ],
  template: `
    <app-async-content
      [state]="state()"
      [content]="figures"
      [skeletonLines]="6"
      [errorHeading]="copy.sectorErrorHeading"
      (retryRequested)="retry()"
    />
    <ng-template #figures let-summary>
      <div class="sector-figures">
        <!-- The shared strip (DL-253): label row, figure, the page's own hint. -->
        <section class="kpi-strip" [attr.aria-label]="copy.sectorFiguresLabel">
          @for (kpi of kpis(summary); track kpi.key) {
            <!-- A figure is the link to the part of this page that shows it (DL-273): the members
                 to the list below, the IDs and benefits to their panel; one nothing lists is text. -->
            @if (kpi.jump; as target) {
              <a class="kpi-strip__cell" [appJumpTo]="target">
                <ng-container *ngTemplateOutlet="cell; context: { $implicit: kpi }" />
                <span class="visually-hidden">{{ kpi.says }}</span>
              </a>
            } @else {
              <div class="kpi-strip__cell">
                <ng-container *ngTemplateOutlet="cell; context: { $implicit: kpi }" />
              </div>
            }
          }
          <ng-template #cell let-kpi>
            <span class="kpi-strip__label">
              <span [class]="'icon-tile kpi-strip__tile icon-tile--' + kpi.tone" aria-hidden="true">
                <app-icon [name]="kpi.icon" [size]="15" [stroke]="2" />
              </span>
              <span class="kpi-strip__name">{{ kpi.label }}</span>
            </span>
            <span class="kpi-strip__value">{{ kpi.value }}</span>
            <span class="kpi-strip__hint kpi-strip__hint--note">{{ kpi.hint }}</span>
          </ng-template>
        </section>

        <div class="sector-figures__bento">
          <section class="sector-figures__panel" aria-labelledby="sector-by-barangay">
            <h2 id="sector-by-barangay" class="sector-figures__title">{{ copy.byBarangay }}</h2>
            <app-chart-table
              class="chart-table--quiet"
              [caption]="summary.byBarangay.title"
              [summary]="summary.byBarangay.summary"
              [labelHeader]="summary.byBarangay.labelHeader"
              [valueHeader]="summary.byBarangay.valueHeader"
              [rows]="summary.byBarangay.rows"
            />
            <p class="sector-figures__note">{{ copy.total(summary.byBarangay.total) }}</p>
          </section>

          @switch (sector()) {
            @case ('pwd') {
              @if (summary.byDisabilityType; as types) {
                <section class="sector-figures__panel" aria-labelledby="sector-disability">
                  <h2 id="sector-disability" class="sector-figures__title">
                    {{ copy.disabilityType }}
                  </h2>
                  <app-chart-table
                    class="chart-table--quiet"
                    [caption]="types.title"
                    [summary]="types.summary"
                    [labelHeader]="types.labelHeader"
                    [valueHeader]="types.valueHeader"
                    [rows]="types.rows"
                  />
                  <p class="sector-figures__note">{{ copy.total(types.total) }}</p>
                  @if (types.suppressionNotice; as notice) {
                    <p class="sector-figures__note">{{ notice }}</p>
                  }
                </section>
              }
            }
            @case ('solo-parent') {
              <!-- Nothing records the children in a solo parent's care (backend ADR 0006). -->
              <section class="sector-figures__panel" aria-labelledby="sector-children">
                <h2 id="sector-children" class="sector-figures__title">
                  {{ copy.childrenInCare }}
                </h2>
                <app-not-connected figure="children-in-care" />
              </section>
            }
            @default {
              <section class="sector-figures__panel" aria-labelledby="sector-age-bands">
                <h2 id="sector-age-bands" class="sector-figures__title">{{ copy.ageBands }}</h2>
                <app-chart-table
                  class="chart-table--quiet"
                  [caption]="summary.byAgeSex.title"
                  [summary]="summary.byAgeSex.summary"
                  [labelHeader]="summary.byAgeSex.labelHeader"
                  [valueHeader]="summary.byAgeSex.valueHeader"
                  [rows]="summary.byAgeSex.rows"
                />
                <p class="sector-figures__note">{{ copy.total(summary.byAgeSex.total) }}</p>
              </section>
            }
          }

          @if (summary.coverage; as coverage) {
            <section class="sector-figures__panel" aria-labelledby="sector-coverage">
              <app-sector-coverage
                [coverage]="coverage"
                [total]="summary.residents.current"
                [heading]="coverageHeading()"
              />
            </section>
          }
        </div>

        @if (summary.attention; as attention) {
          @if (attention.length > 0) {
            <section class="sector-figures__panel" aria-labelledby="sector-attention">
              <app-sector-attention [attention]="attention" />
            </section>
          }
        }
      </div>
    </ng-template>
  `,
  styleUrl: './sector-figures.scss',
})
export class SectorFigures {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly live = inject(LiveUpdates);

  readonly sector = input.required<SectorPageSector>();
  /** The barangay the list below is narrowed to, so the figures and the list agree. */
  readonly barangayId = input<BarangayId | undefined>(undefined);

  protected readonly copy = REGISTRY_PANELS_COPY;

  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(
      computed(() => ({
        sector: this.sector(),
        barangayId: this.barangayId(),
        generation: this.generation(),
      })),
    ).pipe(
      switchMap(({ sector, barangayId }) =>
        liveViewState(
          () =>
            this.repository.summary({
              sector,
              ...(barangayId === undefined ? {} : { barangayId }),
            }),
          this.live.changes(SECTOR_FIGURES_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<ResidentSummary> },
  );

  protected readonly coverageHeading = computed(() => {
    switch (this.sector()) {
      case 'pwd':
        return this.copy.coverageHeadingServices;
      case 'solo-parent':
        return this.copy.coverageHeadingSupport;
      default:
        return this.copy.coverageHeading;
    }
  });

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected kpis(summary: ResidentSummary): readonly SectorKpi[] {
    const sector = this.sector();
    const words = this.copy.sectorKpi[sector];
    const tile = SECTOR_ICON[sector];
    const coverage = summary.coverage;
    const third =
      sector === 'senior-citizen'
        ? (coverage?.socialPension ?? null)
        : sector === 'pwd'
          ? summary.thisMonth.pwdIdsExpiring
          : summary.thisMonth.soloParentIdsDue;
    const toCoverage = { jump: 'sector-coverage', says: this.copy.sectorJumpCoverage };
    const kpis: SectorKpi[] = [
      {
        key: 'total',
        label: words.total,
        hint: this.copy.sectorTotalHint,
        value: summary.residents.current.toLocaleString('en-PH'),
        icon: tile.icon,
        tone: tile.tone,
        jump: 'sector-list-heading',
        says: this.copy.sectorJumpList,
      },
    ];
    if (coverage !== null) {
      kpis.push({
        key: 'id',
        label: words.id,
        hint: this.copy.sectorIdHint,
        value: shown(coverage.sectorIdOnFile),
        icon: 'idCard',
        tone: 'blue',
        ...toCoverage,
      });
    }
    if (third !== null) {
      kpis.push({
        key: 'third',
        label: words.third,
        hint: words.thirdHint,
        value: shown(third),
        icon: sector === 'senior-citizen' ? 'cash' : 'calendar',
        tone: 'green',
        // The social pension is a row of the coverage panel; an ID ending this month is listed
        // nowhere on the page, and the registry cannot filter by it, so that one stays text.
        ...(sector === 'senior-citizen' ? toCoverage : { jump: null, says: '' }),
      });
    }
    if (coverage !== null) {
      kpis.push({
        key: 'app',
        label: this.copy.coverage.appAccounts,
        hint: this.copy.sectorAppHint(shown(coverage.digitalIds)),
        value: shown(coverage.appAccounts),
        icon: 'phone',
        tone: 'red',
        ...toCoverage,
      });
    }
    return kpis;
  }
}

function shown(figure: SummaryFigure): string {
  return figure.value === null
    ? REGISTRY_PANELS_COPY.withheld
    : figure.value.toLocaleString('en-PH');
}
