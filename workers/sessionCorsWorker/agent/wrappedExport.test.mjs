import test from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape, rowsToCsv, rowsToJsonl } from './wrappedExport.mjs';

test('research CSV treats formula-like participant text as literal cells', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@x', '\ttext', '\rtext']) {
    assert.equal(csvEscape(value), `"'${value}"`);
  }
  for (const value of ['-5', -5, 0, '+5', '-1.5e-2']) {
    assert.equal(csvEscape(value), `"${value}"`);
  }
});

test('research CSV quotes every cell and preserves existing non-string serialization', () => {
  assert.equal(rowsToCsv([{ text: 'a"b,c\nd\re', number: -5, object: { ok: true } }]),
    '"text","number","object"\n"a""b,c\nd\re","-5","{""ok"":true}"');
  assert.equal(rowsToCsv([{ '=header': '@value' }]), '"\'=header"\n"\'@value"');
  assert.equal(csvEscape(null), '""""""');
  assert.equal(csvEscape(false), '"false"');
  assert.equal(rowsToCsv([]), '');
});

test('research JSONL keeps participant text exact', () => {
  const rows = [{ text: '=1+1', note: '\rwith\n"quotes"', number: -5 }, { text: '@x' }];
  assert.deepEqual(rowsToJsonl(rows).split('\n').map(line => JSON.parse(line)), rows);
});
