import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createRegistrySession } from './registrySession.mjs';
import { createParticipant } from './participant.mjs';
import { readConfig } from './config.mjs';
import { registryQuestionMatchesSession } from './registryIdentity.mjs';
import { createMcpServer } from './mcpServer.mjs';
import { buildTools } from './tools.mjs';
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
  const responseHashes = new Map();
  // A reorganization gives each replaced block a new hash.
  const generations = new Map();
  const blockHash = (number) => ethers.utils.id(`block ${number} ${generations.get(number) || 0}`);
  const reorg = (from, to) => {
    for (let number = from; number <= to; number += 1) generations.set(number, (generations.get(number) || 0) + 1);
  };
  const provider = {
    _isProvider: true,
    send: async () => ethers.utils.hexValue(chain), getBlockNumber: async () => 10,
    getBlock: async (number) => ({ timestamp: 1000 + number, hash: blockHash(number) }),
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
      getResponse: async (_responder, id) => responseHashes.get(id),
      connect: () => surveys,
      addQuestions: async (...args) => {
        if (faults.send) throw faults.send;
        const event = iface.encodeEventLog(iface.getEvent('QuestionsAdded'), [wallet.address, args[0], args[2]]);
        return { hash: ethers.utils.id('question-tx'), wait: async () => ({
          status: 1, blockNumber: 11, blockHash: blockHash(11), transactionIndex: 0,
          logs: [{ ...event, address: surveysAddress, logIndex: 0 }],
        }) };
      },
      submitResponses: async (...args) => {
        writes.push(args);
        if (faults.send) throw faults.send;
        const event = iface.encodeEventLog(iface.getEvent('ResponsesSubmitted'), [wallet.address, args[0], ethers.constants.HashZero]);
        return { hash: ethers.utils.id('tx'), wait: async () => {
          await faults.afterConfirmation?.();
          return { status: 1, blockNumber: 11, blockHash: blockHash(11), transactionIndex: 0, logs: [{ ...event, address: surveysAddress, logIndex: 0 }] };
        } };
      },
    };
    return surveys;
  };
  const fetchImpl = async (url) => Response.json(records.get(new URL(url).pathname.split('/').pop()));
  const open = (slug = 'town') => createRegistrySession({ info: { slug, chainId: 11155420 }, config: { rpcUrl: '', allowLocalWorkers: false }, wallet, fetchImpl,
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
    responseHashes.set(id, pointer);
    records.set(Buffer.from(pointer.slice(2), 'hex').toString('base64url'), payload);
    const event = surveys.interface.encodeEventLog(surveys.interface.getEvent('ResponsesSubmitted'), [wallet.address, [id], ethers.constants.HashZero]);
    logs.push({ ...event, blockNumber, transactionIndex: 0, logIndex: logs.length });
  };
  return { open, addQuestion, addResponse, hashes, responseHashes, logs, reorg, uploaded, writes, faults, client, fetchImpl, registry,
    options: { provider, addresses: { sessionRegistry: registryAddress, surveys: surveysAddress }, createContract: factory },
    setChain: (value) => { chain = value; }, setGasPrice: (value) => { gasPrice = value; }, setBalance: (value) => { balance = value; } };
};

for (const slug of ['', 'general', 'town']) test(`registry links resolve ${JSON.stringify(slug)} to its registered session`, async () => {
  const f = fixture();
  const expected = slug || 'general';
  const calls = [];
  const readRow = f.registry.getSessionBySlug;
  f.registry.getSessionBySlug = async (requested) => {
    calls.push(['session', requested]);
    assert.equal(requested, expected);
    const row = await readRow();
    row[0] = expected;
    return row;
  };
  f.registry.getSessionFields = async (requested, fields) => {
    calls.push(['fields', requested]);
    assert.equal(requested, expected);
    assert.deepEqual(fields, ['corsWorkerUrl']);
    return [''];
  };
  await f.open(slug);
  assert.deepEqual(calls, [['session', expected], ['fields', expected]]);
});

test('a registry link still rejects a row belonging to another session', async () => {
  const f = fixture();
  await assert.rejects(f.open('general'), /registry returned a different session/);
});

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

