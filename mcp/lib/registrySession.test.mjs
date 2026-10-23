import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createRegistrySession } from './registrySession.mjs';
import { createParticipant } from './participant.mjs';
import { readConfig } from './config.mjs';
import { registryQuestionMatchesSession } from './registryIdentity.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const wallet = ethers.Wallet.createRandom();
const surveysAddress = ethers.Wallet.createRandom().address;
const registryAddress = ethers.Wallet.createRandom().address;
const qid = ethers.utils.id('one');
const otherId = ethers.utils.id('other');
const blockedId = ethers.utils.id('blocked');
const metadata = {
  slug: 'town', sessionName: 'Town', corsWorkerUrl: 'https://w.example.dev', blockLimits: { start: 0 },
  contracts: { surveys: { address: surveysAddress } },
  sessionModeProfile: { authority: { mode: 'evm_registry_canonical' }, encryption: { mode: 'none' }, results: { visibility: 'public_full_if_storage_public' } },
};
const fixture = (overrides = {}) => {
  const meta = { ...metadata, ...overrides };
  const uploaded = [];
  const writes = [];
  const faults = { send: null, afterConfirmation: null };
  let chain = 11155420;
  let gasPrice = ethers.BigNumber.from(1000000);
  let balance = ethers.utils.parseEther('1');
  const logs = [];
  const records = new Map();
  const hashes = new Map();
  const provider = {
    _isProvider: true,
    send: async () => ethers.utils.hexValue(chain), getBlockNumber: async () => 10,
    getBlock: async (number) => ({ timestamp: 1000 + number }),
    getLogs: async (filter) => logs.filter((log) => log.blockNumber >= filter.fromBlock && log.blockNumber <= filter.toBlock && log.topics[0] === filter.topics[0]),
    getGasPrice: async () => gasPrice, getBalance: async () => balance,
  };
  const registry = {
    getSessionBySlug: async () => ['town', 11155420, `data:application/json,${encodeURIComponent(JSON.stringify(meta))}`, '', wallet.address, 1, 1, '0x11111111111111111111111111111111'],
    getSessionFields: async (_slug, fields) => { assert.deepEqual(fields, ['corsWorkerUrl']); return ['']; },
  };
  let surveys;
  const factory = (address, abi) => {
    if (address === registryAddress) return registry;
    const iface = new ethers.utils.Interface(abi);
    surveys = {
      interface: iface, address: surveysAddress,
      getQuestionHash: async (id) => hashes.get(id), questionHashes: async (id) => hashes.get(id) || ethers.constants.HashZero,
      getResponse: async (_responder, id) => hashes.get(id),
      connect: () => surveys,
      addQuestions: async () => { if (faults.send) throw faults.send; throw new Error('No statement success fixture'); },
      submitResponses: async (...args) => {
        writes.push(args);
        if (faults.send) throw faults.send;
        const event = iface.encodeEventLog(iface.getEvent('ResponsesSubmitted'), [wallet.address, args[0], ethers.constants.HashZero]);
        return { hash: ethers.utils.id('tx'), wait: async () => {
          await faults.afterConfirmation?.();
          return { status: 1, blockNumber: 11, transactionIndex: 0, logs: [{ ...event, address: surveysAddress, logIndex: 0 }] };
        } };
      },
    };
    return surveys;
  };
  const fetchImpl = async (url) => Response.json(records.get(new URL(url).pathname.split('/').pop()));
  const open = () => createRegistrySession({ info: { slug: 'town', chainId: 11155420 }, config: { rpcUrl: '', allowLocalWorkers: false }, wallet, fetchImpl,
    options: { provider, addresses: { sessionRegistry: registryAddress, surveys: surveysAddress }, createContract: factory } });
  const addQuestion = (id, payload, block = 1) => {
    const pointer = ethers.utils.id(id);
    hashes.set(id, pointer);
    records.set(Buffer.from(pointer.slice(2), 'hex').toString('base64url'), payload);
    const event = surveys.interface.encodeEventLog(surveys.interface.getEvent('QuestionsAdded'), [wallet.address, [id], [ethers.constants.HashZero]]);
    logs.push({ ...event, blockNumber: block, transactionIndex: 0, logIndex: logs.length });
  };
  const client = { ensureToken: async () => {}, describeTestEth: async () => ({ offered: false }), request: async (_path, args) => {
    uploaded.push(args.body);
    return { id: Buffer.alloc(32, uploaded.length).toString('base64url') };
  } };
  const addResponse = (id, payload, blockNumber) => {
    const pointer = ethers.utils.id(JSON.stringify(payload));
    hashes.set(id, pointer);
    records.set(Buffer.from(pointer.slice(2), 'hex').toString('base64url'), payload);
    const event = surveys.interface.encodeEventLog(surveys.interface.getEvent('ResponsesSubmitted'), [wallet.address, [id], ethers.constants.HashZero]);
    logs.push({ ...event, blockNumber, transactionIndex: 0, logIndex: logs.length });
  };
  return { open, addQuestion, addResponse, hashes, uploaded, writes, faults, client, fetchImpl,
    options: { provider, addresses: { sessionRegistry: registryAddress, surveys: surveysAddress }, createContract: factory },
    setChain: (value) => { chain = value; }, setGasPrice: (value) => { gasPrice = value; }, setBalance: (value) => { balance = value; } };
};

