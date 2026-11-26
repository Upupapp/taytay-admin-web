import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, type Observable } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { LiveUpdates } from '@core/live/live-updates';
import {
  DIRECTORY_OFFICE_REPOSITORY,
  HOTLINE_REPOSITORY,
  TULONG_SERVICE_REPOSITORY,
} from '@domain/index';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import type { FigureLink, FigureTile } from '@shared/ui/figure-tiles/figure-tiles';

import { DIRECTORY_COPY } from './directory.copy';
import { DIRECTORY_HOTLINES_TOPICS } from './hotlines-section';
import { DIRECTORY_OFFICES_TOPICS } from './offices-section';
import { DIRECTORY_SERVICES_TOPICS } from './services-section';

/** The three lists' figures, each `null` until read or for a reader without its key. */
export interface DirectoryFigures {
  readonly tiles: Signal<readonly FigureTile[]>;
  readonly counts: Signal<Readonly<Record<'offices' | 'services' | 'hotlines', number | null>>>;
}

/**
 * The App directory's KPI row and tab counts, as its board draws them (`DL-232`): each section's
 * records in use, read whole from its own admin list — the same read the section makes — and only
 * for a reader holding that section's key. Live like the sections (`DL-222`). An injection-context
 * helper, so the page stays one file of layout.
 */
export function directoryFigures(): DirectoryFigures {
  const permissions = inject(PermissionService);
  const live = inject(LiveUpdates);
  const offices = inject(DIRECTORY_OFFICE_REPOSITORY);
  const services = inject(TULONG_SERVICE_REPOSITORY);
  const hotlines = inject(HOTLINE_REPOSITORY);
  const copy = DIRECTORY_COPY.page.figures;

  const read = <T>(
    allowed: boolean,
    load: () => Observable<T>,
    topics: Parameters<LiveUpdates['changes']>[0],
  ) =>
    toSignal(allowed ? liveViewState(load, live.changes(topics), live) : EMPTY, {
      initialValue: LOADING as ViewState<T>,
    });

  const officeList = read(
    permissions.can('office.manage')(),
    () => offices.list(false),
    DIRECTORY_OFFICES_TOPICS,
  );
  const serviceList = read(
    permissions.can('service.manage')(),
    () => services.list(false),
    DIRECTORY_SERVICES_TOPICS,
  );
  const hotlineList = read(
    permissions.can('hotline.manage')(),
    () => hotlines.list(false),
    DIRECTORY_HOTLINES_TOPICS,
  );

  // Each figure opens its own section, records in use (`DL-273`): a tile is only here for a reader
  // holding that section's key, so the section is always one the page offers them.
  const section = (key: 'offices' | 'services' | 'hotlines'): FigureLink => ({
    kind: 'route',
    route: '/directory',
    queryParams: { section: key },
    says: copy.showSection,
  });

  const tiles = computed<readonly FigureTile[]>(() => {
    const result: FigureTile[] = [];
    const officeRows = valueOf(officeList());
    if (officeRows !== null) {
      result.push({
        key: 'offices',
        label: copy.offices.label,
        value: String(officeRows.length),
        hint: copy.offices.hint(officeRows.filter((office) => office.hasBanner).length),
        dot: 'bar',
        link: section('offices'),
      });
    }
    const serviceRows = valueOf(serviceList());
    if (serviceRows !== null) {
      result.push({
        key: 'services',
        label: copy.services.label,
        value: String(serviceRows.length),
        hint: copy.services.hint(serviceRows.filter((service) => service.featured).length),
        dot: 'gold',
        link: section('services'),
      });
    }
    const hotlineRows = valueOf(hotlineList());
    if (hotlineRows !== null) {
      result.push({
        key: 'hotlines',
        label: copy.hotlines.label,
        value: String(hotlineRows.filter((hotline) => hotline.active).length),
        hint: copy.hotlines.hint(hotlineRows.length),
        dot: 'red',
        link: section('hotlines'),
      });
    }
    return result;
  });

  const counts = computed(() => ({
    offices: valueOf(officeList())?.length ?? null,
    services: valueOf(serviceList())?.length ?? null,
    hotlines: valueOf(hotlineList())?.length ?? null,
  }));

  return { tiles, counts };
}
