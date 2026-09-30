import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
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

const account = '0x0000000000000000000000000000000000000001';

beforeEach(() => {
  jest.clearAllMocks();
  let round = 0;
  jest.mocked(startSessionRealtimeInterview).mockImplementation(async (options) => {
    round += 1;
    const text = `Responder: Round ${round}.`;
    options.onRecordingState?.('recording');
    options.onTranscript?.(text, []);
    return {
      mediaStream: {} as MediaStream,
      stop: jest.fn(async () => ({ transcript: text, turns: [] })),
      pause: jest.fn(),
      resume: jest.fn(),
      getTranscript: () => text,
    };
  });
});

const runRound = async () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
};

const renderTwoRounds = async () => {
  jest
    .mocked(mapInterviewEvidenceToResponses)
    .mockResolvedValueOnce([{ questionId: 'q1', answer: 'First answer', confidence: 0.6 }])
    .mockResolvedValueOnce([{ questionId: 'q1', answer: 'Refined answer', confidence: 0.9 }]);
  const onRecordProvenance = jest.fn();
  render(
    <SessionVoiceModeModal
      isOpen
      mode="interview"
      onSelectMode={jest.fn()}
      onClose={jest.fn()}
      toggleLoginModal={jest.fn()}
      sessionSlug="demo"
      account={account}
      loginComplete
      workerUrl="https://worker.example"
      questionPool={[{ id: 'q1', prompt: 'What matters?', type: 'freeform' }]}
      // The responder already saved an answer and a comment for q1.
      existingResponseSlice={{
        answers: { q1: { value: 'Saved answer' } },
        additionalComments: { q1: { value: 'Saved note' } },
        importance: {},
        conviction: {},
      }}
      prefillPacket={null}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={onRecordProvenance}
      onSubmitResponses={jest.fn().mockResolvedValue({ status: 'submitted' })}
    />,
  );
  await runRound();
  await screen.findByRole('button', { name: /Draft answer for What matters\?/ });
  // Round 1: the AI proposed no comment, review shows the saved note, and the draft is untouched.
  expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
  await runRound();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Draft answer for What matters\?/ })).toHaveTextContent('Refined answer'),
  );
  return { onRecordProvenance };
};

it('continuing an interview keeps an untouched draft marked as AI-proposed', async () => {
  await renderTwoRounds();
  // Round 2: the responder still has not edited anything.
  expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
});

it('continuing an interview does not record the seeded saved comment as a human edit', async () => {
  const { onRecordProvenance } = await renderTwoRounds();
  fireEvent.click(screen.getByRole('button', { name: 'Replace with draft' }));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onRecordProvenance).toHaveBeenCalled());
  const review = onRecordProvenance.mock.calls[0][6];
  expect(review[0].additionalComments).toBe('Saved note');
  // Research metadata (userEditedFields) must not claim the responder edited the comment.
  expect(review[0].userEditedFields || []).toEqual([]);
});
