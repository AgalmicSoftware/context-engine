import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createQuestionIdDerivation } from '../../shared/questions/questionId.mjs';
import { questionIdFixtures } from '../helpers/questionIdFixtures.mjs';

const { generateQuestionId, questionIdMatchesContent } = createQuestionIdDerivation(ethers);

const multichoice = (prompt, options = [], singleSelect = false) => ({ type: 'multichoice', prompt, options, singleSelect });
const idOf = ({ type, prompt, options, singleSelect, voiceCredits }) =>
  generateQuestionId(type, prompt, options, singleSelect, voiceCredits);

test('ids already published for unambiguous questions stay byte-identical', () => {
  assert.equal(
    generateQuestionId('multichoice', 'Prompt', ['Yes', 'No'], true),
    '0x0f92b29cb2e34be67fb3a3fae835fefff1cf7d48ab2bf5af4d5dda977132a8f2',
  );
  assert.equal(generateQuestionId('binary', 'Ban cars downtown'), '0x6484b09fd2200e3712dbdb5f8cc6a16d12fa8c1c2637002df0c9648fc1e7848e');
  assert.equal(
    generateQuestionId('quadratic', 'Fund', ['A', 'B'], false, 50),
    '0x93a98cf5d1a2a25cf07fd4c65ad8189654ec8fbd83cb86cd96f328aaf5c1802e',
  );
});

test('every parity fixture hashes its pinned preimage', () => {
  for (const { args, preimage } of questionIdFixtures) {
    assert.equal(generateQuestionId(...args), ethers.utils.id(preimage), preimage);
  }
});

test('multichoice questions the legacy text conflated get distinct ids', () => {
  const conflated = [
    // A delimiter inside an option.
    [multichoice('Pick', ['A,B', 'C']), multichoice('Pick', ['A', 'B,C']), 'multichoice:pick:a,b,c'],
    // A lone "single" option read as the single-select suffix.
    [multichoice('Pick', ['single']), multichoice('Pick', [], true), 'multichoice:pick:single'],
    [multichoice('Pick:b', ['single']), multichoice('Pick', ['b'], true), 'multichoice:pick:b:single'],
    // No options under a prompt holding ":", or an option under a shorter prompt.
    [multichoice('Pick:a'), multichoice('Pick', ['a']), 'multichoice:pick:a'],
  ];
  for (const [left, right, legacyText] of conflated) {
    const legacyId = ethers.utils.id(legacyText);
    assert.ok(questionIdMatchesContent(legacyId, left) && questionIdMatchesContent(legacyId, right), legacyText);
    assert.notEqual(idOf(left), idOf(right), legacyText);
  }
});

test('delimiters, blanks and order inside options stay significant', () => {
  // Each pair shared one legacy text; the delimiter-free side keeps it.
  const budget = idOf(multichoice('Which budget?', ['$1,000', '$2,000']));
  const resplit = idOf(multichoice('Which budget?', ['$1', '000', '$2', '000']));
  assert.notEqual(budget, resplit);
  assert.equal(resplit, ethers.utils.id('multichoice:which budget?:$1,000,$2,000'));
  assert.notEqual(idOf(multichoice('Pick', [',', ','])), idOf(multichoice('Pick', [',,,'])));
  assert.notEqual(idOf(multichoice('Pick', ['a:b'])), idOf(multichoice('Pick:a', ['b'])));
  assert.equal(idOf(multichoice('Pick:a', ['b'])), ethers.utils.id('multichoice:pick:a:b'));
  assert.notEqual(idOf(multichoice('Pick', ['b:single'])), idOf(multichoice('Pick', ['b'], true)));

  // Blank options never counted.
  assert.equal(idOf(multichoice('Pick', ['A', ' ', '', 'B'])), idOf(multichoice('Pick', ['A', 'B'])));
  assert.equal(idOf(multichoice('Pick', ['', '  '])), idOf(multichoice('Pick')));
  assert.equal(idOf(multichoice('Pick', [' A,B ', ''])), idOf(multichoice('pick', ['a,b'])));

  assert.notEqual(idOf(multichoice('Pick', ['A,B', 'C'])), idOf(multichoice('Pick', ['C', 'A,B'])));
  assert.notEqual(idOf(multichoice('Pick', ['A', 'B'])), idOf(multichoice('Pick', ['B', 'A'])));
});

test('v2 ids are NFC-normalized; legacy ids stay as published', () => {
  const composed = ['Café', ['été, hiver', 'Printemps']];
  const decomposed = ['Café', ['été, hiver', 'Printemps']];
  assert.equal(idOf(multichoice(...composed)), idOf(multichoice(...decomposed)));
  assert.notEqual(
    generateQuestionId('binary', composed[0]),
    generateQuestionId('binary', decomposed[0]),
    'legacy text was never normalized, so its ids cannot change',
  );
});

test('every question-defining field changes the id', () => {
  const base = multichoice('Pick', ['A,B', 'C']);
  const multichoiceIds = [
    base,
    { ...base, prompt: 'Pick again' },
    { ...base, options: ['A,B', 'D'] },
    { ...base, singleSelect: true },
    { ...base, type: 'quadratic' },
  ].map(idOf);
  assert.equal(new Set(multichoiceIds).size, multichoiceIds.length);
  // Voice credits only define quadratic questions.
  assert.equal(idOf({ ...base, voiceCredits: 5 }), idOf(base));
  assert.notEqual(generateQuestionId('quadratic', 'Fund', ['A', 'B'], false, 5), generateQuestionId('quadratic', 'Fund', ['A', 'B']));
});

test('an ambiguous question matches its published legacy id and its v2 id, nothing else', () => {
  const budget = multichoice('Which budget?', ['$1,000', '$2,000']);
  const publishedLegacyId = '0xe5e81c3ffebf1f12d1e006ec43d94740c2f0d5ac726767a05b58ef168e02f344';
  const currentId = idOf(budget);
  assert.notEqual(currentId, publishedLegacyId);
  assert.equal(questionIdMatchesContent(publishedLegacyId, budget), true);
  assert.equal(questionIdMatchesContent(currentId, budget), true);
  assert.equal(questionIdMatchesContent(`0x${currentId.slice(2).toUpperCase()}`, budget), true);

  assert.equal(questionIdMatchesContent(currentId, { ...budget, options: ['$1,000'] }), false);
  assert.equal(questionIdMatchesContent(currentId, { ...budget, singleSelect: true }), false);
  assert.equal(questionIdMatchesContent(undefined, budget), false);
  // The v2 encoding is multichoice-only: it carries no voice credits.
  const quadratic = { type: 'quadratic', prompt: 'Fund', options: ['A', 'B'], voiceCredits: 50 };
  assert.equal(questionIdMatchesContent(idOf(quadratic), quadratic), true);
  const v2Shaped = ethers.utils.id(JSON.stringify(['ce-question-id', 2, 'quadratic', 'fund', ['a', 'b'], false]));
  assert.equal(questionIdMatchesContent(v2Shaped, quadratic), false);
});
