import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import type { Permission } from '@domain/index';
import { FigureTiles } from '@shared/ui/figure-tiles/figure-tiles';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { DIRECTORY_COPY } from './directory.copy';
import { directoryFigures } from './directory-figures';
import { HotlinesSection } from './hotlines-section';
import { OfficesSection } from './offices-section';
import { ServicesSection } from './services-section';

type SectionKey = keyof typeof DIRECTORY_COPY.page.sections;

const SECTIONS: readonly { readonly key: SectionKey; readonly permission: Permission }[] = [
  { key: 'offices', permission: 'office.manage' },
  { key: 'services', permission: 'service.manage' },
  { key: 'hotlines', permission: 'hotline.manage' },
];

/**
 * The residents' app directory (`DL-170`): the offices residents can find, the Tulong pages that
 * tell them about a service, and the numbers they can call.
 *
 * **Residents see this**, and the title block says so before anything else: every act on this page
 * changes what every resident reads the next time the app loads.
 *
 * Three sections, each behind its own key as on the server, with the section in the URL
 * (`?section=`) so a reload or a colleague's link opens the same one, and whether its records in use
 * or its archived ones are shown (`?archived=true`, `DL-225`). A section the reader holds no
 * key for is not offered; the route opens for any of the three.
 */
@Component({
  selector: 'app-directory-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FigureTiles, HotlinesSection, OfficesSection, PageHeader, RouterLink, ServicesSection],
  templateUrl: './directory-page.html',
  styleUrl: './directory-page.scss',
})
export class DirectoryPage {
  private readonly permissions = inject(PermissionService);

  /** The KPI row and the tab counts (`DL-232`). */
  protected readonly figures = directoryFigures();

  /** `?section=` — bound by the router. Anything unknown reads as the first section offered. */
  readonly section = input<string | undefined>(undefined);

  /**
   * `?archived=true` — the section's archived records rather than those in use (`DL-225`). Choosing
   * another section drops it, so each opens on what is in use.
   */
  readonly archived = input<string | undefined>(undefined);
  protected readonly showArchived = computed(() => this.archived() === 'true');

  protected readonly copy = DIRECTORY_COPY.page;

  protected readonly offered = computed(() =>
    SECTIONS.filter((section) => this.permissions.can(section.permission)()),
  );

  protected readonly current = computed<SectionKey | null>(() => {
    const offered = this.offered();
    const wanted = this.section();
    return (offered.find((section) => section.key === wanted) ?? offered[0])?.key ?? null;
  });
}
