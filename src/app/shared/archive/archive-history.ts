import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap, type Observable } from 'rxjs';

import type { ArchiveEvent } from '@domain/index';

import { IDLE, toViewState, type ViewState } from '../state/view-state';
import { AsyncContent } from '../ui/async-content/async-content';
import { ARCHIVE_COPY } from './archive.copy';

let histories = 0;

/**
 * A record's archive history (`DL-225`): every archive and restore, newest first, each saying in
 * words what was done, when, by whom and why. An ordered list and nothing else — no connectors, no
 * colour carrying meaning — for the reason `CaseTimeline` is one (`DL-56`); that primitive speaks of
 * a case's own kinds and sources, so this is its plain sibling on the shared `.soft-list`.
 *
 * It reads what it is handed: `source` is the record's history read, or `null` while there is no
 * record. Loading, the error with Try again, and "never archived" are all said.
 */
@Component({
  selector: 'app-archive-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe],
  template: `
    <section class="stack" [attr.aria-labelledby]="headingId">
      <h3 class="section-title" [id]="headingId">{{ copy.heading }}</h3>
      <p class="status-line">{{ copy.lead }}</p>
      <app-async-content
        [state]="state()"
        [content]="list"
        [skeletonLines]="2"
        [errorHeading]="copy.failed"
      >
        <ng-template #list let-events>
          @if (events.length === 0) {
            <p class="note-box">{{ copy.empty }}</p>
          } @else {
            <ol class="soft-list">
              @for (event of events; track event.id) {
                <li class="soft-row soft-row--stacked">
                  <span>
                    <strong>{{ event.act === 'archived' ? copy.archived : copy.restored }}</strong>
                    <time [attr.datetime]="event.occurredAt">
                      {{ event.occurredAt | date: 'd MMM y, HH:mm' }}</time
                    >
                    {{ copy.by }} {{ event.actorName }}
                  </span>
                  <span class="soft-row__meta">
                    @if (event.reason) {
                      {{ copy.reasonGiven }}: {{ event.reason }}
                    } @else {
                      {{ copy.noReason }}
                    }
                  </span>
                </li>
              }
            </ol>
          }
        </ng-template>
      </app-async-content>
    </section>
  `,
})
export class ArchiveHistory {
  readonly source = input.required<Observable<readonly ArchiveEvent[]> | null>();

  protected readonly copy = ARCHIVE_COPY.history;
  protected readonly headingId = `archive-history-${++histories}`;

  protected readonly state = toSignal(
    toObservable(this.source).pipe(
      switchMap((source) =>
        source === null ? of(IDLE as ViewState<readonly ArchiveEvent[]>) : toViewState(source),
      ),
    ),
    { initialValue: IDLE as ViewState<readonly ArchiveEvent[]> },
  );
}
