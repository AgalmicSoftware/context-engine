import { applySessionConfigMutation } from '../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import { projectPublicWorkerSessionConfig } from '../../../../workers/shared/workerSessionConfig.mjs';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const workerUrl = 'https://session-worker.example.test';
const adminAddress = '0x1111111111111111111111111111111111111111';
const sessionId = '0x00112233445566778899aabbccddeeff';
const response = (status, body) => ({ status, ok: status === 200, json: async () => body });

afterEach(() => jest.restoreAllMocks());

it('verifies, edits, verifies again, then publishes through real Worker mutation and public projection', async () => {
  jest.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => { queueMicrotask(callback); return 0; });
  let stored = {};
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  const config = {
    sessionName: 'Round trip', sessionInfo: 'First description',
    appearance: { colorSchemeId: 'amber' }, allowOrigins: ['https://client.example.test'],
    sessionModeProfile: profile, storageProfile: profile.storage, limits: {}, scopes: {},
  };
  const fetchImpl = async (_url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body);
      const result = applySessionConfigMutation({ existingConfig: stored,
        mutation: { kind: 'set-config', incomingConfig: body.config }, slug: 'round-trip' });
      if (!result.ok) return response(result.status, { error: result.error });
      stored = result.config;
      return response(200, { ok: true });
    }
    return response(200, { config: projectPublicWorkerSessionConfig(stored) });
  };
  const input = { workerUrl, adminAddress, sessionId, slug: 'round-trip', config, fetchImpl,
    signAdminAction: async () => ({ address: adminAddress }),
    browserOrigin: 'https://client.example.test', isWorkerCanonical: true };
  const first = await verifySessionWizardWorkerPublicDeployment(input);
  expect(first.publicConfig.appearance).toEqual(config.appearance);
  expect(stored.authzEpoch).toBe(1);
  expect(stored).not.toHaveProperty('workerCanonicalPublicationRevision');
  config.sessionInfo = 'Edited description';
  await verifySessionWizardWorkerPublicDeployment(input);
  expect(stored.sessionInfo).toBe('Edited description');
  expect(stored.authzEpoch).toBe(2);
  expect(stored).not.toHaveProperty('workerCanonicalPublicationRevision');
  const published = await persistAndVerifySessionWizardWorkerConfig({ ...input, retryDelaysMs: [] });
  expect(stored.workerCanonicalPublicationRevision).toBe(published.configRevision);
  expect(published.publicConfig.sessionInfo).toBe('Edited description');
});
