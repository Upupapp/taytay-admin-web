import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';
import { defer, of, throwError } from 'rxjs';

import { failed, LOADING, toViewState, type ViewState } from '@shared/state/view-state';

import { AsyncContent } from './async-content';

/** Fails the first read, answers the second — as a server that was down for a moment. */
let reads = 0;
const flaky = defer(() => {
  reads += 1;
  return reads === 1 ? throwError(() => new Error('The server did not answer.')) : of('loaded');
});

/** A page that wires nothing: the eighteen pages whose "Try again" did nothing before `DL-186`. */
@Component({
  selector: 'app-unwired-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent],
  template: `
    <app-async-content [state]="state()" [content]="body">
      <ng-template #body let-value
        ><p class="value">{{ value }}</p></ng-template
      >
    </app-async-content>
  `,
})
class UnwiredHost {
  readonly state = toSignal(toViewState(flaky), { initialValue: LOADING as ViewState<string> });
}

/** A page that owns its reload: it is told, and the failure's own retry is not run as well. */
@Component({
  selector: 'app-wired-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent],
  template: `
    <app-async-content [state]="state()" [content]="body" (retryRequested)="reloads = reloads + 1">
      <ng-template #body let-value
        ><p class="value">{{ value }}</p></ng-template
      >
    </app-async-content>
  `,
})
class WiredHost {
  reloads = 0;
  readonly state = toSignal(toViewState(flaky), { initialValue: LOADING as ViewState<string> });
}

/** A failure made by hand, with nobody listening: nothing could answer a button. */
@Component({
  selector: 'app-hand-made-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent],
  template: `
    <app-async-content [state]="state()" [content]="body">
      <ng-template #body let-value
        ><p>{{ value }}</p></ng-template
      >
    </app-async-content>
  `,
})
class HandMadeHost {
  readonly state = signal<ViewState<string>>(failed('Not readable.'));
}

function tryAgain(element: HTMLElement): HTMLButtonElement | null {
  return (
    [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Try again'),
    ) ?? null
  );
}

describe('AsyncContent — "Try again" (DL-186)', () => {
  beforeEach(() => {
    reads = 0;
  });

  it('re-runs the failed read on a page that wires nothing', async () => {
    const fixture = TestBed.createComponent(UnwiredHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(reads).toBe(1);
    const button = tryAgain(element);
    expect(button).not.toBeNull();
    button?.click();
    await fixture.whenStable();

    expect(reads).toBe(2);
    expect(element.querySelector('.value')?.textContent).toBe('loaded');
  });

  it('tells a page that owns its reload, and does not read twice', async () => {
    const fixture = TestBed.createComponent(WiredHost);
    await fixture.whenStable();

    tryAgain(fixture.nativeElement as HTMLElement)?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.reloads).toBe(1);
    expect(reads).toBe(1);
  });

  it('offers no button for a failure nothing can retry', async () => {
    const fixture = TestBed.createComponent(HandMadeHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Not readable.');
    expect(tryAgain(element)).toBeNull();
  });
});
