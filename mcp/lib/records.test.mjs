import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { questionIdFixtures } from '../../tests/helpers/questionIdFixtures.mjs';
import { buildQuestionRecord, buildResponseRecord, generateQuestionId, normalizeAnswerValue } from './records.mjs';

const RESPONDER = '0x00000000000000000000000000000000000000aa';
const SESSION = { sessionSlug: 'town-hall', sessionId: '0x00112233445566778899aabbccddeeff', sessionName: 'Town Hall' };

test('question ids match the web client derivation for every type', () => {
  assert.equal(generateQuestionId('binary', '  Ban Cars Downtown '), ethers.utils.id('binary:ban cars downtown'));
  assert.equal(
    generateQuestionId('multichoice', 'Pick', [' Red', 'Blue ', ''], true),
    ethers.utils.id('multichoice:pick:red,blue:single'),
  );
  assert.equal(
    generateQuestionId('quadratic', 'Fund', ['A', ' b '], false, 50),
    ethers.utils.id('quadratic:fund:["a","b"]:50'),
  );
  assert.equal(generateQuestionId('rating', 'Trust?'), ethers.utils.id('rating:trust?'));
  for (const { args, preimage } of questionIdFixtures) {
    assert.equal(generateQuestionId(...args), ethers.utils.id(preimage), preimage);
  }
});

test('answers are validated and normalized per question type', () => {
  assert.deepEqual(normalizeAnswerValue({ type: 'binary' }, ' agree '), { ok: true, value: 'Agree' });
  assert.equal(normalizeAnswerValue({ type: 'binary' }, 'yes').ok, false);
  assert.deepEqual(normalizeAnswerValue({ type: 'rating' }, 7), { ok: true, value: 7 });
  assert.deepEqual(normalizeAnswerValue({ type: 'rating' }, '10'), { ok: true, value: 10 });
  assert.equal(normalizeAnswerValue({ type: 'rating' }, 11).ok, false);
  assert.equal(normalizeAnswerValue({ type: 'rating' }, 4.5).ok, false);
  assert.deepEqual(normalizeAnswerValue({ type: 'rating', scale: { min: 1, max: 5 } }, 5), { ok: true, value: 5 });
  assert.equal(normalizeAnswerValue({ type: 'rating', scale: { min: 1, max: 5 } }, 0).ok, false);

  const multi = { type: 'multichoice', options: ['Red', 'Blue', 'Green'] };
  assert.deepEqual(normalizeAnswerValue(multi, ['blue', 'RED']), { ok: true, value: ['Blue', 'Red'] });
  assert.deepEqual(normalizeAnswerValue(multi, 'green'), { ok: true, value: ['Green'] });
  assert.equal(normalizeAnswerValue(multi, 'purple').ok, false);
  assert.equal(normalizeAnswerValue({ ...multi, singleSelect: true }, ['Red', 'Blue']).ok, false);
  assert.equal(normalizeAnswerValue({ ...multi, maxSelections: 1 }, ['Red', 'Blue']).ok, false);

  const quadratic = { type: 'quadratic', options: ['A', 'B'], voiceCredits: 10 };
  assert.deepEqual(normalizeAnswerValue(quadratic, [3, -1]), { ok: true, value: [3, -1] });
  assert.equal(normalizeAnswerValue(quadratic, [3, 2]).ok, false);
  assert.equal(normalizeAnswerValue(quadratic, [1]).ok, false);

  assert.deepEqual(normalizeAnswerValue({ type: 'freeform' }, '  hello '), { ok: true, value: 'hello' });
  assert.equal(normalizeAnswerValue({ type: 'freeform' }, '   ').ok, false);
  assert.equal(normalizeAnswerValue({ type: 'unknown' }, 'x').ok, false);
});

test('response records match the web client pile shape and carry the agent marker', () => {
  const question = { id: generateQuestionId('binary', 'Ban cars downtown'), type: 'binary', prompt: 'Ban cars downtown' };
  const built = buildResponseRecord({
    question,
    value: 'disagree',
    comment: 'Buses need the lanes.',
    conviction: 8,
    responder: RESPONDER,
    session: SESSION,
    profile: { displayName: 'civic-bot.delve.town', modelId: 'model-x', platform: 'at_mcp' },
  });
  assert.equal(built.ok, true);
  assert.deepEqual(built.record, {
    questionID: question.id,
    responder: ethers.utils.getAddress(RESPONDER),
    type: 'binary',
    prompt: 'Ban cars downtown',
    conviction: 8,
    importance: 8,
    answer: {
      value: 'Disagree',
      encrypted: false,
      encryptionAudience: 'self',
      encryptionGateId: null,
      audienceMode: 'explicit',
      hash: '',
      encryptedPortion: '',
    },
    additional: {
      value: 'Buses need the lanes.',
      encrypted: false,
      encryptionAudience: 'self',
      encryptionGateId: null,
      audienceMode: 'explicit',
      hash: ethers.utils.id('Buses need the lanes.'),
      encryptedPortion: '',
    },
    responderName: 'civic-bot.delve.town',
    participant: { kind: 'agent', modelId: 'model-x', platform: 'at_mcp', verification: 'self_reported' },
    sessionId: SESSION.sessionId,
    sessionSlug: SESSION.sessionSlug,
  });
});

