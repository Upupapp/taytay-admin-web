import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { RouteProgress } from './route-progress';

@Component({ template: 'stub' })
class StubPage {}

describe('RouteProgress', () => {
  async function render(): Promise<ComponentFixture<RouteProgress>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: StubPage },
          { path: 'residents', component: StubPage },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(RouteProgress);
    await fixture.whenStable();
    return fixture;
  }

  it('shows nothing while idle', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('.route-progress')).toBeNull();
  });

  it('clears once navigation completes', async () => {
    const fixture = await render();
    await TestBed.inject(Router).navigateByUrl('/residents');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.route-progress')).toBeNull();
  });

  it('keeps a polite live region for screen readers rather than announcing an animation', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const live = element.querySelector('[role="status"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.classList.contains('visually-hidden')).toBe(true);
  });

  it('hides the moving bar from assistive technology', async () => {
    // The bar is decoration; the live region carries the meaning. Announcing
    // both would be duplicate noise.
    const fixture = await render();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('aria-live="assertive"');
  });
});
