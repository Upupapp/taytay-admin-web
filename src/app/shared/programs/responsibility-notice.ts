import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { decidesElsewhere, isNationalAgency, type ProgramResponsibility } from '@domain/index';

import { PROGRAM_COPY } from './program.copy';

/**
 * Whose programme this is, said in the office's own words.
 *
 * The wording is **read from the record**, never composed from a condition in
 * this template. That is what makes TAB 12's third criterion maintainable: a
 * correction to how the office describes its part in AICS is an edit to one
 * field, not a hunt through components (`DL-65`).
 *
 * The one thing the component adds is emphasis: where the office does not
 * decide the outcome, it says so plainly, because "we referred it" and "we
 * approved it" are the two sentences an applicant most needs told apart.
 */
@Component({
  selector: 'app-responsibility-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let record = responsibility();

    <section class="responsibility" aria-labelledby="responsibility-heading">
      <h3 class="responsibility__heading" id="responsibility-heading">{{ copy.heading }}</h3>

      <p class="responsibility__badges">
        <span class="responsibility__badge">{{ agencyLabel(record.administeredBy) }}</span>
        <span class="responsibility__badge">{{ roleLabel(record.lguRole) }}</span>
        @if (record.fundsHeldBy !== record.administeredBy) {
          <span class="responsibility__badge">
            {{ copy.fundsHeldBy }}: {{ agencyLabel(record.fundsHeldBy) }}
          </span>
        }
      </p>

      <!-- Straight from the record. Nothing here is assembled from an if. -->
      <p class="responsibility__statement">{{ record.statement }}</p>

      @if (elsewhere()) {
        <p class="responsibility__elsewhere">{{ copy.decidedElsewhere }}</p>
      }

      @if (record.sources.length > 0) {
        <h4 class="responsibility__sources-heading">{{ copy.sourcesHeading }}</h4>
        <ul class="responsibility__sources">
          @for (source of record.sources; track source.url) {
            <li>
              <a [href]="source.url" rel="noopener noreferrer" target="_blank">{{
                source.title
              }}</a>
              <!-- An unread citation says so rather than borrowing the authority
                   of one somebody checked (CLAUDE.md §6). -->
              <span class="responsibility__verified">
                {{ source.verifiedOn === null ? copy.notVerified : copy.verifiedOn }}
              </span>
            </li>
          }
        </ul>
      } @else if (national()) {
        <p class="responsibility__missing">{{ copy.nationalWithoutSource }}</p>
      }
    </section>
  `,
  styleUrl: './responsibility-notice.scss',
})
export class ResponsibilityNotice {
  readonly responsibility = input.required<ProgramResponsibility>();

  protected readonly copy = PROGRAM_COPY.responsibility;

  protected readonly elsewhere = computed(() => decidesElsewhere(this.responsibility()));
  protected readonly national = computed(() =>
    isNationalAgency(this.responsibility().administeredBy),
  );

  protected agencyLabel(agency: ProgramResponsibility['administeredBy']): string {
    return PROGRAM_COPY.agencyLabel[agency];
  }

  protected roleLabel(role: ProgramResponsibility['lguRole']): string {
    return PROGRAM_COPY.roleLabel[role];
  }
}
