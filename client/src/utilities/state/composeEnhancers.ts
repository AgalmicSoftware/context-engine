import { compose } from 'redux';
import type { StoreEnhancer } from 'redux';

type ComposeLike = (...enhancers: StoreEnhancer[]) => StoreEnhancer;

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: ComposeLike;
  }
}

const isDevToolsEnabled = (): boolean => (
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  typeof window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ === 'function'
);

export const composeWithOptionalDevTools = (...enhancers: StoreEnhancer[]): StoreEnhancer => {
  const composeEnhancer = isDevToolsEnabled()
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ as ComposeLike
    : (compose as ComposeLike);
  return composeEnhancer(...enhancers);
};

export default composeWithOptionalDevTools;
