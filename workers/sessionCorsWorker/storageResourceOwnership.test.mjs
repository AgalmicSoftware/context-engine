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
    { ...version('admin-edit', 2_000, ADMIN), uploadAuthority: 'admin' },
    { ...version('admin-second-edit', 3_000, ADMIN), uploadAuthority: 'admin' },
    version('later-attacker', 4_000, OTHER),
    version('other-id', 500, OTHER, 'q2'),
  ], { isAdmin });
  assert.deepEqual(chosen.map((entry) => entry.storageRefId), ['other-id', 'admin-second-edit']);
});

test('upload-time authority survives removal and does not elevate an author after promotion', () => {
  const rows = [
    { ...version('original', 1_000, AUTHOR), uploadAuthority: 'author' },
    { ...version('correction', 2_000, ADMIN), uploadAuthority: 'admin' },
    { ...version('author-retry', 3_000, AUTHOR), uploadAuthority: 'author' },
  ];
  for (const currentAdmins of [[], [ADMIN], [AUTHOR], [OTHER]]) {
    const chosen = selectCanonicalStorageVersions(rows, { isAdmin: (address) => currentAdmins.includes(address) });
    assert.equal(chosen[0].storageRefId, 'correction');
  }
  assert.equal(selectCanonicalStorageVersions([rows[0], rows[2]], { isAdmin: () => true })[0].storageRefId, 'original');
  rows.push({ ...version('next-correction', 4_000, OTHER), uploadAuthority: 'admin' });
  assert.equal(selectCanonicalStorageVersions(rows, { isAdmin: () => false })[0].storageRefId, 'next-correction');
});

test('unstamped rows never gain authority from roles or legacy admin flags', () => {
  const rows = [
    version('original', 1_000, AUTHOR),
    { ...version('legacy-correction', 2_000, ADMIN), uploaderIsAdmin: true },
    { ...version('promoted-retry', 3_000, OTHER), uploaderIsAdmin: true },
    { ...version('invalid-stamp', 4_000, ADMIN), uploadAuthority: ' admin ' },
  ];
  for (const currentAdmins of [[], [ADMIN], [AUTHOR], [OTHER]]) {
    for (const candidates of [rows, [...rows].reverse()]) {
      const chosen = selectCanonicalStorageVersions(candidates, { isAdmin: (address) => currentAdmins.includes(address) });
      assert.equal(chosen[0].storageRefId, 'original');
    }
  }
});

test('equal timestamps break ties by storage id so every reader agrees', () => {
  const rows = [version('b-ref', 1_000, AUTHOR), version('a-ref', 1_000, OTHER)];
  assert.equal(selectCanonicalStorageVersions(rows, { isAdmin })[0].storageRefId, 'a-ref');
  assert.equal(selectCanonicalStorageVersions(rows.reverse(), { isAdmin })[0].storageRefId, 'a-ref');
});

test('equal-time choices use code-unit order for every input order and authority tier', () => {
  const ids = ['a-ref', 'Z-ref', '_ref', 'A-ref'];
  for (const uploadAuthority of ['author', 'admin']) {
    for (const order of [ids, [...ids].reverse(), ['_ref', 'A-ref', 'a-ref', 'Z-ref']]) {
      const rows = order.map((id) => ({ ...version(id, 1_000, AUTHOR), uploadAuthority }));
      assert.equal(selectCanonicalStorageVersions(rows)[0].storageRefId, uploadAuthority === 'admin' ? 'a-ref' : 'A-ref');
    }
  }
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
