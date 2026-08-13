import { inject, Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';

/**
 * Wraps mock results in the same asynchronous shape a real HTTP call has, with
 * a configurable delay so loading and empty states are genuinely exercised
 * during development rather than flashing past.
 */
@Injectable({ providedIn: 'root' })
export class MockLatency {
  private readonly environment = inject(APP_ENVIRONMENT);

  respond<TValue>(value: TValue): Observable<TValue> {
    const latency = this.environment.mockLatencyMs;
    return latency > 0 ? of(value).pipe(delay(latency)) : of(value);
  }
}
