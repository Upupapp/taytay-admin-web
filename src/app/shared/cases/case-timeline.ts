import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  ASSISTANCE_STATUS_CATALOG,
  CASE_STATUS_CATALOG,
  type CaseTimelineEntry,
} from '@domain/index';

import { CASE_COPY } from './case.copy';

/**
 * The case timeline.
 *
 * An **ordered list**, newest first, and nothing else. No connectors, no dots
 * carrying meaning, no colour distinguishing one kind of entry from another —
 * every line says in words what happened, who did it, when, and why. The same
 * argument as the relationship graph (`DL-50`): a decoration that has to be
 * translated for a screen reader is a second artifact, and the second artifact
 * is the one that stops being maintained.
 *
 * A withheld entry is **shown, not hidden**. The reader is told an entry exists
 * and that their role cannot read it. Removing the line entirely would let a
 * caseworker read a partial file as a complete one, which is a worse failure
 * than knowing there is something they may not see (`DL-58`).
 */
@Component({
  selector: 'app-case-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <section class="timeline" aria-labelledby="case-timeline-heading">
      <header class="timeline__header">
        <h2 class="timeline__heading" id="case-timeline-heading">{{ heading() }}</h2>
        <p class="timeline__summary">{{ copy.summary }}</p>
      </header>

      @if (entries().length === 0) {
        <p class="timeline__empty">{{ copy.empty }}</p>
      } @else {
        <ol class="timeline__list">
          @for (entry of entries(); track entry.id) {
            <li class="timeline__entry">
              <p class="timeline__what">
                <span class="timeline__source">{{ sourceLabel(entry) }}</span>
                <span class="timeline__kind">{{ kindLabel(entry) }}</span>
                @if (movement(entry); as move) {
                  <span class="timeline__move">{{ move }}</span>
                }
              </p>

              <p class="timeline__who">
                <time class="timeline__when" [attr.datetime]="entry.occurredAt">
                  {{ entry.occurredAt | date: 'd MMM y, HH:mm' }}
                </time>
                <span class="timeline__by">{{ copy.by }} {{ entry.actorName }}</span>
                @if (entry.reference) {
                  <span class="timeline__reference">{{ entry.reference }}</span>
                }
              </p>

              @if (entry.isWithheld) {
                <p class="timeline__withheld">
                  <span class="timeline__withheld-tag">{{ copy.withheld }}</span>
                  <span class="timeline__withheld-hint">{{ copy.withheldHint }}</span>
                </p>
              } @else if (entry.detail) {
                <p class="timeline__detail">{{ entry.detail }}</p>
              }

              @if (entry.reason) {
                <p class="timeline__reason">
                  <span class="timeline__reason-label">{{ copy.reasonGiven }}:</span>
                  {{ entry.reason }}
                </p>
              } @else if (needsReason(entry)) {
                <p class="timeline__reason timeline__reason--absent">{{ copy.noReason }}</p>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styleUrl: './case-timeline.scss',
})
export class CaseTimeline {
  readonly entries = input.required<readonly CaseTimelineEntry[]>();
  readonly heading = input(CASE_COPY.timeline.heading);

  protected readonly copy = CASE_COPY.timeline;

  protected readonly withheldCount = computed(
    () => this.entries().filter((entry) => entry.isWithheld).length,
  );

  protected sourceLabel(entry: CaseTimelineEntry): string {
    return CASE_COPY.sourceLabel[entry.source];
  }

  protected kindLabel(entry: CaseTimelineEntry): string {
    return CASE_COPY.eventLabel[entry.kind];
  }

  /** "from Assessment to Intervention", written out rather than drawn. */
  protected movement(entry: CaseTimelineEntry): string | null {
    const { movedFrom, movedTo } = CASE_COPY.timeline;
    if (entry.toCaseStatus !== null) {
      const to = CASE_STATUS_CATALOG[entry.toCaseStatus].label;
      return entry.fromCaseStatus === null
        ? `${movedTo} ${to}`
        : `${movedFrom} ${CASE_STATUS_CATALOG[entry.fromCaseStatus].label} ${movedTo} ${to}`;
    }
    if (entry.toRequestStatus !== null) {
      const to = ASSISTANCE_STATUS_CATALOG[entry.toRequestStatus].label;
      return entry.fromRequestStatus === null
        ? `${movedTo} ${to}`
        : `${movedFrom} ${ASSISTANCE_STATUS_CATALOG[entry.fromRequestStatus].label} ${movedTo} ${to}`;
    }
    return null;
  }

  /**
   * A lifecycle move with no reason is a gap worth naming. A note carries its
   * own words and a completed task its outcome, so neither is missing anything.
   */
  protected needsReason(entry: CaseTimelineEntry): boolean {
    return entry.toCaseStatus !== null || entry.toRequestStatus !== null;
  }
}
