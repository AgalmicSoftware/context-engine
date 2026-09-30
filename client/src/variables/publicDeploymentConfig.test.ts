import workerReleasePin from './workerReleasePin.json';

const processEnv = process.env as Record<string, string | undefined>;

const releaseAssetUrl = (commit: string, file: string) =>
  `https://github.com/AgalmicSoftware/context-engine/releases/download/worker-bundles-${commit}/${file}`;

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
    });
  });

  it('keeps the default bundle, manifest and native deployment on one immutable release', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toMatch(/^[a-f0-9]{40}$/);
      for (const url of [
        config.WORKER_BUNDLE_URL,
        config.AGENT_BRIDGE_WORKER_BUNDLE_URL,
        config.WORKER_RELEASE_MANIFEST_URL,
      ]) {
        expect(url).toContain(`/releases/download/worker-bundles-${config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT}/`);
      }
    });
  });

  it('downloads every Worker asset and deploys natively from the pinned immutable release', () => {
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');

      expect(config.WORKER_BUNDLE_URL).toBe(releaseAssetUrl(workerReleasePin.commit, 'sessionCorsWorker.bundle.js'));
      expect(config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe(
        releaseAssetUrl(workerReleasePin.commit, 'agentBridgeWorker.bundle.js'),
      );
      expect(config.WORKER_RELEASE_MANIFEST_URL).toBe(
        releaseAssetUrl(workerReleasePin.commit, 'worker-release-manifest.json'),
      );
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toBe(workerReleasePin.commit);
      expect(decodeURIComponent(config.CLOUDFLARE_NATIVE_DEPLOY_URL)).toContain(
        `/tree/${workerReleasePin.commit}/deploy/cloudflare/session-worker`,
      );
      expect(JSON.stringify(config)).not.toContain('/releases/latest/');
    });
  });

  it('moves the native deploy and default downloads together to an explicit release commit', () => {
    const commit = '0123456789abcdef0123456789abcdef01234567';
    process.env.REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT = commit.toUpperCase();
    jest.isolateModules(() => {
      const config = require('./publicDeploymentConfig.js');
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_URL).toContain('https://deploy.workers.cloudflare.com/');
      expect(decodeURIComponent(config.CLOUDFLARE_NATIVE_DEPLOY_URL)).toContain(
        `/tree/${commit}/deploy/cloudflare/session-worker`,
      );
      expect(config.WORKER_BUNDLE_URL).toBe(releaseAssetUrl(commit, 'sessionCorsWorker.bundle.js'));
      expect(config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe(releaseAssetUrl(commit, 'agentBridgeWorker.bundle.js'));
      expect(config.WORKER_RELEASE_MANIFEST_URL).toBe(releaseAssetUrl(commit, 'worker-release-manifest.json'));
    });
  });

  it('fails closed instead of falling back to latest when the release commit is invalid', () => {
    const expectNoReleaseDefaults = (config: Record<string, unknown>) => {
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT).toBe('');
      expect(config.CLOUDFLARE_NATIVE_DEPLOY_URL).toBe('');
      expect(config.WORKER_BUNDLE_URL).toBe('');
      expect(config.AGENT_BRIDGE_WORKER_BUNDLE_URL).toBe('');
      expect(config.WORKER_RELEASE_MANIFEST_URL).toBe('');
    };

    process.env.REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT = 'main';
    jest.isolateModules(() => expectNoReleaseDefaults(require('./publicDeploymentConfig.js')));

    clearPublicDeploymentEnv();
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock('./workerReleasePin.json', () => ({ commit: 'v0.6.3' }));
      expectNoReleaseDefaults(require('./publicDeploymentConfig.js'));
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
