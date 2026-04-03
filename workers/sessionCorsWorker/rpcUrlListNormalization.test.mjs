import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeRpcUrlLists,
  normalizeRpcUrlList,
} from './rpcUrlListNormalization.js';

test('normalizeRpcUrlList trims array entries and removes empty values', () => {
  assert.deepEqual(
    normalizeRpcUrlList([' https://rpc-a.example ', '', null, 'https://rpc-b.example ']),
    ['https://rpc-a.example', 'https://rpc-b.example']
  );
});

test('normalizeRpcUrlList converts a single scalar into a one-item trimmed list', () => {
  assert.deepEqual(
    normalizeRpcUrlList(' https://rpc.example '),
    ['https://rpc.example']
  );
  assert.deepEqual(normalizeRpcUrlList('   '), []);
});

test('mergeRpcUrlLists preserves first-seen order and dedupes trimmed URLs across lists', () => {
  assert.deepEqual(
    mergeRpcUrlLists(
      [' https://shared.example ', 'https://mapped-only.example'],
      null,
      ['https://shared.example', 'https://fallback.example '],
      [' ', undefined]
    ),
    [
      'https://shared.example',
      'https://mapped-only.example',
      'https://fallback.example',
    ]
  );
});
