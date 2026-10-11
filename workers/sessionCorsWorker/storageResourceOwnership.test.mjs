import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isOwnedStorageResource,
  isStorageResourceHidden,
  listHiddenStorageResourceIds,
  readStorageResourceOwner,
  selectCanonicalStorageVersions,
  writeStorageResourceHidden,
  writeStorageResourceOwner,
} from './storageResourceOwnership.js';

const ADMIN = '0x00000000000000000000000000000000000000aa';
const AUTHOR = '0x00000000000000000000000000000000000000bb';
const OTHER = '0x00000000000000000000000000000000000000cc';
const isAdmin = (address) => address === ADMIN;

const version = (storageRefId, createdAtMs, uploader, resourceId = 'q1') => ({ resourceId, storageRefId, createdAtMs, uploader });

const createKv = () => {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
};

test('only questions and surveys are owned by their first author', () => {
  assert.equal(isOwnedStorageResource('questions'), true);
  assert.equal(isOwnedStorageResource('surveys'), true);
  for (const resource of ['responses', 'docsContext', 'images', '']) assert.equal(isOwnedStorageResource(resource), false);
});

test('the earliest upload of an id wins over later uploads by anyone else', () => {
  const chosen = selectCanonicalStorageVersions([
    version('later-attacker', 3_000, OTHER),
    version('first-author', 1_000, AUTHOR),
    version('author-retry', 2_000, AUTHOR),
    version('legacy-unknown', 4_000, ''),
  ], { isAdmin });
  assert.deepEqual(chosen.map((entry) => entry.storageRefId), ['first-author']);
});

test('a session admin upload wins, and the newest admin upload replaces an older one', () => {
  const chosen = selectCanonicalStorageVersions([
    version('first-author', 1_000, AUTHOR),
    version('admin-edit', 2_000, ADMIN),
    version('admin-second-edit', 3_000, ADMIN),
    version('later-attacker', 4_000, OTHER),
    version('other-id', 500, OTHER, 'q2'),
  ], { isAdmin });
  assert.deepEqual(chosen.map((entry) => entry.storageRefId), ['other-id', 'admin-second-edit']);
});

test('equal timestamps break ties by storage id so every reader agrees', () => {
  const rows = [version('b-ref', 1_000, AUTHOR), version('a-ref', 1_000, OTHER)];
  assert.equal(selectCanonicalStorageVersions(rows, { isAdmin })[0].storageRefId, 'a-ref');
  assert.equal(selectCanonicalStorageVersions(rows.reverse(), { isAdmin })[0].storageRefId, 'a-ref');
});

test('owner and hidden records are keyed per session, resource, and lowercased id', async () => {
  const index = createKv();
  await writeStorageResourceOwner({
    index, slug: 'session-a', resource: 'questions', resourceId: '0xABC', uploader: AUTHOR.toUpperCase().replace('0X', '0x'), storageRefId: 'ref-1', createdAt: '2026-10-10T00:00:00.000Z',
  });
  assert.deepEqual(await readStorageResourceOwner({ index, slug: 'session-a', resource: 'questions', resourceId: '0xabc' }), {
    version: 1,
    resource: 'questions',
    resourceId: '0xabc',
    uploader: AUTHOR,
    storageRefId: 'ref-1',
    createdAt: '2026-10-10T00:00:00.000Z',
  });
  assert.equal(await readStorageResourceOwner({ index, slug: 'session-b', resource: 'questions', resourceId: '0xabc' }), null);
  assert.equal(await readStorageResourceOwner({ index, slug: 'session-a', resource: 'surveys', resourceId: '0xabc' }), null);

  await writeStorageResourceHidden({ index, slug: 'session-a', resource: 'questions', resourceId: 'Q1', hidden: true, actor: ADMIN, updatedAt: 'now' });
  await writeStorageResourceHidden({ index, slug: 'session-a', resource: 'questions', resourceId: 'q2', hidden: true, actor: ADMIN, updatedAt: 'now' });
  await writeStorageResourceHidden({ index, slug: 'session-a', resource: 'surveys', resourceId: 's1', hidden: true, actor: ADMIN, updatedAt: 'now' });
  assert.equal(await isStorageResourceHidden({ index, slug: 'session-a', resource: 'questions', resourceId: 'q1' }), true);
  assert.deepEqual([...await listHiddenStorageResourceIds({ index, slug: 'session-a', resource: 'questions' })], ['q1', 'q2']);
  await writeStorageResourceHidden({ index, slug: 'session-a', resource: 'questions', resourceId: 'q1', hidden: false, actor: ADMIN });
  assert.equal(await isStorageResourceHidden({ index, slug: 'session-a', resource: 'questions', resourceId: 'q1' }), false);
  assert.deepEqual([...await listHiddenStorageResourceIds({ index, slug: 'session-a', resource: 'questions' })], ['q2']);
  // Keys never collide with storage index rows listed by the ce-storage: prefix.
  assert.equal([...index.store.keys()].some((key) => key.startsWith('ce-storage:')), false);
});
