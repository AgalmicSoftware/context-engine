// After "Decrypt & edit", the owner changes only the public comment
// of a question whose answer is encrypted. What does the real submit path upload?
import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import {
  buildSelfQuestionDecryptSuccessState,
  buildSurveyDecryptSuccessState,
  normalizeBulkDecryptedSliceForSurveyState,
} from './surveyToolDecryptSliceState';

import { validateNoLockedPlaintextInPayload } from '../../utilities/arweave/noLeakPayloads';

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');

const OWNER = '0x3333333333333333333333333333333333333333';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const OLD_ENVELOPE = JSON.stringify({
  v: 1,
  aad: { context: `0x${'aa'.repeat(32)}` },
  recipients: [
    { type: 'self-eip712-v1' },
    {
      type: 'worker-response-field-v1',
      policy: { audience: 'self_admin', owner: OWNER, sessionSlug: 'example', sessionId: 'x', context: 'y' },
    },
  ],
  ciphertext: 'old-ciphertext',
});
const ownMaskedResponse = () => ({
  responses: [
    {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: OLD_ENVELOPE,
        encryptionAudience: 'self_admin',
        audienceMode: 'explicit',
        hash: '0xoldhash',
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
});

// Per-question "Decrypt" button (unchanged by the branch; same code on dev).
const perQuestionTransition = (prev) =>
  buildSelfQuestionDecryptSuccessState(prev, {
    surveyIndex: 0,
    questionId: 'q1',
    clearMode: 'answer',
    didUpdate: true,
    baselineSlice: prev.editBaseline,
    decryptedStateSlice: { answers: { q1: { value: 'SECRET owner answer' } }, additionalComments: {} },
  });

it.each([
  ['branch (merge)', buildSurveyDecryptSuccessState],
  ['per-question decrypt (same code on base)', 'perQuestion'],
])(
  '%s: editing only the public comment after "Decrypt & edit"',
  async (label, transition) => {
    jest
      .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
      .mockImplementation(async (_p, responder) =>
        String(responder).toLowerCase() === OWNER ? ownMaskedResponse() : null,
      );
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
    jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
    const encryptMultipleAnswers = jest.spyOn(cryptoUtils, 'encryptMultipleAnswers');
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
    // What handleDecryptEdit applies after decryptMultipleAnswers returned { value, zkSalt }.
    await act(async () => {
      engine.setState((prev) => {
        const previousStateSlice = prev.surveysResponseState[0];
        const decryptedSlice = normalizeBulkDecryptedSliceForSurveyState(
          { answers: { q1: { value: 'SECRET owner answer', zkSalt: '0x01' } }, additionalComments: {} },
          { previousStateSlice, baselineSlice: prev.editBaseline },
        );
        if (transition === 'perQuestion') return perQuestionTransition(prev);
        return transition(prev, { surveyIndex: 0, decryptedSlice });
      });
    });
    await act(async () => {
      engine.handleAdditional(0, 'q1', 'new public comment');
    });
    await new Promise((r) => setTimeout(r, 50));
    const stats = engine.getPendingEditStats();
    let outcome;
    await act(async () => {
      try {
        outcome = await engine.encryptAndUpload();
      } catch (error) {
        outcome = { threw: String(error?.message || error) };
      }
    });
    const uploaded = submitResponses.mock.calls[0] || [];

    // The spy replaces chainGateway.submitResponses, whose first step before any upload is
    // validateNoLockedPlaintextInPayload on the survey response and on each question response.
    let guard = 'not reached (client verification threw first)';
    if (uploaded.length) {
      try {
        validateNoLockedPlaintextInPayload(uploaded[4], { family: 'survey_response_payload', path: 'survey response' });
        uploaded[2].forEach((r) =>
          validateNoLockedPlaintextInPayload(r, { family: 'question_response_payload', path: 'question response' }),
        );
        guard = 'passed';
      } catch (error) {
        guard = `threw: ${error.message}`;
      }
    }

    // Either the client verification or the chainGateway guard must stop the plaintext.
    expect(outcome).toMatchObject({ status: 'submitted' });
    expect(guard).toBe('passed');
    expect(uploaded[2][0].answer).toMatchObject({ value: '*', encryptedPortion: OLD_ENVELOPE, hash: '0xoldhash' });
    expect(encryptMultipleAnswers).not.toHaveBeenCalled();
  },
  30000,
);
