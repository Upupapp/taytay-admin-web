import { Pipe, type PipeTransform } from '@angular/core';

import { toDecimal, type Money } from '@domain/index';

const FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

/** Renders `Money` as `₱1,234.56`. Never do currency maths in a template. */
@Pipe({ name: 'peso' })
export class PesoPipe implements PipeTransform {
  transform(value: Money | null | undefined, fallback = '—'): string {
    return value ? FORMATTER.format(toDecimal(value)) : fallback;
  }
}
