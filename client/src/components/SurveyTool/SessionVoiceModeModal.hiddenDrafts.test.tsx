import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { HIDDEN_DRAFT_NOTE, pickHiddenInterviewDrafts } from './sessionInterviewHiddenDrafts';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';

jest.mock('./SessionInterviewRecommendedGroups', () => ({
  __esModule: true,
  // The refresh control lives in the Groups section.
  default: ({ onRefresh }: { onRefresh?: () => void }) =>
    onRefresh ? (
      <button type="button" onClick={onRefresh}>
        Refresh group suggestions
      </button>
    ) : null,
}));
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
  // The one question the AI left undrafted.
  { id: 'o1', prompt: 'What else?', type: 'freeform' },
];
const prefillPacket = {
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: {
    facts: [
      ...statements.map((questionId) => ({ fact: `FACT-${questionId}`, relatedQuestionIds: [questionId] })),
      { fact: 'MIXED-FACT', relatedQuestionIds: statements },
      { fact: 'GENERAL-FACT' },
    ],
  },
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

// A review left unsubmitted is kept in this browser and would open in the next test.
beforeEach(() => window.localStorage.clear());

it('hides the same share of AI prefill drafts on every load while research sharing is on', async () => {
  const { unmount } = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.getAllByText(HIDDEN_DRAFT_NOTE)).toHaveLength(hiddenIds.length);
  for (const id of hiddenIds) {
    expect(card(id)).toHaveTextContent(HIDDEN_DRAFT_NOTE);
    expect(answer(id)).toHaveValue('');
    const concealed = within(card(id)).getByRole('group', { name: 'Hidden AI prediction' });
    // One line says it is hidden, once: no heading repeats it.
    expect(concealed).toHaveTextContent(HIDDEN_DRAFT_NOTE);
    expect(within(card(id)).getAllByText(/hidden/i)).toHaveLength(1);
    expect(concealed.querySelector('input, textarea')).toBeNull();
    expect(card(id).innerHTML).not.toContain('AI note');
    expect(card(id).innerHTML).not.toContain(`EVIDENCE-${id}`);
    expect(within(card(id)).getByRole('button', { name: 'Why is the prediction hidden?' })).toBeEnabled();
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

it('says how many drafts are hidden and why, with the session note on where the data goes, until sharing stops', async () => {
  const dataNote = 'Part of a study funded by Example. https://example.test/study';
  renderReview({ hiddenDraftShare: share, shareDraftChangesByDefault: true, dataNote });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const status = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS);
  expect(status).toHaveTextContent(
    `Your AI drafted 6 answers${hiddenIds.length} are hidden until you answer, to test how well your AI predicts you.`,
  );
  expect(within(status).getByRole('link', { name: 'How it works' })).toHaveAttribute(
    'href',
    'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/research-data.md',
  );
  const help = within(status).getByRole('button', { name: 'About hidden drafts' });
  expect(help).toHaveAccessibleDescription(/so you answer before you see its guess.*Part of a study funded by Example/);
  fireEvent.focus(help);
  const tooltip = await screen.findByRole('tooltip');
  expect(within(tooltip).getByRole('link', { name: 'https://example.test/study' })).toHaveAttribute(
    'href',
    'https://example.test/study',
  );
  const sharing = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(screen.getByRole('button', { name: 'What’s this? About sharing for research' })).toHaveAccessibleDescription(
    /Part of a study funded by Example/,
  );
  fireEvent.click(sharing);
  await waitFor(() => expect(status).not.toHaveTextContent('hidden until you answer'));
  expect(status).toHaveTextContent('Your AI drafted 6 answers');
});

it('counts only drafts still hidden, so answering them or unticking sharing clears the line', async () => {
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const status = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS);
  answerWith(hiddenStatement, 'Disagree');
  await waitFor(() => expect(status).toHaveTextContent(`${hiddenIds.length - 1} `));
  expect(status).toHaveTextContent(
    `${hiddenIds.length - 1} ${hiddenIds.length - 1 === 1 ? 'is' : 'are'} hidden until you answer`,
  );
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON));
  await waitFor(() => expect(status).not.toHaveTextContent('hidden until you answer'));
});

it('names no study when the session has no note on where the data goes', async () => {
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const help = within(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).getByRole('button', {
    name: 'About hidden drafts',
  });
  expect(help).toHaveAccessibleDescription(
    'Some of your AI’s drafts start blank, so you answer before you see its guess. This measures how well your AI predicts you. Untick “Share for research” to see every draft and keep no research record.',
  );
  expect(screen.queryByTestId('session-data-note')).not.toBeInTheDocument();
});

it('hides nothing when research sharing is off', async () => {
  renderReview({ hiddenDraftShare: share, shareDraftChangesByDefault: false });
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.queryByText(HIDDEN_DRAFT_NOTE)).not.toBeInTheDocument();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).not.toHaveTextContent(
    'hidden until you answer',
  );
  for (const id of statements) expect(answer(id)).toHaveValue('Agree');
});

