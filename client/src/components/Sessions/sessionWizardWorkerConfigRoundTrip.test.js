import { applySessionConfigMutation } from '../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import { dispatchSessionConfigBootstrapRequest } from '../../../../workers/sessionCorsWorker/sessionConfigBootstrapDispatch.js';
import { selectDeployWorkerSessionConfigFields } from '../../../../workers/shared/workerSessionConfig.mjs';
import { buildSessionWizardDefaultTemplate } from './sessionWizardDraftState';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';
import { buildSessionWizardWorkerVerificationConfig } from './sessionWizardWorkerVerificationConfig';
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
// adaptIncoming can reproduce an older Worker's write semantics.
const createWorker = ({ stored = {}, adaptIncoming = (incoming) => incoming } = {}) => {
  const worker = { stored, reads: [] };
  worker.fetchImpl = async (url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body);
      const result = applySessionConfigMutation({
        existingConfig: worker.stored,
        mutation: { kind: 'set-config', incomingConfig: adaptIncoming(body.config, worker.stored) },
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
    stored: {
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
    },
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

const buildWizardConfig = ({ sessionEndsAt, perWalletPerDay, perAnonymousIpPerDay }) => {
  const draft = buildSessionWizardDefaultTemplate();
  draft.slug = slug;
  draft.sessionName = 'Edited session';
  draft.sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  draft.storageProfile = draft.sessionModeProfile.storage;
  draft.sessionEndsAt = sessionEndsAt;
  return buildSessionWizardWorkerVerificationConfig({
    runtime: {
      draft,
      sessionId,
      account: adminAddress,
      workerLimitPerWallet: perWalletPerDay,
      workerLimitPerAnonymousIp: perAnonymousIpPerDay,
      embeddedDeployHelperEnabled: true,
    },
    draft,
    adminAddress,
    workerUrl,
    allowOrigins: ['https://client.example.test'],
    workerSecrets: {},
  });
};

it.each([
  ['an updated Worker', undefined],
  // Before 0.6.8, set-config merged a supplied limits object key by key.
  [
    'an older Worker that merges limit keys',
    (incoming, stored) => ({ ...incoming, limits: { ...stored.limits, ...incoming.limits } }),
  ],
])('clears an end time and a limit when editing and verifying again on %s', async (_label, adaptIncoming) => {
  const endsAt = '2099-01-02T03:04:00.000Z';
  const worker = createWorker({ adaptIncoming });
  const verify = (config) => verifySessionWizardWorkerPublicDeployment(buildInput(config, worker));

  await verify(buildWizardConfig({ sessionEndsAt: endsAt, perWalletPerDay: '100', perAnonymousIpPerDay: '5' }));
  expect(worker.stored.sessionEndsAt).toBe(endsAt);
  expect(worker.stored.limits).toEqual({ perWalletPerDay: 100, perAnonymousIpPerDay: 5 });

  const edited = buildWizardConfig({ sessionEndsAt: '', perWalletPerDay: '100', perAnonymousIpPerDay: '' });
  await verify(edited);
  expect(worker.stored.sessionEndsAt).toBe('');
  expect(worker.stored.limits).toEqual({ perWalletPerDay: 100, perAnonymousIpPerDay: null });

  const published = await persistAndVerifySessionWizardWorkerConfig({
    ...buildInput(edited, worker),
    retryDelaysMs: [],
  });
  expect(worker.stored.workerCanonicalPublicationRevision).toBe(published.configRevision);
});
