// A choose-several answer through Agent HTTP: every option arrives together, whichever of the two fields an
// agent puts the list in, and what is refused is refused whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraftForQuestion, normalizePreferenceEntries } from './participation.mjs';
import { buildAgentResponsePayload } from './onChainResponses.mjs';

const several = { questionId: 'q-several', type: 'multichoice', questionType: 'multichoice', options: ['Rivers', 'Forests', 'Coasts', 'Cities'] };
const one = { ...several, questionId: 'q-one', singleSelect: true };
const draftOf = (body, question = several) => {
  const [entry] = normalizePreferenceEntries({ preferences: [{ questionId: question.questionId, ...body }] });
  return normalizeDraftForQuestion(entry.answer, question);
};

test('a choose-several answer is taken whole from values, from a list in value, or from a list as the answer', () => {
  for (const body of [
    { values: ['Rivers', 'Coasts'] },
    { value: ['Rivers', 'Coasts'] },
    { answer: ['Rivers', 'Coasts'] },
    { answer: { values: ['Rivers', 'Coasts'] } },
    { answer: { value: ['Rivers', 'Coasts'] } },
  ]) {
    const draft = draftOf(body);
    assert.deepEqual(draft?.value, { questionType: 'multichoice', values: ['Rivers', 'Coasts'], comments: '' }, JSON.stringify(body));
    assert.equal(draft.label, 'Rivers, Coasts');
    // What is stored for it holds both options.
    const stored = buildAgentResponsePayload({ questionRef: several, answer: draft.value });
    assert.deepEqual(stored.answer.value, ['Rivers', 'Coasts'], JSON.stringify(body));
  }
  // Where both fields are sent, `values` is the one read.
  assert.deepEqual(draftOf({ values: ['Cities'], value: ['Rivers', 'Coasts'] }).value.values, ['Cities']);
  // One option by itself still comes as text, as before.
  assert.deepEqual(draftOf({ value: 'Forests' }).value.values, ['Forests']);
  assert.deepEqual(draftOf({ value: ['Forests'], comments: 'Mostly.' }).value, { questionType: 'multichoice', values: ['Forests'], comments: 'Mostly.' });
});

test('a list is held to the same rules whichever field carries it', () => {
  for (const field of ['values', 'value']) {
    assert.equal(draftOf({ [field]: [] }), null, field);
    assert.equal(draftOf({ [field]: ['Rivers', 'Rivers'] }), null, field);
    assert.equal(draftOf({ [field]: ['Rivers', 'Lakes'] }), null, field);
    assert.equal(draftOf({ [field]: ['rivers'] }), null, field);
    // A choose-one question takes one option, not a list of two.
    assert.equal(draftOf({ [field]: ['Rivers', 'Coasts'] }, one), null, field);
    assert.deepEqual(draftOf({ [field]: ['Coasts'] }, one).value.values, ['Coasts'], field);
  }
});

test('other question types read value as they did', () => {
  const quadratic = { questionId: 'q-quad', type: 'quadratic', questionType: 'quadratic', options: ['A', 'B', 'C'], voiceCredits: 9 };
  assert.deepEqual(normalizeDraftForQuestion({ value: [2, 0, -1] }, quadratic).value.value, [2, 0, -1]);
  const binary = { questionId: 'q-bin', type: 'binary', questionType: 'binary' };
  assert.equal(normalizeDraftForQuestion({ value: 'agree' }, binary).value.value, 'agree');
  const freeform = { questionId: 'q-free', type: 'freeform', questionType: 'freeform' };
  assert.equal(normalizeDraftForQuestion({ text: 'Autumn' }, freeform).value.text, 'Autumn');
});