test('registry question reads filter sessions and blocked ids, trust chain ids and reuse payloads', async () => {
  const f = fixture({ BLOCKED_QUESTION_IDS: [blockedId] });
  const session = await f.open();
  f.addQuestion(qid, { id: 'untrusted-id', sessionSlug: 'town', prompt: 'One', type: 'binary' });
  f.addQuestion(otherId, { sessionSlug: 'elsewhere', sessionName: 'Town', prompt: 'Other', type: 'binary' });
  f.addQuestion(blockedId, { sessionName: 'Town', prompt: 'Blocked', type: 'binary' });
  const first = await session.loadQuestions();
  assert.deepEqual(first.items.map((item) => item.id), [qid]);
  assert.equal(first.complete, true);
  assert.equal((await session.loadQuestions()).items.length, 1);
});

test('question scoping keeps explicit slugs authoritative and accepts the general alias', () => {
  assert.equal(registryQuestionMatchesSession({ sessionSlug: 'elsewhere', sessionName: 'Town' }, metadata), false);
  assert.equal(registryQuestionMatchesSession({ sessionName: 'Town' }, metadata), true);
  assert.equal(registryQuestionMatchesSession({ sessionSlug: '' }, { slug: 'general' }), true);
  assert.equal(registryQuestionMatchesSession({ sessionSlug: 'general' }, { slug: 'general' }), true);
  assert.equal(registryQuestionMatchesSession({}, metadata), false);
});

test('registry refuses encrypted metadata fields, unsupported profiles and wrong-chain reads', async () => {
  for (const overrides of [
    { encryptedFields: { sessionName: 'ciphertext' } },
    { sessionModeProfile: { authority: { mode: 'worker_canonical' } } },
    { sessionModeProfile: { ...metadata.sessionModeProfile, encryption: { mode: 'lit' } } },
    { sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } } },
    { corsWorkerUrl: { encrypted: true, value: 'ciphertext' } },
  ]) await assert.rejects(fixture(overrides).open(), /encrypted|unencrypted|registry|Worker/i);
  const f = fixture(); f.setChain(1);
  await assert.rejects(f.open(), /different chain/);
});

test('existing statements are refused before upload and gas caps precede uploads', async () => {
  const f = fixture(); const session = await f.open();
  f.hashes.set(qid, ethers.utils.id('existing'));
  await assert.rejects(session.addStatement({ client: f.client, record: { id: qid } }), /already exists.*reword/i);
  assert.equal(f.uploaded.length, 0);
  f.setGasPrice(ethers.utils.parseUnits('1000', 'gwei'));
  await assert.rejects(session.submitAnswers({ client: f.client, records: [{ questionID: qid }] }), /0.005/);
  assert.equal(f.uploaded.length, 0);
  f.setChain(1);
  await assert.rejects(session.submitAnswers({ client: f.client, records: [{ questionID: qid }] }), /different chain/);
});

