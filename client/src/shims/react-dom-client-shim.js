// Minimal React 18-compatible client shim for React 17 apps.
// Provides createRoot / hydrateRoot backed by ReactDOM.render/unmount.
// a result of updating Web3Auth from v8 to v10


import ReactDOM from 'react-dom';

export const createRoot = (container) => {
  return {
    render: (element) => ReactDOM.render(element, container),
    unmount: () => ReactDOM.unmountComponentAtNode(container),
  };
};

export const hydrateRoot = (container, element) => {
  if (typeof ReactDOM.hydrate === 'function') {
    ReactDOM.hydrate(element, container);
  } else {
    ReactDOM.render(element, container);
  }
  return {
    render: (el) => ReactDOM.render(el, container),
    unmount: () => ReactDOM.unmountComponentAtNode(container),
  };
};

export default { createRoot, hydrateRoot };
