import { Pipe, type PipeTransform } from '@angular/core';

/**
 * First letter of the first and the last word, e.g. "Marisol Alcantara" → "MA", "Cordero, M." →
 * "CM". For the avatar circle beside a printed name, so it is always `aria-hidden`: it repeats the
 * name it stands beside, and it is made only from the name the screen already shows — a masked
 * listing ("Cordero, M.") gives masked initials, never the withheld given name.
 */
export function initialsOf(name: string): string {
  const words = name.split(/[\s,]+/).filter((word) => /\p{L}/u.test(word));
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .map((word) => (word === undefined ? '' : (/\p{L}/u.exec(word)?.[0] ?? '')))
    .join('')
    .toLocaleUpperCase();
}

@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return initialsOf(name ?? '');
  }
}
