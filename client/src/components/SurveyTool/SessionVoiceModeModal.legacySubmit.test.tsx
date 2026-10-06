import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { mapInterviewEvidenceToResponses } from './sessionInterview';

jest.mock('./SessionInterviewRecommendedGroups', () => ({ __esModule: true, default: () => null }));
jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));
jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));
jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: () => null,
  SessionListeningWaveform: () => null,
  formatSessionRecordingElapsed: (seconds: number) => `0:${seconds}`,
}));
jest.mock('./sessionInterview', () => {
  const actual = jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview');
  return {
    ...actual,
    hashInterviewQuestions: jest.fn(async () => 'a'.repeat(64)),
    mapInterviewEvidenceToResponses: jest.fn(),
  };
});
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));

const account = '0x0000000000000000000000000000000000000001';
const savedSlice = {
  answers: { q1: { value: 'Already saved' } },
  additionalComments: {},
  importance: {},
  conviction: {},
};

const run = async (onLoadSavedResponses: jest.Mock) => {
  jest
    .mocked(mapInterviewEvidenceToResponses)
    .mockResolvedValue([{ questionId: 'q1', answer: 'New answer', confidence: 0.8, evidence: 'Context' }] as any);
  const onApplyAnswer = jest.fn();
  const onSubmitResponses = jest
    .fn()
    .mockResolvedValueOnce({ status: 'login-required' })
    .mockResolvedValue({ status: 'submitted' });
  const common = {
    isOpen: true,
    mode: 'interview' as const,
    onSelectMode: jest.fn(),
    onClose: jest.fn(),
    toggleLoginModal: jest.fn(),
    sessionSlug: 'demo',
    workerUrl: 'https://worker.example',
    questionPool: [{ id: 'q1', prompt: 'What matters?', type: 'freeform' }],
    prefillPacket: {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'synthetic', verification: 'self_reported' as const },
      responderContext: { summary: 'Context' },
    },
    onApplyAnswer,
    onApplyAdditional: jest.fn(),
    onApplyImportance: jest.fn(),
    onApplyConviction: jest.fn(),
    onRecordProvenance: jest.fn(),
    onSubmitResponses,
    onLoadSavedResponses,
  };
  const view = render(
    <SessionVoiceModeModal {...(common as any)} account="" loginComplete={false} existingResponseSlice={null} />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
  // After login the public cache hydrates the participant's earlier answer.
  view.rerender(
    <SessionVoiceModeModal
      {...(common as any)}
      account={account}
      loginComplete
      isResponsesCacheReady
      responseReadinessContextToken={`demo|${account}|true`}
      existingResponseSlice={savedSlice}
    />,
  );
  await waitFor(() => expect(onLoadSavedResponses).toHaveBeenCalled());
  // Wait for either outcome (overwrite applied, or conflict review shown), then assert.
  await waitFor(
    () =>
      expect(
        onApplyAnswer.mock.calls.length > 0 ||
          /Saved answers loaded/.test(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS).textContent || ''),
      ).toBe(true),
    { timeout: 4000 },
  );
  return { onApplyAnswer, onSubmitResponses };
};

it('PROBE 23: a verified legacy Worker reviews an answer found after login before the queued submit', async () => {
  const { onApplyAnswer } = await run(jest.fn().mockResolvedValue(null)); // 0.6.2 Worker: verified legacy listing
  expect(onApplyAnswer).not.toHaveBeenCalled();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Saved answers loaded');
});

it('control: a current Worker (own-answer load) already reviews the same conflict', async () => {
  const { onApplyAnswer } = await run(jest.fn().mockResolvedValue(savedSlice));
  expect(onApplyAnswer).not.toHaveBeenCalled();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Saved answers loaded');
});
