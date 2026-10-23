import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerRouteShellWithWorkerDeps } from './workerRouteShellBinding.js';
import { authorizeCloudflareStorageResourceRead } from './storageRouteExecution.js';
import { resolveRpcUrlListForGate } from './gateRpcResolution.js';

const principal = `0x${'11'.repeat(20)}`;
const secretRpcUrl = 'https://private-rpc.example.test/eth';
const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const gate = { sbtAddresses: [`0x${'aa'.repeat(20)}`], chainId: 31337, mode: 'all' };
const config = {
  sessionId, networkChainId: 31337,
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' }, encryption: { mode: 'none' },
    results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true } },
  },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { encryption: 'none', gate: 'sbt_gate' } },
  __registry: { gatesByResource: { default: gate, docUploads: gate, questionResponses: gate, surveyResponses: gate } },
};

const fixture = ({ secrets = async () => ({ customRpcUrl: secretRpcUrl }), member = true } = {}) => {
  const calls = { secretReads: 0, gateRpcs: [], artifacts: 0 };
  const shell = createWorkerRouteShellWithWorkerDeps({
    constants: { missingSlugError: 'Missing sessionSlug.', sessionConfigNotFoundError: 'Session config not found.' },
    deps: {
      json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
      toStr: (value) => String(value ?? ''), corsHeaders: () => ({}),
      resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'session-a', explicitSlugProvided: true }),
      readCurrentSessionConfig: async () => ({ revision: 1, config }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      requireAuth: async () => ({ ok: true, slug: 'session-a', payload: { sub: principal, sessionId, scopes: { storage: true } } }),
      computeScopesForLogin: async () => ({ storage: true }), checkRateLimit: async () => true,
      getSessionSecrets: async () => { calls.secretReads += 1; return secrets(); },
      resolveRpcUrlListForGate: (runtimeConfig, gateChainId) => resolveRpcUrlListForGate({ config: runtimeConfig, gateChainId }),
      checkSbtGate: async ({ rpcUrl }) => { calls.gateRpcs.push(rpcUrl); return member && rpcUrl === secretRpcUrl; },
      authorizeCloudflareStorageResourceRead,
      readPublishedResultsAnalysisArtifact: async () => { calls.artifacts += 1; return { ok: true, artifact: { kind: 'ce_session_results_analysis_artifact' } }; },
    },
  });
  return { calls, run: () => shell.fetch(new Request('https://worker.example/results-analysis/artifact?slug=session-a', {
    headers: { authorization: 'Bearer synthetic' },
  }), {}) };
};

test('report artifact authorizes all storage resources using session-secret RPC without publishing it', async () => {
  const before = structuredClone(config);
  const f = fixture();
  const response = await f.run();
  assert.equal(response.status, 200);
  assert.equal(f.calls.artifacts, 1);
  assert.ok(f.calls.gateRpcs.length >= 3);
  assert.ok(f.calls.gateRpcs.every((rpcUrl) => rpcUrl === secretRpcUrl));
  assert.ok(f.calls.secretReads > 0);
  assert.equal((await response.text()).includes(secretRpcUrl), false);
  assert.deepEqual(config, before);
});

for (const [label, options] of [
  ['missing secret', { secrets: async () => ({}) }],
  ['unavailable secrets', { secrets: async () => { throw new Error('secret store unavailable'); } }],
  ['invalid RPC', { secrets: async () => ({ customRpcUrl: 'invalid' }) }],
  ['nonmember', { member: false }],
]) {
  test(`report artifact remains denied with ${label}`, async () => {
    const f = fixture(options);
    const response = await f.run();
    assert.notEqual(response.status, 200);
    assert.equal(f.calls.artifacts, 0);
    assert.equal((await response.text()).includes(secretRpcUrl), false);
  });
}
