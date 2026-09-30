import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

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

it('the responder-name consent is locked while a submission that already carries it is in flight', async () => {
  const onRecordProvenance = jest.fn();
  // The pile upload is waiting on a wallet signature.
  const onSubmitResponses = jest.fn(() => new Promise<never>(() => {}));
  render(
    <SessionVoiceModeModal
      isOpen
      mode="interview"
      onSelectMode={jest.fn()}
      onClose={jest.fn()}
      toggleLoginModal={jest.fn()}
      sessionSlug="demo"
      account="0x0000000000000000000000000000000000000001"
      loginComplete
      workerUrl="https://worker.example"
      questionPool={[{ id: 'q1', prompt: 'Proceed?', type: 'binary' }]}
      prefillPacket={{
        version: 1,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v4',
        source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
        responderContext: { name: 'Fixture Responder' },
        responses: [{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }],
      }}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={onRecordProvenance}
      onSubmitResponses={onSubmitResponses}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByText('AI submission info'));
  const nameConsent = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
  fireEvent.click(nameConsent);
  expect(nameConsent).toBeChecked();

  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
  // The in-flight submission already recorded the name.
  expect(onRecordProvenance.mock.calls[0][5]).toBe('Fixture Responder');
  // The research consent checkboxes are locked for the same reason...
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeDisabled();
  // ...but the name consent can still be unticked, showing a choice the upload will not honour.
  expect(nameConsent).toBeDisabled();
});