it('reveals a statement guess after the answer and records the first answer', async () => {
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith(hiddenStatement, 'Disagree');
  expect(within(card(hiddenStatement)).queryByRole('group', { name: 'Hidden AI prediction' })).not.toBeInTheDocument();
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

it('keeps hidden drafts hidden, and a revealed one with its first answer, through a reload', async () => {
  const first = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  answerWith(hiddenStatement, 'Disagree');
  await waitFor(() =>
    expect(window.localStorage.getItem(`ce:interview-review:v1:demo:account:${account}`)).toContain('"blindAnswer"'),
  );
  first.unmount();
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer(hiddenStatement)).toHaveValue('Disagree');
  expect(card(hiddenStatement)).toHaveTextContent('Your AI guessed: Agree · 80% sure');
  for (const id of hiddenIds.filter((hiddenId) => hiddenId !== hiddenStatement)) {
    expect(card(id)).toHaveTextContent(HIDDEN_DRAFT_NOTE);
    expect(answer(id)).toHaveValue('');
  }
  submit();
  await waitFor(() => expect(props.onSubmitResponses).toHaveBeenCalled());
  expect(reviewed(props, hiddenStatement)).toEqual(
    expect.objectContaining({ predictionCondition: 'blind', blindAnswer: 'Disagree' }),
  );
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

it('leaves every AI-drafted question, hidden ones included, out of the voice round', async () => {
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
  expect(instructions).toContain(`FACT-${shownStatement}`);
  expect(instructions).toContain('MIXED-FACT');
  expect(instructions).toContain('GENERAL-FACT');
  for (const id of hiddenIds) {
    expect(instructions).not.toContain(`EVIDENCE-${id}`);
    expect(instructions).not.toContain(`FACT-${id}`);
  }
  // The interviewer opens from the shown drafts and asks only the undrafted question.
  expect(instructions).toContain('digs into what the AI drafts below say');
  expect(instructions).toContain('[o1]');
  for (const id of [...eligible, 'f1']) expect(instructions).not.toContain(`[${id}]`);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await waitFor(() => expect(mapInterviewEvidenceToResponses).toHaveBeenCalled());
  const [request] = jest.mocked(mapInterviewEvidenceToResponses).mock.calls[0] as unknown as [
    {
      questions: Array<{ id: string }>;
      previousResponses?: Array<{ prediction: { questionId: string } }>;
      prefillPacket?: { responses?: unknown[] };
    },
  ];
  expect(request.questions.map((question) => question.id)).toEqual(['o1']);
  expect(request.previousResponses || []).toEqual([]);
  expect(request.prefillPacket?.responses).toEqual([]);
});

it('drafts only undrafted questions from a voice round, leaving prefill and hidden drafts as they were', async () => {
  const transcript = 'Responder: I disagree with all of it.';
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
  // The reply drafts AI-drafted questions too, which must change none of them.
  jest.mocked(mapInterviewEvidenceToResponses).mockResolvedValue([
    { questionId: 'o1', answer: 'More audits.', evidence: 'Said so', confidence: 0.7 },
    { questionId: hiddenStatement, answer: 'Disagree', evidence: 'Said so', confidence: 0.9 },
    { questionId: shownStatement, answer: 'Disagree', evidence: 'Said so', confidence: 0.9 },
  ]);
  const props = renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const hiddenCard = card(hiddenStatement).textContent;
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await waitFor(() => expect(mapInterviewEvidenceToResponses).toHaveBeenCalled());
  await waitFor(() => expect(card('o1')).toHaveTextContent('More audits.'));
  // Still only the AI's own drafts are counted as its.
  expect(screen.getByText('Your AI drafted 6 answers')).toBeInTheDocument();
  expect(card(hiddenStatement).textContent).toBe(hiddenCard);
  expect(answer(shownStatement)).toHaveValue('Agree');
  answerWith(hiddenStatement, 'Disagree');
  submit();
  await waitFor(() => expect(props.onRecordProvenance).toHaveBeenCalled());
  // The hidden draft is still scored as held out against the AI's first guess.
  expect(reviewed(props, hiddenStatement)).toMatchObject({ predictionCondition: 'blind' });
});

it('keeps hidden guesses out of group suggestions until they are shown', async () => {
  jest
    .mocked(useSessionInterviewGroupRecommendations)
    .mockReturnValue({ availability: 'available', recommendations: [] });
  renderReview({ hiddenDraftShare: share, shareDraftChangesByDefault: true, joinMatchingGroups: true });
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

it('explains the grey answer area with a keyboard-accessible tooltip', async () => {
  renderReview();
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  const help = within(card(hiddenStatement)).getByRole('button', { name: 'Why is the prediction hidden?' });
  expect(help).toHaveAccessibleDescription(/^Answer first, so the AI’s prediction can’t sway you/);
  // It says what is saved with the answer, never that only the answer is.
  expect(help).toHaveAccessibleDescription(
    /prediction, its confidence and what you changed are saved with your answer/,
  );
  expect(help).not.toHaveAccessibleDescription(/Only your own answer/);
  fireEvent.focus(help);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Answer first, so the AI’s prediction can’t sway you');
  expect(answer(hiddenStatement)).toBeEnabled();
  expect(card(hiddenStatement).innerHTML).not.toContain('EVIDENCE-');
});
