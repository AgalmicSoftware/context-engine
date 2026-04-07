import { compose } from 'redux';

const isDevToolsEnabled = () => (
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  typeof window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ === 'function'
);

export const composeWithOptionalDevTools = (...enhancers) => {
  const composeEnhancer = isDevToolsEnabled()
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : compose;
  return composeEnhancer(...enhancers);
};

export default composeWithOptionalDevTools;
