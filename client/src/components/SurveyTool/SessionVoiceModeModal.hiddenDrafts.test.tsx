import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { HIDDEN_DRAFT_NOTE, pickHiddenInterviewDrafts } from './sessionInterviewHiddenDrafts';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';

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

const statements = ['b1', 'b2', 'b3', 'b4'];
const eligible = [...statements, 'r1'];
const questionPool = [
  ...statements.map((id) => ({ id, prompt: `Statement ${id}?`, type: 'binary' })),
  { id: 'r1', prompt: 'How much?', type: 'rating', scale: { min: 0, max: 10 } },
  { id: 'f1', prompt: 'Why?', type: 'freeform' },
];
const prefillPacket = {
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: {},
  responses: [
    ...statements.map((questionId) => ({
      questionId,
      answer: 'Agree',
      additionalComments: 'AI note',
      evidence: `EVIDENCE-${questionId}`,
      confidence: 0.8,
    })),
    { questionId: 'r1', answer: 7, evidence: 'EVIDENCE-r1', confidence: 0.6 },
    { questionId: 'f1', answer: 'Because.', confidence: 0.5 },
  ],
};
// Half of five eligible drafts: three hidden. Pick an account whose hidden set includes
// the rating and at least one statement, so both reveal rules are exercised.
const share = 0.5;
const account = Array.from({ length: 50 }, (_, index) => `0x${String(index + 1).padStart(40, '0')}`).find(
  (candidate) => {
    const hidden = pickHiddenInterviewDrafts(eligible, share, `demo|${candidate}`);
    return hidden.includes('r1') && hidden.some((id) => statements.includes(id));
  },
)!;
const hiddenIds = pickHiddenInterviewDrafts(eligible, share, `demo|${account}`);
const hiddenStatement = hiddenIds.find((id) => statements.includes(id))!;
const shownStatement = statements.find((id) => !hiddenIds.includes(id))!;

const renderReview = (
  interviewMode: Record<string, unknown> = { hiddenDraftShare: share, shareDraftChangesByDefault: true },
  savedResponses: Record<string, unknown> | null = null,
) => {
  const props = {
    onApplyAnswer: jest.fn(),
    onApplyAdditional: jest.fn(),
    onRecordProvenance: jest.fn(),
    onSubmitResponses: jest.fn().mockResolvedValue({ status: 'submitted' }),
  };
  const modal = (saved: Record<string, unknown> | null) => (
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
      existingResponseSlice={saved}
      prefillPacket={prefillPacket}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      renderAnswerInput={(questionId, value, onChange, question) => (
        <input
          aria-label={`Answer ${questionId}`}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(question?.type === 'rating' ? Number(event.target.value) : event.target.value)}
        />
      )}
      {...props}
    />
  );
  const view = render(modal(savedResponses));
  return { ...props, ...view, rerenderWithSaved: (saved: Record<string, unknown>) => view.rerender(modal(saved)) };
};
const card = (questionId: string) =>
  screen
    .getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)
    .find((element) => element.getAttribute('data-ce-question-id') === questionId)!;
const answer = (questionId: string) => screen.getByLabelText(`Answer ${questionId}`);
const answerWith = (questionId: string, value: string) => fireEvent.change(answer(questionId), { target: { value } });
const submit = () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
const reviewed = (props: ReturnType<typeof renderReview>, questionId: string) =>
  props.onRecordProvenance.mock.calls[0][6].find((entry: { questionId: string }) => entry.questionId === questionId);

it('hides the same share of AI prefill drafts on every load while research sharing is on', async () => {
  const { unmount } = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.getAllByText(HIDDEN_DRAFT_NOTE)).toHaveLength(hiddenIds.length);
  for (const id of hiddenIds) {
    expect(card(id)).toHaveTextContent(HIDDEN_DRAFT_NOTE);
    expect(answer(id)).toHaveValue('');
    // Neither the AI's notes nor its marker give the answer away.
    expect(within(card(id)).queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE)).not.toBeInTheDocument();
    expect(within(card(id)).queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
  }
  expect(answer(shownStatement)).toHaveValue('Agree');
  expect(card('f1')).not.toHaveTextContent(HIDDEN_DRAFT_NOTE);
  unmount();
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  for (const id of hiddenIds) expect(card(id)).toHaveTextContent(HIDDEN_DRAFT_NOTE);
});

