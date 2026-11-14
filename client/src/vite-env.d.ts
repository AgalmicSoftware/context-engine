/// <reference types="vite/client" />

declare module 'process/browser' {
  const processShim: {
    env?: Record<string, string | undefined>;
  };
  export default processShim;
}

/** The app's release (client/package.json's version), set by the build; not defined in tests. */
declare const __CE_APP_RELEASE__: string | undefined;
