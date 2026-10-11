import { applySessionConfigMutation } from '../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import { dispatchSessionConfigBootstrapRequest } from '../../../../workers/sessionCorsWorker/sessionConfigBootstrapDispatch.js';
import { selectDeployWorkerSessionConfigFields } from '../../../../workers/shared/workerSessionConfig.mjs';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const workerUrl = 'https://session-worker.example.test';
const adminAddress = '0x1111111111111111111111111111111111111111';
const sessionId = '0x00112233445566778899aabbccddeeff';
const slug = 'round-trip';
// A deployed Worker with a storage KEK advertises response field encryption
// on every /session-config read.
const workerEnv = { CE_STORAGE_ENVELOPE_KEK: 'test-kek', STORAGE_KV: { put: async () => {} } };
const response = (status, body) => ({ status, ok: status === 200, json: async () => body });

// Serves set-config through the real Worker mutation and /session-config
// through the real Worker dispatcher, so the client sees what a Worker returns.
const createWorker = (stored = {}) => {
  const worker = { stored, reads: [] };
  worker.fetchImpl = async (url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body);
      const result = applySessionConfigMutation({
        existingConfig: worker.stored,
        mutation: { kind: 'set-config', incomingConfig: body.config },
        slug,
      });
      if (!result.ok) return response(result.status, { error: result.error });
      if (!result.skipPersistence) worker.stored = result.config;
      return response(200, { ok: true });
    }
    const read = await dispatchSessionConfigBootstrapRequest({
      request: { url: String(url), headers: new Headers(init?.headers) },
      env: workerEnv,
      constants: { missingSlugError: 'Missing session slug.', sessionConfigNotFoundError: 'Session not found.' },
      deps: {
        resolveRequestSlugWithoutToken: ({ request }) => ({
          ok: true,
          slug: request.headers.get('X-Session-Slug'),
          explicitSlugProvided: true,
        }),
        getSessionConfig: async () => worker.stored,
        getCorsContext: async () => ({ ok: true, headers: {} }),
        json: (body, status) => response(status, body),
      },
    });
    worker.reads.push(await read.json());
    return read;
  };
  return worker;
};

const buildConfig = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  return {
    sessionName: 'Round trip',
    sessionInfo: 'First description',
    appearance: { colorSchemeId: 'amber' },
    allowOrigins: ['https://client.example.test'],
    sessionModeProfile: profile,
    storageProfile: profile.storage,
    limits: {},
    scopes: {},
    embeddedDeployHelperEnabled: true,
  };
};

const buildInput = (config, worker) => ({
  workerUrl,
  adminAddress,
  sessionId,
  slug,
  config,
  fetchImpl: worker.fetchImpl,
  signAdminAction: async () => ({ address: adminAddress }),
  browserOrigin: 'https://client.example.test',
  isWorkerCanonical: true,
});

beforeEach(() => {
  jest.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
    queueMicrotask(callback);
    return 0;
  });
});

afterEach(() => jest.restoreAllMocks());

it('verifies, edits, verifies again, then publishes through the real Worker mutation and readback', async () => {
  const config = buildConfig();
  const worker = createWorker();
  const input = buildInput(config, worker);

  const first = await verifySessionWizardWorkerPublicDeployment(input);
  expect(first.publicConfig.appearance).toEqual(config.appearance);
  // The real readback advertises field encryption the wizard never sends.
  expect(worker.reads.at(-1).config.responseFieldEncryption).toEqual({ version: 1 });
  expect(worker.stored.authzEpoch).toBe(1);
  expect(worker.stored).not.toHaveProperty('workerCanonicalPublicationRevision');
  config.sessionInfo = 'Edited description';
  await verifySessionWizardWorkerPublicDeployment(input);
  expect(worker.stored.sessionInfo).toBe('Edited description');
  expect(worker.stored.authzEpoch).toBe(2);
  expect(worker.stored).not.toHaveProperty('workerCanonicalPublicationRevision');
  const published = await persistAndVerifySessionWizardWorkerConfig({ ...input, retryDelaysMs: [] });
  expect(worker.stored.workerCanonicalPublicationRevision).toBe(published.configRevision);
  expect(published.publicConfig.sessionInfo).toBe('Edited description');
});

it('verifies and publishes over the config a deploy helper staged', async () => {
  const config = buildConfig();
  // Mirrors deployHelperCore: the helper writes server-managed state, the
  // deploy request's canonical fields and its attempt revision straight to KV.
  const worker = createWorker({
    slug,
    authzEpoch: 1,
    workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'deployment-1' },
    adminAddress,
    allowOrigins: config.allowOrigins,
    limits: { perWalletPerDay: 25 },
    scopes: {},
    // Helpers before this release staged the URL with a trailing slash.
    corsWorkerUrl: `${workerUrl}/`,
    embeddedDeployHelperEnabled: true,
    ...selectDeployWorkerSessionConfigFields({ ...config, sessionId, configRevision: 'deploy-attempt-revision' }),
  });
  const input = buildInput(config, worker);

  await expect(verifySessionWizardWorkerPublicDeployment(input)).resolves.toEqual(
    expect.objectContaining({ workerOrigin: workerUrl, configRevision: '' }),
  );
  expect(worker.reads.at(-1).config.configRevision).toBe('deploy-attempt-revision');
  expect(worker.stored.corsWorkerUrl).toBe(workerUrl);
  expect(worker.stored.limits).toEqual({});

  const published = await persistAndVerifySessionWizardWorkerConfig({ ...input, retryDelaysMs: [] });
  expect(worker.stored.workerCanonicalPublicationRevision).toBe(published.configRevision);
  expect(worker.stored.configRevision).toBe(published.configRevision);
});
