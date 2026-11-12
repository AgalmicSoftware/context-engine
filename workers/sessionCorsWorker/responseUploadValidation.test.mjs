import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { buildResponseRecord } from '../../mcp/lib/records.mjs';
import { buildAgentResponsePayload } from './agent/onChainResponses.mjs';
import {
  aesGcmEncrypt, b64encode, buildEnvelopeObject, buildResponseFieldAAD, encodePaddedEnvelopePlaintext, importAesGcmKey,
} from '../../shared/encryption/envelopeV1Core.mjs';
import {
  SESSION_ID, SLUG, createSessionEnv, login, signedAdminRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const QUESTIONS = [
  { id: 'q-bin', type: 'binary', prompt: 'Agree?' },
  { id: 'q-rate', type: 'rating', prompt: 'How much?', min: 1, max: 5 },
  { id: 'q-quad', type: 'quadratic', prompt: 'Spend credits', options: ['A', 'B', 'C'], voiceCredits: 99 },
  { id: 'q-multi', type: 'multichoice', prompt: 'Which?', options: ['North', 'South'], singleSelect: true },
  { id: 'q-free', type: 'freeform', prompt: 'Why?' },
  // A locked question masks what an answer would be checked against.
  { id: 'q-locked', type: 'multichoice', prompt: '[encrypted]', promptEncrypted: true, options: ['[encrypted]'], locked: true },
  { id: 'q-hidden', type: 'binary', prompt: 'Hidden later' },
].map((question) => ({ ...question, ...session }));

const setup = async () => {
  const { admin, env } = createSessionEnv();
  const adminToken = await login({ env, wallet: admin });
  for (const question of QUESTIONS) {
    const stored = await uploadJson({ env, token: adminToken, resource: 'questions', data: question });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  const hidden = await signedAdminRequest({ env, wallet: admin, action: 'storage/set-hidden', body: { resource: 'questions', id: 'q-hidden', hidden: true } });
  assert.equal(hidden.status, 200, JSON.stringify(hidden.body));
  const participant = Wallet.createRandom();
  return { env, participant, token: await login({ env, wallet: participant }) };
};

const field = (value, extra = {}) => ({ value, encrypted: false, encryptionAudience: 'public', encryptionGateId: '', audienceMode: 'public', hash: '', ...extra });
// The web client's answer row (surveyToolResponsePayloadController).
const clientRow = (questionID, value, extra = {}) => ({
  questionID, responder: '0x0', type: QUESTIONS.find((question) => question.id === questionID)?.type || 'binary', prompt: 'Prompt',
  conviction: 5, importance: 5, answer: field(value), additional: field(''), ...session, ...extra,
});

const lockedField = async (value, kind) => {
  const random = (length) => crypto.getRandomValues(new Uint8Array(length));
  const hex = (length) => `0x${Buffer.from(random(length)).toString('hex')}`;
  const context = hex(32);
  const aad = buildResponseFieldAAD({ contextHex: context, chainId: 11155420, surveyId: hex(32), qId: 'q-multi', fieldKey: kind });
  const plaintext = encodePaddedEnvelopePlaintext({ v: 1, value, kind, salt: hex(16) }, {});
  const { iv, ciphertext } = await aesGcmEncrypt(await importAesGcmKey(random(32)), plaintext, { aadBytes: new TextEncoder().encode(JSON.stringify(aad)) });
  const recipients = [{ type: 'self-eip712-v1', context, wrap_iv: b64encode(random(12)), wrapped_cek: b64encode(random(48)), nonce: '1' }];
  return JSON.stringify(buildEnvelopeObject({ iv, ciphertextBytes: ciphertext, aadObj: aad, recipients, commitments: { keccak256: hex(32), poseidon: hex(32) }, kind }));
};

test('the Worker refuses answers to unknown questions and values a question does not accept', async () => {
  const { env, token } = await setup();
  for (const [data, reason] of [
    [{ questionID: 'q-does-not-exist', answer: 'Agree' }, 'response_question_unknown'],
    [{ questionID: 'q-bin', answer: 'Banana' }, 'response_answer_invalid'],
    [{ questionID: 'q-rate', answer: 9000 }, 'response_answer_invalid'],
    [{ questionID: 'q-quad', answer: [1000, 1000, 1000] }, 'response_answer_invalid'],
    [clientRow('q-multi', ['North', 'South']), 'response_answer_invalid'],
    [clientRow('q-multi', ['West']), 'response_answer_invalid'],
    // One bad answer refuses the whole survey submission.
    [{ surveyID: 'survey-1', responses: [clientRow('q-bin', 'Agree'), clientRow('q-unknown', 'Agree')] }, 'response_question_unknown'],
  ]) {
    const refused = await uploadJson({ env, token, resource: 'responses', data });
    assert.equal(refused.status, 422, JSON.stringify(data));
    assert.equal(refused.body.reason, reason, JSON.stringify(refused.body));
    assert.ok(refused.body.error, 'a refusal carries a message the client can show');
  }
});

test('every answer shape the app uploads is still accepted', async () => {
  const { env, participant, token } = await setup();
  const longText = 'Because '.repeat(2000);
  const mcp = buildResponseRecord({ question: QUESTIONS[0], value: 'disagree', comment: 'From an agent', responder: participant.address, session });
  assert.equal(mcp.ok, true, mcp.error);
  const agent = buildAgentResponsePayload({
    sessionSlug: SLUG,
    questionRef: { questionId: 'q-quad', questionType: 'quadratic', options: ['A', 'B', 'C'], voiceCredits: 99, prompt: 'Spend credits' },
    answer: { value: [3, 4, 5] },
    accountAddress: participant.address,
  });
  const cases = {
    'typed binary': clientRow('q-bin', 'Agree'),
    'typed rating': clientRow('q-rate', 4),
    'typed quadratic': clientRow('q-quad', [5, 5, 7]),
    'typed multichoice': clientRow('q-multi', ['South']),
    'long freeform from an interview draft': clientRow('q-free', longText, {
      interviewProvenance: { version: 2, predictionComparison: { changed: false }, originalPrediction: { value: longText } },
    }),
    'comment edit with no answer': clientRow('q-bin', '', { additional: field('A comment only') }),
    'cleared multichoice': clientRow('q-multi', []),
    'locked answer and comment': clientRow('q-multi', '*', {
      answer: field('*', { encrypted: true, encryptionAudience: 'self_admin', hash: `0x${'1'.repeat(64)}`, encryptedPortion: await lockedField(['South'], 'multichoice') }),
      importance: null,
      importanceEncrypted: await lockedField(4, 'rating'),
    }),
    'answer to a locked question': clientRow('q-locked', ['anything']),
    'answer to a hidden question': clientRow('q-hidden', 'Agree'),
    'survey submission': { surveyID: 'survey-1', responder: '0x0', timeStamp: Date.now(), sessionName: SLUG, ...session,
      responses: [clientRow('q-bin', 'Unsure'), clientRow('q-rate', 2)] },
    'single-question mode': clientRow('q-bin', 'Disagree', { timeStamp: Date.now(), sessionName: SLUG }),
    'MCP agent': mcp.record,
    'Agent HTTP': agent,
    'load-rehearsal minimum': { questionID: 'q-bin', type: 'binary', answer: { value: 'Agree', encrypted: false }, additional: { value: '', encrypted: false } },
  };
  for (const [name, data] of Object.entries(cases)) {
    const stored = await uploadJson({ env, token, resource: 'responses', data });
    assert.equal(stored.status, 200, `${name}: ${JSON.stringify(stored.body)}`);
  }
});
