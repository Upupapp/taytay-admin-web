import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject, Injectable, InjectionToken, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import type { OfficeRepository } from '@domain/ports/repositories';

import { lazyAdapter, lazyPort } from './lazy-port';

const BASE = 'https://api.example.gov.ph/api/v1';
const GREETING = new InjectionToken<string>('Greeting');

interface Echo {
  say(word: string): Observable<string>;
  notAnObservable(): Observable<string>;
}

let built = 0;

/** Stands in for an adapter: built by DI, so `inject` in a field initialiser must work. */
@Injectable()
class EchoAdapter implements Echo {
  private readonly greeting = inject(GREETING);

  constructor() {
    built++;
  }

  say(word: string): Observable<string> {
    return of(`${this.greeting} ${word}`);
  }

  notAnObservable(): Observable<string> {
    // A port method that broke its contract; the proxy must say so rather than hang.
    return 'plain' as unknown as Observable<string>;
  }
}

function portWith(load: () => Promise<Type<Echo>>): Echo {
  TestBed.configureTestingModule({
    providers: [{ provide: GREETING, useValue: 'Magandang araw,' }],
  });
  return TestBed.runInInjectionContext(lazyAdapter(load));
}

afterEach(() => {
  built = 0;
  TestBed.resetTestingModule();
});

describe('a port whose adapter is fetched on its first question (DL-224)', () => {
  it('fetches nothing until a call is subscribed to, then builds the adapter once', async () => {
    let loads = 0;
    const port = portWith(() => {
      loads++;
      return Promise.resolve(EchoAdapter);
    });

    const first = port.say('po');
    const second = port.say('ulit');
    expect(loads).toBe(0);
    expect(built).toBe(0);

    expect(await firstValueFrom(first)).toBe('Magandang araw, po');
    expect(await firstValueFrom(second)).toBe('Magandang araw, ulit');
    expect(loads).toBe(1);
    expect(built).toBe(1);
  });

  it('answers a failed download as that call’s error, and tries again on the next call', async () => {
    let attempts = 0;
    const port = portWith(() => {
      attempts++;
      return attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(EchoAdapter);
    });

    await expect(firstValueFrom(port.say('po'))).rejects.toThrow('offline');
    expect(await firstValueFrom(port.say('po'))).toBe('Magandang araw, po');
    expect(attempts).toBe(2);
  });

  it('is never mistaken for a promise or for something Angular must destroy', () => {
    const port = portWith(() => Promise.resolve(EchoAdapter));

    expect(Reflect.get(port, 'then')).toBeUndefined();
    expect(Reflect.get(port, 'ngOnDestroy')).toBeUndefined();
  });

  it('refuses in words a method that does not answer with an Observable', async () => {
    const port = portWith(() => Promise.resolve(EchoAdapter));

    await expect(firstValueFrom(port.notAnObservable())).rejects.toThrow(/Nothing was sent/);
  });

  it('reaches a real adapter through the adapters module, and its request goes out', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: BASE, dataSource: 'http' } },
      ],
    });
    const offices = TestBed.runInInjectionContext(
      lazyPort<OfficeRepository>((m) => m.HttpOfficeRepository),
    );
    const http = TestBed.inject(HttpTestingController);

    const read = firstValueFrom(offices.list());
    // The module arrives on a later turn; the request follows it.
    const request = await waitForRequest(http, `${BASE}/offices`);
    request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });

    expect(await read).toEqual([]);
    http.verify();
  });
});

/** The dynamic import resolves on its own schedule; poll the testing backend until it is sent. */
async function waitForRequest(http: HttpTestingController, url: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const [match] = http.match((request) => request.url.startsWith(url));
    if (match !== undefined) {
      return match;
    }
    await new Promise((settle) => setTimeout(settle, 10));
  }
  throw new Error(`No request to ${url} was made.`);
}
