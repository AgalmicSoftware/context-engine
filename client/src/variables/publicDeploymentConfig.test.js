const ENV_KEYS = [
  'REACT_APP_CE_SHARED_WORKER_URL',
  'REACT_APP_CE_DEPLOY_HELPER_URL',
  'REACT_APP_CE_HEALTHCHECK_WORKER_URL',
  'REACT_APP_CE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_USE_LOCAL_WORKER_BUNDLE_FALLBACK',
  'REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED',
];

const ORIGINAL_ENV = ENV_KEYS.reduce((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const clearPublicDeploymentEnv = () => {
  ENV_KEYS.forEach((key) => {
    try {
      delete process.env[key];
    } catch (_) {}
  });
};

describe('publicDeploymentConfig', () => {
  beforeEach(() => {
    clearPublicDeploymentEnv();
    jest.resetModules();
  });

  afterEach(() => {
    clearPublicDeploymentEnv();
    jest.resetModules();
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (typeof ORIGINAL_ENV[key] === 'undefined') {
        delete process.env[key];
        return;
      }
      process.env[key] = ORIGINAL_ENV[key];
    });
  });

  it('exports all public deployment endpoints as strings', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(typeof config.DEFAULT_SHARED_WORKER_URL).toBe('string');
      expect(typeof config.DEPLOY_HELPER_URL).toBe('string');
      expect(typeof config.HEALTHCHECK_WORKER_URL).toBe('string');
      expect(typeof config.WORKER_BUNDLE_URL).toBe('string');
      expect(typeof config.USE_LOCAL_WORKER_BUNDLE_FALLBACK).toBe('boolean');
      expect(typeof config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED).toBe('boolean');
    });
  });

  it('ships the verified project worker, healthcheck, and deploy-helper defaults', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.DEFAULT_SHARED_WORKER_URL).toBe('https://demo-worker-030226.agalmic.workers.dev');
      expect(config.DEPLOY_HELPER_URL).toBe('https://ce-deploy-helper.agalmic.workers.dev/');
      expect(config.HEALTHCHECK_WORKER_URL).toBe('https://demo-worker-030226.agalmic.workers.dev');
    });
  });

  it('keeps the default worker bundle pointed at a JavaScript asset', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.WORKER_BUNDLE_URL).toContain('.js');
    });
  });

  it('prefers REACT_APP_CE_* env overrides over fallback deployment URLs', () => {
    process.env.REACT_APP_CE_SHARED_WORKER_URL = 'https://shared.example.test/';
    process.env.REACT_APP_CE_DEPLOY_HELPER_URL = 'https://deploy-helper.example.test';
    process.env.REACT_APP_CE_HEALTHCHECK_WORKER_URL = 'https://healthcheck.example.test/';
    process.env.REACT_APP_CE_WORKER_BUNDLE_URL = 'https://assets.example.com/sessionCorsWorker.bundle.js';
    process.env.REACT_APP_CE_USE_LOCAL_WORKER_BUNDLE_FALLBACK = 'false';
    process.env.REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = 'false';

    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.DEFAULT_SHARED_WORKER_URL).toBe(process.env.REACT_APP_CE_SHARED_WORKER_URL);
      expect(config.DEPLOY_HELPER_URL).toBe(process.env.REACT_APP_CE_DEPLOY_HELPER_URL);
      expect(config.HEALTHCHECK_WORKER_URL).toBe(process.env.REACT_APP_CE_HEALTHCHECK_WORKER_URL);
      expect(config.WORKER_BUNDLE_URL).toBe(process.env.REACT_APP_CE_WORKER_BUNDLE_URL);
      expect(config.USE_LOCAL_WORKER_BUNDLE_FALLBACK).toBe(false);
      expect(config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED).toBe(false);
    });
  });
});
