import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { ethers } from 'ethers';
import { installSessionCoordinatorBinding } from '../helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { buildQuestionRecord, buildResponseRecord } from '../../mcp/lib/records.mjs';
import { readWorkerCapabilities } from '../../client/src/utilities/worker/workerCapabilities';
import { uploadDataToSessionStorage } from '../../client/src/utilities/storage/storageClient';
import { loadWorkerResponses } from '../../client/src/utilities/survey/workerResponseHydration';
import { loadWorkerCanonicalQuestions } from '../../client/src/domains/surveys/workerCanonicalMetadataHydrationPort';
import { buildReportResponseStats } from '../../client/src/components/PolisReport/polisReportAnswers';
import { buildRatingMatrixFromRealData } from '../../client/src/components/PolisReport/polisReportRuntime';

const repo = path.resolve(__dirname, '../..');
const tag = 'refs/tags/worker-bundles-stable';
let hasTag = true;
try { execFileSync('git', ['rev-parse', '--verify', tag], { cwd: repo, stdio: 'pipe' }); }
catch { hasTag = false; console.warn('Skipping previous Worker release compatibility: worker-bundles-stable tag is missing (fetch full history to run it).'); }

const memoryKv = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    get: async key => values.get(key) ?? null,
    put: async (key, value) => values.set(key, value),
    delete: async key => values.delete(key),
    list: async ({ prefix = '', cursor = '', limit = 1000 } = {}) => {
      const names = [...values.keys()].filter(key => key.startsWith(prefix)).sort();
      const start = Number(cursor || 0);
      const keys = names.slice(start, start + limit).map(name => ({ name }));
      const done = start + keys.length >= names.length;
      return { keys, list_complete: done, cursor: done ? '' : String(start + keys.length) };
    },
  };
};

