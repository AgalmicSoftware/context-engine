export {};

const processEnv = process.env as Record<string, string | undefined>;

const ENV_KEYS = [
  'REACT_APP_CE_SHARED_WORKER_URL',
  'REACT_APP_CE_DEPLOY_HELPER_URL',
  'REACT_APP_CE_HEALTHCHECK_WORKER_URL',
  'REACT_APP_CE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_AGENT_BRIDGE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL',
  'REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED',
  'REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT',
];

const ORIGINAL_ENV = ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = processEnv[key];
  return acc;
}, {});

const EXPECTED_DEFAULT_SHARED_WORKER_URL = 'https://demo-worker-030226.agalmic.workers.dev'; // intentional: production default worker URL snapshot - must fail if defaults silently change
const EXPECTED_DEPLOY_HELPER_URL = 'https://ce-deploy-helper.agalmic.workers.dev/'; // intentional: production default deploy URL snapshot - must fail if defaults silently change

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
      processEnv[key] = ORIGINAL_ENV[key];
    });
  });

  it('exports all public deployment endpoints as strings', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(typeof config.DEFAULT_SHARED_WORKER_URL).toBe('string');
      expect(typeof config.DEPLOY_HELPER_URL).toBe('string');
      expect(typeof config.HEALTHCHECK_WORKER_URL).toBe('string');
      expect(typeof config.WORKER_BUNDLE_URL).toBe('string');
      expect(typeof config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe('string');
      expect(typeof config.WORKER_RELEASE_MANIFEST_URL).toBe('string');
      expect(typeof config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED).toBe('boolean');
      expect(typeof config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toBe('string');
      expect(typeof config.CLOUDFLARE_NATIVE_DEPLOY_URL).toBe('string');
    });
  });

  it('ships the verified project worker, healthcheck, and deploy-helper defaults', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.DEFAULT_SHARED_WORKER_URL).toBe(EXPECTED_DEFAULT_SHARED_WORKER_URL);
      expect(config.DEPLOY_HELPER_URL).toBe(EXPECTED_DEPLOY_HELPER_URL);
      expect(config.HEALTHCHECK_WORKER_URL).toBe(EXPECTED_DEFAULT_SHARED_WORKER_URL);
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toBe('');
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_URL).toBe('');
    });
  });

  it('keeps the default worker bundle pointed at a JavaScript asset', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');
      const { buildPublicRepoLatestReleaseAssetUrl } = require('./publicRepoMetadata.js');

      expect(config.WORKER_BUNDLE_URL).toContain('.js');
      expect(config.WORKER_BUNDLE_URL).toBe(buildPublicRepoLatestReleaseAssetUrl('sessionCorsWorker.bundle.js'));
      expect(config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe(
        buildPublicRepoLatestReleaseAssetUrl('agentBridgeWorker.bundle.js'),
      );
      expect(config.WORKER_RELEASE_MANIFEST_URL).toBe(
        buildPublicRepoLatestReleaseAssetUrl('worker-release-manifest.json'),
      );
    });
  });

  it('prefers REACT_APP_CE_* env overrides over fallback deployment URLs', () => {
    process.env.REACT_APP_CE_SHARED_WORKER_URL = 'https://shared.example.test/';
    process.env.REACT_APP_CE_DEPLOY_HELPER_URL = 'https://deploy-helper.example.test';
    process.env.REACT_APP_CE_HEALTHCHECK_WORKER_URL = 'https://healthcheck.example.test/';
    process.env.REACT_APP_CE_WORKER_BUNDLE_URL = 'https://assets.example.test/sessionCorsWorker.bundle.js';
    process.env.REACT_APP_CE_AGENT_BRIDGE_WORKER_BUNDLE_URL = 'https://assets.example.test/agentBridgeWorker.bundle.js';
    process.env.REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL = 'https://assets.example.test/worker-release-manifest.json';
    process.env.REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = 'false';
    process.env.REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT = 'abcdef0123456789abcdef0123456789abcdef01';

    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.DEFAULT_SHARED_WORKER_URL).toBe(process.env.REACT_APP_CE_SHARED_WORKER_URL);
      expect(config.DEPLOY_HELPER_URL).toBe(process.env.REACT_APP_CE_DEPLOY_HELPER_URL);
      expect(config.HEALTHCHECK_WORKER_URL).toBe(process.env.REACT_APP_CE_HEALTHCHECK_WORKER_URL);
      expect(config.WORKER_BUNDLE_URL).toBe(process.env.REACT_APP_CE_WORKER_BUNDLE_URL);
      expect(config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe(process.env.REACT_APP_CE_AGENT_BRIDGE_WORKER_BUNDLE_URL);
      expect(config.WORKER_RELEASE_MANIFEST_URL).toBe(process.env.REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL);
      expect(config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED).toBe(false);
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toBe(
        process.env.REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT,
      );
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_URL).toContain('deploy.workers.cloudflare.com');
    });
  });
});
