import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { buildViewedResponseDecryptSuccessState } from './surveyToolDecryptFlow.js';
import { buildSurveyDecryptSuccessState } from './surveyToolDecryptSliceState';

const ADMIN = '0x2222222222222222222222222222222222222222';
const OWNER = '0x3333333333333333333333333333333333333333';
const RESPONDER = '0x1111111111111111111111111111111111111111';
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const envelopeFor = (owner) =>
  JSON.stringify({
    v: 1,
    aad: { context: `0x${'aa'.repeat(32)}` },
    recipients: [
      { type: 'self-eip712-v1' },
      {
        type: 'worker-response-field-v1',
        policy: { audience: 'self_admin', owner, sessionSlug: 'example', sessionId: 'x', context: 'y' },
      },
    ],
  });
const maskedResponse = (owner) => ({
  responses: [
    {
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: envelopeFor(owner), encryptionAudience: 'self_admin' },
      additional: { value: '' },
    },
  ],
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

it('P1 control: a refetch by the same admin keeps the decrypted viewed value', async () => {
  const reads = jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) =>
      String(responder).toLowerCase() === RESPONDER ? maskedResponse(RESPONDER) : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: ADMIN,
    loginComplete: true,
    displayAnswerMode: true,
    viewAddress: RESPONDER,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    questionResponsesNonce: 1,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.parsedViewAddressAnswers?.responses?.[0]?.answer?.value).toBe('*'));
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
  const before = reads.mock.calls.length;
  await act(async () => {
    harness.rerenderSurveyQuestions({ questionResponsesNonce: 2 });
  });
  await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  expect(engine.state.parsedViewAddressAnswers.responses[0].answer.value).toBe('admin-only plaintext');
});

it('P2: an owner who used "Decrypt & edit" and then signs out leaves the plaintext in the anonymous draft', async () => {
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) =>
      String(responder).toLowerCase() === OWNER ? maskedResponse(OWNER) : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  // Same state transition handleDecryptEdit applies after the owner's own key unwrap.
  await act(async () => {
    engine.setState((prev) =>
      buildSurveyDecryptSuccessState(prev, {
        surveyIndex: 0,
        decryptedSlice: { answers: { q1: { value: 'owner-only plaintext', encrypted: true } }, additionalComments: {} },
      }),
    );
  });
  expect(engine.state.surveysResponseState[0].answers.q1.value).toBe('owner-only plaintext');
  await act(async () => {
    harness.rerenderSurveyQuestions({ account: '', loginComplete: false });
  });
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  await new Promise((r) => setTimeout(r, 50));
  const drafts = Object.keys(sessionStorage)
    .filter((k) => k.startsWith('dg:surveyDraft:'))
    .map((k) => [k, sessionStorage.getItem(k)]);

  const anonDrafts = drafts.filter(([k]) => k.includes(':anon:'));
  expect(anonDrafts.some(([, v]) => String(v).includes('owner-only plaintext'))).toBe(false);
  expect(engine.state.surveysResponseState?.[0]?.answers?.q1?.value).not.toBe('owner-only plaintext');
});

const OTHER = '0x4444444444444444444444444444444444444444';

it.each([
  [
    'sign-out, then another account signs in',
    [
      { account: '', loginComplete: false },
      { account: OTHER, loginComplete: true },
    ],
  ],
  ['direct switch to another account', [{ account: OTHER, loginComplete: true }]],
])('P3 (%s): the owner plaintext reaches the next account', async (_label, steps) => {
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) =>
      String(responder).toLowerCase() === OWNER ? maskedResponse(OWNER) : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  await act(async () => {
    engine.setState((prev) =>
      buildSurveyDecryptSuccessState(prev, {
        surveyIndex: 0,
        decryptedSlice: { answers: { q1: { value: 'owner-only plaintext', encrypted: true } }, additionalComments: {} },
      }),
    );
  });
  for (const step of steps) {
    await act(async () => {
      harness.rerenderSurveyQuestions(step);
    });
    await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
    await new Promise((r) => setTimeout(r, 50));
  }
  const otherDrafts = Object.keys(sessionStorage)
    .filter((k) => k.includes(`:${OTHER}:`))
    .map((k) => sessionStorage.getItem(k));

  expect(engine.state.surveysResponseState?.[0]?.answers?.q1?.value).not.toBe('owner-only plaintext');
  expect(otherDrafts.some((v) => String(v).includes('owner-only plaintext'))).toBe(false);
});

