#!/usr/bin/env node
// Real Session Worker auth/uploads, fresh local contracts, and a local Arweave stand-in.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { createParticipant } from '../mcp/lib/participant.mjs';
import { readConfig } from '../mcp/lib/config.mjs';
import { buildQuestionRecord } from '../mcp/lib/records.mjs';
import { arweaveIdToHex } from '../mcp/lib/registryPayloads.mjs';
import worker from '../workers/sessionCorsWorker/worker.js';
import { installSessionCoordinatorBinding } from '../tests/helpers/sessionCorsWorkerTestUtils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chainId = 11155420;
const workerOrigin = 'https://registry-smoke.example.workers.dev';
const workerRpcOrigin = 'https://registry-rpc.example.test';
const slug = 'registry-agent-smoke';
const sessionId = '0x11111111111111111111111111111111';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const createMemoryKv = (seed) => {
  const values = new Map(Object.entries(seed));
  return {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => { values.set(key, value); },
    delete: async (key) => { values.delete(key); },
  };
};
const freePort = async () => {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const main = async () => {
  let anvil;
  let provider;
  let arweaveServer;
  let stateDir;
  const originalFetch = globalThis.fetch;
  try {
    const port = await freePort();
    const rpcUrl = `http://127.0.0.1:${port}`;
    anvil = spawn('anvil', ['--silent', '--host', '127.0.0.1', '--port', String(port), '--chain-id', String(chainId)], { stdio: 'ignore' });
    let startupError;
    anvil.on('error', (error) => { startupError = error; });
    provider = new ethers.providers.JsonRpcProvider({ url: rpcUrl, timeout: 5000 }, chainId);
    provider.pollingInterval = 100;
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
      if (startupError) throw startupError;
      try { await provider.getBlockNumber(); ready = true; } catch { await pause(100); }
    }
    assert.ok(ready, 'local Anvil must start');
    const admin = provider.getSigner(0);
    const deploy = async (name) => {
      const artifact = JSON.parse(await fs.readFile(path.join(root, `out/${name}.sol/${name}.json`), 'utf8'));
      const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, admin).deploy();
      return contract.deployed();
    };
    const registry = await deploy('SessionRegistry');
    const surveys = await deploy('Surveys');
    const records = new Map();
    let hideReads = false;
    let uploadCount = 0;
    arweaveServer = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/tx_anchor') return response.end(Buffer.alloc(32, 1).toString('base64url'));
        if (url.pathname.startsWith('/price/')) return response.end('1');
        if (url.pathname === '/tx' && request.method === 'POST') {
          let raw = '';
          for await (const chunk of request) raw += chunk;
          const transaction = JSON.parse(raw);
          assert.ok(transaction.signature, 'real Arweave signing must run');
          records.set(transaction.id, JSON.parse(Buffer.from(transaction.data, 'base64url').toString('utf8')));
          uploadCount += 1;
          return response.end('OK');
        }
        const id = url.pathname.split('/').pop();
        if (!hideReads && records.has(id)) {
          response.setHeader('Content-Type', 'application/json');
          return response.end(JSON.stringify(records.get(id)));
        }
        response.statusCode = 404;
        response.end('Not propagated yet');
      } catch {
        response.statusCode = 500;
        response.end('Local Arweave fixture failed');
      }
    }).listen(0, '127.0.0.1');
    await once(arweaveServer, 'listening');
    const arweaveOrigin = `http://127.0.0.1:${arweaveServer.address().port}`;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.origin === workerRpcOrigin) return originalFetch(`${rpcUrl}${url.pathname}`, init);
      if (['ar-io.dev', 'arweave.net'].includes(url.hostname)) return originalFetch(`${arweaveOrigin}${url.pathname}`, init);
      throw new Error(`Unexpected network destination in registry smoke: ${url.origin}`);
    };
    const metadata = {
      slug, sessionName: 'Registry agent smoke', networkChainId: chainId, blockLimits: { start: 0 }, corsWorkerUrl: workerOrigin,
      rpcUrl: 'https://unused-rpc.example.test', contracts: { surveys: { address: surveys.address, chainId } },
      sessionModeProfile: {
        profileVersion: 1, preset: 'custom', authority: { mode: 'evm_registry_canonical' }, evm: { registryChainId: chainId },
        storage: { backend: 'arweave', payloadAccessControl: { gate: 'none', encryption: 'none' } },
        identity: { default: 'passkey', enabled: ['passkey', 'wallet'] }, authorization: { mechanisms: ['sbt_onchain'] },
        encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
        results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
        export: { scope: 'all_session' },
      },
    };
    await (await registry.createSession(slug, sessionId, chainId, `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`, '',
      { value: ethers.utils.parseEther('0.0001') })).wait();
    const seed = buildQuestionRecord({ prompt: 'Participants should explain their reasoning.', creator: await admin.getAddress(), session: { sessionSlug: slug, sessionName: metadata.sessionName } });
    const seedId = createHash('sha256').update(JSON.stringify(seed.record)).digest('base64url');
    records.set(seedId, seed.record);
    await (await surveys.addQuestions([seed.id], [arweaveIdToHex(seedId)], [ethers.constants.HashZero])).wait();
    const jwk = generateKeyPairSync('rsa', { modulusLength: 4096 }).privateKey.export({ format: 'jwk' });
    const env = installSessionCoordinatorBinding({ TOKEN_HMAC_SECRET: 'registry-agent-smoke-secret', GROUP_KV: createMemoryKv({
      [`session:${slug}:config`]: JSON.stringify({ ...metadata, registryAddress: registry.address, registryChainId: chainId,
        rpcUrl: workerRpcOrigin, rpcUrlsByChainId: { [chainId]: [workerRpcOrigin] }, allowOrigins: ['https://contextengine.sh'] }),
      [`session:${slug}:secrets`]: JSON.stringify({ arweaveJwk: jwk, customRpcUrl: workerRpcOrigin }),
    }) });
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-smoke-'));
    const wallet = ethers.Wallet.createRandom();
    await provider.send('anvil_setBalance', [wallet.address, ethers.utils.hexValue(ethers.utils.parseEther('0.05'))]);
    const participantOptions = {
      config: readConfig({ CE_MCP_STATE_DIR: stateDir, CE_MCP_RPC_URL: rpcUrl, CE_MCP_ALLOW_LOCAL_WORKERS: '1' }), wallet,
      registry: { addresses: { sessionRegistry: registry.address, surveys: surveys.address } },
      fetchImpl: async (url, init = {}) => new URL(url).origin === workerOrigin
        ? worker.fetch(new Request(url, init), env, { waitUntil() {}, passThroughOnException() {} })
        : globalThis.fetch(url, init),
    };
    const participant = createParticipant(participantOptions);
    const joined = await participant.joinSession({ link: `https://contextengine.sh/session/${slug}` });
    assert.equal(joined.signedIn, true, joined.readOnlyReason);
    assert.ok(joined.scopes.includes('arweave'));
    assert.equal((await participant.listQuestions()).questions[0].id, seed.id);
    const answered = await participant.answer({ answers: [{ questionId: seed.id, value: 'Agree', comment: 'Reasoning helps review.' }] });
    assert.equal(answered.submitted, 1, JSON.stringify(answered.results));
    assert.ok(answered.txHash);
    const statement = await participant.addStatement({ prompt: 'Public summaries should include agent disclosures.' });
    assert.equal(statement.created, true);
    await assert.rejects(participant.addStatement({ prompt: 'Public summaries should include agent disclosures.' }), /already exists.*reword/);
    hideReads = true;
    assert.equal((await participant.listQuestions({ filter: 'all' })).total, 2);
    const immediate = await participant.getResults();
    assert.equal(immediate.participants, 1);
    assert.equal(immediate.questions.find((question) => question.questionId === seed.id).counts.Agree, 1);
    hideReads = false;
    const reopened = createParticipant(participantOptions);
    const results = await reopened.getResults();
    assert.equal(results.partial, false);
    assert.equal(results.questions.length, 2);
    assert.equal(results.questions.find((question) => question.questionId === seed.id).selfDeclaredAgents, 1);
    assert.equal(uploadCount, 2, 'one answer and one new statement were uploaded');
    console.log('Registry agent smoke passed: real Worker sign-in and Arweave upload, join/list/answer/add/results, duplicate refusal, propagation delay, and reopening saved state.');
  } finally {
    globalThis.fetch = originalFetch;
    provider?.removeAllListeners();
    if (arweaveServer) await new Promise((resolve) => arweaveServer.close(resolve));
    if (stateDir) await fs.rm(stateDir, { recursive: true, force: true });
    if (anvil?.pid && anvil.exitCode === null) { const exited = once(anvil, 'exit'); anvil.kill('SIGTERM'); await exited; }
  }
};

main().catch((error) => { console.error(`Registry agent smoke failed: ${error.message}`); process.exitCode = 1; });
