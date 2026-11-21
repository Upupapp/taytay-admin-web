import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { AttentionSeverity, AttentionSignal } from '@domain/index';
import { Icon } from '@shared/ui/icon/icon';

import { DASHBOARD_COPY } from './dashboard.copy';
import type { DrillDown } from './dashboard-drill-down';

export interface AttentionCard {
  readonly signal: AttentionSignal;
  readonly message: string;
  /** The message without its figure, which the screen sets large beside it. */
  readonly noun: string;
  readonly severityLabel: string;
  readonly drillDown: DrillDown;
}

export interface AttentionGroup {
  readonly severity: AttentionSeverity;
  readonly label: string;
  readonly total: number;
  readonly cards: readonly AttentionCard[];
}

/**
 * "What needs attention now": the dashboard's first answer, as the Main mock-up draws it. The page
 * decides what is shown — which signals this role may act on, in `sortAttention`'s order — and
 * this only lays it out, a heading per urgency with its figures and the rule each was counted by.
 */
@Component({
  selector: 'app-dashboard-attention',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  template: `
    <section class="card card--panel attention" aria-labelledby="attention-heading">
      <div class="attention__head">
        <h2 id="attention-heading" class="section-title section-title--display">
          {{ copy.attentionHeading }}
        </h2>
        <span
          class="icon-tile icon-tile--sm icon-tile--round icon-tile--red-soft"
          aria-hidden="true"
        >
          <app-icon name="bell" [stroke]="2" />
        </span>
      </div>

      @if (hasAny()) {
        <div class="attention__list">
          @for (group of groups(); track group.severity) {
            @if (group.cards.length > 0) {
              <!-- Severity is stated in words as well as shown by tone, so the
                   ranking survives without colour; then how many items it holds. -->
              <h3 class="attention__group" [class]="'attention__group--' + group.severity">
                <span class="attention__dot" aria-hidden="true"></span>
                <span class="attention__severity">{{ group.label }}</span>
                <span class="attention__group-count">{{ copy.attentionItems(group.cards.length) }}</span>
              </h3>
              <ul class="attention__items">
                @for (card of group.cards; track card.signal.kind) {
                  @let open = isOpen(card);
                  <li class="attention__item" [class]="'attention__item--' + card.signal.severity">
                    <span class="attention__count">{{ card.signal.count }}</span>
                    <span class="attention__message">{{ card.noun }}</span>
                    <button
                      type="button"
                      class="icon-button attention__how"
                      [attr.aria-expanded]="open"
                      [attr.aria-controls]="'attention-basis-' + card.signal.kind"
                      [attr.aria-label]="copy.attentionHow"
                      [title]="copy.attentionHow"
                      (click)="toggle(card)"
                    >
                      <app-icon name="info" [size]="17" [stroke]="2" />
                    </button>
                    <a
                      class="attention__action"
                      [routerLink]="card.drillDown.route"
                      [queryParams]="card.drillDown.queryParams"
                    >
                      {{ copy.attentionAction }}
                      <span class="visually-hidden">— {{ card.message }}</span>
                      <app-icon name="arrowRight" [size]="13" [stroke]="2.2" />
                    </a>
                    <!-- The rule the server counted by, so the figure can be checked (DL-98): folded
                         behind the button as the board draws it (DL-233), never removed. -->
                    <p
                      class="attention__basis"
                      [id]="'attention-basis-' + card.signal.kind"
                      [hidden]="!open"
                    >
                      {{ copy.attentionBasis }} {{ card.signal.basis }}
                    </p>
                  </li>
                }
              </ul>
            }
          }
        </div>
        <!-- The sums, said once, in three tiles at the foot as the board draws them (DL-233). The
             figure is drawn above its label (column-reverse), so dt stays before dd. -->
        <dl class="tally-row attention__totals">
          @for (group of groups(); track group.severity) {
            <div
              class="tally tally--figure-first"
              [class.tally--red]="group.severity === 'critical'"
              [class.tally--gold]="group.severity === 'warning'"
              [class.tally--soft]="group.severity === 'info'"
            >
              <dt class="tally__label">{{ group.label }}</dt>
              <dd class="tally__value">{{ group.total }}</dd>
            </div>
          }
        </dl>
      } @else {
        <div class="attention__clear">
          <h3 class="section-title">{{ copy.attentionEmptyHeading }}</h3>
          <p class="attention__clear-body">
            {{ hiddenByRole() ? copy.attentionNothingForRole : copy.attentionEmptyBody }}
          </p>
        </div>
      }
    </section>
  `,
  styleUrl: './dashboard-attention.scss',
})
export class DashboardAttention {
  readonly groups = input.required<readonly AttentionGroup[]>();
  /** Work exists, but none of it is this role's to act on. */
  readonly hiddenByRole = input(false);

  protected readonly copy = DASHBOARD_COPY;
  protected readonly hasAny = computed(() => this.groups().some((group) => group.cards.length > 0));

  /** Which signals' rules are unfolded; for this view only. */
  private readonly opened = signal<ReadonlySet<string>>(new Set());

  protected isOpen(card: AttentionCard): boolean {
    return this.opened().has(card.signal.kind);
  }

  protected toggle(card: AttentionCard): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (next.has(card.signal.kind)) next.delete(card.signal.kind);
      else next.add(card.signal.kind);
      return next;
    });
  }
}
