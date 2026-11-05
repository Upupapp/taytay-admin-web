import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { ServedPorts } from '@core/access/served-ports';
import { NAVIGATION, type NavItem } from '@core/navigation/navigation';
import { DATA_PORT_HOLDINGS, type DataPort } from '@domain/index';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { UNSERVED_COPY } from './unserved.copy';

interface WithheldModule {
  readonly label: string;
  readonly description: string;
  /** The ports this module reads that the API does not serve, in words. */
  readonly missing: readonly string[];
}

/**
 * The one page that names every module the connected API cannot serve (`DL-167`).
 *
 * The menu withholds those modules and their routes send people here, so this page carries the
 * whole of `DL-112`'s doctrine for them: a part of the console that is not served is **named**,
 * never silently left out. An officer who finds no "Cases" in the menu and no explanation concludes
 * the office keeps no case files — a wrong answer delivered with confidence.
 *
 * Every withheld module is listed, whatever the reader's role: what the server lacks is not a
 * secret about any record, and listing only what a role may open would make two officers describe
 * the same console differently.
 */
@Component({
  selector: 'app-unserved-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink],
  template: `
    <app-page-header [title]="copy.heading" [subtitle]="copy.subtitle" />

    @if (unserved().length === 0) {
      <section class="card">
        <p>{{ copy.everythingServed }}</p>
      </section>
    } @else {
      <section class="card unserved" aria-labelledby="unserved-meaning">
        <h2 id="unserved-meaning">{{ copy.meaningHeading }}</h2>
        @for (sentence of copy.meaning; track $index) {
          <p>{{ sentence }}</p>
        }
      </section>

      <section class="card unserved" aria-labelledby="unserved-modules">
        <h2 id="unserved-modules">{{ copy.modulesHeading }}</h2>
        <ul class="unserved__list">
          @for (module of withheld(); track module.label) {
            <li>
              <strong>{{ module.label }}.</strong>
              {{ module.description }}
              {{ copy.needs(module.missing) }}
            </li>
          }
        </ul>
      </section>

      <section class="card unserved" aria-labelledby="unserved-ports">
        <h2 id="unserved-ports">{{ copy.portsHeading }}</h2>
        <p>{{ copy.portsLead }}</p>
        <ul class="unserved__list">
          @for (holding of unservedHoldings(); track holding) {
            <li>{{ copy.portSentence(holding) }}</li>
          }
        </ul>
      </section>
    }

    <section class="card unserved" aria-labelledby="unserved-available">
      <h2 id="unserved-available">{{ copy.availableHeading }}</h2>
      @if (available().length > 0) {
        <ul class="unserved__list">
          @for (item of available(); track item.route) {
            <li>
              <a [routerLink]="item.route">{{ item.label }}</a> — {{ item.description }}
            </li>
          }
        </ul>
      } @else {
        <p>{{ copy.nothingAvailable }}</p>
      }
    </section>
  `,
  styles: `
    .unserved {
      display: grid;
      gap: var(--space-snug);
      margin-block-start: var(--space-section);
    }

    .unserved__list {
      display: grid;
      gap: var(--space-compact);
      margin: 0;
      padding-inline-start: var(--space-section);
    }
  `,
})
export class UnservedPage {
  private readonly served = inject(ServedPorts);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = UNSERVED_COPY;

  private readonly modules: readonly NavItem[] = NAVIGATION.flatMap((section) => section.items);

  protected readonly unserved = computed<readonly DataPort[]>(() => this.served.unserved);

  protected readonly unservedHoldings = computed<readonly string[]>(() =>
    this.unserved().map((port) => DATA_PORT_HOLDINGS[port]),
  );

  protected readonly withheld = computed<readonly WithheldModule[]>(() =>
    this.modules
      .filter((item) => !this.served.servesAll(item.reads))
      .map((item) => ({
        label: item.label,
        description: item.description,
        missing: item.reads
          .filter((port) => !this.served.servesAll([port]))
          .map((port) => DATA_PORT_HOLDINGS[port]),
      })),
  );

  /** The same filter the menu applies, so this list and the menu never disagree. */
  protected readonly available = computed<readonly NavItem[]>(() =>
    this.modules.filter(
      (item) => this.served.servesAll(item.reads) && this.permissions.hasAny(item.permissions),
    ),
  );
}
