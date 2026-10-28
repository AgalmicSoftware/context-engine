import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_RESPONSE_ITEM_BYTES,
  MAX_RESPONSE_PLAINTEXT_BYTES,
  STORAGE_RESOURCE_MAX_BYTES,
  validateStorageUploadPayload,
} from './storageUploadValidation.js';
import {
  aesGcmEncrypt,
  b64encode,
  buildEnvelopeObject,
  buildResponseFieldAAD,
  encodePaddedEnvelopePlaintext,
  importAesGcmKey,
} from '../../shared/encryption/envelopeV1Core.mjs';

const encode = (value) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const check = (resource, value, extra = {}) => validateStorageUploadPayload({ resource, bytes: encode(value), ...extra });

const QUESTION_ID = '0x5D1b6b0b7c2e0c9e0f2c3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d';
// Shapes the authoring client uploads (CreateQuestionsAndSurveys).
const clientQuestion = {
  id: QUESTION_ID,
  type: 'multichoice',
  prompt: 'Which pilot should continue?',
  options: ['North', 'South'],
  singleSelect: true,
  tags: ['pilot'],
  creator: '0x0000000000000000000000000000000000000abc',
  associatedSurveyId: `0x${'0'.repeat(64)}`,
  sessionName: 'Pilot',
  sessionSlug: 'pilot',
  sessionId: '0x0123456789abcdef0123456789abcdef',
};
const clientSurvey = {
  surveyID: `0x${'a'.repeat(64)}`,
  title: 'Pilot survey',
  questionIDs: [QUESTION_ID],
  creator: '0x0000000000000000000000000000000000000abc',
  documentURLs: [],
  sessionSlug: 'pilot',
};
const clientAnswer = (overrides = {}) => ({
  questionID: QUESTION_ID,
  type: 'freeform',
  answer: { value: 'Yes', encrypted: false },
  additional: { value: '', encrypted: false },
  ...overrides,
});

test('accepts the question, survey, and answer shapes the client uploads', () => {
  assert.deepEqual(check('questions', clientQuestion), {
    ok: true,
    payload: clientQuestion,
    resourceId: QUESTION_ID.toLowerCase(),
  });
  assert.equal(check('surveys', clientSurvey).resourceId, clientSurvey.surveyID);
  assert.equal(check('surveys', { ...clientSurvey, title: '[encrypted]' }).ok, true);
  assert.equal(check('responses', clientAnswer()).ok, true);
  // A survey submission bundles every changed answer.
  assert.equal(check('responses', { surveyID: clientSurvey.surveyID, responses: [clientAnswer(), clientAnswer()] }).ok, true);
  // A long free-text answer with a long comment stays under the answer cap.
  const longText = 'word '.repeat(6_000);
  assert.equal(check('responses', clientAnswer({ answer: { value: longText }, additional: { value: longText } })).ok, true);
});

for (const [label, resource, payload, error] of [
  ['a question without an id', 'questions', { ...clientQuestion, id: undefined }, /string id/],
  ['a question id with unsafe characters', 'questions', { ...clientQuestion, id: 'q/../1' }, /string id/],
  ['a question without a type', 'questions', { ...clientQuestion, type: '' }, /string type/],
  ['an object prompt', 'questions', { ...clientQuestion, prompt: { text: 'x' } }, /string prompt/],
  ['non-list options', 'questions', { ...clientQuestion, options: 'North,South' }, /options array/],
  ['a survey title that is not text', 'surveys', { ...clientSurvey, title: { text: 'x' } }, /string title/],
  ['non-text survey question ids', 'surveys', { ...clientSurvey, questionIDs: [1] }, /questionIDs/],
  ['a survey without an id', 'surveys', { ...clientSurvey, surveyID: undefined }, /string id/],
  ['an answer without a question id', 'responses', { answer: 'yes' }, /questionID/],
  ['an empty answer bundle', 'responses', { responses: [] }, /non-empty array/],
  ['a bundled answer without a question id', 'responses', { responses: [clientAnswer(), { answer: 'x' }] }, /responses\[1\]/],
  ['a JSON array', 'questions', [clientQuestion], /JSON object/],
  ['text that is not JSON', 'surveys', 'not json', /expected JSON/],
]) {
  test(`rejects ${label} with 400`, () => {
    const result = check(resource, payload);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, error);
  });
}