test('a reorganization that replaces a read block rebuilds the questions from canonical history', async () => {
  const f = fixture();
  let head = 10;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  const replacedId = ethers.utils.id('replaced');
  f.addQuestion(replacedId, { sessionSlug: 'town', prompt: 'Replaced', type: 'binary' }, 10);
  assert.deepEqual((await session.loadQuestions()).items.map((item) => item.id), [replacedId]);
  // Block 10 is replaced by one holding a different question, and the chain moves on.
  f.logs.splice(0);
  f.reorg(10, 11);
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' }, 10);
  head = 11;
  const after = await session.loadQuestions();
  assert.deepEqual(after.items.map((item) => item.id), [qid]);
  assert.equal(after.complete, true);
});

for (const nextHead of [10, 11]) test(`existing and fresh readers converge after a reorg to head ${nextHead}`, async () => {
  const f = fixture();
  let head = 10;
  f.options.provider.getBlockNumber = async () => head;
  const running = await f.open();
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'Retained question', type: 'binary' }, 1);
  f.addQuestion(otherId, { sessionSlug: 'town', prompt: 'Orphaned question', type: 'binary' }, 10);
  f.addResponse(qid, { questionID: qid, answer: { value: 'Orphaned answer' } }, 10);
  const scope = { questionIds: [qid, otherId, blockedId] };
  const beforeQuestions = await running.loadQuestions();
  const beforeAnswers = await running.readAnswers(scope);
  assert.deepEqual(beforeQuestions.items.map(item => item.id), [qid, otherId]);
  assert.equal(beforeAnswers.entries[0].payload.answer.value, 'Orphaned answer');
  assert.equal(beforeQuestions.complete, true);
  assert.equal(beforeAnswers.complete, true);

  f.logs.splice(1);
  f.reorg(10, nextHead);
  f.addQuestion(blockedId, { sessionSlug: 'town', prompt: 'Canonical question', type: 'binary' }, 10);
  f.addResponse(qid, { questionID: qid, answer: { value: 'Canonical answer' } }, 10);
  head = nextHead;
  const refreshedQuestions = await running.loadQuestions();
  const refreshedAnswers = await running.readAnswers(scope);
  const fresh = await f.open();
  assert.deepEqual(refreshedQuestions, await fresh.loadQuestions());
  assert.deepEqual(refreshedAnswers, await fresh.readAnswers(scope));
  assert.deepEqual(refreshedQuestions.items.map(item => item.id), [qid, blockedId]);
  assert.equal(refreshedAnswers.entries.length, 1);
  assert.equal(refreshedAnswers.entries[0].payload.answer.value, 'Canonical answer');
  assert.equal(refreshedQuestions.complete, true);
  assert.equal(refreshedAnswers.complete, true);
});

test('a reorganization drops answers, including the agent\'s own, from replaced blocks', async () => {
  const f = fixture();
  let head = 12;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  await session.submitAnswers({ client: f.client, records: [{ questionID: qid, sessionSlug: 'town', answer: { value: 'Agree', encrypted: false } }] });
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'Orphaned' } }, 12);
  const questionIds = new Set([qid, otherId]);
  assert.deepEqual(new Set((await session.readAnswers({ questionIds })).entries.map((entry) => entry.questionId)), new Set([qid, otherId]));
  // Blocks 11 and 12, with both answers, are replaced by empty ones.
  f.logs.splice(0);
  f.reorg(11, 13);
  head = 13;
  const after = await session.readAnswers({ questionIds });
  assert.deepEqual(after.entries, []);
  assert.equal(after.complete, true);
  assert.equal(await session.replacedWrite({ blockNumber: 11, blockHash: ethers.utils.id('block 11 0') }), true);
});

for (const changeScope of [false, true]) test(`local answers above the scanned head are checked after a reorg (changed scope: ${changeScope})`, async () => {
  const f = fixture();
  let head = 10;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  await session.readAnswers({ questionIds: [qid] });
  await session.submitAnswers({ client: f.client, records: [{ questionID: qid, sessionSlug: 'town', answer: { value: 'Agree' } }] });
  f.reorg(11, 13);
  head = 13;
  const after = await session.readAnswers({ questionIds: changeScope ? [qid, otherId] : [qid] });
  assert.deepEqual(after.entries, []);
  assert.equal(after.complete, true);
});

