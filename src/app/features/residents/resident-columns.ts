import type { TemplateRef } from '@angular/core';

import {
  ageInYears,
  barangayName,
  type ResidentSectorDetail,
  type ResidentView,
  type VulnerabilitySector,
} from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import type { RESIDENTS_COPY, SectorPageSector } from './residents.copy';

type Cell = TemplateRef<{ $implicit: ResidentView }>;

/**
 * The registry's columns, defined once: the registry and each sector page list the same people the
 * same way (`DL-210`). Since the API sends them (`DL-232`), the registry adds its app, household
 * and updated columns (`registryColumns`), and a sector page adds the two of its own card it is
 * about (`sectorCardColumns`) — each read from what the server sent, already redacted.
 */
export function residentColumns(
  copy: (typeof RESIDENTS_COPY)['list'],
  cells: { readonly name: Cell; readonly sectors: Cell; readonly status: Cell },
): readonly TableColumn<ResidentView>[] {
  return [
    { key: 'name', header: copy.columnResident, cell: cells.name },
    {
      key: 'barangay',
      header: copy.columnBarangay,
      value: (view) => barangayName(view.resident.address.barangayId),
    },
    {
      key: 'age',
      header: copy.columnAge,
      align: 'end',
      width: '80px',
      value: (view) => `${ageInYears(view.resident.birthDate)}`,
    },
    { key: 'sectors', header: copy.columnSectors, cell: cells.sectors },
    {
      key: 'status',
      header: copy.columnStatus,
      width: '110px',
      value: (view) => (view.resident.isActive ? copy.active : copy.retired),
      cell: cells.status,
    },
  ];
}

/**
 * A sector chip's tint, as the CitizenRegistry board draws it: the two sectors with an office ID
 * in blue, solo parents in gold, 4Ps in green, the rest neutral. The words carry the meaning; the
 * tint only helps a reader scan a long list (WCAG 1.4.1). Presentation only: nothing reads it.
 */
const SECTOR_CHIP: Partial<Record<VulnerabilitySector, string>> = {
  'senior-citizen': 'chip chip--info',
  pwd: 'chip chip--info',
  'solo-parent': 'chip chip--warning',
  'four-ps': 'chip chip--success',
};

export function sectorChipClass(sector: VulnerabilitySector): string {
  return SECTOR_CHIP[sector] ?? 'chip';
}

type ListCopy = (typeof RESIDENTS_COPY)['list'];

/** The registry board's columns after the sectors: app and Digital ID, household, updated. */
export function registryColumns(
  copy: ListCopy,
  cells: { readonly app: Cell },
): readonly TableColumn<ResidentView>[] {
  return [
    appColumn(copy, cells.app),
    {
      key: 'household',
      header: copy.columnHousehold,
      value: (view) => {
        const registry = view.registry;
        if (registry === undefined) return copy.notSent;
        if (registry.householdWithheld) return copy.withheld;
        return registry.householdReference ?? copy.householdNone;
      },
    },
    {
      key: 'updated',
      header: copy.columnUpdated,
      value: (view) => formatDisplayDate(view.resident.audit.updatedAt) ?? copy.notSent,
    },
  ];
}

/** "App and Digital ID": the standing the row's app facts say (`DL-232`). */
export function appColumn(copy: ListCopy, cell: Cell): TableColumn<ResidentView> {
  return { key: 'app', header: copy.columnApp, cell };
}

/** A sector page's own two columns: its card's number, and what the board shows beside it. */
export function sectorCardColumns(
  sector: SectorPageSector,
  copy: ListCopy,
): readonly TableColumn<ResidentView>[] {
  const words = copy.sectorColumns[sector];
  const detail = (view: ResidentView): ResidentSectorDetail | null | undefined =>
    view.registry === undefined
      ? undefined
      : (view.registry.sectorDetails.find((entry) => entry.sector === sector) ?? null);
  const withheldOr = (entry: ResidentSectorDetail | null | undefined, shown: string | null) =>
    entry === undefined
      ? copy.notSent
      : entry === null
        ? copy.notRecorded
        : shown !== null
          ? shown
          : entry.detailsWithheld
            ? copy.withheld
            : null;
  return [
    {
      key: 'card',
      header: words.id,
      value: (view) => {
        const entry = detail(view);
        return withheldOr(entry, entry?.idNumber ?? null) ?? copy.cardNone;
      },
    },
    {
      key: 'card-second',
      header: words.second,
      value: (view) => {
        const entry = detail(view);
        switch (sector) {
          case 'senior-citizen': {
            const pension = entry?.socialPension ?? null;
            return (
              withheldOr(entry, pension === null ? null : pension ? copy.yes : copy.no) ??
              copy.notRecorded
            );
          }
          case 'pwd':
            return withheldOr(entry, entry?.disabilityType ?? null) ?? copy.notRecorded;
          case 'solo-parent':
            return (
              withheldOr(entry, formatDisplayDate(entry?.validUntil ?? null)) ?? copy.notRecorded
            );
        }
      },
    },
  ];
}
