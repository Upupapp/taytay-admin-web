import { defer, lastValueFrom, of, take, throwError, toArray } from 'rxjs';

import { failed, isReady, toViewState, valueOf, type ViewState } from './view-state';

async function collect<T>(
  source: ReturnType<typeof toViewState<T>>,
  count = Number.POSITIVE_INFINITY,
): Promise<ViewState<T>[]> {
  return lastValueFrom(source.pipe(take(count), toArray()));
}

describe('toViewState', () => {
  it('emits loading before the value arrives', async () => {
    const states = await collect(toViewState(of(42)));
    expect(states.map((state) => state.kind)).toEqual(['loading', 'ready']);
    expect(valueOf(states[1] as ViewState<number>)).toBe(42);
  });

  it('turns a failure into an error state rather than throwing', async () => {
    const states = await collect(
      toViewState<number>(throwError(() => new Error('Network is down'))),
      2,
    );
    expect(states.map((state) => state.kind)).toEqual(['loading', 'error']);
    const failure = states[1];
    expect(failure?.kind === 'error' ? failure.message : null).toBe('Network is down');
  });

  // DL-196: a refused read no longer leaves the screen, so the panel carries the server's words.
  it('says the server’s sentence when the failure is the API’s', async () => {
    const refusal = {
      code: 'FORBIDDEN',
      status: 403,
      message: 'Your account cannot read home visits.',
      details: null,
      requestId: null,
      retryAfterSeconds: null,
    };
    const states = await collect(toViewState<number>(throwError(() => refusal)), 2);
    const failure = states[1];
    expect(failure?.kind === 'error' ? failure.message : null).toBe(
      'Your account cannot read home visits.',
    );
  });

  it('falls back to a non-technical message for a non-Error rejection', async () => {
    const states = await collect(toViewState<number>(throwError(() => 'boom')), 2);
    const failure = states[1];
    expect(failure?.kind === 'error' ? failure.message : '').toContain('could not be loaded');
  });

  // "Try again" on the shared error panel calls this; it did nothing on eighteen pages (DL-186).
  it('gives a failure a retry that asks the same question again on the same stream', () => {
    let calls = 0;
    const source = defer(() => {
      calls += 1;
      return calls === 1 ? throwError(() => new Error('Network is down')) : of('answer');
    });
    const seen: ViewState<string>[] = [];
    const subscription = toViewState(source).subscribe((state) => seen.push(state));

    const failure = seen.at(-1);
    expect(failure?.kind).toBe('error');
    if (failure?.kind !== 'error' || failure.retry === undefined) {
      throw new Error('The failure carried no retry.');
    }
    failure.retry();

    expect(calls).toBe(2);
    expect(seen.map((state) => state.kind)).toEqual(['loading', 'error', 'loading', 'ready']);
    expect(valueOf(seen[3] as ViewState<string>)).toBe('answer');
    subscription.unsubscribe();
  });

  it('sends nothing for a retry asked after the screen has gone', () => {
    let calls = 0;
    const source = defer(() => {
      calls += 1;
      return throwError(() => new Error('Network is down'));
    });
    const seen: ViewState<string>[] = [];
    const subscription = toViewState(source).subscribe((state) => seen.push(state));
    subscription.unsubscribe();

    const failure = seen.at(-1);
    if (failure?.kind === 'error') {
      failure.retry?.();
    }
    expect(calls).toBe(1);
    expect(seen).toHaveLength(2);
  });

  it('keeps a hand-made failure without a retry, so no button is offered for it', () => {
    const state = failed<string>('Not readable');
    expect(state.kind === 'error' && state.retry === undefined).toBe(true);
  });
});

describe('view-state helpers', () => {
  it('narrows a ready state', () => {
    const state: ViewState<string> = { kind: 'ready', value: 'ok' };
    expect(isReady(state)).toBe(true);
    expect(valueOf(state)).toBe('ok');
  });

  it('reports no value while loading or failed', () => {
    expect(valueOf<string>({ kind: 'loading' })).toBeNull();
    expect(valueOf<string>({ kind: 'error', message: 'x' })).toBeNull();
    expect(valueOf<string>({ kind: 'idle' })).toBeNull();
  });
});
