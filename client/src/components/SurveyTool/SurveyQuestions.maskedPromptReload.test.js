// Runs the masked-prompt Decrypt handler through the composed runtimes.
// A helper missing from that composition throws before any work starts.
import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';

it('reloads a masked prompt through the composed runtimes and clears its busy state', async () => {
  let engine = null;
  renderSurveyQuestions({
    account: '0x1111111111111111111111111111111111111111',
    loginComplete: true,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: '[encrypted]' }],
    runtimeStrategy: {
      render: (runtimeEngine) => {
        engine = runtimeEngine;
        return null;
      },
    },
  });
  await waitFor(() => expect(engine).not.toBeNull());

  let reloaded;
  await act(async () => {
    reloaded = await engine.handleReloadMaskedPrompt('Q1');
  });

  expect(typeof reloaded).toBe('boolean');
  const promptKeys = Object.keys(engine.state.decryptingByKey || {}).filter((key) => key.includes('q1'));
  expect(promptKeys.length).toBeGreaterThan(0);
  promptKeys.forEach((key) => expect(engine.state.decryptingByKey[key]).toBe(false));
});
