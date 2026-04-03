import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findArweaveTagIndex,
  getArweaveTagValue,
  normalizeArweaveCeTags,
  setArweaveTagValue,
} from './arweaveCeTagNormalization.js';

test('normalizeArweaveCeTags accepts array and object payloads and trims names/values', () => {
  assert.deepEqual(
    normalizeArweaveCeTags([
      { name: ' CE-Test ', value: ' ok ' },
    ]),
    {
      ok: true,
      tags: [{ name: 'CE-Test', value: 'ok' }],
    }
  );

  assert.deepEqual(
    normalizeArweaveCeTags({
      ' CE-Other ': ' yes ',
    }),
    {
      ok: true,
      tags: [{ name: 'CE-Other', value: 'yes' }],
    }
  );
});

test('normalizeArweaveCeTags preserves invalid-json and invalid-name rejections', () => {
  assert.deepEqual(
    normalizeArweaveCeTags('{bad-json'),
    { ok: false, error: 'Invalid tags JSON.' }
  );

  assert.deepEqual(
    normalizeArweaveCeTags([{ name: 'Not-CE', value: 'ok' }]),
    { ok: false, error: 'Custom tags must start with CE-' }
  );

  assert.deepEqual(
    normalizeArweaveCeTags([{ name: 'Content-Type', value: 'text/plain' }]),
    { ok: false, error: 'Reserved tag name: Content-Type' }
  );
});

test('find/get/set arweave tag helpers preserve trimmed overwrite behavior', () => {
  const tags = [{ name: 'CE-Test', value: 'one' }];

  assert.equal(findArweaveTagIndex(tags, 'CE-Test'), 0);
  assert.equal(getArweaveTagValue(tags, 'CE-Test'), 'one');

  setArweaveTagValue(tags, 'CE-Test', ' two ');
  assert.deepEqual(tags, [{ name: 'CE-Test', value: 'two' }]);

  setArweaveTagValue(tags, 'CE-Other', ' three ');
  assert.deepEqual(tags, [
    { name: 'CE-Test', value: 'two' },
    { name: 'CE-Other', value: 'three' },
  ]);
});
