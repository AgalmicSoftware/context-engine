import React from 'react';

const mockRender = jest.fn();
const mockCreateRoot = jest.fn(() => ({ render: mockRender }));

jest.mock('react-dom/client', () => ({
  createRoot: (...args: unknown[]) => mockCreateRoot(...args),
}));

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('utilities/logging.js', () => ({
  initLogging: jest.fn(),
}));

jest.mock('components/App', () => ({
  __esModule: true,
  default: () => null,
}));

type RuntimeGlobals = typeof globalThis & {
  CE_RPC_TESTING_MODE?: boolean;
  CE_SESSION_SCAN_SCOPE?: string;
  CE_SESSION_SCAN_SLUGS?: string[];
  __CE_DID_LOG_RPC_TESTING_MODE__?: boolean;
};

describe('browser runtime config entrypoint', () => {
  const runtimeGlobals = globalThis as RuntimeGlobals;

  beforeEach(() => {
    jest.resetModules();
    mockCreateRoot.mockClear();
    mockRender.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, '', '/?ceRpcTestingMode=1&ceSessionScanSlugs=alpha,beta');
    delete runtimeGlobals.CE_RPC_TESTING_MODE;
    delete runtimeGlobals.CE_SESSION_SCAN_SCOPE;
    delete runtimeGlobals.CE_SESSION_SCAN_SLUGS;
    delete runtimeGlobals.__CE_DID_LOG_RPC_TESTING_MODE__;
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    delete runtimeGlobals.CE_RPC_TESTING_MODE;
    delete runtimeGlobals.CE_SESSION_SCAN_SCOPE;
    delete runtimeGlobals.CE_SESSION_SCAN_SLUGS;
    delete runtimeGlobals.__CE_DID_LOG_RPC_TESTING_MODE__;
  });

  it('applies URL runtime overrides before rendering the application', () => {
    let runtimeAtRender: Pick<
      RuntimeGlobals,
      'CE_RPC_TESTING_MODE' | 'CE_SESSION_SCAN_SCOPE' | 'CE_SESSION_SCAN_SLUGS'
    > = {};
    mockRender.mockImplementationOnce(() => {
      runtimeAtRender = {
        CE_RPC_TESTING_MODE: runtimeGlobals.CE_RPC_TESTING_MODE,
        CE_SESSION_SCAN_SCOPE: runtimeGlobals.CE_SESSION_SCAN_SCOPE,
        CE_SESSION_SCAN_SLUGS: runtimeGlobals.CE_SESSION_SCAN_SLUGS,
      };
    });

    jest.isolateModules(() => {
      require('./index');
    });

    expect(mockCreateRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(runtimeAtRender).toEqual({
      CE_RPC_TESTING_MODE: true,
      CE_SESSION_SCAN_SCOPE: 'list',
      CE_SESSION_SCAN_SLUGS: ['alpha', 'beta'],
    });
  });
});
