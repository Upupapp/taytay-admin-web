import { lastValueFrom, of, throwError, toArray } from 'rxjs';

import { isReady, toViewState, valueOf, type ViewState } from './view-state';

async function collect<T>(source: ReturnType<typeof toViewState<T>>): Promise<ViewState<T>[]> {
  return lastValueFrom(source.pipe(toArray()));
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
    );
    expect(states.map((state) => state.kind)).toEqual(['loading', 'error']);
    const failure = states[1];
    expect(failure?.kind === 'error' ? failure.message : null).toBe('Network is down');
  });

  it('falls back to a non-technical message for a non-Error rejection', async () => {
    const states = await collect(toViewState<number>(throwError(() => 'boom')));
    const failure = states[1];
    expect(failure?.kind === 'error' ? failure.message : '').toContain('could not be loaded');
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