it('hides nothing when research sharing is off', async () => {
  renderReview({ hiddenDraftShare: share, shareDraftChangesByDefault: false });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.queryByText(HIDDEN_DRAFT_NOTE)).not.toBeInTheDocument();
  for (const id of statements) expect(answer(id)).toHaveValue('Agree');
});

it('reveals a statement guess after the answer and records the first answer', async () => {
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith(hiddenStatement, 'Disagree');
  expect(card(hiddenStatement)).toHaveTextContent('Your AI guessed: Agree · 80% sure');
  answerWith(hiddenStatement, 'Unsure');
  submit();
  await waitFor(() => expect(props.onSubmitResponses).toHaveBeenCalled());
  expect(props.onApplyAnswer).toHaveBeenCalledWith(hiddenStatement, 'Unsure');
  expect(reviewed(props, hiddenStatement)).toEqual(
    expect.objectContaining({
      answer: 'Unsure',
      selected: true,
      predictionCondition: 'blind',
      blindAnswer: 'Disagree',
      revealedAt: expect.any(Number),
      original: expect.objectContaining({ answer: 'Agree', confidence: 0.8 }),
    }),
  );
  expect(reviewed(props, shownStatement).predictionCondition).toBeUndefined();
});

it('reveals a rating guess once the person moves to another question', async () => {
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith('r1', '4');
  expect(card('r1')).toHaveTextContent(HIDDEN_DRAFT_NOTE);
  answerWith(shownStatement, 'Disagree');
  expect(card('r1')).toHaveTextContent('Your AI guessed: 7 of 10 · 60% sure');
  expect(answer('r1')).toHaveValue('4');
});

it('leaves out hidden drafts the person did not answer', async () => {
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  submit();
  await waitFor(() => expect(props.onSubmitResponses).toHaveBeenCalled());
  for (const id of hiddenIds) {
    expect(props.onApplyAnswer).not.toHaveBeenCalledWith(id, expect.anything());
    expect(reviewed(props, id)).toEqual(expect.objectContaining({ selected: false, answer: undefined }));
  }
  expect(props.onApplyAnswer).toHaveBeenCalledWith(shownStatement, 'Agree');
});

it('shows every hidden draft when research sharing is turned off, and never hides them again', async () => {
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith('r1', '4');
  const sharing = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  fireEvent.click(sharing);
  await waitFor(() => expect(screen.queryByText(HIDDEN_DRAFT_NOTE)).not.toBeInTheDocument());
  expect(card('r1')).toHaveTextContent('Your AI guessed: 7 of 10 · 60% sure');
  for (const id of hiddenIds.filter((id) => id !== 'r1')) expect(answer(id)).toHaveValue('Agree');
  fireEvent.click(sharing);
  expect(screen.queryByText(HIDDEN_DRAFT_NOTE)).not.toBeInTheDocument();
  submit();
  await waitFor(() => expect(props.onSubmitResponses).toHaveBeenCalled());
  // The rating was answered before its guess was shown, so it still counts as blind.
  expect(reviewed(props, 'r1')).toEqual(expect.objectContaining({ predictionCondition: 'blind', blindAnswer: 4 }));
  expect(reviewed(props, hiddenStatement).predictionCondition).toBeUndefined();
});

