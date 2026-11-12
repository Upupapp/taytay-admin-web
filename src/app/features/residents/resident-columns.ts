import type { TemplateRef } from '@angular/core';

import { ageInYears, barangayName, type ResidentView } from '@domain/index';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import type { RESIDENTS_COPY } from './residents.copy';

type Cell = TemplateRef<{ $implicit: ResidentView }>;

/**
 * The registry's columns, defined once: the registry and each sector page list the same people the
 * same way (`DL-210`), so a sector page cannot drift into showing a field the registry does not.
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
