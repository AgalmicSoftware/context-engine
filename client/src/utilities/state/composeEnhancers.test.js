import { compose } from 'redux';
import { composeWithOptionalDevTools } from './composeEnhancers.js';

describe('composeWithOptionalDevTools', () => {
  afterEach(() => {
    delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
  });

  it('falls back to redux compose when the browser devtools enhancer is unavailable', () => {
    const composed = composeWithOptionalDevTools(
      (next) => (value) => next(value + 1),
      (next) => (value) => next(value * 2)
    );

    expect(composed((value) => value)(3)).toBe(compose(
      (next) => (value) => next(value + 1),
      (next) => (value) => next(value * 2)
    )((value) => value)(3));
  });

  it('uses the browser devtools compose helper when it is available', () => {
    const devtoolsCompose = jest.fn((...enhancers) => compose(...enhancers));
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = devtoolsCompose;

    composeWithOptionalDevTools((next) => next);

    expect(devtoolsCompose).toHaveBeenCalled();
  });
});
