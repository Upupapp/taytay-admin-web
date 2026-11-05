import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type CanActivateFn } from '@angular/router';

import { DATA_PORTS, UNSERVED_PORTS, type DataPort } from '@domain/index';

import { servedGuard, ServedPorts, UNSERVED_ROUTE } from './served-ports';

@Component({ template: 'screen' })
class Screen {}

@Component({ template: 'unserved' })
class Unserved {}

/** Refuses everybody, standing in for a permission the reader lacks. */
const refused: CanActivateFn = () => TestBed.inject(Router).createUrlTree(['/forbidden']);

function configure(unserved: readonly DataPort[]): Router {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'residents', component: Screen, canActivate: [servedGuard('resident')] },
        {
          path: 'referrals',
          component: Screen,
          canActivate: [servedGuard('referral', 'resident')],
        },
        { path: 'locked', component: Screen, canActivate: [servedGuard('case'), refused] },
        { path: 'unavailable', component: Unserved },
        { path: 'forbidden', component: Unserved },
      ]),
      { provide: UNSERVED_PORTS, useValue: unserved },
    ],
  });
  return TestBed.inject(Router);
}

describe('ServedPorts', () => {
  it('lists what is unserved in the vocabulary order, whatever order it was declared in', () => {
    configure(['search', 'case', 'resident']);
    expect(TestBed.inject(ServedPorts).unserved).toEqual(['resident', 'case', 'search']);
  });

  it('serves a module only when it serves every port the module reads', () => {
    configure(['resident']);
    const served = TestBed.inject(ServedPorts);

    expect(served.servesAll(['referral'])).toBe(true);
    expect(served.servesAll(['referral', 'resident'])).toBe(false);
    expect(served.servesAll([])).toBe(true);
  });

  it('serves everything when nothing is declared unserved', () => {
    configure([]);
    const served = TestBed.inject(ServedPorts);

    expect(served.unserved).toEqual([]);
    expect(served.servesAll(DATA_PORTS)).toBe(true);
  });

  it('has no default, so an adapter set that forgets to declare fails loudly', () => {
    TestBed.resetTestingModule();
    expect(() => TestBed.inject(ServedPorts)).toThrow(/UnservedPorts/);
  });
});

describe('servedGuard', () => {
  it('says which ports it stands for, so a test can hold it to its menu entry', () => {
    expect(servedGuard('referral', 'resident').ports).toEqual(['referral', 'resident']);
  });

  it('lets a served screen open', async () => {
    const router = configure(['case']);
    await router.navigateByUrl('/residents');
    expect(router.url).toBe('/residents');
  });

  it('sends an unserved screen to the page that names it', async () => {
    const router = configure(['resident']);
    await router.navigateByUrl('/residents');
    expect(router.url).toBe(UNSERVED_ROUTE);
  });

  it('withholds a screen when any port it reads is unserved, not only its main one', async () => {
    const router = configure(['resident']);
    await router.navigateByUrl('/referrals');
    expect(router.url).toBe(UNSERVED_ROUTE);
  });

  it('answers "not connected" before "not permitted", because nobody could open it', async () => {
    const router = configure(['case']);
    await router.navigateByUrl('/locked');
    expect(router.url).toBe(UNSERVED_ROUTE);
  });

  it('leaves the permission answer to the permission guard once the module is served', async () => {
    const router = configure([]);
    await router.navigateByUrl('/locked');
    expect(router.url).toBe('/forbidden');
  });
});
