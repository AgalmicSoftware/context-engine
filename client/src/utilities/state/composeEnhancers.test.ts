import { compose } from 'redux';
import { composeWithOptionalDevTools } from './composeEnhancers.js';

type UnaryNumberFn = (value: number) => number;
type NumberEnhancer = (next: UnaryNumberFn) => UnaryNumberFn;

describe('composeWithOptionalDevTools', () => {
  afterEach(() => {
    delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
  });

  it('falls back to redux compose when the browser devtools enhancer is unavailable', () => {
    const composed = composeWithOptionalDevTools(
      ((next: UnaryNumberFn) => (value: number) => next(value + 1)) as NumberEnhancer,
      ((next: UnaryNumberFn) => (value: number) => next(value * 2)) as NumberEnhancer
    );

    expect((composed as NumberEnhancer)((value: number) => value)(3)).toBe(compose(
      ((next: UnaryNumberFn) => (value: number) => next(value + 1)) as NumberEnhancer,
      ((next: UnaryNumberFn) => (value: number) => next(value * 2)) as NumberEnhancer
    )((value: number) => value)(3));
  });

  it('uses the browser devtools compose helper when it is available', () => {
    const devtoolsCompose = jest.fn(((...enhancers: NumberEnhancer[]) => compose(...enhancers)) as typeof compose);
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = devtoolsCompose;

    composeWithOptionalDevTools(((next: UnaryNumberFn) => next) as NumberEnhancer);

    expect(devtoolsCompose).toHaveBeenCalled();
  });
});
