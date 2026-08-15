import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  ASSISTANCE_STATUS_CATALOG,
  DISBURSEMENT_STATUS_CATALOG,
  ENROLLMENT_STATUS_CATALOG,
  REFERRAL_STATUS_CATALOG,
  TIMELINE_EVENT_KIND_LABELS,
  groupTimelineByYear,
  type AssistanceTimelineEntry,
  type StatusDescriptor,
} from '@domain/index';

import { PesoPipe } from '../pipes/peso.pipe';

/**
 * One person's assistance history, as an ordered list.
 *
 * Built on the same argument as the case timeline (`DL-56`) and the relationship
 * graph (`DL-50`): an **ordered list, newest first**, with no connectors and no
 * dot whose colour carries meaning. Every line says in words what happened,
 * when, under which programme, and what the record it came from is called.
 *
 * The year headings are the one piece of structure, because the question this
 * screen is usually asked — "when did we last help this family?" — is answered
 * by looking at how far back the list goes.
 *
 * Four status vocabularies meet here and stay four: each entry is rendered with
 * the catalog that already defines its wording and tone, rather than flattened
 * into a fifth vocabulary that would then have to be kept in step with all of
 * them.
 */
@Component({
  selector: 'app-assistance-history-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PesoPipe],
  template: `
    <section class="history" [attr.aria-labelledby]="headingId()">
      <header class="history__header">
        <h2 class="history__heading" [id]="headingId()">{{ heading() }}</h2>
        @if (hint()) {
          <p class="history__hint">{{ hint() }}</p>
        }
      </header>

      @if (entries().length === 0) {
        <p class="history__empty">{{ emptyMessage() }}</p>
      } @else {
        @for (year of years(); track year.year) {
          <h3 class="history__year">{{ year.year }}</h3>
          <ol class="history__list">
            @for (entry of year.entries; track entry.key) {
              <li class="history__entry">
                <p class="history__what">
                  <span class="history__kind">{{ kindLabel(entry) }}</span>
                  <span class="history__status" [attr.data-tone]="describe(entry).tone">
                    {{ describe(entry).label }}
                  </span>
                  @if (entry.amount && entry.amount.centavos > 0) {
                    <span class="history__amount">{{ entry.amount | peso }}</span>
                  }
                </p>

                <p class="history__summary">{{ entry.summary }}</p>

                <p class="history__meta">
                  <time class="history__when" [attr.datetime]="entry.occurredAt">
                    {{ entry.occurredAt | date: 'd MMM y' }}
                  </time>
                  <!-- The reference is what makes a line checkable: every row on
                       this list names a record somebody can open. -->
                  <span class="history__reference">{{ entry.reference }}</span>
                </p>
              </li>
            }
          </ol>
        }
      }
    </section>
  `,
  styleUrl: './assistance-history-timeline.scss',
})
export class AssistanceHistoryTimeline {
  readonly entries = input.required<readonly AssistanceTimelineEntry[]>();
  readonly heading = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly emptyMessage = input.required<string>();
  readonly headingId = input('assistance-history-heading');

  protected readonly years = computed(() => groupTimelineByYear(this.entries()));

  protected kindLabel(entry: AssistanceTimelineEntry): string {
    return TIMELINE_EVENT_KIND_LABELS[entry.kind];
  }

  /**
   * Reads the entry's status with its own catalog. The union is discriminated,
   * so adding a fifth source type is a compile error here rather than a silently
   * unlabelled row.
   */
  protected describe(entry: AssistanceTimelineEntry): StatusDescriptor<string> {
    switch (entry.status.catalog) {
      case 'request':
        return ASSISTANCE_STATUS_CATALOG[entry.status.value];
      case 'disbursement':
        return DISBURSEMENT_STATUS_CATALOG[entry.status.value];
      case 'referral':
        return REFERRAL_STATUS_CATALOG[entry.status.value];
      case 'enrollment':
        return ENROLLMENT_STATUS_CATALOG[entry.status.value];
    }
  }
}