test('answers upload CE tags and use one confirmed chain transaction for the batch', async () => {
  const f = fixture(); const session = await f.open();
  const records = [qid, otherId].map((questionID) => ({ questionID, sessionSlug: 'town', answer: { value: 'Agree', encrypted: false } }));
  const result = await session.submitAnswers({ client: f.client, records });
  assert.equal(f.uploaded.length, 2);
  assert.ok(f.uploaded.every((item) => item.sessionSlug === 'town' && item.contentType === 'application/json' && item.tags.every((tag) => tag.name.startsWith('CE-'))));
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0][0], [qid, otherId]);
  assert.equal(result.txHash, ethers.utils.id('tx'));
});

test('short balances use the shared funding callback only when the session offers test ETH', async () => {
  const f = fixture(); const session = await f.open();
  f.setBalance(ethers.constants.Zero);
  const records = [{ questionID: qid, sessionSlug: 'town', answer: { value: 'Agree' } }];
  let calls = 0;
  const fund = async () => { calls += 1; f.setBalance(ethers.utils.parseEther('1')); };
  await assert.rejects(session.submitAnswers({ client: f.client, records, fund }), new RegExp(`Fund ${wallet.address}`));
  assert.equal(calls, 0);
  assert.equal(f.uploaded.length, 0);
  f.client.describeTestEth = async () => ({ offered: true });
  await session.submitAnswers({ client: f.client, records, fund });
  assert.equal(calls, 1);
  assert.equal(f.writes.length, 1);
});

test('registry writes explain how to fund a wallet when faucet access is unavailable', async () => {
  for (const action of ['submitAnswers', 'addStatement']) {
    const f = fixture(); const session = await f.open();
    f.setBalance(ethers.constants.Zero);
    f.client.describeTestEth = async () => ({ offered: true, tokenHasFaucetScope: false });
    let requests = 0;
    const args = { client: f.client, records: [{ questionID: qid }], record: { id: qid },
      fund: async () => { requests += 1; throw new Error('This session does not offer test ETH to you.'); } };
    await assert.rejects(session[action](args), new RegExp(`Fund ${wallet.address}.*chain 11155420.*ETH`));
    assert.equal(requests, 0);
    f.client.describeTestEth = async () => ({ offered: true, tokenHasFaucetScope: true });
    await assert.rejects(session[action](args), (error) => {
      assert.match(error.message, new RegExp(`Fund ${wallet.address}`));
      assert.match(error.message, /does not offer test ETH/);
      return true;
    });
    assert.equal(f.uploaded.length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('registry writes keep pending faucet transaction hashes and explain balance refusals', async () => {
  const f = fixture(); const session = await f.open();
  f.setBalance(ethers.constants.Zero);
  f.client.describeTestEth = async () => ({ offered: true, tokenHasFaucetScope: true });
  const args = { client: f.client, records: [{ questionID: qid }] };
  const txHash = ethers.utils.id('pending-faucet');
  await assert.rejects(session.submitAnswers({ ...args, fund: async () => ({ sent: true, pending: true, txHash }) }), new RegExp(txHash));
  await assert.rejects(session.submitAnswers({ ...args, fund: async () => ({ sent: false, reason: 'balance_high' }) }), /refused.*above.*threshold/i);
  await assert.rejects(session.submitAnswers({ ...args, fund: async () => {
    f.options.provider.getBalance = async () => { throw new Error('Balance RPC unavailable'); };
    return { sent: true, pending: true, txHash };
  } }), new RegExp(txHash));
  assert.equal(f.uploaded.length, 0);
});

test('newer chain answers supersede locally remembered answers and results obey the record cap', async () => {
  const f = fixture(); const session = await f.open();
  const records = [qid, otherId].map((questionID) => ({ questionID, sessionSlug: 'town', answer: { value: 'Agree', encrypted: false } }));
  await session.submitAnswers({ client: f.client, records });
  const capped = await session.readAnswers({ questionIds: new Set([qid, otherId]), maxRecords: 1 });
  assert.equal(capped.entries.length, 1);
  assert.equal(capped.complete, false);
  // Use a later transaction in a block included by this fixture's head.
  f.addResponse(qid, { questionID: qid, answer: { value: 'ciphertext', encrypted: true } }, 10);
  // The local receipt is block 11; move this external event beyond it through the fixture head.
  f.options.provider.getBlockNumber = async () => 12;
  f.addResponse(qid, { questionID: qid, answer: { value: 'new ciphertext', encrypted: true } }, 12);
  const latest = await session.readAnswers({ questionIds: new Set([qid]) });
  assert.equal(latest.entries.length, 0);
});

test('long registry sessions read recent answers first and finish older history across calls', async () => {
  const f = fixture();
  let head = 1200000;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  f.addResponse(qid, { questionID: qid, answer: { value: 'old' } }, 1);
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'recent' } }, 1000000);
  const questionIds = new Set([qid, otherId]);
  const first = await session.readAnswers({ questionIds });
  assert.equal(first.complete, false);
  assert.deepEqual(first.entries.map((entry) => entry.payload.answer.value), ['recent']);
  head += 1;
  const second = await session.readAnswers({ questionIds });
  assert.equal(second.complete, true);
  assert.deepEqual(new Set(second.entries.map((entry) => entry.payload.answer.value)), new Set(['recent', 'old']));
  head += 1;
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'ciphertext', encrypted: true } }, head);
  const third = await session.readAnswers({ questionIds });
  assert.equal(third.complete, true);
  assert.deepEqual(third.entries.map((entry) => entry.questionId), [qid]);
  assert.equal(third.chainOrders.get(otherId).blockNumber, head);
  const own = await session.readAnswers({ questionIds, mine: true });
  assert.equal(own.complete, false);
  assert.equal(own.chainOrders.get(otherId).blockNumber, head);
});