test('local questions above the scanned head are removed when their own block is replaced', async () => {
  const f = fixture();
  let head = 10;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  await session.loadQuestions();
  await session.addStatement({ client: f.client, record: { id: qid, sessionSlug: 'town', prompt: 'Local statement', type: 'binary' } });
  assert.equal((await session.loadQuestions()).items.length, 1);
  f.reorg(11, 13);
  head = 13;
  const after = await session.loadQuestions();
  assert.deepEqual(after.items, []);
  assert.equal(after.complete, true);
});

test('local answer verification and timestamps share one block read per call', async () => {
  const f = fixture();
  const session = await f.open();
  await session.submitAnswers({ client: f.client, records: [qid, otherId].map((questionID) => ({ questionID, sessionSlug: 'town', answer: { value: 'Agree' } })) });
  const getBlock = f.options.provider.getBlock;
  const reads = [];
  f.options.provider.getBlock = (number) => { reads.push(number); return getBlock(number); };
  const result = await session.readAnswers({ questionIds: [qid, otherId] });
  assert.equal(result.entries.length, 2);
  assert.equal(result.complete, true);
  assert.equal(reads.filter((number) => number === 11).length, 1);
});

test('block lookup failures keep local records and report incomplete reads', async () => {
  const f = fixture();
  const session = await f.open();
  await session.addStatement({ client: f.client, record: { id: qid, sessionSlug: 'town', prompt: 'Local', type: 'binary' } });
  await session.submitAnswers({ client: f.client, records: [{ questionID: qid, sessionSlug: 'town', answer: { value: 'Agree' } }] });
  await session.loadQuestions();
  await session.readAnswers({ questionIds: [qid] });
  f.options.provider.getBlock = async () => { throw new Error('RPC temporarily unavailable'); };
  const questions = await session.loadQuestions();
  assert.equal(questions.complete, false);
  assert.deepEqual(questions.items.map((entry) => entry.id), [qid]);
  const answers = await session.readAnswers({ questionIds: [qid] });
  assert.equal(answers.complete, false);
  assert.deepEqual(answers.entries.map((entry) => entry.questionId), [qid]);
});

for (const mine of [false, true]) for (const failure of ['missing', 'throws']) {
  test(`unverified answer marks retain newly confirmed local answers (${mine}, ${failure})`, async () => {
    const f = fixture();
    const session = await f.open();
    const questionIds = [qid, otherId];
    f.addResponse(qid, { questionID: qid, answer: { value: 'Before' } }, 9);
    await session.readAnswers({ questionIds, mine });
    await session.submitAnswers({ client: f.client, records: [qid, otherId, blockedId].map((questionID) =>
      ({ questionID, sessionSlug: 'town', answer: { value: 'Confirmed' } })) });
    f.options.provider.getBlockNumber = async () => 11;
    f.options.provider.getBlock = async () => {
      if (failure === 'throws') throw new Error('RPC temporarily unavailable');
      return null;
    };
    f.options.provider.getLogs = async () => assert.fail('The scan must not advance past an unverified mark');
    const answers = await session.readAnswers({ questionIds, mine });
    assert.equal(answers.complete, false);
    assert.deepEqual(new Set(answers.entries.map((entry) => entry.questionId)), new Set(questionIds));
    assert.ok(answers.entries.every((entry) => entry.payload.answer.value === 'Confirmed'));
    assert.deepEqual(new Set(answers.chainOrders.keys()), new Set(questionIds));
    assert.ok([...answers.chainOrders.values()].every((entry) => entry.blockNumber === 11));
    const capped = await session.readAnswers({ questionIds, mine, maxRecords: 1 });
    assert.equal(capped.entries.length, 1);
    assert.equal(capped.chainOrders.size, 2);
  });
}

