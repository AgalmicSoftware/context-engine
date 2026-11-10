import test from 'node:test';
import assert from 'node:assert/strict';
import { stableCanonicalSerialize } from '../../shared/canonicalJson.mjs';
import { stableCanonicalSerialize as workerSerialize } from '../../workers/shared/deployHelperCore.mjs';

// Request digests and stored signatures hash these bytes, so they must never move.
test('canonical JSON sorts keys, drops absent members and keeps array positions', () => {
  const value = {
    b: 1,
    a: [undefined, () => 1, Symbol('s'), Number.NaN, Infinity, { d: undefined, c: 'x', e: null }],
    f: { h: [true, false], g: -0 },
    i: () => 2,
  };
  assert.equal(stableCanonicalSerialize(value), '{"a":[null,null,null,null,null,{"c":"x","e":null}],"b":1,"f":{"g":0,"h":[true,false]}}');
  assert.equal(stableCanonicalSerialize(undefined), undefined);
  assert.equal(stableCanonicalSerialize('text'), '"text"');
  assert.equal(workerSerialize, stableCanonicalSerialize);
});