test('participant joins registry links read-only when gates refuse login and persists a distinct registry entry', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-participant-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  const participant = createParticipant({ config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
      const pathname = new URL(url).pathname;
      if (pathname === '/resource-presence') return Response.json({ resources: { txGas: false } });
      if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
      if (pathname === '/auth/login') return Response.json({ error: 'default gate requires membership' }, { status: 403 });
      throw new Error(`Unexpected Worker read ${pathname}`);
    },
  });
  const joined = await participant.joinSession({ link: 'https://contextengine.sh/session/town' });
  assert.equal(joined.signedIn, false);
  assert.match(joined.readOnlyReason, /gate requires membership/);
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  assert.equal((await participant.listQuestions()).questions[0].id, qid);
  assert.equal((await participant.getResults()).resultsPublic, true);
  await assert.rejects(participant.joinGroup({ groupId: 'group' }), /not available in on-chain/);
  const state = JSON.parse(await fs.readFile(path.join(stateDir, 'state.json'), 'utf8'));
  assert.match(state.current, /^registry /);
  assert.equal(state.sessions[state.current].kind, 'registry');
});

test('an external registry answer replaces an older answer remembered in agent state', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-order-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  let now = Date.parse('2026-10-16T00:00:00Z');
  const participant = createParticipant({ config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options, now: () => now,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
      const pathname = new URL(url).pathname;
      if (pathname === '/resource-presence') return Response.json({ resources: {} });
      if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
      if (pathname === '/auth/login') return Response.json({ token: 'e30.sig', exp: 9999999999 });
      if (pathname === '/arweave/upload') return Response.json({ id: Buffer.alloc(32, 2).toString('base64url') });
      throw new Error(`Unexpected route ${pathname}`);
    },
  });
  await participant.joinSession({ link: 'https://contextengine.sh/session/town' });
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  assert.equal((await participant.answer({ answers: [{ questionId: qid, value: 'Agree' }] })).submitted, 1);
  f.options.provider.getBlockNumber = async () => 12;
  f.addResponse(qid, { questionID: qid, type: 'binary', answer: { value: 'Disagree', encrypted: false } }, 12);
  now += 11 * 60 * 1000;
  const listed = await participant.listQuestions({ filter: 'answered' });
  assert.equal(listed.questions[0].myAnswer.value, 'Disagree');
  f.options.provider.getBlockNumber = async () => 13;
  f.addResponse(qid, { questionID: qid, type: 'binary', answer: { value: 'ciphertext', encrypted: true } }, 13);
  now += 11 * 60 * 1000;
  assert.equal((await participant.listQuestions({ filter: 'answered' })).questions.length, 0);
});