test('a lagging head keeps the previous mark without rescanning session history', async () => {
  const f = fixture();
  const session = await f.open();
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  await session.loadQuestions();
  await session.readAnswers({ questionIds: [qid] });
  f.options.provider.getBlockNumber = async () => 11;
  const getBlock = f.options.provider.getBlock;
  f.options.provider.getBlock = async (number) => number === 11 ? null : getBlock(number);
  assert.equal((await session.loadQuestions()).complete, false);
  assert.equal((await session.readAnswers({ questionIds: [qid] })).complete, false);
  const ranges = [];
  const getLogs = f.options.provider.getLogs;
  f.options.provider.getLogs = (filter) => { ranges.push(filter); return getLogs(filter); };
  f.options.provider.getBlock = getBlock;
  assert.equal((await session.loadQuestions()).complete, true);
  assert.equal((await session.readAnswers({ questionIds: [qid] })).complete, true);
  assert.ok(ranges.length > 0);
  assert.ok(ranges.every((range) => range.fromBlock > 0));
});

test('remembered answers share block checks and remain visible during RPC gaps', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-block-checks-'));
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
  const ids = Array.from({ length: 20 }, (_, index) => ethers.utils.id(`batch question ${index}`));
  ids.forEach((id, index) => f.addQuestion(id, { sessionSlug: 'town', prompt: `Question ${index}`, type: 'binary' }));
  assert.equal((await first.answer({ answers: ids.map((questionId) => ({ questionId, value: 'Agree' })) })).submitted, 20);
  const reopened = createParticipant(args);
  const getBlock = f.options.provider.getBlock;
  const reads = [];
  f.options.provider.getBlock = (number) => { reads.push(number); return getBlock(number); };
  assert.equal((await reopened.listQuestions({ filter: 'answered' })).questions.length, 20);
  assert.equal(reads.filter((number) => number === 11).length, 1);
  f.options.provider.getBlock = async () => { throw new Error('RPC temporarily unavailable'); };
  const partial = await reopened.listQuestions({ filter: 'answered' });
  assert.equal(partial.questions.length, 20);
  assert.equal(partial.myAnswersComplete, false);
  assert.equal(partial.questionsComplete, false);
});

test('an unavailable prior mark is retained until its history can be checked', async () => {
  const f = fixture();
  const session = await f.open();
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'Orphaned', type: 'binary' }, 10);
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'Orphaned' } }, 10);
  await session.loadQuestions();
  await session.readAnswers({ questionIds: [otherId] });
  f.reorg(10, 11);
  f.logs.splice(0);
  f.options.provider.getBlockNumber = async () => 11;
  const getBlock = f.options.provider.getBlock;
  f.options.provider.getBlock = async (number) => number === 10 ? null : getBlock(number);
  assert.equal((await session.loadQuestions()).complete, false);
  assert.equal((await session.readAnswers({ questionIds: [otherId] })).complete, false);
  f.options.provider.getBlock = getBlock;
  assert.deepEqual((await session.loadQuestions()).items, []);
  assert.deepEqual((await session.readAnswers({ questionIds: [otherId] })).entries, []);
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
  f.options.provider.getBlock = async () => null;
  const held = await session.readAnswers({ questionIds: new Set([qid]) });
  assert.equal(held.complete, false);
  assert.equal(held.entries.length, 0, 'Older local plaintext must not replace the held encrypted answer');
  assert.equal(held.chainOrders.get(qid).blockNumber, 12);
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

