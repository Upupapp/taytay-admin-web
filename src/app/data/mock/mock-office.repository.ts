import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import type { Office, OfficeRepository } from '@domain/index';

import { MockLatency } from './mock-latency';
import { MOCK_OFFICES } from './seed/offices.seed';

/**
 * The office directory, in memory (`DL-168`). No permission is checked because the API checks none:
 * `GET offices` is the residents' app's public directory.
 */
@Injectable()
export class MockOfficeRepository implements OfficeRepository {
  private readonly latency = inject(MockLatency);

  list(): Observable<readonly Office[]> {
    return this.latency.respond(MOCK_OFFICES);
  }
}
