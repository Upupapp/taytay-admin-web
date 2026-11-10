import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { ServedPorts } from '@core/access/served-ports';
import { NAVIGATION, type NavItem } from '@core/navigation/navigation';
import { DATA_PORT_HOLDINGS, type DataPort } from '@domain/index';
import { Icon } from '@shared/ui/icon/icon';
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
  imports: [Icon, PageHeader, RouterLink],
  template: `
    <app-page-header [title]="copy.heading" [subtitle]="copy.subtitle" />

    <div class="unserved-grid">
      @if (unserved().length === 0) {
        <section class="card card--padded unserved">
          <p class="callout callout--success">
            <app-icon name="success" [size]="18" [stroke]="2" />
            <span>{{ copy.everythingServed }}</span>
          </p>
        </section>
      } @else {
        <section class="card card--padded unserved" aria-labelledby="unserved-meaning">
          <h2 id="unserved-meaning" class="section-title">{{ copy.meaningHeading }}</h2>
          @for (sentence of copy.meaning; track $index) {
            <p>{{ sentence }}</p>
          }
        </section>

        <section class="card card--padded unserved" aria-labelledby="unserved-modules">
          <h2 id="unserved-modules" class="section-title">{{ copy.modulesHeading }}</h2>
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

        <section class="card card--padded unserved" aria-labelledby="unserved-ports">
          <h2 id="unserved-ports" class="section-title">{{ copy.portsHeading }}</h2>
          <div class="note-box">
            <p>{{ copy.portsLead }}</p>
            <ul>
              @for (holding of unservedHoldings(); track holding) {
                <li>{{ copy.portSentence(holding) }}</li>
              }
            </ul>
          </div>
        </section>
      }

      <section class="card card--padded unserved" aria-labelledby="unserved-available">
        <h2 id="unserved-available" class="section-title">{{ copy.availableHeading }}</h2>
        @if (available().length > 0) {
          <ul class="unserved__list">
            @for (item of available(); track item.route) {
              <li>
                <a class="record-link" [routerLink]="item.route">{{ item.label }}</a> —
                {{ item.description }}
              </li>
            }
          </ul>
        } @else {
          <p class="note-box">{{ copy.nothingAvailable }}</p>
        }
        @if (awaitingOffice()) {
          <p class="callout callout--warning">{{ copy.awaitingOffice }}</p>
        }
      </section>
    </div>
  `,
  // A notice page: padded cards in two columns at desktop widths; each listed
  // module a soft row whose sentence keeps its inline flow.
  styles: `
    .unserved-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
      align-items: start;
      gap: var(--space-4);
    }

    .unserved {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-inline-size: 0;
      color: var(--text);
      font-size: var(--fs-sm);
    }

    .unserved .callout app-icon {
      flex: none;
      margin-block-start: 1px;
    }

    .unserved__list {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .unserved__list > li {
      padding: 10px var(--space-3);
      border-radius: var(--r-field);
      background: var(--soft2);
      color: var(--text2);
      font-size: var(--fs-label);
    }

    .unserved__list strong {
      color: var(--ink);
    }
  `,
})
export class UnservedPage {
  private readonly served = inject(ServedPorts);
  private readonly permissions = inject(PermissionService);
  private readonly session = inject(SessionStore);

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

  /**
   * A staff account with no office lands here having been offered no inbox (`DL-168`). The reason
   * is the server's, and an officer who is not told it concludes the inbox does not exist.
   */
  protected readonly awaitingOffice = computed(() => this.session.user()?.awaitingOffice === true);

  /** The same filter the menu applies, so this list and the menu never disagree. */
  protected readonly available = computed<readonly NavItem[]>(() =>
    this.modules.filter(
      (item) => this.served.servesAll(item.reads) && this.permissions.hasAny(item.permissions),
    ),
  );
}