it.each([
  ['signed out', { account: '', loginComplete: false }],
  ['another account', { account: OTHER, loginComplete: true }],
])(
  'P4 (%s): a fresh mount in the same tab prefills the owner plaintext from the persisted draft',
  async (_label, next) => {
    jest
      .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
      .mockImplementation(async (_p, responder) =>
        String(responder).toLowerCase() === OWNER ? maskedResponse(OWNER) : null,
      );
    let engine = null;
    const base = {
      surveyId: SURVEY_ID,
      isQuestionCacheReady: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: { render: (e) => ((engine = e), null) },
    };
    const first = renderSurveyQuestions({ ...base, account: OWNER, loginComplete: true });
    await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
    await act(async () => {
      engine.setState((prev) =>
        buildSurveyDecryptSuccessState(prev, {
          surveyIndex: 0,
          decryptedSlice: {
            answers: { q1: { value: 'owner-only plaintext', encrypted: true } },
            additionalComments: {},
          },
        }),
      );
    });
    await act(async () => {
      first.rerenderSurveyQuestions(next);
    });
    await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
    await new Promise((r) => setTimeout(r, 50));
    first.unmount();
    engine = null;
    renderSurveyQuestions({ ...base, ...next });
    await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]).toBeTruthy());
    await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
    await new Promise((r) => setTimeout(r, 50));

    expect(engine.state.surveysResponseState?.[0]?.answers?.q1?.value).not.toBe('owner-only plaintext');
  },
);

it.each([
  ['signed out', [{ account: '', loginComplete: false }]],
  ['another account', [{ account: OTHER, loginComplete: true }]],
  [
    'signed out, then another account',
    [
      { account: '', loginComplete: false },
      { account: OTHER, loginComplete: true },
    ],
  ],
])('P5 (%s): an EDITED decrypted answer is prefilled for the next identity', async (_label, steps) => {
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) =>
      String(responder).toLowerCase() === OWNER ? maskedResponse(OWNER) : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  await act(async () => {
    engine.setState((prev) =>
      buildSurveyDecryptSuccessState(prev, {
        surveyIndex: 0,
        decryptedSlice: { answers: { q1: { value: 'owner-only plaintext', encrypted: true } }, additionalComments: {} },
      }),
    );
  });
  await act(async () => {
    engine.handleAnswer(0, 'q1', 'owner-only plaintext, edited');
  });
  await new Promise((r) => setTimeout(r, 300));

  for (const step of steps) {
    await act(async () => {
      harness.rerenderSurveyQuestions(step);
    });
    await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
    await new Promise((r) => setTimeout(r, 100));
  }
  const q1 = engine.state.surveysResponseState?.[0]?.answers?.q1;

  expect(String(q1?.value || '')).not.toContain('owner-only plaintext');
});

it.each([
  ['JSON panel hidden', false],
  ['JSON panel open', true],
])('P6 (%s): jsonPreview after the owner decrypts, then signs out', async (_label, showJson) => {
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) =>
      String(responder).toLowerCase() === OWNER ? maskedResponse(OWNER) : null,
    );
  let engine = null;
  const harness = renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  if (showJson) {
    await act(async () => {
      engine.setState({ showJson: true });
    });
  }
  await act(async () => {
    engine.setState(
      (prev) =>
        buildSurveyDecryptSuccessState(prev, {
          surveyIndex: 0,
          decryptedSlice: {
            answers: { q1: { value: 'owner-only plaintext', encrypted: true } },
            additionalComments: {},
          },
        }),
      () => engine.setState({ jsonPreview: engine.prepareJsonAndHash(0) }),
    );
  });
  expect(JSON.stringify(engine.state.jsonPreview)).toContain('owner-only plaintext');
  await act(async () => {
    harness.rerenderSurveyQuestions({ account: '', loginComplete: false });
  });
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  await new Promise((r) => setTimeout(r, 100));

  expect(JSON.stringify(engine.state.jsonPreview)).not.toContain('owner-only plaintext');
});
