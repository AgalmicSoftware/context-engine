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

it('uses saved per-question choices and forwards only explicit consent changes', async () => {
  const record = jest.fn();
  render(
    <SessionVoiceModeModal
      isOpen
      mode="interview"
      onSelectMode={jest.fn()}
      onClose={jest.fn()}
      sessionSlug="demo"
      account="0x0000000000000000000000000000000000000001"
      loginComplete
      workerUrl="https://worker.example"
      questionPool={[
        { id: 'q1', prompt: 'First?', type: 'binary' },
        { id: 'q2', prompt: 'Second?', type: 'binary' },
      ]}
      existingResponseSlice={{
        interviewProvenance: {
          q1: {
            includeAiProvenance: true,
            source: { platform: 'claude', modelId: 'saved-model' },
            responderName: 'Participant A',
          },
          q2: { includeAiProvenance: false },
        },
      }}
      prefillPacket={{
        version: 1,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v4',
        source: { platform: 'claude', modelId: 'new-model', verification: 'self_reported' },
        responderContext: {},
        responses: [
          { questionId: 'q1', answer: 'Agree', confidence: 0.8 },
          { questionId: 'q2', answer: 'Agree', confidence: 0.8 },
        ],
      }}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={record}
      onSubmitResponses={jest.fn(async () => ({ status: 'submitted' as const }))}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByText('AI submission info'));
  expect(screen.getByLabelText(/Include platform\/model provenance/i)).toHaveAttribute('aria-checked', 'mixed');
  const name = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
  expect(name).toHaveAttribute('aria-checked', 'mixed');
  fireEvent.click(name);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(record.mock.calls[0][7]).toEqual({ includeResponderName: true });
});

const researchReviewProps = () => ({
  isOpen: true,
  mode: 'interview' as const,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  sessionSlug: 'demo',
  account: '0x0000000000000000000000000000000000000001',
  loginComplete: true,
  workerUrl: 'https://worker.example',
  questionPool: [{ id: 'q1', prompt: 'Proceed?', type: 'binary' }],
  prefillPacket: {
    version: 1 as const,
    sessionSlug: 'demo',
    questionSetHash: 'a'.repeat(64),
    promptVersion: 'ce-interview-brief-v4',
    source: { platform: 'claude' as const, modelId: 'fixture-model', verification: 'self_reported' as const },
    responderContext: {},
    responses: [{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }],
  },
  onApplyAnswer: jest.fn(),
  onApplyAdditional: jest.fn(),
  onApplyImportance: jest.fn(),
  onApplyConviction: jest.fn(),
  onRecordProvenance: jest.fn(),
  onSubmitResponses: jest.fn(async () => ({ status: 'submitted' as const })),
});

it.each([
  [undefined, false],
  [false, false],
  [true, true],
  ['true', false],
])('uses the session research-sharing default %s for new responses', async (setting, expected) => {
  const props = researchReviewProps();
  render(
    <SessionVoiceModeModal {...props} sessionConfig={{ interviewMode: { shareDraftChangesByDefault: setting } }} />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const comparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(comparison).toHaveProperty('checked', expected);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(props.onRecordProvenance.mock.calls[0][4]).toBe(expected);
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({});
});

it('uses late-loaded defaults without overwriting an explicit participant choice', async () => {
  const props = researchReviewProps();
  const { rerender } = render(<SessionVoiceModeModal {...props} />);
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const comparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(comparison).not.toBeChecked();
  rerender(
    <SessionVoiceModeModal {...props} sessionConfig={{ interviewMode: { shareDraftChangesByDefault: true } }} />,
  );
  expect(comparison).toBeChecked();
  fireEvent.click(comparison);
  expect(comparison).not.toBeChecked();
  rerender(
    <SessionVoiceModeModal
      {...props}
      sessionConfig={{ interviewMode: { shareDraftChangesByDefault: true }, sessionName: 'Updated' }}
    />,
  );
  expect(comparison).not.toBeChecked();
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(props.onRecordProvenance.mock.calls[0][4]).toBe(false);
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({ includePredictionComparison: false });
});

it.each([true, false])('preserves saved research consent %s over the opposite session default', async (saved) => {
  const props = researchReviewProps();
  render(
    <SessionVoiceModeModal
      {...props}
      sessionConfig={{ interviewMode: { shareDraftChangesByDefault: !saved } }}
      existingResponseSlice={{ interviewProvenance: { q1: { includePredictionComparison: saved } } }}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toHaveProperty(
    'checked',
    saved,
  );
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({});
});

it('retains an explicit decline through login and uses the next session’s own default', async () => {
  const props = researchReviewProps();
  const sessionConfig = { interviewMode: { shareDraftChangesByDefault: true } };
  const { rerender } = render(
    <SessionVoiceModeModal {...props} account="" loginComplete={false} sessionConfig={sessionConfig} />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const comparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(comparison).toBeChecked();
  fireEvent.click(comparison);
  rerender(<SessionVoiceModeModal {...props} sessionConfig={sessionConfig} />);
  expect(comparison).not.toBeChecked();
  rerender(<SessionVoiceModeModal {...props} sessionSlug="next-session" sessionConfig={sessionConfig} />);
  expect(comparison).toBeChecked();
});
