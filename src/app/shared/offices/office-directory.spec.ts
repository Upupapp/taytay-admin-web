import { TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { asId, type Office, type OfficeId } from '@domain/index';

import { ARCHIVED_OFFICE, officeDirectory, type OfficeDirectory } from './office-directory';

const MSWDO: Office = {
  id: asId<OfficeId>('office-mswdo'),
  name: 'Municipal Social Welfare and Development Office',
  slug: 'mswdo',
  shortName: 'MSWDO',
};

function directory(source: Observable<readonly Office[]>): OfficeDirectory {
  TestBed.resetTestingModule();
  return TestBed.runInInjectionContext(() => officeDirectory(source));
}

describe('officeDirectory (DL-225)', () => {
  it('names an office it lists by its label', () => {
    const offices = directory(of([MSWDO]));

    expect(offices.name(MSWDO.id, 'fallback')).toBe(
      'Municipal Social Welfare and Development Office (MSWDO)',
    );
  });

  it('says an office the directory has read and does not list is an archived one', () => {
    const offices = directory(of([MSWDO]));

    expect(offices.name(asId<OfficeId>('office-gone'), 'office-gone')).toBe(ARCHIVED_OFFICE);
    expect(ARCHIVED_OFFICE).toBe('An archived office');
  });

  it('keeps the fallback while the directory is being read, and after it failed', () => {
    const pending = new Subject<readonly Office[]>();
    const loading = directory(pending);
    expect(loading.name(asId<OfficeId>('office-gone'), 'office-gone')).toBe('office-gone');

    const failed = directory(throwError(() => new Error('The server did not answer.')));
    expect(failed.failed()).toBe(true);
    // A directory that could not be read says nothing about which offices are archived.
    expect(failed.name(asId<OfficeId>('office-gone'), 'office-gone')).toBe('office-gone');

    expect(directory(NEVER).failed()).toBe(false);
  });
});
