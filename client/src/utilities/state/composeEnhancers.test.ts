import { compose, createStore } from 'redux';
import type { AnyAction, Reducer, StoreEnhancer } from 'redux';
import { composeWithOptionalDevTools } from './composeEnhancers.js';

interface CounterState {
  value: number;
}

const counterReducer: Reducer<CounterState, AnyAction> = (state = { value: 0 }, action) =>
  action.type === 'increment' ? { value: state.value + 1 } : state;

const makeDispatchLogEnhancer =
  (label: string, calls: string[]): StoreEnhancer =>
  (next) =>
  (reducer, preloadedState) => {
    const store = next(reducer, preloadedState);
    return {
      ...store,
      dispatch(action: AnyAction) {
        calls.push(label);
        return store.dispatch(action);
      },
    };
  };

describe('composeWithOptionalDevTools', () => {
  afterEach(() => {
    delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
  });

  it('falls back to redux compose when the browser devtools enhancer is unavailable', () => {
    const actualCalls: string[] = [];
    const composed = composeWithOptionalDevTools(
      makeDispatchLogEnhancer('first', actualCalls),
      makeDispatchLogEnhancer('second', actualCalls),
    );

    const expectedCalls: string[] = [];
    const expected = compose(
      makeDispatchLogEnhancer('first', expectedCalls),
      makeDispatchLogEnhancer('second', expectedCalls),
    ) as StoreEnhancer;

    createStore(counterReducer, composed).dispatch({ type: 'increment' });
    createStore(counterReducer, expected).dispatch({ type: 'increment' });

    expect(actualCalls).toEqual(expectedCalls);
    expect(actualCalls).toEqual(['first', 'second']);
  });

  it('uses the browser devtools compose helper when it is available', () => {
    const devtoolsCompose = jest.fn((...enhancers: StoreEnhancer[]) => compose(...enhancers) as StoreEnhancer);
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = devtoolsCompose;

    const calls: string[] = [];
    const composed = composeWithOptionalDevTools(makeDispatchLogEnhancer('devtools', calls));
    const store = createStore(
      counterReducer,
      compose(composed, makeDispatchLogEnhancer('terminal', calls)) as StoreEnhancer,
    );
    store.dispatch({ type: 'increment' });

    expect(devtoolsCompose).toHaveBeenCalled();
    expect(calls).toEqual(['devtools', 'terminal']);
  });
});