test('response records hash freeform text, omit an empty display name, and reject bad scores', () => {
  const question = { id: '0xabc', type: 'freeform', prompt: 'Why?' };
  const built = buildResponseRecord({ question, value: 'Because.', responder: RESPONDER, session: SESSION });
  assert.equal(built.record.answer.hash, ethers.utils.id('Because.'));
  assert.equal(built.record.additional.hash, '');
  assert.equal(built.record.importance, null);
  assert.equal('responderName' in built.record, false);
  assert.deepEqual(built.record.participant, { kind: 'agent', verification: 'self_reported' });
  assert.equal(buildResponseRecord({ question, value: 'x', importance: 11, responder: RESPONDER, session: SESSION }).ok, false);
  assert.equal(buildResponseRecord({ question: { type: 'binary' }, value: 'Agree', responder: RESPONDER, session: SESSION }).ok, false);
});

test('question records match the web client authoring shape', () => {
  const built = buildQuestionRecord({
    type: 'multichoice',
    prompt: '  Which   institution first? ',
    options: ['Courts', 'Assembly', 'Ledger'],
    singleSelect: true,
    tags: ['governance'],
    creator: RESPONDER,
    session: SESSION,
    profile: { modelId: 'model-x' },
  });
  assert.equal(built.ok, true);
  assert.equal(built.id, generateQuestionId('multichoice', 'Which   institution first?', ['Courts', 'Assembly', 'Ledger'], true));
  // The web client hashes trimmed, lowercased text without collapsing inner spaces.
  assert.equal(built.id, ethers.utils.id('multichoice:which   institution first?:courts,assembly,ledger:single'));
  assert.deepEqual(built.record, {
    id: built.id,
    type: 'multichoice',
    prompt: 'Which   institution first?',
    options: ['Courts', 'Assembly', 'Ledger'],
    singleSelect: true,
    tags: ['governance'],
    creator: ethers.utils.getAddress(RESPONDER),
    associatedSurveyId: ethers.constants.HashZero,
    participant: { kind: 'agent', modelId: 'model-x', verification: 'self_reported' },
    sessionName: 'Town Hall',
    sessionSlug: 'town-hall',
    sessionId: SESSION.sessionId,
  });
  assert.match(built.id, /^[a-z0-9][a-z0-9._:-]{0,127}$/);
});

test('question records validate type, text, options and credits', () => {
  const base = { creator: RESPONDER, session: SESSION };
  assert.equal(buildQuestionRecord({ ...base, prompt: 'x', type: 'poll' }).ok, false);
  assert.equal(buildQuestionRecord({ ...base, prompt: '   ' }).ok, false);
  assert.equal(buildQuestionRecord({ ...base, prompt: 'x', type: 'multichoice', options: ['one'] }).ok, false);
  assert.equal(buildQuestionRecord({ ...base, prompt: 'x', type: 'multichoice', options: ['a', 'A'] }).ok, false);
  assert.equal(buildQuestionRecord({ ...base, prompt: 'x', type: 'quadratic', options: ['a', 'b'], voiceCredits: 0 }).ok, false);
  const quadratic = buildQuestionRecord({ ...base, prompt: 'Fund', type: 'quadratic', options: ['A', 'B'] });
  assert.equal(quadratic.record.voiceCredits, 99);
  assert.equal(quadratic.id, generateQuestionId('quadratic', 'Fund', ['A', 'B'], false, 99));
  const binary = buildQuestionRecord({ ...base, prompt: 'Plain' });
  assert.equal('options' in binary.record, false);
  assert.equal(binary.record.sessionName, 'Town Hall');
});

test('choices and numbers keep an empty answer hash, and locked questions are refused', () => {
  const cases = [
    [{ id: '0x1', type: 'rating', prompt: 'R' }, 4],
    [{ id: '0x2', type: 'multichoice', prompt: 'M', options: ['a', 'b'] }, ['a']],
    [{ id: '0x3', type: 'quadratic', prompt: 'Q', options: ['a', 'b'] }, [1, -1]],
  ];
  cases.forEach(([question, value]) => {
    const built = buildResponseRecord({ question, value, responder: RESPONDER, session: SESSION });
    assert.equal(built.record.answer.hash, '');
  });
  const locked = { id: '0x4', type: 'binary', prompt: '[encrypted]', promptEncrypted: { ciphertext: 'x' }, encryption: { gates: [] } };
  assert.match(buildResponseRecord({ question: locked, value: 'Agree', responder: RESPONDER, session: SESSION }).error, /locked/);
});

test('answers carry the link recruitment source like the web client', () => {
  const question = { id: '0x5', type: 'binary', prompt: 'B' };
  const built = buildResponseRecord({ question, value: 'Agree', responder: RESPONDER, session: SESSION, recruitmentSource: 'delve town' });
  assert.deepEqual(built.record.recruitment, { source: 'delve-town' });
  assert.equal('recruitment' in buildResponseRecord({ question, value: 'Agree', responder: RESPONDER, session: SESSION, recruitmentSource: '!!' }).record, false);
});