it('keeps hidden guesses from the voice interviewer and the drafting request', async () => {
  let instructions = '';
  const transcript = 'Responder: Safety matters to me.';
  jest.mocked(startSessionRealtimeInterview).mockImplementation(async (options) => {
    instructions = options.instructions;
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
  jest.mocked(mapInterviewEvidenceToResponses).mockResolvedValue([]);
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  expect(instructions).toContain(`EVIDENCE-${shownStatement}`);
  for (const id of hiddenIds) expect(instructions).not.toContain(`EVIDENCE-${id}`);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await waitFor(() => expect(mapInterviewEvidenceToResponses).toHaveBeenCalled());
  const [request] = jest.mocked(mapInterviewEvidenceToResponses).mock.calls[0];
  const { previousResponses = [] } = request as { previousResponses?: Array<{ prediction: { questionId: string } }> };
  const sent = previousResponses.map((entry) => entry.prediction.questionId);
  expect(sent).toContain(shownStatement);
  for (const id of hiddenIds) expect(sent).not.toContain(id);
});

it('keeps hidden guesses out of group suggestions until they are shown', async () => {
  jest
    .mocked(useSessionInterviewGroupRecommendations)
    .mockReturnValue({ availability: 'available', recommendations: [] });
  renderReview({ hiddenDraftShare: share, shareDraftChangesByDefault: true, suggestGroups: true });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const sent = () =>
    (jest.mocked(useSessionInterviewGroupRecommendations).mock.calls.at(-1)?.[0].request?.draftResponses || []).map(
      (draft) => draft.questionId,
    );
  await waitFor(() => expect(sent()).toContain(shownStatement));
  for (const id of hiddenIds) expect(sent()).not.toContain(id);
  // Answering a statement shows its guess; asking again then includes it, but not the guesses still hidden.
  answerWith(hiddenStatement, 'Disagree');
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh group suggestions' }));
  await waitFor(() => expect(sent()).toContain(hiddenStatement));
  for (const id of hiddenIds.filter((id) => id !== hiddenStatement)) expect(sent()).not.toContain(id);
});

it("never applies the AI's comment to a hidden draft, so a locked comment survives", async () => {
  const props = renderReview(undefined, {
    answers: {},
    additionalComments: { [hiddenStatement]: { value: '*', encrypted: true } },
    importance: {},
    conviction: {},
  });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith(hiddenStatement, 'Disagree');
  submit();
  await waitFor(() => expect(props.onSubmitResponses).toHaveBeenCalled());
  expect(props.onApplyAnswer).toHaveBeenCalledWith(hiddenStatement, 'Disagree');
  expect(props.onApplyAdditional).not.toHaveBeenCalledWith(hiddenStatement, expect.anything());
  expect(props.onApplyAdditional).toHaveBeenCalledWith(shownStatement, 'AI note');
});

it('drops a hidden draft once a saved answer for its question loads', async () => {
  const view = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(card(hiddenStatement)).toHaveTextContent(HIDDEN_DRAFT_NOTE);
  view.rerenderWithSaved({
    answers: { [hiddenStatement]: { value: 'Disagree' } },
    additionalComments: {},
    importance: {},
    conviction: {},
  });
  await waitFor(() => expect(card(hiddenStatement)).toBeUndefined());
  // An answered question gets no suggestion, so its guess is never shown.
  expect(screen.queryByText(/Your AI guessed/)).not.toBeInTheDocument();
  expect(screen.getAllByText(HIDDEN_DRAFT_NOTE)).toHaveLength(hiddenIds.length - 1);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
    'Left out 1 draft for a question you’ve already answered.',
  );
});

it('keeps a hidden draft the person already answered, as an ordinary draft, when a saved answer loads', async () => {
  const view = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  // A rating stays hidden until the person moves on, so this answer is still blind.
  answerWith('r1', '4');
  expect(card('r1')).toHaveTextContent(HIDDEN_DRAFT_NOTE);
  view.rerenderWithSaved({ answers: { r1: { value: 6 } }, additionalComments: {}, importance: {}, conviction: {} });
  await waitFor(() => expect(card('r1')).not.toHaveTextContent(HIDDEN_DRAFT_NOTE));
  expect(answer('r1')).toHaveValue('4');
  expect(screen.getAllByText(HIDDEN_DRAFT_NOTE)).toHaveLength(hiddenIds.length - 1);
  // It stays chosen with the person's own answer, which Submit sends.
  expect(
    within(card('r1')).queryByRole('button', { name: /Replace with draft|Restore draft/ }),
  ).not.toBeInTheDocument();
  submit();
  await waitFor(() => expect(view.onSubmitResponses).toHaveBeenCalled());
  expect(view.onApplyAnswer).toHaveBeenCalledWith('r1', 4);
});
