import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createRegistryWriter } from './registryWrites.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const fixture = () => {
  const reached = deferred();
  const release = deferred();
  const controller = new AbortController();
  const writes = [];
  const remembered = [];
  let uploaded = false;
  let afterBroadcast = () => {};
  const wallet = { address: `0x${'11'.repeat(20)}`, connect() { return this; } };
  const qid = `0x${'22'.repeat(32)}`;
  const provider = {
    send: async () => { if (uploaded) { reached.resolve(); await release.promise; } return '0xaa37dc'; },
    getGasPrice: async () => ethers.BigNumber.from(1),
    getBalance: async () => ethers.utils.parseEther('1'),
  };
  const surveys = {
    address: `0x${'33'.repeat(20)}`, connect() { return this; },
    questionHashes: async () => ethers.constants.HashZero,
    interface: { parseLog: log => log },
  };
  for (const [method, event] of [['submitResponses', 'ResponsesSubmitted'], ['addQuestions', 'QuestionsAdded']]) {
    surveys[method] = async ids => {
      writes.push(method); afterBroadcast();
      return { hash: `0x${'44'.repeat(32)}`, wait: async () => ({ status: 1, logs: [{
        address: surveys.address, name: event, args: { responder: wallet.address, creator: wallet.address, questionIds: ids },
      }] }) };
    };
  }
  const client = {
    ensureToken: async () => {},
    request: async () => { uploaded = true; return { id: Buffer.alloc(32, 1).toString('base64url') }; },
  };
  const writer = createRegistryWriter({ provider, chainId: 11155420, wallet, surveys, slug: 'fixture', remember: (...args) => remembered.push(args) });
  return { controller, writes, remembered, reached, release, setAfterBroadcast: fn => { afterBroadcast = fn; },
    send: method => writer[method]({ client, signal: controller.signal, records: [{ questionID: qid }], record: { id: qid } }) };
};

for (const method of ['submitAnswers', 'addStatement']) {
  test(`${method}: cancellation during the final chain read sends and remembers nothing`, async () => {
    const f = fixture();
    const pending = f.send(method);
    await f.reached.promise;
    f.controller.abort(); f.release.resolve();
    await assert.rejects(pending, /Stopped/);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.remembered, []);
  });
  test(`${method}: cancellation before starting sends and remembers nothing`, async () => {
    const f = fixture(); f.controller.abort();
    await assert.rejects(f.send(method), /Stopped/);
    assert.deepEqual(f.writes, []); assert.deepEqual(f.remembered, []);
  });
  test(`${method}: an uncancelled write still sends`, async () => {
    const f = fixture(); f.release.resolve();
    assert.equal((await f.send(method)).txHash, `0x${'44'.repeat(32)}`);
    assert.equal(f.writes.length, 1); assert.equal(f.remembered.length, 1);
  });
  test(`${method}: cancellation after broadcast keeps the hash and remembered result`, async () => {
    const f = fixture(); f.release.resolve(); f.setAfterBroadcast(() => f.controller.abort());
    assert.equal((await f.send(method)).txHash, `0x${'44'.repeat(32)}`);
    assert.equal(f.writes.length, 1); assert.equal(f.remembered.length, 1);
  });
}