(hasTag ? describe : describe.skip)('current clients with the released Worker bundle', () => {
  let tempDir;
  let released;
  let client;
  let config;
  let fetchImpl;
  let token;
  let uploads;
  const originalFetch = globalThis.fetch;
  const originalCrypto = globalThis.crypto;
  let origin;
  let fixtureNumber = 0;
  const slug = 'compat-session';
  const sessionId = `0x${'12'.repeat(16)}`;
  const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
  const session = { sessionSlug: slug, sessionId, sessionName: 'Compatibility fixture' };
  const question = buildQuestionRecord({ prompt: 'Should the pilot continue?', creator: wallet.address, session }).record;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-previous-worker-'));
    const bundlePath = path.join(tempDir, 'worker.mjs');
    const bundle = execFileSync('git', ['show', `${tag}:deploy/cloudflare/session-worker/worker.mjs`], { cwd: repo, maxBuffer: 20 * 1024 * 1024 });
    await fs.writeFile(bundlePath, bundle);
    released = await import(bundlePath);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  }, 30000);

  beforeEach(async () => {
    origin = `https://previous-release-${++fixtureNumber}.example.workers.dev`;
    token = '';
    uploads = [];
    config = {
      slug, sessionId, sessionName: session.sessionName, corsWorkerUrl: origin,
      adminAddress: wallet.address, allowOrigins: ['https://contextengine.sh'],
      workerAuthority: { version: 1, participantScopes: ['storage'] },
      sessionModeProfile: {
        profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' },
        evm: { registryChainId: null },
        storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
        identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
        encryption: { mode: 'none' },
        surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
        results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
        export: { scope: 'all_session' },
      },
      storageProfile: {
        type: 'session_storage_profile', version: 'session-storage-profile-v1', backend: 'cloudflare', sessionOwned: true,
        resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
        payloadAccessControl: { gate: 'none', encryption: 'none', mode: 'public_read', enforcement: 'session_worker_public_read', litRequired: false },
      },
    };
    const env = installSessionCoordinatorBinding({
      GROUP_KV: memoryKv({ [`session:${slug}:config`]: JSON.stringify(config) }),
      CE_STORAGE_INDEX_KV: memoryKv(), TOKEN_HMAC_SECRET: 'synthetic-previous-release-hmac',
    }, released.SessionWriteCoordinator);
    fetchImpl = async (url, init = {}) => {
      const request = new Request(url, init);
      if (new URL(request.url).origin !== origin) throw new Error(`Unexpected external request: ${request.url}`);
      if (new URL(request.url).pathname === '/storage/upload') uploads.push(await request.clone().json());
      const response = await released.default.fetch(request, env, { waitUntil: () => {} });
      if (new URL(request.url).pathname === '/auth/login' && response.ok) token = (await response.clone().json()).token;
      return response;
    };
    globalThis.fetch = fetchImpl;
    client = createWorkerClient({ workerOrigin: origin, slug, trustedOrigins: ['https://contextengine.sh'], wallet, fetchImpl });
    await client.ensureToken();
  });

  afterEach(() => { globalThis.fetch = originalFetch; });
  afterAll(async () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  const submitFromBrowser = () => {
    const response = buildResponseRecord({ question, value: 'Agree', responder: wallet.address, session }).record;
    return uploadDataToSessionStorage(JSON.stringify(response), 'json', {
      sessionSlug: slug, sessionConfig: config, workerUrl: origin, resource: 'responses',
      credentialToken: token, fetchImpl, requestId: 'compat-response-1',
    });
  };

  it('publishes with MCP, submits with the browser, and hydrates saved answers and Results', async () => {
    const ref = await client.upload({ resource: 'questions', data: JSON.stringify(question) });
    expect((await client.read(ref.id)).id).toBe(question.id);
    const submitted = await submitFromBrowser();
    expect((await client.read(submitted.id)).answer.value).toBe('Agree');
    expect((await client.listAll('responses')).items).toHaveLength(1);
    const questions = await loadWorkerCanonicalQuestions({ sessionSlug: slug, sessionConfig: config });
    expect(questions.map(row => row.id)).toEqual([question.id]);
    const answers = await loadWorkerResponses({ sessionSlug: slug, sessionConfig: config });
    expect(answers).toHaveLength(1);
    expect(answers[0].response.answer.value).toBe('Agree');
    const aggregator = { [question.id]: answers.map(row => ({ responder: row.responder, response: JSON.stringify(row.response) })) };
    const metadata = { [question.id]: questions[0].payload };
    expect(buildReportResponseStats(aggregator, metadata, { sessionSlug: slug }).all).toMatchObject({ participants: 1, questions: 1, responses: 1 });
    expect(buildRatingMatrixFromRealData(aggregator, { sessionSlug: slug, metadata }).matrix).toEqual([[1]]);
  });

  it('handles the old capability route without blocking Submit', async () => {
    // The released router authenticates unknown paths before returning 404.
    // Today's anonymous capability probe therefore receives 401, not 404.
    expect((await fetchImpl(`${origin}/capabilities?slug=${slug}`)).status).toBe(401);
    expect(await readWorkerCapabilities(origin, slug, { fetchImpl })).toEqual({ legacy: false, features: [], unavailable: true });
    await client.upload({ resource: 'questions', data: JSON.stringify(question) });
    await submitFromBrowser();
    expect(uploads.filter(row => row.resource === 'responses')).toHaveLength(1);
    const authenticatedFetch = (url, init = {}) => fetchImpl(url, {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, 'X-Group-Slug': slug },
    });
    expect((await authenticatedFetch(`${origin}/capabilities?slug=${slug}`)).status).toBe(404);
    expect(await readWorkerCapabilities(origin, slug, { fetchImpl: authenticatedFetch })).toEqual({ legacy: true, features: [] });
    await submitFromBrowser();
    expect(uploads.filter(row => row.resource === 'responses')).toHaveLength(2);
  });

  it('refuses an admin correction before sending an unstamped upload', async () => {
    await client.upload({ resource: 'questions', data: JSON.stringify(question) });
    await expect(uploadDataToSessionStorage(JSON.stringify({ ...question, description: 'Corrected context' }), 'json', {
      sessionSlug: slug, sessionConfig: config, workerUrl: origin, resource: 'questions',
      context: { account: wallet.address }, credentialToken: token, fetchImpl,
    })).rejects.toThrow('This Worker cannot safely record admin corrections. Upgrade the session Worker');
    expect(uploads).toHaveLength(1);
  });
});
