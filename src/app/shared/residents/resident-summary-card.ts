import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ageInYears,
  barangayName,
  SEX_LABELS,
  VULNERABILITY_SECTOR_LABELS,
  type ResidentView,
  type VulnerabilitySector,
} from '@domain/index';

/**
 * One resident, said the same way everywhere.
 *
 * Used for a household member, a picker result and a linked party on a case, so
 * that the identity of a person does not get re-described slightly differently
 * on every screen — which is how two records for the same person end up in a
 * registry.
 *
 * It renders a `ResidentView`, never a `Resident`. That is the point: the card
 * can only show what the data layer disclosed, and it states plainly when
 * something was withheld rather than leaving a blank that reads as
 * "not recorded" (`DL-38`).
 */
@Component({
  selector: 'app-resident-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @let subject = view();

    <article class="rsc" [class.rsc--compact]="compact()">
      <div class="rsc__heading">
        @if (routerLink(); as link) {
          <a class="rsc__name" [routerLink]="link">{{ subject.listedName }}</a>
        } @else {
          <span class="rsc__name">{{ subject.listedName }}</span>
        }

        @if (relationship(); as text) {
          <span class="rsc__relationship">{{ text }}</span>
        }
      </div>

      <p class="rsc__meta">{{ meta() }}</p>

      @if (subject.isProtected) {
        <p class="rsc__protected">
          <span class="rsc__protected-tag">Protected record</span>
          <span class="rsc__protected-note">{{ protectedNote() }}</span>
        </p>
      }

      @if (sectors().length > 0) {
        <ul class="rsc__sectors">
          @for (sector of sectors(); track sector) {
            <li class="rsc__sector">{{ label(sector) }}</li>
          }
        </ul>
      }

      @if (!subject.resident.isActive) {
        <p class="rsc__inactive">Retired from the active registry</p>
      }

      @if (withheldCount() > 0) {
        <p class="rsc__withheld">
          {{ withheldCount() }} detail{{ withheldCount() === 1 ? '' : 's' }} hidden by your role
        </p>
      }

      <div class="rsc__actions">
        <ng-content select="[card-actions]"></ng-content>
      </div>
    </article>
  `,
  styleUrl: './resident-summary-card.scss',
})
export class ResidentSummaryCard {
  readonly view = input.required<ResidentView>();
  /** Where the name links to. Omit for a card inside a picker list. */
  readonly routerLink = input<string | null>(null);
  /** "Spouse", "Household head" — supplied by the caller that knows the context. */
  readonly relationship = input<string | null>(null);
  /** `booleanAttribute` so `<app-resident-summary-card compact />` type-checks. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly sectors = computed(() => this.view().resident.sectors);
  protected readonly withheldCount = computed(() => this.view().withheld.length);

  protected readonly meta = computed(() => {
    const resident = this.view().resident;
    return [
      `${ageInYears(resident.birthDate)} yrs`,
      SEX_LABELS[resident.sex],
      barangayName(resident.address.barangayId),
    ].join(' · ');
  });

  protected readonly protectedNote = computed(() =>
    this.view().withheld.includes('protectedSectors')
      ? 'Handle with care. Details are restricted.'
      : 'Handle with care under RA 9262 / RA 9344.',
  );

  protected label(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }
}