test('rejects oversized questions, surveys, answers, and bundles with 413', () => {
  const padding = (bytes) => 'x'.repeat(bytes);
  const oversized = [
    ['questions', { ...clientQuestion, prompt: padding(STORAGE_RESOURCE_MAX_BYTES.questions) }],
    ['surveys', { ...clientSurvey, title: padding(STORAGE_RESOURCE_MAX_BYTES.surveys) }],
    ['responses', clientAnswer({ additional: { value: padding(MAX_RESPONSE_ITEM_BYTES) } })],
    ['responses', { responses: [clientAnswer(), clientAnswer({ additional: { value: padding(MAX_RESPONSE_ITEM_BYTES) } })] }],
    ['responses', { responses: Array.from({ length: 40 }, () => clientAnswer({ answer: { value: padding(60_000) } })) }],
  ];
  for (const [resource, payload] of oversized) {
    const result = check(resource, payload);
    assert.equal(result.status, 413, `${resource} ${JSON.stringify(result)}`);
    assert.match(result.error, /^Upload payload too large/);
  }
});

// A locked field is padded, encrypted, base64-encoded and wrapped for its
// recipients by the client's envelope code; recipients use their longest forms.
const lockedField = async (value, kind) => {
  const random = (length) => crypto.getRandomValues(new Uint8Array(length));
  const hex = (length) => `0x${Buffer.from(random(length)).toString('hex')}`;
  const context = hex(32);
  const aad = buildResponseFieldAAD({ contextHex: context, chainId: 11155420, surveyId: hex(32), qId: QUESTION_ID, fieldKey: kind });
  const plaintext = encodePaddedEnvelopePlaintext({ v: 1, value, kind, salt: hex(16) }, {});
  const { iv, ciphertext } = await aesGcmEncrypt(await importAesGcmKey(random(32)), plaintext, {
    aadBytes: new TextEncoder().encode(JSON.stringify(aad)),
  });
  const recipients = [
    { type: 'self-eip712-v1', context, wrap_iv: b64encode(random(12)), wrapped_cek: b64encode(random(48)), nonce: (2n ** 256n - 1n).toString() },
    {
      type: 'worker-response-field-v1',
      policy: { owner: `0x${'ab'.repeat(20)}`, audience: 'self_admin', context, sessionSlug: 's'.repeat(128), sessionId: hex(16) },
      wrapped: { alg: 'AES-256-GCM', wrapAlg: 'AES-GCM-KW-v1', iv: 'i'.repeat(16), wrappedKey: 'k'.repeat(64) },
    },
  ];
  const envelope = buildEnvelopeObject({
    iv, ciphertextBytes: ciphertext, aadObj: aad, recipients,
    commitments: { keccak256: hex(32), poseidon: (2n ** 254n).toString() }, kind,
  });
  return JSON.stringify(envelope);
};

test('an answer within the plaintext budget still fits once its answer, comment and ratings are locked', async () => {
  // The budget counts the answer and comment as JSON strings in UTF-8.
  const text = 'x'.repeat(MAX_RESPONSE_PLAINTEXT_BYTES / 2 - 2);
  const field = async (value, kind) => ({
    value: '*', encrypted: true, encryptionAudience: 'self_admin', audienceMode: 'explicit',
    hash: `0x${'1'.repeat(64)}`, encryptedPortion: await lockedField(value, kind),
  });
  const locked = clientAnswer({
    answer: await field(text, 'freeform'),
    additional: await field(text, 'additional'),
    importance: null,
    conviction: null,
    importanceEncrypted: await lockedField(10, 'rating'),
    convictionEncrypted: await lockedField(10, 'rating'),
  });
  assert.equal(2 * encode(JSON.stringify(text)).length, MAX_RESPONSE_PLAINTEXT_BYTES);
  assert.equal(check('responses', locked).ok, true, `${encode(locked).length} bytes`);
  assert.equal(check('responses', { responses: [clientAnswer(), locked] }).ok, true);
  assert.equal(check('responses', clientAnswer({ answer: { value: text }, additional: { value: text } })).ok, true);
});

test('keeps encrypted answers opaque but requires readable questions and surveys', () => {
  assert.deepEqual(check('responses', 'ciphertext', { payloadEncrypted: true }), { ok: true });
  assert.equal(check('questions', 'ciphertext', { payloadEncrypted: true }).status, 400);
  assert.equal(check('surveys', 'ciphertext', { payloadEncrypted: true }).status, 400);
  assert.equal(check('responses', 'x'.repeat(STORAGE_RESOURCE_MAX_BYTES.responses + 1), { payloadEncrypted: true }).status, 413);
});

test('leaves documents, media, and images to the deployment-wide limit', () => {
  for (const resource of ['docsContext', 'media', 'images', 'generatedArtifacts']) {
    assert.deepEqual(check(resource, 'x'.repeat(STORAGE_RESOURCE_MAX_BYTES.responses + 1)), { ok: true });
  }
});

for (const option of [null, 7, false, { label: 'North' }, { toString: 'not callable' }, ['North']]) {
  test(`question options reject non-string ${JSON.stringify(option)}`, () => {
    const result = check('questions', { ...clientQuestion, options: ['North', option] });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /options.*strings/);
  });
}
