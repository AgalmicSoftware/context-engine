import test from 'node:test';
import assert from 'node:assert/strict';
import { isStoredVersionsDiagnostics } from './sessionDiagnostics.mjs';

test('the stored-version contract accepts what the Worker sends and nothing else', () => {
  for (const good of [null, { count: 0, limit: 10_000, overLimit: false }, { count: 10_000, limit: 10_000, overLimit: false },
    { count: 10_001, limit: 10_000, overLimit: true }]) assert.equal(isStoredVersionsDiagnostics(good), true, JSON.stringify(good));
  for (const bad of [undefined, {}, [], { count: 3, limit: 10_000 }, { count: 3, limit: 10_000, complete: true },
    { count: -1, limit: 10_000, overLimit: false }, { count: 1.5, limit: 10_000, overLimit: false },
    { count: 3, limit: 0, overLimit: false }, { count: 10_001, limit: 10_000, overLimit: false },
    { count: 3, limit: 10_000, overLimit: true }, { count: 3, limit: 10_000, overLimit: 0 },
    { count: 3, limit: 10_000, overLimit: false, extra: 1 }]) {
    assert.equal(isStoredVersionsDiagnostics(bad), false, JSON.stringify(bad));
  }
});
