import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_RESULTS_BUILDS, RESULTS_BUILD_LEASE_MS, dispatchResultsBuildStore } from './resultsBuildStore.js';

const createCoordinator = () => {
  const values = new Map();
  const storage = {
    values,
    // Durable Object storage hands back copies, so an edit is kept only by a put.
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    transaction: async (run) => run(storage),
  };
  const coordinator = { state: { storage }, nowMs: 1_000_000, now: () => coordinator.nowMs };
  return coordinator;
};

const call = async (coordinator, operation, payload, kind = 'debate-atlas') => {
  const response = await dispatchResultsBuildStore(coordinator, kind, operation, payload);
  return { status: response.status, body: await response.json() };
};

let buildSequence = 0;
const buildRecord = (extra = {}) => {
  buildSequence += 1;
  return {
    id: `atlas_k${buildSequence}_0000000${buildSequence % 10}`,
    version: 1,
    builtAt: '2026-11-08T12:00:00.000Z',
    builtBy: '0x1111111111111111111111111111111111111111',
    counts: { responses: 12, participants: 4, questions: 3, aiResponses: 12, aiQuestions: 3 },
    title: `Atlas ${buildSequence}`,
    missingTopics: [],
    branches: [{ id: 'b1', label: 'Trust', summary: '', topics: [] }],
    ...extra,
  };
};

const finishBuild = async (coordinator, build) => {
  const reserved = await call(coordinator, 'reserve', { builder: '0xABC' });
  assert.equal(reserved.status, 200);
  return call(coordinator, 'finalize', { attemptId: reserved.body.attemptId, build });
};

test('one build runs at a time until it finishes or its lease runs out', async () => {
  const coordinator = createCoordinator();
  const first = await call(coordinator, 'reserve', { builder: '0xABC' });
  assert.equal(first.status, 200);
  const second = await call(coordinator, 'reserve', { builder: '0xDEF' });
  assert.equal(second.status, 409);
  assert.equal(second.body.reason, 'debate_atlas_build_running');
  assert.deepEqual(second.body.active, { startedAtMs: 1_000_000 });

  coordinator.nowMs += RESULTS_BUILD_LEASE_MS;
  const afterLease = await call(coordinator, 'reserve', { builder: '0xDEF' });
  assert.equal(afterLease.status, 200);
  // The expired attempt can no longer write over the new one.
  const stale = await call(coordinator, 'finalize', { attemptId: first.body.attemptId, build: buildRecord() });
  assert.equal(stale.status, 409);
  assert.equal((await call(coordinator, 'read', {})).body.build, null);
});

test('a failed build frees the next one and keeps nothing', async () => {
  const coordinator = createCoordinator();
  const reserved = await call(coordinator, 'reserve', {});
  assert.equal((await call(coordinator, 'finalize', { attemptId: reserved.body.attemptId })).status, 200);
  const read = await call(coordinator, 'read', {});
  assert.deepEqual(read.body.builds, []);
  assert.equal(read.body.active, null);
  assert.equal((await call(coordinator, 'reserve', {})).status, 200);
});

test('a large build is kept in chunks and read back whole, newest first', async () => {
  const coordinator = createCoordinator();
  const older = buildRecord();
  const large = buildRecord({ branches: [{ id: 'b1', label: 'x'.repeat(60_000), summary: '', topics: [] }] });
  await finishBuild(coordinator, older);
  assert.equal((await finishBuild(coordinator, large)).status, 200);
  const chunkKeys = [...coordinator.state.storage.values.keys()].filter((key) => key.includes(`${large.id}:`));
  assert.ok(chunkKeys.length >= 3, `expected chunks, got ${chunkKeys.length}`);

  const newest = await call(coordinator, 'read', {});
  assert.deepEqual(newest.body.build, large);
  assert.deepEqual(newest.body.builds.map((entry) => entry.id), [large.id, older.id]);
  assert.equal('branches' in newest.body.builds[0], false);
  assert.equal('chunkCount' in newest.body.builds[0], false);
  assert.deepEqual((await call(coordinator, 'read', { id: older.id })).body.build, older);
});

test(`keeps the newest ${MAX_RESULTS_BUILDS} builds and deletes the chunks of older ones`, async () => {
  const coordinator = createCoordinator();
  const builds = [];
  for (let index = 0; index <= MAX_RESULTS_BUILDS; index += 1) {
    const build = buildRecord();
    builds.push(build);
    await finishBuild(coordinator, build);
  }
  const read = await call(coordinator, 'read', {});
  assert.equal(read.body.builds.length, MAX_RESULTS_BUILDS);
  assert.equal(read.body.builds.some((entry) => entry.id === builds[0].id), false);
  assert.equal([...coordinator.state.storage.values.keys()].some((key) => key.includes(`${builds[0].id}:`)), false);
  assert.equal((await call(coordinator, 'read', { id: builds[0].id })).status, 404);
});

test('refuses a malformed or oversized build, keeps nothing, and frees the next press', async () => {
  const coordinator = createCoordinator();
  assert.equal((await call(coordinator, 'read', { id: '../config' })).status, 400);
  for (const [build, status] of [
    [{ id: 'debate-atlas-v1' }, 400],
    [buildRecord({ branches: [{ id: 'b1', label: 'x'.repeat(64 * 24_000), summary: '', topics: [] }] }), 413],
  ]) {
    const reserved = await call(coordinator, 'reserve', {});
    assert.equal(reserved.status, 200);
    assert.equal((await call(coordinator, 'finalize', { attemptId: reserved.body.attemptId, build })).status, status);
  }
  assert.equal((await call(coordinator, 'reserve', {})).status, 200);
  assert.deepEqual((await call(coordinator, 'read', {})).body.builds, []);
});

