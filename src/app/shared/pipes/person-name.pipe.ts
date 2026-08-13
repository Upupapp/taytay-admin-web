import { Pipe, type PipeTransform } from '@angular/core';

import { formatPersonName, formatPersonNameListed, type PersonName } from '@domain/index';

export type PersonNameFormat = 'natural' | 'listed';

/**
 * `natural` → "Aurora D. Mercado" (prose, headings)
 * `listed`  → "Mercado, Aurora Delos Santos" (sortable table columns)
 */
@Pipe({ name: 'personName' })
export class PersonNamePipe implements PipeTransform {
  transform(value: PersonName | null | undefined, format: PersonNameFormat = 'natural'): string {
    if (!value) {
      return '—';
    }
    return format === 'listed' ? formatPersonNameListed(value) : formatPersonName(value);
  }
}