test('a remembered registry answer whose block was replaced is no longer reported as answered', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-reorg-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  let head = 12;
  f.options.provider.getBlockNumber = async () => head;
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
  assert.equal((await participant.listQuestions({ filter: 'answered' })).questions.length, 1);
  // The answer's block 11 is replaced without it.
  f.reorg(11, 13);
  head = 13;
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

const SECRET_RPC = 'https://rpc.example.invalid/v2/SYNTHETIC_RPC_SECRET_123';
const CALLDATA = '0xfeedfacecafe0001';
const RPC_DETAILS = /SYNTHETIC_RPC_SECRET_123|rpc\.example\.invalid|feedfacecafe|requestBody/;
// ethers' own formatter, so each message quotes the URL and request like a live RPC failure.
const rpcFailure = (reason, code, method, params = [], fields = {}) => Object.assign(ethers.logger.makeError(reason, code, {
  requestBody: JSON.stringify({ method, params, id: 42, jsonrpc: '2.0' }), requestMethod: 'POST', url: SECRET_RPC,
}), fields);
const retry = (detail) => `The chain request failed (${detail}). Check the RPC connection and retry.`;

const serveRegistry = async (t, f) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-registry-rpc-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const fetchImpl = async (url, init) => {
    if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
    const pathname = new URL(url).pathname;
    if (pathname === '/resource-presence') return Response.json({ resources: {} });
    if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
    if (pathname === '/auth/login') return Response.json({ token: 'e30.sig', exp: 9999999999 });
    if (pathname === '/arweave/upload') return Response.json({ id: Buffer.alloc(32, 2).toString('base64url') });
    throw new Error(`Unexpected route ${pathname}`);
  };
  const logs = [];
  const participant = createParticipant({ config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options, fetchImpl });
  const server = createMcpServer({ serverInfo: { name: 'test', version: '1' }, tools: buildTools(participant), log: (line) => logs.push(line) });
  let id = 0;
  const call = async (name, args = {}) =>
    JSON.parse(await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: (id += 1), method: 'tools/call', params: { name, arguments: args } }))).result;
  return { call, logs, exposed: (result) => `${JSON.stringify(result)}\n${logs.join('\n')}` };
};

const link = 'https://contextengine.sh/session/town';
for (const [stage, inject, message, overrides] of [
  ['chain detection', (f) => { f.options.provider.send = async () => { throw rpcFailure('missing response', 'SERVER_ERROR', 'eth_chainId'); }; },
    retry('SERVER_ERROR: missing response')],
  ['registry lookup', (f) => { f.registry.getSessionBySlug = async () => { throw rpcFailure('processing response error', 'SERVER_ERROR', 'eth_call', [{ data: CALLDATA }, 'latest']); }; },
    retry('SERVER_ERROR: processing response error')],
  ['a missing session', (f) => { f.registry.getSessionBySlug = async () => { throw Object.assign(ethers.logger.makeError('call revert exception', 'CALL_EXCEPTION', {
    method: 'getSessionBySlug(string)', errorArgs: ['session not found'], errorName: 'Error', reason: 'session not found' }), { transaction: { data: CALLDATA } }); }; },
    'The contract rejected the request (CALL_EXCEPTION: session not found).'],
  ['the head block lookup', (f) => { f.options.provider.getBlockNumber = async () => { throw rpcFailure('timeout', 'TIMEOUT', 'eth_blockNumber'); }; },
    retry('TIMEOUT: timeout')],
  ['the start block search', (f) => { f.options.provider.getBlock = async () => { throw rpcFailure('bad response', 'SERVER_ERROR', 'eth_getBlockByNumber', ['0x5', false]); }; },
    retry('SERVER_ERROR: bad response'), { blockLimits: undefined }],
]) {
  test(`join_session keeps RPC details out of tool output and logs when ${stage} fails`, async (t) => {
    const f = fixture(overrides);
    inject(f);
    const { call, logs, exposed } = await serveRegistry(t, f);
    const result = await call('join_session', { link });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, message);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(exposed(result), RPC_DETAILS);
  });
}

test('registry log scans and transactions keep RPC details out of tool output and logs', async (t) => {
  const f = fixture();
  const { call, logs, exposed } = await serveRegistry(t, f);
  assert.equal((await call('join_session', { link })).isError, undefined);
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'One', type: 'binary' });
  const transactionHash = ethers.utils.id('uncertain-submission');
  f.faults.send = rpcFailure('processing response error', 'SERVER_ERROR', 'eth_sendRawTransaction', [`${CALLDATA}02`], { transactionHash, transaction: { data: CALLDATA } });
  const answered = await call('answer', { answers: [{ questionId: qid, value: 'Agree' }] });
  assert.equal(answered.structuredContent.reconciliationRequired, true);
  assert.equal(answered.structuredContent.txHash, transactionHash);
  assert.match(answered.structuredContent.results[0].error, new RegExp(`^Transaction ${transactionHash} may have been submitted.*\\(SERVER_ERROR: processing response error\\)`));
  assert.doesNotMatch(exposed(answered), RPC_DETAILS);
  const added = await call('add_statement', { prompt: 'A statement agents should see' });
  assert.equal(added.isError, true);
  assert.match(added.content[0].text, new RegExp(`^Transaction ${transactionHash} may have been submitted`));
  assert.doesNotMatch(exposed(added), RPC_DETAILS);
  f.options.provider.getLogs = async () => { throw rpcFailure('bad response', 'SERVER_ERROR', 'eth_getLogs', [{ fromBlock: '0x0', toBlock: '0xa' }]); };
  const listed = await call('list_questions');
  assert.equal(listed.content[0].text, retry('SERVER_ERROR: bad response'));
  assert.doesNotMatch(exposed(listed), RPC_DETAILS);
  assert.equal(logs.length, 2);
});

