import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  type MonthFigure,
  type RegistryFunnel,
  type RegistryThisMonth,
  type SectorAttention,
  type SectorAttentionKind,
  type SectorCoverage,
  type SummaryFigure,
} from '@domain/index';
import { Icon } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icons';
import { LineChart, type LinePoint } from '@shared/ui/line-chart/line-chart';

import { REGISTRY_PANELS_COPY } from './registry-panels.copy';

/*
 * The registry panels the citizens' boards draw and the API now sends (`DL-232`, backend ADR 0006).
 * Each renders the inside of a panel; the page that places it owns the panel's box and its span.
 * Every figure is the server's: a withheld one says so and is never drawn as a zero (`DL-105`).
 */

/** The figure as text, or "Withheld". */
function shown(figure: SummaryFigure): string {
  return figure.value === null
    ? REGISTRY_PANELS_COPY.withheld
    : figure.value.toLocaleString('en-PH');
}

/** "Citizens on the registry": the registry at each month's end, twelve months, as a line. */
@Component({
  selector: 'app-registry-growth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChart],
  template: `
    <div class="registry-panel__head">
      <h2 id="registry-growth" class="registry-panel__title">{{ copy.growthHeading }}</h2>
      <span class="registry-panel__aside">{{ copy.growthWindow }}</span>
    </div>
    <app-line-chart
      class="registry-growth__chart"
      [points]="points()"
      [caption]="copy.growthCaption"
      [labelHeader]="copy.growthMonthHeader"
      [valueHeader]="copy.growthCountHeader"
      [withheldLabel]="copy.withheld"
      [callout]="callout()"
    />
    <p class="registry-panel__note">{{ copy.growthNote }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class RegistryGrowth {
  readonly months = input.required<readonly MonthFigure[]>();

  protected readonly copy = REGISTRY_PANELS_COPY;

  protected readonly points = computed<readonly LinePoint[]>(() =>
    this.months().map((entry) => ({
      key: entry.month,
      label: formatDate(`${entry.month}-01`, 'MMM', 'en-US'),
      longLabel: formatDate(`${entry.month}-01`, 'MMMM y', 'en-US'),
      value: entry.figure.value,
    })),
  );

  protected readonly callout = computed(() => {
    const last = this.months().at(-1)?.figure.value ?? null;
    return last === null ? '' : this.copy.growthCallout(last);
  });
}

interface FunnelStep {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly withheld: boolean;
}

/** "From the registry to a Digital ID": four steps, each narrower, as the board draws them. */
@Component({
  selector: 'app-registry-funnel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="registry-panel__head">
      <h2 id="registry-funnel" class="registry-panel__title">{{ copy.funnelHeading }}</h2>
      @if (showLink()) {
        <a class="registry-panel__link" routerLink="/digital-ids">{{ copy.funnelLink }}</a>
      }
    </div>
    <ol class="registry-funnel">
      @for (step of steps(); track step.key; let index = $index) {
        <li class="registry-funnel__step" [class]="'registry-funnel__step--' + index">
          <span>{{ step.label }}</span>
          <b [attr.title]="step.withheld ? copy.withheldHint : null">{{ step.value }}</b>
        </li>
      }
    </ol>
    <p class="registry-panel__note">{{ copy.funnelNote }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class RegistryFunnelPanel {
  readonly funnel = input.required<RegistryFunnel>();
  /** The card list is the administrator's; a reader who cannot open it is not sent there. */
  readonly showLink = input(false);

  protected readonly copy = REGISTRY_PANELS_COPY;

  protected readonly steps = computed<readonly FunnelStep[]>(() => {
    const funnel = this.funnel();
    const step = (key: keyof typeof REGISTRY_PANELS_COPY.funnelSteps, figure: SummaryFigure) => ({
      key,
      label: this.copy.funnelSteps[key],
      value: shown(figure),
      withheld: figure.withheld,
    });
    return [
      step('onRegistry', { value: funnel.onRegistry, withheld: false }),
      step('onApp', funnel.onApp),
      step('verified', funnel.verified),
      step('activeIds', funnel.activeIds),
    ];
  });
}

/** "This month": four counts in a row, each with what it counts. */
@Component({
  selector: 'app-registry-this-month',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="registry-month">
      <h2 id="registry-this-month" class="registry-panel__title registry-month__title">
        {{ copy.thisMonthHeading }}
      </h2>
      <ul class="registry-month__list">
        @for (item of items(); track item.key) {
          <li class="registry-month__item">
            <span class="registry-month__figure">{{ item.value }}</span>
            <span class="registry-month__label">{{ item.label }}</span>
          </li>
        }
      </ul>
    </div>
    <p class="registry-panel__note">{{ copy.thisMonthNote(monthName()) }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class RegistryThisMonthPanel {
  readonly thisMonth = input.required<RegistryThisMonth>();

  protected readonly copy = REGISTRY_PANELS_COPY;

  protected readonly monthName = computed(() =>
    formatDate(`${this.thisMonth().month}-01`, 'MMMM y', 'en-US'),
  );

  protected readonly items = computed(() => {
    const month = this.thisMonth();
    return (['turning60', 'turning18', 'soloParentIdsDue', 'pwdIdsExpiring'] as const).map(
      (key) => ({ key, value: shown(month[key]), label: this.copy.thisMonth[key] }),
    );
  });
}

const ATTENTION_ICONS: Readonly<Record<SectorAttentionKind, IconName>> = {
  'milestone-birthdays': 'calendar',
  centenarians: 'senior',
  'no-sector-id': 'idCard',
};

/**
 * "Needs attention" on a sector page: counts with the rule each was counted by (`DL-98`). Advice,
 * never a decision: nothing here is a link to act on a person, and nothing gates.
 */
@Component({
  selector: 'app-sector-attention',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="registry-panel__head">
      <h2 id="sector-attention" class="registry-panel__title">{{ copy.attentionHeading }}</h2>
    </div>
    <ul class="sector-attention">
      @for (item of attention(); track item.key) {
        <li class="sector-attention__item">
          <span class="sector-attention__top">
            <span class="sector-attention__tile" aria-hidden="true">
              <app-icon [name]="icon(item.key)" [size]="20" [stroke]="2" />
            </span>
            <span class="sector-attention__figure">{{ value(item) }}</span>
          </span>
          <span class="sector-attention__label">{{ item.label }}</span>
          <span class="sector-attention__basis">{{ copy.attentionBasis }} {{ item.basis }}</span>
        </li>
      }
    </ul>
    <p class="registry-panel__note">{{ copy.attentionAdvice }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class SectorAttentionPanel {
  readonly attention = input.required<readonly SectorAttention[]>();

  protected readonly copy = REGISTRY_PANELS_COPY;

  protected icon(kind: SectorAttentionKind): IconName {
    return ATTENTION_ICONS[kind];
  }

  protected value(item: SectorAttention): string {
    return shown(item.figure);
  }
}

interface CoverageRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** Share of the registry total for the bar; 0 for a withheld figure, which draws none. */
  readonly width: number;
}

/** "Benefits and IDs": how many of the sector hold each, out of the registry total. */
@Component({
  selector: 'app-sector-coverage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="registry-panel__head">
      <h2 id="sector-coverage" class="registry-panel__title">{{ heading() }}</h2>
      <span class="registry-panel__aside">{{ copy.coverageOf(total()) }}</span>
    </div>
    <ul class="sector-coverage">
      @for (row of rows(); track row.key) {
        <li class="sector-coverage__row">
          <span class="sector-coverage__label">{{ row.label }}</span>
          <span class="sector-coverage__track" aria-hidden="true">
            <i [style.width.%]="row.width"></i>
          </span>
          <span class="sector-coverage__figure">{{ row.value }}</span>
        </li>
      }
    </ul>
    <p class="registry-panel__note">{{ copy.coverageNote }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class SectorCoveragePanel {
  readonly coverage = input.required<SectorCoverage>();
  /** The registry total under the filter, taken before suppression. */
  readonly total = input.required<number>();
  readonly heading = input<string>(REGISTRY_PANELS_COPY.coverageHeading);

  protected readonly copy = REGISTRY_PANELS_COPY;

  protected readonly rows = computed<readonly CoverageRow[]>(() => {
    const coverage = this.coverage();
    const total = this.total();
    const row = (key: keyof typeof REGISTRY_PANELS_COPY.coverage, figure: SummaryFigure) => ({
      key,
      label: this.copy.coverage[key],
      value: shown(figure),
      width:
        figure.value === null || total <= 0
          ? 0
          : Math.min(100, Math.max(2, (figure.value / total) * 100)),
    });
    return [
      row('sectorIdOnFile', coverage.sectorIdOnFile),
      ...(coverage.socialPension === null ? [] : [row('socialPension', coverage.socialPension)]),
      row('appAccounts', coverage.appAccounts),
      row('digitalIds', coverage.digitalIds),
    ];
  });
}