test('incomplete own-answer scans do not restore saved plaintext and resume without waiting for cache expiry', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-partial-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  const args = { config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
      const pathname = new URL(url).pathname;
      if (pathname === '/resource-presence') return Response.json({ resources: {} });
      if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
      if (pathname === '/auth/login') return Response.json({ token: 'e30.sig', exp: 9999999999 });
      if (pathname === '/arweave/upload') return Response.json({ id: Buffer.alloc(32, 2).toString('base64url') });
      throw new Error(`Unexpected route ${pathname}`);
    },
  };
  const first = createParticipant(args);
  await first.joinSession({ link: 'https://contextengine.sh/session/town' });
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  await first.answer({ answers: [{ questionId: qid, value: 'Agree' }] });
  f.options.provider.getBlockNumber = async () => 1200000;
  f.addResponse(qid, { questionID: qid, type: 'binary', answer: { value: 'ciphertext', encrypted: true } }, 200000);
  const reopened = createParticipant(args);
  const partial = await reopened.listQuestions({ filter: 'answered' });
  assert.equal(partial.myAnswersComplete, false);
  assert.equal(partial.questions.length, 0);
  const complete = await reopened.listQuestions({ filter: 'answered' });
  assert.notEqual(complete.myAnswersComplete, false);
  assert.equal(complete.questions.length, 0);
});

for (const action of ['submitAnswers', 'addStatement']) {
  test(`${action} redacts keyed RPC errors and retains an uncertain transaction hash`, async () => {
    const f = fixture();
    const session = await f.open();
    const transactionHash = ethers.utils.id('uncertain-tx');
    f.faults.send = Object.assign(new Error('request failed url=https://rpc.example/key/fixture-secret body=private-calldata'), { code: 'SERVER_ERROR', transactionHash });
    await assert.rejects(session[action]({ client: f.client, records: [{ questionID: qid }], record: { id: qid } }), error => {
      assert.doesNotMatch(error.message, /fixture-secret|rpc\.example|private-calldata/);
      assert.match(error.message, new RegExp(transactionHash));
      assert.match(error.message, /check.*before retrying/i);
      assert.equal(error.txHash, transactionHash);
      return true;
    });
  });
}

test('confirmed answers remain successful when the local answer history cannot be saved', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-state-failure-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  const participant = createParticipant({ config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
      const pathname = new URL(url).pathname;
      if (pathname === '/resource-presence') return Response.json({ resources: {} });
      if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
      if (pathname === '/auth/login') return Response.json({ token: 'e30.sig', exp: 9999999999 });
      if (pathname === '/arweave/upload') return Response.json({ id: Buffer.alloc(32, 2).toString('base64url') });
      throw new Error(`Unexpected route ${pathname}`);
    },
  });
  await participant.joinSession({ link: 'https://contextengine.sh/session/town' });
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  f.faults.afterConfirmation = async () => {
    await fs.rename(path.join(stateDir, 'state.json'), path.join(stateDir, 'state.saved.json'));
    await fs.mkdir(path.join(stateDir, 'state.json'));
  };
  const result = await participant.answer({ answers: [{ questionId: qid, value: 'Agree' }] });
  assert.equal(result.submitted, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.txHash, ethers.utils.id('tx'));
  assert.match(result.warning, /submitted.*local answer history.*not.*saved/i);
  assert.equal(f.writes.length, 1);
});

test('preflight RPC failures are sanitized before any upload or transaction', async () => {
  const f = fixture(); const session = await f.open();
  f.options.provider.getGasPrice = async () => { throw Object.assign(new Error('url=https://rpc.example/fixture-secret'), { code: 'SERVER_ERROR' }); };
  await assert.rejects(session.submitAnswers({ client: f.client, records: [{ questionID: qid }] }), error => {
    assert.doesNotMatch(error.message, /fixture-secret|rpc\.example/);
    assert.match(error.message, /SERVER_ERROR/);
    return true;
  });
  assert.equal(f.uploaded.length, 0);
  assert.equal(f.writes.length, 0);
});