test('deliberate join errors reach the agent unchanged', async (t) => {
  const { call, logs } = await serveRegistry(t, fixture());
  const message = 'Session link must be a full URL, such as https://contextengine.sh/session/<slug>?worker=<origin>.';
  assert.deepEqual(await call('join_session', { link: 'town' }), { content: [{ type: 'text', text: message }], isError: true });
  assert.deepEqual(logs, [`tool join_session failed: ${message}`]);
});


test('a missing stored mark holds both scans until new blocks can be covered by a verified mark', async () => {
  const f = fixture();
  let head = 10;
  f.options.provider.getBlockNumber = async () => head;
  const session = await f.open();
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'Retained', type: 'binary' }, 9);
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'Retained' } }, 9);
  const originalPointer = f.responseHashes.get(otherId);
  const beforeQuestions = await session.loadQuestions();
  const beforeAnswers = await session.readAnswers({ questionIds: [otherId] });
  head = 11;
  f.addQuestion(blockedId, { sessionSlug: 'town', prompt: 'Unverified orphan', type: 'binary' }, 11);
  f.addResponse(otherId, { questionID: otherId, answer: { value: 'Unverified orphan' } }, 11);
  const getBlock = f.options.provider.getBlock;
  f.options.provider.getBlock = (number) => number === 10 ? null : getBlock(number);
  const getLogs = f.options.provider.getLogs;
  let scans = 0;
  f.options.provider.getLogs = (filter) => { scans += 1; return getLogs(filter); };
  const gapQuestions = await session.loadQuestions();
  const gapAnswers = await session.readAnswers({ questionIds: [otherId] });
  assert.equal(gapQuestions.complete, false);
  assert.equal(gapAnswers.complete, false);
  assert.deepEqual(gapQuestions.items, beforeQuestions.items);
  assert.deepEqual(gapAnswers.entries, beforeAnswers.entries);
  assert.equal(scans, 0, 'No cursor may advance beyond an unverified prior mark');
  f.reorg(11, 11);
  f.logs.splice(2);
  f.responseHashes.set(otherId, originalPointer);
  f.options.provider.getBlock = getBlock;
  const questions = await session.loadQuestions();
  const answers = await session.readAnswers({ questionIds: [otherId] });
  assert.deepEqual(questions.items, beforeQuestions.items);
  assert.deepEqual(answers.entries, beforeAnswers.entries);
  assert.equal(questions.complete, true);
  assert.equal(answers.complete, true);
});

test('participant question reads retain stored rating steps for answer validation', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-rating-participant-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const f = fixture();
  const participant = createParticipant({ config: readConfig({ CE_MCP_STATE_DIR: stateDir }), wallet, registry: f.options,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname !== 'w.example.dev') return f.fetchImpl(url, init);
      const pathname = new URL(url).pathname;
      if (pathname === '/resource-presence') return Response.json({ resources: { txGas: false } });
      if (pathname === '/auth/nonce') return Response.json({ nonce: 'nonce123456' });
      if (pathname === '/auth/login') return Response.json({ error: 'fixture read only' }, { status: 403 });
      throw new Error(`Unexpected Worker read ${pathname}`);
    },
  });
  await participant.joinSession({ link: 'https://contextengine.sh/session/town' });
  f.addQuestion(qid, { sessionSlug: 'town', prompt: 'A fractional rating', type: 'rating', scale: { min: -0.5, max: 0.5, step: 0.1 } });
  const question = (await participant.listQuestions()).questions[0];
  assert.equal(question.scale.step, 0.1);
});
