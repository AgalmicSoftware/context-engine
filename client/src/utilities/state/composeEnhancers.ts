import { compose } from 'redux';

type GenericComposable = (...args: any[]) => any;
type ComposeLike = (...enhancers: GenericComposable[]) => GenericComposable;

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

export const composeWithOptionalDevTools = (...enhancers: GenericComposable[]): GenericComposable => {
  const composeEnhancer = isDevToolsEnabled()
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : compose;
  return (composeEnhancer as ComposeLike)(...enhancers);
};

export default composeWithOptionalDevTools;
