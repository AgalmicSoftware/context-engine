import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  buildResultsSyncSnapshot,
  compareResultsSyncSnapshot,
  defaultSyncPaths,
} from '../src/results-sync.mjs';
import { sha256 } from '../src/provenance.mjs';

test('standalone report declares every live Context Engine Results source it mirrors', async () => {
  const { contextEngineRoot, manifestPath } = defaultSyncPaths();
  const expected = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const actual = await buildResultsSyncSnapshot(contextEngineRoot);
  assert.deepEqual(compareResultsSyncSnapshot(expected, actual), []);
  assert.ok(Object.keys(actual.files).length >= 10);
});

test('Results sync comparison reports changed and newly-added source files', () => {
  const drift = compareResultsSyncSnapshot(
    { files: { 'a.scss': 'old' } },
    { files: { 'a.scss': 'new', 'b.tsx': 'hash' } }
  );
  assert.deepEqual(drift.map((entry) => entry.path), ['a.scss', 'b.tsx']);
});

test('byte hashing preserves distinct non-UTF8 buffers', () => {
  assert.notEqual(sha256(Buffer.from([0xff])), sha256(Buffer.from([0xfe])));
});
