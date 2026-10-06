import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { mergeDecryptedViewedResponse } from './surveyToolResponseMerge';

const ADMIN = '0x2222222222222222222222222222222222222222';
const OTHER = '0x4444444444444444444444444444444444444444';
const RESPONDER = '0x1111111111111111111111111111111111111111';
const envelope = JSON.stringify({ v: 1, aad: { context: `0x${'aa'.repeat(32)}` }, recipients: [] });
const response = (value) => ({
  questionID: 'q1',
  answer: { value, encrypted: true, encryptedPortion: envelope, encryptionAudience: 'self_admin' },
  additional: { value: '' },
});

it.each([
  ['sign-out', { account: '', loginComplete: false }, null],
  ['switch to non-admin', { account: OTHER }, null],
  ['unrelated prop change by the same admin (control)', { sessionSlug: 'example', questionsCacheNonce: 2 }, 'kept'],
])('single-question mode, %s', async (_label, next, expectation) => {
  let engine = null;
  const harness = renderSurveyQuestions({
    account: ADMIN,
    loginComplete: true,
    singleQuestionMode: true,
    questionID: 'q1',
    responderAddress: RESPONDER,
    sessionSlug: 'example',
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?._isMounted).toBe(true));
  await new Promise((r) => setTimeout(r, 50));
  await act(async () => {
    engine.setState({
      parsedViewAddressAnswers: response('admin-only plaintext'),
      viewAddressAnswers: JSON.stringify(response('admin-only plaintext')),
    });
  });
  await act(async () => {
    harness.rerenderSurveyQuestions(next);
  });
  await new Promise((r) => setTimeout(r, 50));
  const viewed = engine.state.parsedViewAddressAnswers;

  if (expectation === 'kept') expect(viewed?.answer?.value).toBe('admin-only plaintext');
  else {
    expect(viewed).toBeNull();
    expect(engine.state.viewAddressAnswers).toBe('');
  }
  // The next fetch merges the masked payload onto that state: nothing to restore.
  expect(mergeDecryptedViewedResponse(viewed, response('*')).answer.value).toBe(
    expectation === 'kept' ? 'admin-only plaintext' : '*',
  );
});
