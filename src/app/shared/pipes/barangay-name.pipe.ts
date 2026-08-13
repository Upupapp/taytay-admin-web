import { Pipe, type PipeTransform } from '@angular/core';

import { barangayName, type BarangayId } from '@domain/index';

@Pipe({ name: 'barangayName' })
export class BarangayNamePipe implements PipeTransform {
  transform(value: BarangayId | null | undefined): string {
    return value ? barangayName(value) : '—';
  }
}
