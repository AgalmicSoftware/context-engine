import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { buildViewedResponseDecryptSuccessState } from './surveyToolDecryptFlow.js';

const ADMIN = '0x2222222222222222222222222222222222222222';
const OTHER = '0x4444444444444444444444444444444444444444';
const RESPONDER = '0x1111111111111111111111111111111111111111';
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const workerEnvelope = JSON.stringify({
  v: 1,
  aad: { context: `0x${'aa'.repeat(32)}` },
  recipients: [
    { type: 'self-eip712-v1' },
    {
      type: 'worker-response-field-v1',
      policy: { audience: 'self_admin', owner: RESPONDER, sessionSlug: 'example', sessionId: 'x', context: 'y' },
    },
  ],
});
const maskedResponse = () => ({
  responses: [
    {
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: workerEnvelope, encryptionAudience: 'self_admin' },
      additional: { value: '' },
    },
  ],
});

afterEach(() => {
  jest.restoreAllMocks();
});

const run = async (nextProps) => {
  const reads = jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_provider, responder) =>
      String(responder).toLowerCase() === RESPONDER ? maskedResponse() : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: ADMIN,
    loginComplete: true,
    displayAnswerMode: true,
    viewAddress: RESPONDER,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: {
      render: (runtimeEngine) => {
        engine = runtimeEngine;
        return null;
      },
    },
  });
  await waitFor(() => expect(engine?.state?.parsedViewAddressAnswers?.responses?.[0]?.answer?.value).toBe('*'));
  // Same state transition the viewed-response decrypt handler applies after the Worker released the key to the admin.
  await act(async () => {
    engine.setState((prev) =>
      buildViewedResponseDecryptSuccessState(prev, {
        questionId: 'q1',
        clearMode: 'answer',
        didUpdate: true,
        decryptedStateSlice: { answers: { q1: { value: 'admin-only plaintext' } }, additionalComments: {} },
      }),
    );
  });
  expect(engine.state.parsedViewAddressAnswers.responses[0].answer.value).toBe('admin-only plaintext');
  const callsBefore = reads.mock.calls.length;
  await act(async () => {
    harness.rerenderSurveyQuestions(nextProps);
  });
  // Wait until the post-account-change fetch re-read the responder's response.
  await waitFor(() =>
    expect(reads.mock.calls.slice(callsBefore).some(([, responder]) => responder === RESPONDER)).toBe(true),
  );
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  return engine;
};

it("C1: signing out removes another responder's Worker-decrypted plaintext from the view", async () => {
  const engine = await run({ account: '', loginComplete: false });
  expect(engine.state.parsedViewAddressAnswers.responses[0].answer.value).toBe('*');
});

it('C2: switching to a non-admin account removes the admin-decrypted plaintext from the view', async () => {
  const engine = await run({ account: OTHER });
  expect(engine.state.parsedViewAddressAnswers.responses[0].answer.value).toBe('*');
});
