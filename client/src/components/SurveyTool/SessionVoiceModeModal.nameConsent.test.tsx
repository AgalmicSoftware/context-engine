import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { useSessionNames } from '../../utilities/session/useSessionNames';

// These sessions have no place for names, so an answer may carry one.
jest.mock('../../utilities/session/useSessionNames', () => ({
  useSessionNames: jest.fn(() => ({ source: null, names: {}, answerNamesShown: true, signIn: null })),
}));
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

it('offers no answer name and sends none, even when the imported context names someone', async () => {
  const onRecordProvenance = jest.fn();
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
      onSubmitResponses={jest.fn(async () => ({ status: 'submitted' as const }))}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByText('AI submission info'));
  expect(screen.queryByText(/as the responder name/)).toBeNull();
  // This session has no place for names, so no username box either.
  expect(screen.queryByLabelText('Username (optional)')).toBeNull();

  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(onRecordProvenance.mock.calls[0][5]).toBe('');
  expect(onRecordProvenance.mock.calls[0][7]).toEqual({ includeResponderName: false });
});

it('puts a username box under the drafts where the session keeps names, apart from the answers', async () => {
  const setOwn = jest.fn(async (name: string) => name);
  const names = {
    status: 'empty' as const,
    source: {
      enabled: true,
      readAll: jest.fn(async () => ({})),
      readAllOrFail: jest.fn(async () => ({})),
      hasSignIn: jest.fn(async () => true),
      signIn: jest.fn(async () => {}),
      setOwn,
    },
    names: {},
    answerNamesShown: false,
    signIn: null,
  };
  jest.mocked(useSessionNames).mockReturnValue(names);
  const onRecordProvenance = jest.fn();
  try {
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
          responderContext: { name: 'Robin' },
          responses: [{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }],
        }}
        onApplyAnswer={jest.fn()}
        onApplyAdditional={jest.fn()}
        onApplyImportance={jest.fn()}
        onApplyConviction={jest.fn()}
        onRecordProvenance={onRecordProvenance}
        onSubmitResponses={jest.fn(async () => ({ status: 'submitted' as const }))}
      />,
    );
    const review = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    const box = screen.getByLabelText('Username (optional)');
    expect(box).toHaveValue('Robin');
    expect(review.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save username' }));
    await waitFor(() => expect(setOwn).toHaveBeenCalledWith('Robin'));

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onRecordProvenance).toHaveBeenCalledTimes(1));
    expect(onRecordProvenance.mock.calls[0][5]).toBe('');
  } finally {
    jest
      .mocked(useSessionNames)
      .mockReturnValue({ status: 'unavailable', source: null, names: {}, answerNamesShown: true, signIn: null });
  }
});

it('uses saved per-question choices and withdraws a saved answer name', async () => {
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
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  // A name an earlier answer carried is withdrawn; nothing else is forced.
  expect(record.mock.calls[0][5]).toBe('');
  expect(record.mock.calls[0][7]).toEqual({ includeResponderName: false });
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

// Sharing starts on unless the session turns it off; a value that isn't true or false leaves it on.
it.each([
  [undefined, true],
  [false, false],
  [true, true],
  ['true', true],
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
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({ includeResponderName: false });
});

it('shows research sharing ticked on the submission bar, beside the closed submission info', async () => {
  const props = researchReviewProps();
  render(<SessionVoiceModeModal {...props} />);
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const panel = screen.getByText('AI submission info').closest('details')!;
  const share = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(share).toBeChecked();
  expect(panel).toHaveProperty('open', false);
  expect(panel).not.toContainElement(share);
  expect(screen.getByRole('group', { name: 'Response submission' })).toContainElement(share);
  expect(screen.getByRole('button', { name: 'What’s this? About sharing for research' })).toHaveAccessibleDescription(
    /predicted answers/,
  );
  // Choosing doesn't open the panel.
  fireEvent.click(share);
  expect(share).not.toBeChecked();
  expect(panel).toHaveProperty('open', false);
});

it('uses late-loaded defaults without overwriting an explicit participant choice', async () => {
  const props = researchReviewProps();
  const { rerender } = render(
    <SessionVoiceModeModal {...props} sessionConfig={{ interviewMode: { shareDraftChangesByDefault: false } }} />,
  );
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
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({
    includePredictionComparison: false,
    includeResponderName: false,
  });
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
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({ includeResponderName: false });
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

it('keeps a declined AI draft text choice through login', async () => {
  const props = researchReviewProps();
  const sessionConfig = { interviewMode: { shareDraftChangesByDefault: true, keepDraftTextForAdmins: true } };
  const { rerender } = render(
    <SessionVoiceModeModal {...props} account="" loginComplete={false} sessionConfig={sessionConfig} />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const draftText = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_DRAFT_TEXT);
  expect(draftText).toBeChecked();
  fireEvent.click(draftText);
  rerender(<SessionVoiceModeModal {...props} sessionConfig={sessionConfig} />);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_DRAFT_TEXT)).not.toBeChecked();
  // The decline reaches what is saved, not only the checkbox.
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({ includeDraftText: false, includeResponderName: false });
});

it('keeps no AI draft text when the setting turns on after the person read that none is kept', async () => {
  const props = researchReviewProps();
  const off = { interviewMode: { shareDraftChangesByDefault: true } };
  const { rerender } = render(<SessionVoiceModeModal {...props} sessionConfig={off} />);
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const on = { interviewMode: { shareDraftChangesByDefault: true, keepDraftTextForAdmins: true } };
  rerender(<SessionVoiceModeModal {...props} sessionConfig={on} />);
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_DRAFT_TEXT)).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalledTimes(1));
  expect(props.onRecordProvenance.mock.calls[0][7]).toEqual({ includeDraftText: false, includeResponderName: false });
});

it('keeps provenance inside AI submission info, before its metadata, and sharing on its bar', async () => {
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
        source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
        responderContext: { name: 'Fixture Responder' },
        responses: [{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }],
      }}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={jest.fn()}
      onSubmitResponses={jest.fn()}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const submissionInfo = screen.getByText('AI submission info').closest('details')!;
  const provenance = screen.getByLabelText('Include platform/model provenance');
  expect(submissionInfo).toContainElement(provenance);
  expect(submissionInfo).not.toContainElement(
    screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON),
  );
  const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
  expect(submissionInfo).toContainElement(metadata);
  expect(provenance.compareDocumentPosition(metadata) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
