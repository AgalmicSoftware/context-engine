// Decrypt-edit resubmits keep the ciphertext paired with the displayed answer.
// real handleDecryptEdit / encryptAndUpload; only crypto primitives and the upload are mocked.
// Question: can a resubmit after "Decrypt & edit" upload plaintext, or an envelope that no
// longer matches the value the owner sees?
import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { validateNoLockedPlaintextInPayload } from '../../utilities/arweave/noLeakPayloads';

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');

const OWNER = '0x3333333333333333333333333333333333333333';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const envelope = (tag) =>
  JSON.stringify({
    v: 1,
    aad: { context: `0x${'aa'.repeat(32)}` },
    recipients: [{ type: 'self-eip712-v1' }],
    ciphertext: tag,
  });
const E0 = envelope('ciphertext-of-P0'); // what this tab hydrated (stale cache / older version)
const E1 = envelope('ciphertext-of-P1'); // the latest saved version (e.g. submitted from another device)
const FRESH = envelope('fresh-ciphertext');
const PLAINTEXT = { [E0]: 'P0 older secret', [E1]: 'P1 newer secret' };

const maskedResponse = (env, hash) => ({
  responses: [
    {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: env,
        encryptionAudience: 'self',
        audienceMode: 'explicit',
        hash,
      },
      additional: {
        value: 'old public comment',
        encrypted: false,
        encryptionAudience: 'self',
        audienceMode: 'explicit',
      },
    },
  ],
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const mount = async ({ hydrate, latest }) => {
  let current = hydrate;
  const reads = jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) => (String(responder).toLowerCase() === OWNER ? current : null));
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  jest.spyOn(cryptoUtils, 'decryptMultipleAnswers').mockImplementation(async (slice) => {
    const out = { answers: {}, additionalComments: {}, importance: {} };
    for (const [qid, field] of Object.entries(slice?.answers || {})) {
      if (field?.value === '*' && PLAINTEXT[field.encryptedPortion])
        out.answers[qid] = { value: PLAINTEXT[field.encryptedPortion], zkSalt: '0x01' };
    }
    return out;
  });
  const encryptMultipleAnswers = jest
    .spyOn(cryptoUtils, 'encryptMultipleAnswers')
    .mockImplementation(async (slice) => ({
      answers: Object.fromEntries(
        Object.entries(slice.answers || {}).map(([qid, field]) => [
          qid,
          { ...field, value: '*', encrypted: true, encryptedPortion: FRESH, hash: '0xfresh' },
        ]),
      ),
      additionalComments: {},
      importance: {},
    }));
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
  let engine = null;
  renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    provider: { request: async () => null },
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    toggleLoginModal: () => {},
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    network: { id: 84532 },
    networkChainId: 84532,
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  current = latest; // what "Decrypt & edit" fetches as the latest saved response
  await act(async () => {
    await engine.handleDecryptEdit();
  });
  await new Promise((r) => setTimeout(r, 50));
  return { engine: () => engine, reads, submitResponses, encryptMultipleAnswers };
};

const submit = async (engine) => {
  let outcome;
  await act(async () => {
    try {
      outcome = await engine.encryptAndUpload();
    } catch (error) {
      outcome = { threw: String(error?.message || error) };
    }
  });
  return outcome;
};

const guard = (uploaded) => {
  try {
    if (uploaded[4])
      validateNoLockedPlaintextInPayload(uploaded[4], { family: 'survey_response_payload', path: 'survey response' });
    uploaded[2].forEach((r) =>
      validateNoLockedPlaintextInPayload(r, { family: 'question_response_payload', path: 'question response' }),
    );
    return 'passed';
  } catch (error) {
    return `threw: ${error.message}`;
  }
};

it('T1 control: comment-only resubmit after Decrypt & edit re-sends the saved envelope, no plaintext', async () => {
  const h = await mount({ hydrate: maskedResponse(E1, '0xh1'), latest: maskedResponse(E1, '0xh1') });
  expect(h.engine().state.surveysResponseState[0].answers.q1.value).toBe('P1 newer secret');
  await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
  const outcome = await submit(h.engine());
  const uploaded = h.submitResponses.mock.calls[0] || [];
  expect(outcome).toMatchObject({ status: 'submitted' });
  expect(guard(uploaded)).toBe('passed');
  expect(JSON.stringify(uploaded)).not.toContain('secret');
  expect(uploaded[2][0].answer).toMatchObject({ value: '*', encryptedPortion: E1 });
}, 30000);

it('T2 changed value: the edit is re-encrypted (fresh envelope), never the stale saved envelope', async () => {
  const h = await mount({ hydrate: maskedResponse(E1, '0xh1'), latest: maskedResponse(E1, '0xh1') });
  await act(async () => h.engine().handleAnswer(0, 'q1', 'NEW edited secret'));
  await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
  const outcome = await submit(h.engine());
  const uploaded = h.submitResponses.mock.calls[0] || [];
  expect(outcome).toMatchObject({ status: 'submitted' });
  expect(guard(uploaded)).toBe('passed');
  expect(JSON.stringify(uploaded)).not.toContain('secret');
  expect(h.encryptMultipleAnswers.mock.calls[0][0].answers.q1.value).toBe('NEW edited secret');
  expect(uploaded[2][0].answer).toMatchObject({ value: '*', encryptedPortion: FRESH });
}, 30000);

it('T3 changed then typed back to the decrypted value: no plaintext, envelope still encodes that value', async () => {
  const h = await mount({ hydrate: maskedResponse(E1, '0xh1'), latest: maskedResponse(E1, '0xh1') });
  await act(async () => h.engine().handleAnswer(0, 'q1', 'NEW edited secret'));
  await act(async () => h.engine().handleAnswer(0, 'q1', 'P1 newer secret'));
  await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
  const outcome = await submit(h.engine());
  const uploaded = h.submitResponses.mock.calls[0] || [];
  expect(guard(uploaded)).toBe('passed');
  expect(JSON.stringify(uploaded)).not.toContain('secret');
  expect([E1, FRESH]).toContain(uploaded[2][0].answer.encryptedPortion);
}, 30000);

it('T4 stale tab: Decrypt & edit shows the latest value, but a comment-only resubmit must not upload the older envelope', async () => {
  const h = await mount({ hydrate: maskedResponse(E0, '0xh0'), latest: maskedResponse(E1, '0xh1') });
  const shown = h.engine().state.surveysResponseState[0].answers.q1;
  expect(shown.value).toBe('P1 newer secret');
  await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
  const outcome = await submit(h.engine());
  const uploaded = h.submitResponses.mock.calls[0] || [];
  expect(JSON.stringify(uploaded)).not.toContain('secret');
  // The owner saw and kept "P1 newer secret"; uploading E0 silently reverts the answer to P0.
  expect(uploaded[2]?.[0]?.answer?.encryptedPortion).not.toBe(E0);
}, 30000);
