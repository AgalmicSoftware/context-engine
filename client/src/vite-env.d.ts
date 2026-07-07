/// <reference types="vite/client" />

declare module 'process/browser' {
  const processShim: {
    env?: Record<string, string | undefined>;
  };
  export default processShim;
}
