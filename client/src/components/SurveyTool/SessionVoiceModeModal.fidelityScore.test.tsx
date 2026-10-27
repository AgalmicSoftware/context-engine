import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { pickHiddenInterviewDrafts } from './sessionInterviewHiddenDrafts';
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
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));
jest.mock('./sessionInterview', () => ({
  ...jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview'),
  mapInterviewEvidenceToResponses: jest.fn(),
}));

const account = '0x0000000000000000000000000000000000000001';
const questionPool = [
  { id: 'b1', prompt: 'Statement one?', type: 'binary' },
  { id: 'b2', prompt: 'Statement two?', type: 'binary' },
  { id: 'r1', prompt: 'How much?', type: 'rating', scale: { min: 0, max: 10 } },
];
const prefillPacket = {
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: {},
  responses: [
    { questionId: 'b1', answer: 'Agree', confidence: 0.9 },
    { questionId: 'b2', answer: 'Agree', confidence: 0.6 },
    { questionId: 'r1', answer: 7, confidence: 0.5 },
  ],
};

const renderModal = ({
  interviewMode = { showFidelityScore: true },
  packet = prefillPacket as typeof prefillPacket | null,
}: { interviewMode?: Record<string, unknown>; packet?: typeof prefillPacket | null } = {}) => {
  const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'submitted' });
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
      sessionConfig={{ interviewMode }}
      questionPool={questionPool}
      existingResponseSlice={null}
      prefillPacket={packet}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={jest.fn()}
      onSubmitResponses={onSubmitResponses}
      onViewResults={jest.fn()}
      renderAnswerInput={(questionId, value, onChange, question) => (
        <input
          aria-label={`Answer ${questionId}`}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(question?.type === 'rating' ? Number(event.target.value) : event.target.value)}
        />
      )}
    />,
  );
  return { onSubmitResponses };
};
const answerWith = (questionId: string, value: string) =>
  fireEvent.change(screen.getByLabelText(`Answer ${questionId}`), { target: { value } });
const submit = () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

it('shows the person how well their AI predicted them after submitting, in place of the drafts', async () => {
  const { onSubmitResponses } = renderModal();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith('b2', 'Disagree');
  submit();
  const score = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE);
  expect(onSubmitResponses).toHaveBeenCalled();
  expect(score).toHaveTextContent('1 of 2 answers matched');
  // One match, one miss and an exact rating: two of three.
  expect(score).toHaveTextContent('67% Mirror Score');
  expect(score).toHaveTextContent('partial credit for close ratings and allocations');
  expect(score).toHaveTextContent('Statement two? Your AI guessed: Agree · 60% sure You: Disagree');
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  // The footer button stays where it was: same test id, after the score.
  const button = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY);
  expect(score.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows nothing when the session leaves the score off', async () => {
  const { onSubmitResponses } = renderModal({ interviewMode: {} });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  submit();
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toHaveTextContent('Responses submitted'),
  );
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE)).not.toBeInTheDocument();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
});

it('shows nothing without the person’s own AI drafts', async () => {
  const transcript = 'Responder: I agree with the first statement.';
  jest.mocked(startSessionRealtimeInterview).mockImplementation(async (options) => {
    options.onRecordingState?.('recording');
    options.onTranscript?.(transcript, []);
    return {
      mediaStream: {} as MediaStream,
      stop: jest.fn(async () => ({ transcript, turns: [] })),
      pause: jest.fn(),
      resume: jest.fn(),
      getTranscript: () => transcript,
    };
  });
  jest
    .mocked(mapInterviewEvidenceToResponses)
    .mockResolvedValue([{ questionId: 'b1', answer: 'Agree', confidence: 0.9 }]);
  const { onSubmitResponses } = renderModal({ packet: null });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  submit();
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toHaveTextContent('Responses submitted'),
  );
  // Voice drafts restate what the person just said, so they aren't scored.
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE)).not.toBeInTheDocument();
});

it('counts every hidden draft, scored on the answer given before the reveal', async () => {
  const hidden = pickHiddenInterviewDrafts(['b1', 'b2', 'r1'], 0.5, `demo|${account}`);
  const statement = hidden.find((id) => id !== 'r1')!;
  renderModal({ interviewMode: { showFidelityScore: true, hiddenDraftShare: 0.5, shareDraftChangesByDefault: true } });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  // Sharing that starts on opens the submission info before submitting.
  const submissionInfo = screen.getByText('AI submission info').closest('details')!;
  expect(submissionInfo).toHaveAttribute('open');
  // Blind, the person disagrees, then switches to the AI's guess once it is shown.
  answerWith(statement, 'Disagree');
  answerWith(statement, 'Agree');
  for (const id of hidden.filter((id) => id !== statement)) answerWith(id, id === 'r1' ? '7' : 'Agree');
  submit();
  const score = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE);
  // Ratings count too, and the switched statement is a miss.
  expect(score).toHaveTextContent(`${hidden.length - 1} of ${hidden.length} hidden guesses matched`);
  // Then folds away, so the score has the room.
  expect(submissionInfo).not.toHaveAttribute('open');
});

it('keeps the modal height and footer while the score shows, and moves focus to it', async () => {
  const clientHeight = jest.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: Element,
  ) {
    return this.classList.contains('modal-body') ? 600 : 0;
  });
  try {
    renderModal();
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    submit();
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE);
    // The shorter score keeps the body's height and the modal's footer, so the button doesn't move.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PANEL)).toHaveStyle({ minHeight: '600px' });
    expect(screen.getByRole('button', { name: 'Discard interview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How well your AI knew you' })).toHaveFocus();
  } finally {
    clientHeight.mockRestore();
  }
});
