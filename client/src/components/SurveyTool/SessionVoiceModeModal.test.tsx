import { useInterviewReadiness } from './useInterviewReadiness';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildExternalInterviewKickoff,
  hashInterviewQuestions,
  INTERVIEW_PREFILL_PASTE_NOTE,
  mapInterviewEvidenceToResponses,
  type InterviewDraftResponse,
} from './sessionInterview';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';
import { loadDraftingGroupChoices } from './sessionInterviewGroupRecommendations';

const mockGroupArea = jest.fn();
const mockGroupAreaMounts = jest.fn();
// These sessions have no place for names, so an answer may carry one.
jest.mock('../../utilities/session/useSessionNames', () => ({
  useSessionNames: jest.fn(() => ({ source: null, names: {}, answerNamesShown: true, signIn: null })),
}));
jest.mock('./SessionInterviewRecommendedGroups', () => ({
  __esModule: true,
  default: (props: { recommendations?: unknown[]; onRefresh?: () => void }) => {
    mockGroupArea(props);
    jest.requireActual<typeof import('react')>('react').useEffect(() => mockGroupAreaMounts(), []);
    return (
      <>
        {props.recommendations?.length ? <div data-testid="mock-group-recommendations" /> : null}
        {props.onRefresh ? (
          <button type="button" onClick={props.onRefresh}>
            Refresh group suggestions
          </button>
        ) : null}
      </>
    );
  },
}));

jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('./sessionInterviewGroupRecommendations', () => ({
  ...jest.requireActual<object>('./sessionInterviewGroupRecommendations'),
  loadDraftingGroupChoices: jest.fn(),
}));

jest.mock('./CreateQuestionsAndSurveys', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-create-questions">Question creation editor</div>,
}));

jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));

jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: jest.fn(() => ({ opening: '', notice: '', loading: false })),
}));

jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-group-listening"
      data-mode={String(props.panelMode || '')}
      data-embedded={String(Boolean(props.embeddedInModal))}
    />
  ),
  SessionListeningWaveform: () => <canvas data-testid="mock-interview-waveform" />,
  formatSessionRecordingElapsed: (seconds: number) => `0:${String(seconds).padStart(2, '0')}`,
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

jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({
  startSessionRealtimeInterview: jest.fn(),
}));

// The voice brief's question rows: from "Questions:" to the blank line before the answered and drafted lists.
const questionBank = (instructions: string) =>
  instructions.slice(instructions.indexOf('\nQuestions:')).split('\n\n')[0];
const baseProps = {
  isOpen: true,
  mode: null,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  onSubmitResponses: jest.fn(),
  toggleLoginModal: jest.fn(),
  sessionSlug: 'demo',
  account: '0x0000000000000000000000000000000000000001',
  loginComplete: true,
  workerUrl: 'https://worker.example',
  questionPool: [{ id: 'q1', prompt: 'What matters?', type: 'freeform' }],
  existingResponseSlice: null,
  prefillPacket: null,
  onApplyAnswer: jest.fn(),
  onApplyAdditional: jest.fn(),
  onApplyImportance: jest.fn(),
  onApplyConviction: jest.fn(),
  onRecordProvenance: jest.fn(),
};

const mockedHashInterviewQuestions = jest.mocked(hashInterviewQuestions);
const mockedMapInterviewEvidenceToResponses = jest.mocked(mapInterviewEvidenceToResponses);
const mockedStartSessionRealtimeInterview = jest.mocked(startSessionRealtimeInterview);
const mockedUseSessionInterviewGroupRecommendations = jest.mocked(useSessionInterviewGroupRecommendations);
const mockedLoadDraftingGroupChoices = jest.mocked(loadDraftingGroupChoices);

const buildAllowedSuggestionSessionConfig = () => ({
  slug: 'demo',
  sessionId: `0x${'1'.repeat(32)}`,
  corsWorkerUrl: 'https://worker.example/',
  interviewMode: { suggestQuestions: true },
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active' },
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
});

const editableButtonName = (label: string) => `${label}. Activate to edit.`;

const expectReadableDraftText = async (label: string, value: string) => {
  const button = await screen.findByRole('button', { name: editableButtonName(label) });
  expect(button).toHaveTextContent(value);
  return button;
};

const editReadableDraftText = async (label: string, value: string) => {
  const button = await screen.findByRole('button', { name: editableButtonName(label) });
  fireEvent.click(button);
  const editor = screen.getByLabelText(label);
  fireEvent.change(editor, { target: { value } });
  fireEvent.blur(editor);
};

// A voice round whose transcript is ready when it stops.
const mockVoiceRound = (transcript: string) =>
  mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
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
const speak = async () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
};
const draftIds = () =>
  screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT).map((card) => card.getAttribute('data-ce-question-id'));
type SavedSlice = {
  answers: Record<string, unknown>;
  importance: Record<string, unknown>;
  conviction: Record<string, unknown>;
  additionalComments: Record<string, unknown>;
};
const deferredSavedAnswers = () => {
  let resolve: (slice: SavedSlice) => void = () => {};
  const load = jest.fn(
    () =>
      new Promise<SavedSlice>((done) => {
        resolve = done;
      }),
  );
  return {
    load,
    finish: (answers: Record<string, unknown>) =>
      act(async () => resolve({ answers, importance: {}, conviction: {}, additionalComments: {} })),
  };
};
const aiPrefill = (responses: Array<{ questionId: string; answer: unknown }>) => ({
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: {},
  responses: responses.map((response) => ({ ...response, confidence: 0.8 })),
});
const threeQuestions = [
  { id: 'q1', prompt: 'What matters?', type: 'freeform' },
  { id: 'q2', prompt: 'Second question?', type: 'freeform' },
  { id: 'q3', prompt: 'Third question?', type: 'freeform' },
];

describe('SessionVoiceModeModal', () => {
  beforeEach(() => {
    // A review one test leaves unsubmitted is kept in this browser and would open in the next.
    window.localStorage.clear();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: 'demo',
          prefillPromptVersion: 'ce-interview-brief-v5',
          questionSetHash: 'f'.repeat(64),
          questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
        }),
      ),
    );
    jest
      .mocked(useInterviewReadiness)
      .mockReturnValue({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) },
    });
    baseProps.onSubmitResponses.mockResolvedValue({ status: 'submitted' });
    mockedHashInterviewQuestions.mockResolvedValue('a'.repeat(64));
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([]);
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'idle', recommendations: [] });
    mockedLoadDraftingGroupChoices.mockResolvedValue([]);
  });

  it('retains review edits and progress through close/reopen, and clears them only on discard', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'Draft answer' }]);
    const onInterviewProgressChange = jest.fn();
    const props = {
      ...baseProps,
      mode: 'interview' as const,
      onInterviewProgressChange,
      prefillPacket: {
        version: 1 as const,
        sessionSlug: 'demo',
        source: { platform: 'other' as const, modelId: 'unknown', verification: 'self_reported' as const },
        responderContext: { summary: 'Synthetic context' },
      },
    };
    const view = render(<SessionVoiceModeModal {...props} />);
    await editReadableDraftText('Draft answer for What matters?', 'My unsaved edit');
    await waitFor(() => expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    view.rerender(<SessionVoiceModeModal {...props} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true);
    view.rerender(<SessionVoiceModeModal {...props} />);
    await expectReadableDraftText('Draft answer for What matters?', 'My unsaved edit');
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(1);
    // Discard leads the row under the microphone, the transcript after it (SurveyTool.styles.test.ts
    // checks the styling), and explains itself on hover, and to screen readers.
    const discard = screen.getByRole('button', { name: 'Discard interview' });
    const microphone = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START);
    expect(discard).toHaveClass('sessionInterviewDiscard');
    expect(discard).toHaveTextContent('Discard');
    expect(discard.parentElement).toHaveClass('sessionInterviewMicRow');
    expect(discard.parentElement?.previousElementSibling).toBe(microphone);
    expect(discard.parentElement?.firstElementChild).toBe(discard);
    expect(document.querySelector('.modal-footer')).toBeNull();
    expect(discard).toHaveAccessibleDescription(/Responses you’ve submitted are kept\.$/);
    fireEvent.mouseOver(discard);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Responses you’ve submitted are kept.');
    fireEvent.mouseOut(discard);
    fireEvent.click(discard);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep reviewing' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep reviewing' })).not.toBeInTheDocument());
    await expectReadableDraftText('Draft answer for What matters?', 'My unsaved edit');
    fireEvent.click(screen.getByRole('button', { name: 'Discard interview' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Discard this interview?' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard interview' }));
    await waitFor(() => expect(onInterviewProgressChange).toHaveBeenLastCalledWith(false));
    expect(baseProps.onClose).toHaveBeenCalledTimes(2);
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    expect(screen.queryByText('My unsaved edit')).not.toBeInTheDocument();
  });

  it('retains edits for the same packet but starts a new review for replacement evidence', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      source: { platform: 'other' as const, modelId: 'fixture', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'First imported answer', confidence: 0.8 }],
    };
    const props = { ...baseProps, mode: 'interview' as const, prefillPacket };
    const view = render(<SessionVoiceModeModal {...props} />);
    await editReadableDraftText('Draft answer for What matters?', 'My retained edit');
    view.rerender(<SessionVoiceModeModal {...props} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    view.rerender(<SessionVoiceModeModal {...props} prefillPacket={{ ...prefillPacket }} />);
    await expectReadableDraftText('Draft answer for What matters?', 'My retained edit');
    view.rerender(<SessionVoiceModeModal {...props} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    view.rerender(
      <SessionVoiceModeModal
        {...props}
        prefillPacket={{
          ...prefillPacket,
          responses: [{ questionId: 'q1', answer: 'Replacement answer', confidence: 0.8 }],
        }}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Replacement answer');
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
  });

  it('reports unusable voice context before starting the recorder', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[{ id: 'q1', type: 'freeform', prompt: 'x'.repeat(40_000) }]}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByRole('alert')).toHaveTextContent('No complete question fits');
    expect(mockedStartSessionRealtimeInterview).not.toHaveBeenCalled();
  });

  it('shows limited voice context on Continue while final mapping receives the full transcript', async () => {
    const longTranscript =
      'Interviewer: Earlier question?\nResponder: Earlier answer.\n\n'.repeat(700) +
      'Interviewer: How ready now?\nResponder: Four.';
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      options.onTranscript?.(longTranscript, []);
      return {
        mediaStream: {} as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop: jest.fn(async () => ({ transcript: longTranscript, turns: [] })),
        getTranscript: () => longTranscript,
      };
    });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() =>
      expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: longTranscript }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeEnabled());
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    expect(screen.getByText(/Voice context was limited/)).toHaveTextContent('full transcript and drafts');
    const instructions = mockedStartSessionRealtimeInterview.mock.calls[1][0].instructions;
    expect(instructions.length).toBeLessThanOrEqual(31_500);
    expect(instructions).toContain('Interviewer: How ready now?');
    expect(instructions).toContain('Responder: Four.');
    expect(instructions).not.toContain(longTranscript);
  });

  it.each([
    ['checking', 'Checking setup', 'busy'],
    ['unavailable', 'Setup needed', 'error'],
    ['unknown', 'Not checked', 'pending'],
  ] as const)('shows %s readiness without a misleading green pill', (state, label, tone) => {
    jest.mocked(useInterviewReadiness).mockReturnValue({ state, detail: 'Check setup.', retry: jest.fn() });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(label);
    expect(screen.getByRole('button', { name: `Interview status: ${label}` })).toHaveAttribute('data-tone', tone);
  });

  it('shows suggested questions in an expanded section without submitting anything', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [];
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={buildAllowedSuggestionSessionConfig()}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );
    const section = await screen.findByText('Suggested new questions (1)');
    expect(section.closest('details')).toHaveAttribute('open');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts');
    expect(screen.getByText(/No matching answers yet. Review the suggested questions below./)).toBeInTheDocument();
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('puts collapsible responses before suggested questions and preserves edits when collapsed', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [{ questionId: 'q1', answer: 'Original draft', additionalComments: 'An explanation', confidence: 0.8 }];
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={buildAllowedSuggestionSessionConfig()}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );
    const review = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    const suggestions = screen.getByRole('heading', { name: 'Suggested new questions (1)' }).closest('details');
    expect(review).toHaveAttribute('open');
    expect(suggestions).toHaveAttribute('open');
    expect(review.compareDocumentPosition(suggestions!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expectReadableDraftText('Draft answer for What matters?', 'Original draft');
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
    await editReadableDraftText('Draft answer for What matters?', 'My edited answer');
    await expectReadableDraftText('Draft answer for What matters?', 'My edited answer');
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    const summary = review.querySelector('summary')!;
    fireEvent.click(summary);
    expect(review).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(review).toHaveAttribute('open');
    await expectReadableDraftText('Draft answer for What matters?', 'My edited answer');
    expect(screen.queryByRole('button', { name: 'Draft selected' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 of 1 selected')).not.toBeInTheDocument();
    await editReadableDraftText('Additional comments for What matters?', 'My own comment');
    await expectReadableDraftText('Additional comments for What matters?', 'My own comment');
    fireEvent.click(screen.getByRole('button', { name: 'Submit (1)' }));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'My edited answer'));
    expect(baseProps.onApplyAdditional).toHaveBeenCalledWith('q1', 'My own comment');
  });

  it('keeps existing user comments unprefixed until edited', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        existingResponseSlice={{ additionalComments: { q1: { value: 'My existing comment' } } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Agent draft', confidence: 0.8 }],
        }}
      />,
    );
    await expectReadableDraftText('Additional comments for What matters?', 'My existing comment');
    expect(screen.queryByLabelText('AI-proposed comment')).not.toBeInTheDocument();
    await editReadableDraftText('Additional comments for What matters?', 'My revised comment');
    await expectReadableDraftText('Additional comments for What matters?', 'My revised comment');
  });

  it('does not treat direct user context as an AI prefill for research consent', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          responderContext: { summary: 'My own context' },
          source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
          responses: [{ questionId: 'q1', answer: 'Agent: A reviewed answer', confidence: 0.8 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'AI research metadata' })).not.toBeInTheDocument();
    expect(screen.queryByText('AI submission info')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Agent: A reviewed answer'));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        [expect.objectContaining({ questionId: 'q1', answer: 'Agent: A reviewed answer' })],
        expect.any(Object),
        expect.any(Object),
        false,
        false,
        '',
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1', answer: 'Agent: A reviewed answer' })]),
        { includeResponderName: false },
      ),
    );
  });

  it('shows the live status pill with setup details available in its tooltip', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const help = screen.getByRole('button', { name: 'About Interview' });
    const status = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS);
    expect(help.closest('.modal-header')).not.toBeNull();
    expect(status.closest('.modal-header')).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText(/Speak with an AI interviewer/)).not.toBeInTheDocument();
    fireEvent.focus(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Stopping prepares drafts for your review');
    expect(screen.getByRole('tooltip')).toHaveTextContent('You can answer in the language you prefer.');
    fireEvent.blur(help);
    // Beside it, flags that screen readers name by language, not country.
    const languages = within(screen.getByRole('list', { name: 'Some languages you can answer in' }));
    expect(languages.getAllByRole('img').map((flag) => flag.textContent)).toEqual([
      'English',
      'Portuguese',
      'German',
      'French',
      'Hindi',
      'Japanese',
      'Korean',
    ]);
    expect(languages.getByRole('img', { name: 'English' })).not.toHaveAccessibleDescription();
    expect(languages.getByRole('img', { name: 'English' }).closest('.modal-header')).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    fireEvent.focus(screen.getByRole('button', { name: 'Interview status: Ready' }));
    expect(status).toHaveTextContent('Ready');
    expect(screen.getByRole('button', { name: 'Interview status: Ready' })).toHaveAttribute('data-tone', 'ready');
    // Led by the status in full, which a phone may cut short in the pill.
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Ready\. Voice setup ready\. Click to check again\.$/,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Start voice interview');
  });

  it('says the questions are loading until the pile settles, and no questions only after', () => {
    const { rerender } = render(
      <SessionVoiceModeModal {...baseProps} mode="interview" questionPool={[]} questionLoad="loading" />,
    );
    const status = () => screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS);
    const none = () => screen.queryByText('No accessible questions are available for this interview.');
    expect(status()).toHaveTextContent('Loading questions…');
    expect(none()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Interview status: Loading questions…' })).toHaveAttribute(
      'data-tone',
      'busy',
    );
    rerender(<SessionVoiceModeModal {...baseProps} mode="interview" questionPool={[]} questionLoad="failed" />);
    expect(status()).toHaveTextContent("Questions didn't load");
    expect(none()).not.toBeInTheDocument();
    rerender(<SessionVoiceModeModal {...baseProps} mode="interview" questionPool={[]} />);
    expect(status()).toHaveTextContent('No questions');
    expect(none()).toBeInTheDocument();
  });

  it('submits reviewed values and retains edited unselected predictions only as consented metadata', async () => {
    const onInterviewProgressChange = jest.fn();
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [
        { questionId: 'q1', answer: 'Original one', additionalComments: 'Relevant explanation', confidence: 0.8 },
        { questionId: 'q2', answer: 'Original two', confidence: 0.8 },
      ],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        onInterviewProgressChange={onInterviewProgressChange}
        prefillPacket={prefillPacket}
        // Unselected drafts are kept only at full research detail.
        sessionConfig={{ interviewMode: { researchDetail: 'full' } }}
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'Second question?', type: 'freeform' }]}
        renderFieldLock={(id, field) => <button type="button" aria-label={`Privacy ${id} ${field}`} />}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.getByRole('button', { name: 'Privacy q1 answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy q1 additional' })).toBeInTheDocument();
    const choices = screen.getByText('AI submission info').closest('details')!;
    const submission = screen.getByRole('group', { name: 'Response submission' });
    expect(submission).toContainElement(choices);
    // As on every Submit that sends answers: its count, here of both drafts, in the corner without its brackets.
    const submitButton = screen.getByRole('button', { name: 'Submit (2)' });
    expect(submission).toContainElement(submitButton);
    expect(submitButton.querySelector('.pileSubmitButtonCount')).toHaveTextContent(/^2$/);
    expect(choices).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Include platform/model provenance')).toBeChecked();
    // Sharing for research starts on, beside the closed submission info.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeChecked();
    fireEvent.click(choices.querySelector('summary')!);
    expect(choices).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'What’s this? About sharing for research' })).toHaveAccessibleDescription(
      /drafts you did not select/,
    );
    // Inside AI submission info the metadata shows at once, with nothing more to open.
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    expect(metadata.querySelector('details, summary')).toBeNull();
    expect(metadata).toHaveTextContent('Claude');
    expect(metadata).toHaveTextContent('example');
    expect(metadata).toHaveTextContent('Self-reported');
    expect(metadata).toHaveTextContent('ce-interview-brief-v4');
    expect(metadata).toHaveTextContent('a'.repeat(64));
    expect(metadata).not.toHaveTextContent('will not be included');
    expect(metadata).toHaveTextContent('2 selected drafts and 0 unselected drafts');
    fireEvent.click(choices.querySelector('summary')!);
    expect(choices).not.toHaveAttribute('open');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeChecked();
    await editReadableDraftText('Draft answer for What matters?', 'Edited one');
    await editReadableDraftText('Additional comments for What matters?', 'Edited explanation');
    await editReadableDraftText('Draft answer for Second question?', 'Edited two');
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Second question?' }));
    expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).toHaveLength(1);
    expect(screen.queryByText('Second question?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: editableButtonName('Draft answer for Second question?') }),
    ).not.toBeInTheDocument();
    expect(metadata).toHaveTextContent('1 selected draft and 1 unselected draft');
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true);
    // The removed draft leaves one to send.
    fireEvent.click(screen.getByRole('button', { name: 'Submit (1)' }));
    await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onInterviewProgressChange).toHaveBeenLastCalledWith(false));
    expect(baseProps.onApplyAnswer).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Edited one');
    expect(baseProps.onApplyAdditional).toHaveBeenCalledWith('q1', 'Edited explanation');
    expect(baseProps.onRecordProvenance.mock.calls[0][6]).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        answer: 'Edited one',
        selected: true,
        original: {
          ...prefillPacket.responses[0],
          revisions: [
            expect.objectContaining({
              revision: 1,
              answer: prefillPacket.responses[0].answer,
              modelId: prefillPacket.source.modelId,
            }),
          ],
        },
      }),
      expect.objectContaining({
        questionId: 'q2',
        answer: 'Edited two',
        selected: false,
        original: {
          ...prefillPacket.responses[1],
          revisions: [
            expect.objectContaining({
              revision: 1,
              answer: prefillPacket.responses[1].answer,
              modelId: prefillPacket.source.modelId,
            }),
          ],
        },
      }),
    ]);
    expect(baseProps.onRecordProvenance.mock.invocationCallOrder[0]).toBeLessThan(
      baseProps.onSubmitResponses.mock.invocationCallOrder[0],
    );
  });

  it('waits for an identity-bound response readiness token after login', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const submitContextToken = 'demo|111|worker-a|session-a';
    const account = '0x0000000000000000000000000000000000000001';
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed after login');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account={account}
        isResponsesCacheReady
        responseReadinessContextToken=""
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Waiting for session data'),
    );
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account={account}
        isResponsesCacheReady
        responseReadinessContextToken={`${submitContextToken}|${account}|true`}
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed after login'));
    expect(onSubmitResponses).toHaveBeenCalledTimes(2);
  });

  it('opens the normal login modal when a logged-out draft submit is deferred', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest.fn().mockResolvedValue(undefined);
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };

    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.toggleLoginModal).toHaveBeenCalledWith(true);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Log in to submit');
  });

  it('preserves reviewed drafts while logged out and submits them after login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginModalToggled
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed after login');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onRecordProvenance).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Log in to submit');
    expect(await screen.findByRole('button', { name: /Draft answer for What matters/i })).toHaveTextContent(
      'Reviewed after login',
    );

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginModalToggled
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady={false}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.toggleLoginModal).toHaveBeenCalledWith(false);

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginModalToggled
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed after login'));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(2));
    expect(baseProps.onRecordProvenance).toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('cancels deferred submit when login is dismissed before authentication', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'login-required' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        loginModalToggled
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        loginModalToggled={false}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Login required');

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('submits with complete own answers while the public results cache remains partial', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'New answer', confidence: 0.8, evidence: 'Context' },
    ]);
    const onLoadSavedResponses = jest
      .fn()
      .mockResolvedValue({ answers: {}, additionalComments: {}, importance: {}, conviction: {} });
    baseProps.onSubmitResponses.mockResolvedValue({ status: 'submitted' });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        isResponsesCacheReady={false}
        onLoadSavedResponses={onLoadSavedResponses}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'synthetic', verification: 'self_reported' },
          responderContext: { summary: 'Context' },
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    await waitFor(() => expect(onLoadSavedResponses).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'New answer'));
    expect(baseProps.onSubmitResponses).toHaveBeenCalled();
  });

  it.each([
    ['differs from', 'New answer', true],
    ['repeats', 'Already saved', false],
  ])(
    'when an answer loads during a queued submit, holds a typed-context draft that %s it for a check, or drops it',
    async (_label, drafted, kept) => {
      mockedMapInterviewEvidenceToResponses.mockResolvedValue([
        { questionId: 'q1', answer: drafted, confidence: 0.8, evidence: 'Context' },
      ]);
      type Slice = {
        answers: Record<string, unknown>;
        importance: Record<string, unknown>;
        conviction: Record<string, unknown>;
        additionalComments: Record<string, unknown>;
      };
      let resolveSaved: (slice: Slice) => void = () => {};
      const onLoadSavedResponses = jest.fn(
        () =>
          new Promise<Slice>((resolve) => {
            resolveSaved = resolve;
          }),
      );
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          isResponsesCacheReady={false}
          onLoadSavedResponses={onLoadSavedResponses}
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            questionSetHash: 'a'.repeat(64),
            promptVersion: 'ce-interview-brief-v1',
            source: { platform: 'chatgpt', modelId: 'synthetic', verification: 'self_reported' },
            responderContext: { summary: 'Context' },
          }}
        />,
      );
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      await act(async () =>
        resolveSaved({
          answers: { q1: { value: 'Already saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        }),
      );
      expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
      expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
      if (kept) {
        // The person's own words give a new answer: it stays chosen, says what it changes,
        // and the queued submit waits for them to check it.
        expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(
          'Saved answers loaded. Check drafts that change an earlier answer or comment, then submit.',
        );
        await expectReadableDraftText('Draft answer for What matters?', 'New answer');
        expect(screen.getByText('Changes your earlier answer: Already saved')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Replace with draft' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove draft for What matters?' })).toBeEnabled();
        expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeEnabled();
        expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).not.toBeInTheDocument();
      } else {
        expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
        expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
          'You’ve already answered the question this draft covers.',
        );
        expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Ready');
      }
    },
  );

  it('drops untouched drafts whose saved answers load late, and keeps an edited one with a note', async () => {
    type Slice = {
      answers: Record<string, unknown>;
      importance: Record<string, unknown>;
      conviction: Record<string, unknown>;
      additionalComments: Record<string, unknown>;
    };
    let resolveSaved: (slice: Slice) => void = () => {};
    const onLoadSavedResponses = jest.fn(
      () =>
        new Promise<Slice>((resolve) => {
          resolveSaved = resolve;
        }),
    );
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        onLoadSavedResponses={onLoadSavedResponses}
        questionPool={[
          ...baseProps.questionPool,
          { id: 'q2', prompt: 'Second question?', type: 'freeform' },
          { id: 'q3', prompt: 'Third question?', type: 'freeform' },
        ]}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [
            { questionId: 'q1', answer: 'Drafted one', confidence: 0.8 },
            { questionId: 'q2', answer: 'Drafted two', confidence: 0.8 },
            { questionId: 'q3', answer: 'Drafted three', confidence: 0.8 },
          ],
        }}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).toHaveTextContent(
      'Your AI drafted 3 answers',
    );
    await editReadableDraftText('Draft answer for Second question?', 'My own answer');
    await act(async () =>
      resolveSaved({
        answers: { q1: { value: 'Saved one' }, q2: { value: 'Saved two' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      }),
    );
    // The untouched draft goes; the edited one stays as it was, saying what it changes.
    expect(screen.queryByText('What matters?')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).toHaveLength(2);
    await expectReadableDraftText('Draft answer for Second question?', 'My own answer');
    expect(screen.getAllByText(/^Changes your earlier answer/)).toHaveLength(1);
    expect(screen.getByText('Changes your earlier answer: Saved two')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace with draft' })).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(
      'Saved answers loaded. Check drafts that change an earlier answer or comment, then submit.',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 1 draft for a question you’ve already answered.',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).toHaveTextContent(
      'Your AI drafted 2 answers',
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledWith(['q2', 'q3']));
    expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q2', 'My own answer');
    expect(baseProps.onApplyAnswer).toHaveBeenCalledTimes(2);
    expect(
      baseProps.onRecordProvenance.mock.calls[0][6].map(({ questionId }: { questionId: string }) => questionId),
    ).toEqual(['q2', 'q3']);
  });

  it('uses complete public-cache readiness for a verified legacy Worker', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'New answer' }]);
    const onLoadSavedResponses = jest.fn().mockResolvedValue(null);
    const props = {
      ...baseProps,
      mode: 'interview' as const,
      onLoadSavedResponses,
      prefillPacket: {
        version: 1 as const,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v1',
        source: { platform: 'chatgpt' as const, modelId: 'synthetic', verification: 'self_reported' as const },
        responderContext: { summary: 'Context' },
      },
      responseReadinessContextToken: '',
    };
    const view = render(<SessionVoiceModeModal {...props} isResponsesCacheReady={false} />);
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    view.rerender(<SessionVoiceModeModal {...props} isResponsesCacheReady responseReadinessContextToken="stale" />);
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    view.rerender(
      <SessionVoiceModeModal
        {...props}
        isResponsesCacheReady
        responseReadinessContextToken={`demo|${baseProps.account}|true`}
      />,
    );
    await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalled());
    expect(screen.queryByText(/Could not load your saved answers/)).not.toBeInTheDocument();
  });

  it('shows one saved-answer error and a working retry', async () => {
    const onLoadSavedResponses = jest
      .fn()
      .mockRejectedValueOnce(new Error('Page unavailable'))
      .mockResolvedValueOnce({ answers: {}, additionalComments: {}, importance: {}, conviction: {} });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" onLoadSavedResponses={onLoadSavedResponses} />);
    const retry = await screen.findByRole('button', { name: 'Retry saved answers' });
    expect(screen.getByRole('alert')).toHaveTextContent('Page unavailable');
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry saved answers' })).not.toBeInTheDocument());
    expect(onLoadSavedResponses).toHaveBeenCalledTimes(2);
  });

  it('marks a typed-context draft that changes an answer whose saved lookup completes before draft mapping', async () => {
    type Draft = { questionId: string; answer: string; evidence: string; confidence: number };
    let resolveMapping: (drafts: Draft[]) => void = () => {};
    mockedMapInterviewEvidenceToResponses.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMapping = resolve;
        }),
    );
    const onLoadSavedResponses = jest.fn().mockResolvedValue({
      answers: { q1: { value: 'Saved' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        onLoadSavedResponses={onLoadSavedResponses}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'synthetic', verification: 'self_reported' },
          responderContext: { summary: 'Context' },
        }}
      />,
    );
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    await act(async () => resolveMapping([{ questionId: 'q1', answer: 'New', evidence: 'Context', confidence: 0.8 }]));
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.getByText('Changes your earlier answer: Saved')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeEnabled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('shows AI-prefill drafts only for unanswered questions and keeps the others out of research', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
      responderContext: {},
      responses: [
        { questionId: 'q1', answer: 'Drafted one', confidence: 0.8 },
        { questionId: 'q2', answer: 'Drafted two', confidence: 0.8 },
        { questionId: 'q3', answer: 'Drafted three', confidence: 0.8 },
      ],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[
          ...baseProps.questionPool,
          { id: 'q2', prompt: 'Second question?', type: 'freeform' },
          { id: 'q3', prompt: 'Third question?', type: 'freeform' },
        ]}
        // q1 was answered before; q3 is typed on the page but not yet submitted.
        existingResponseSlice={{ answers: { q1: { value: 'Saved answer' }, q3: { value: 'Unsaved answer' } } }}
        // Full detail keeps unselected drafts for research, so a left-out one would show up there.
        sessionConfig={{ interviewMode: { researchDetail: 'full', shareDraftChangesByDefault: true } }}
        prefillPacket={prefillPacket}
      />,
    );
    await expectReadableDraftText('Draft answer for Second question?', 'Drafted two');
    expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).toHaveLength(1);
    expect(screen.queryByText('What matters?')).not.toBeInTheDocument();
    expect(screen.queryByText('Third question?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace with draft' })).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 2 drafts for questions you’ve already answered.',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).toHaveTextContent(
      'Your AI drafted 1 answer',
    );
    expect(screen.getByRole('group', { name: 'AI prefill metadata' })).toHaveTextContent(
      '1 selected draft and 0 unselected drafts',
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledWith(['q2']));
    expect(baseProps.onApplyAnswer).toHaveBeenCalledTimes(1);
    expect(baseProps.onRecordProvenance.mock.calls[0][6]).toEqual([
      expect.objectContaining({ questionId: 'q2', selected: true }),
    ]);
  });

  it('explains a review where every draft is for a question the person already answered', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'Second question?', type: 'freeform' }]}
        existingResponseSlice={{ answers: { q1: { value: 'Saved one' }, q2: { value: 'Saved two' } } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [
            { questionId: 'q1', answer: 'Drafted one', confidence: 0.8 },
            { questionId: 'q2', answer: 'Drafted two', confidence: 0.8 },
          ],
        }}
      />,
    );
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      /^You’ve already answered every question these drafts cover\.$/,
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ready');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Start voice interview');
  });

  it('says which of the AI’s drafts were left out instead of dropping them silently', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillNotice="Left out 1 draft from your AI that was incomplete or repeated."
        prefillPacket={aiPrefill([
          { questionId: 'q1', answer: 'Drafted one' },
          { questionId: 'q-not-here', answer: 'Stray draft' },
        ])}
      />,
    );
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 1 draft from your AI that was incomplete or repeated. Left out 1 draft from your AI that doesn’t fit this session’s questions or their options.',
    );
    expect(draftIds()).toEqual(['q1']);
  });

  it('offers a paste box for the AI’s answers when a prefill link is broken', async () => {
    const onImportPrefillJson = jest.fn((_json: string) => 'This interview prefill belongs to a different session.');
    const { rerender } = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_PASTE)).not.toBeInTheDocument();
    rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        initialError="This link is incomplete: it was cut off when it was copied."
        onImportPrefillJson={onImportPrefillJson}
      />,
    );
    const paste = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_PASTE);
    // The link's reason shows even though the review was already open.
    expect(screen.getByText('This link is incomplete: it was cut off when it was copied.')).toBeInTheDocument();
    const button = within(paste).getByRole('button', { name: 'Review draft answers' });
    expect(button).toBeDisabled();
    fireEvent.change(within(paste).getByLabelText('Paste your AI’s answers'), {
      target: { value: '{"version":1}' },
    });
    fireEvent.click(button);
    expect(onImportPrefillJson).toHaveBeenCalledWith('{"version":1}');
    expect(within(paste).getByRole('alert')).toHaveTextContent('different session');
  });

  // An AI with no code tool links #prefill=paste: the box opens with no error.
  it('opens on the paste box, without an error, when the AI asks for a paste', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        initialError={INTERVIEW_PREFILL_PASTE_NOTE}
        onImportPrefillJson={() => ''}
      />,
    );
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_PASTE)).toBeInTheDocument();
    expect(screen.queryByText(INTERVIEW_PREFILL_PASTE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
    expect(screen.getByText('Paste drafts')).toBeInTheDocument();
    // Talking instead leaves the note behind; the paste box stays.
    mockVoiceRound('Responder: Hello.');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    expect(screen.queryByText('Paste drafts')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_PASTE)).toBeInTheDocument();
  });

  it.each([
    [{ suggestQuestions: true }, true],
    [{}, false],
  ])(
    'gives the voice interviewer the closing questions only when interviews suggest questions (%j)',
    async (interviewMode, asks) => {
      let instructions = '';
      mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
        instructions = options.instructions;
        options.onRecordingState?.('recording');
        return {
          mediaStream: {} as MediaStream,
          stop: jest.fn(async () => ({ transcript: '', turns: [] })),
          pause: jest.fn(),
          resume: jest.fn(),
          getTranscript: () => '',
        };
      });
      render(<SessionVoiceModeModal {...baseProps} mode="interview" sessionConfig={{ interviewMode }} />);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
      await screen.findByLabelText('Pause interview');
      expect(instructions.includes('which session question they would most like to see other people answer')).toBe(
        asks,
      );
      expect(instructions).toContain('Don’t wrap up until the responder says they’re done.');
    },
  );

  it('after a submit, a voice interview adds drafts only for new questions and leaves the AI draft as it was', async () => {
    let instructions = '';
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      instructions = options.instructions;
      options.onRecordingState?.('recording');
      options.onTranscript?.('Responder: More detail.', []);
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: 'Responder: More detail.', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => 'Responder: More detail.',
      };
    });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Refined answer', confidence: 0.9 },
      // Repeats the person's earlier answer, so it adds nothing new.
      { questionId: 'q2', answer: 'Mine', confidence: 0.9 },
      { questionId: 'q3', answer: 'New answer', confidence: 0.9 },
    ]);
    const props = {
      ...baseProps,
      mode: 'interview' as const,
      questionPool: [
        ...baseProps.questionPool,
        { id: 'q2', prompt: 'Second question?', type: 'freeform' },
        { id: 'q3', prompt: 'Third question?', type: 'freeform' },
      ],
      prefillPacket: {
        version: 1 as const,
        sessionSlug: 'demo',
        source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
        responderContext: {},
        responses: [{ questionId: 'q1', answer: 'Drafted one', confidence: 0.8 }],
      },
    };
    const view = render(
      <SessionVoiceModeModal {...props} existingResponseSlice={{ answers: { q2: { value: 'Mine' } } }} />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Drafted one'));
    await screen.findByRole('button', { name: 'Responses submitted' });
    // Submitting writes the answer into the form; the submitted draft stays in review.
    view.rerender(
      <SessionVoiceModeModal
        {...props}
        existingResponseSlice={{ answers: { q1: { value: 'Drafted one' }, q2: { value: 'Mine' } } }}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    // The interviewer spends the conversation on the question still open.
    expect(questionBank(instructions)).toContain('Third question?');
    expect(questionBank(instructions)).not.toContain('What matters?');
    expect(questionBank(instructions)).not.toContain('Second question?');
    // It knows what was answered, without the answers, so it does not ask again unless the person raises it.
    expect(instructions).toContain(
      'Questions listed as already answered are done: don’t ask them, or about their answers, unless the responder brings one up.',
    );
    expect(instructions).toMatch(
      /Already answered \(reference only; not to ask again\):\n- What matters\?\n- Second question\?/,
    );
    expect(instructions).not.toContain('Mine');
    expect(instructions).not.toContain('Ask which earlier answer');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for Third question?', 'New answer');
    // The AI prefill's submitted draft stays its own, whatever the voice round drafts for it.
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    expect(screen.queryByText('Second question?')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).toHaveLength(2);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 1 draft for a question you’ve already answered.',
    );
  });

  it('leaves an AI-prefill draft for the person to correct, whatever the voice round drafts', async () => {
    mockVoiceRound('Responder: Actually, I disagree.');
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Disagree', confidence: 0.9 },
    ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={aiPrefill([{ questionId: 'q1', answer: 'Agree' }])}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Agree');
    await speak();
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    // Its guess is what research compares the person's answer with, so only the person changes it.
    await expectReadableDraftText('Draft answer for What matters?', 'Agree');
    expect(mockedMapInterviewEvidenceToResponses.mock.calls[0][0].previousResponses).toEqual([]);
  });

  it('leaves out an answered question even when the voice mapper hands back its AI-prefill guess', async () => {
    mockVoiceRound('Responder: Transit matters to me.');
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      // The AI prefill's guess for the answered q1, handed back as if it were new.
      { questionId: 'q1', answer: 'Agree', confidence: 0.9 },
      { questionId: 'q2', answer: 'Agree', confidence: 0.9 },
    ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={threeQuestions.slice(0, 2)}
        existingResponseSlice={{ answers: { q1: { value: 'Disagree' } } }}
        prefillPacket={aiPrefill([
          { questionId: 'q1', answer: 'Agree' },
          { questionId: 'q2', answer: 'Agree' },
        ])}
      />,
    );
    await expectReadableDraftText('Draft answer for Second question?', 'Agree');
    await speak();
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    // The mapper hears neither the guess for the answered question nor the drafted one's, and drafts only q1.
    const [request] = mockedMapInterviewEvidenceToResponses.mock.calls[0];
    expect(request.prefillPacket?.responses).toEqual([]);
    expect(request.questions.map(({ id }) => id)).toEqual(['q1']);
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(draftIds()).toEqual(['q2']);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 1 draft for a question you’ve already answered.',
    );
  });

  it('keeps out a draft whose saved answer loads while the mapper works', async () => {
    mockVoiceRound('Responder: More detail.');
    let finishMapping: (drafts: InterviewDraftResponse[]) => void = () => {};
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      () =>
        new Promise<InterviewDraftResponse[]>((resolve) => {
          finishMapping = resolve;
        }),
    );
    const saved = deferredSavedAnswers();
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        onLoadSavedResponses={saved.load}
        questionPool={threeQuestions}
        prefillPacket={aiPrefill([
          { questionId: 'q1', answer: 'Drafted one' },
          { questionId: 'q2', answer: 'Drafted two' },
        ])}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    await speak();
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    await saved.finish({ q1: { value: 'Saved one' } });
    await act(async () =>
      finishMapping([
        { questionId: 'q2', answer: 'Refined two', confidence: 0.9 },
        { questionId: 'q3', answer: 'New three', confidence: 0.9 },
      ]),
    );
    await expectReadableDraftText('Draft answer for Third question?', 'New three');
    // The AI-drafted q2 isn't redrafted.
    await expectReadableDraftText('Draft answer for Second question?', 'Drafted two');
    expect(draftIds()).toEqual(['q2', 'q3']);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      'Left out 1 draft for a question you’ve already answered.',
    );
  });

  it('counts only drafts the person hadn’t already dismissed when saved answers load late', async () => {
    const saved = deferredSavedAnswers();
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        onLoadSavedResponses={saved.load}
        questionPool={threeQuestions}
        prefillPacket={aiPrefill([
          { questionId: 'q1', answer: 'Drafted one' },
          { questionId: 'q2', answer: 'Drafted two' },
          { questionId: 'q3', answer: 'Drafted three' },
        ])}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted one');
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for What matters?' }));
    await saved.finish({ q1: { value: 'Saved one' }, q2: { value: 'Saved two' } });
    expect(draftIds()).toEqual(['q3']);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
      /^Left out 1 draft for a question you’ve already answered\.$/,
    );
  });

  it.each([
    ['kept', ['q2', 'q3']],
    ['dismissed', ['q3']],
  ])(
    'offers a voice draft that changes a saved answer, and submits it only while chosen (%s)',
    async (choice, submitted) => {
      mockVoiceRound('Responder: I now care most about speed.');
      mockedMapInterviewEvidenceToResponses.mockResolvedValue([
        { questionId: 'q1', answer: 'Safety', confidence: 0.9 },
        { questionId: 'q2', answer: 'Speed', confidence: 0.9 },
        { questionId: 'q3', answer: 'Trains', confidence: 0.9 },
      ]);
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          questionPool={threeQuestions}
          existingResponseSlice={{ answers: { q1: { value: 'Safety' }, q2: { value: 'Cost' } } }}
        />,
      );
      await speak();
      // New evidence changes the saved "Cost"; repeating "Safety" adds nothing.
      await expectReadableDraftText('Draft answer for Second question?', 'Speed');
      expect(draftIds()).toEqual(['q2', 'q3']);
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
        /^Left out 1 draft for a question you’ve already answered\.$/,
      );
      expect(screen.getAllByText(/^Changes your earlier answer/)).toHaveLength(1);
      expect(screen.getByText('Changes your earlier answer: Cost')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Replace with draft' })).not.toBeInTheDocument();
      if (choice === 'dismissed')
        fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Second question?' }));
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledWith(submitted));
      expect(baseProps.onApplyAnswer.mock.calls.map(([questionId]) => questionId)).toEqual(submitted);
      // Research sees the draft as shown either way, chosen or not.
      expect(baseProps.onRecordProvenance.mock.calls[0][6]).toEqual([
        expect.objectContaining({ questionId: 'q2', answer: 'Speed', selected: choice === 'kept' }),
        expect.objectContaining({ questionId: 'q3', selected: true }),
      ]);
    },
  );

  it('gives the voice interviewer the session context only where the session turns it on', async () => {
    const sessionContext = { title: 'Salon', paragraphs: ['Background notes on reverse alignment.'], links: [] };
    for (const [interviewMode, given] of [
      [{}, false],
      [{ voiceSessionContext: true }, true],
    ] as const) {
      mockedStartSessionRealtimeInterview.mockClear();
      const view = render(
        <SessionVoiceModeModal {...baseProps} mode="interview" sessionConfig={{ interviewMode, sessionContext }} />,
      );
      // The context block is built from the notes after a render; let it settle before starting.
      await act(async () => {});
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
      await waitFor(() => expect(mockedStartSessionRealtimeInterview).toHaveBeenCalled());
      const { instructions } = mockedStartSessionRealtimeInterview.mock.calls[0][0];
      expect(instructions.includes('Background notes on reverse alignment.')).toBe(given);
      expect(instructions.includes('<session_context>')).toBe(given);
      view.unmount();
    }
  });

  it('gives the voice interviewer only undrafted unanswered questions, or every question once all are answered', async () => {
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: '', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => '',
      };
    });
    const props = {
      ...baseProps,
      mode: 'interview' as const,
      questionPool: [
        ...baseProps.questionPool,
        { id: 'q2', prompt: 'Second question?', type: 'freeform' },
        { id: 'q3', prompt: 'Third question?', type: 'freeform' },
      ],
      prefillPacket: {
        version: 1 as const,
        sessionSlug: 'demo',
        source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
        responderContext: {},
        responses: [
          { questionId: 'q1', answer: 'Drafted one', evidence: 'EVIDENCE-q1', confidence: 0.8 },
          { questionId: 'q2', answer: 'Drafted two', evidence: 'EVIDENCE-q2', confidence: 0.8 },
        ],
      },
    };
    const first = render(
      <SessionVoiceModeModal {...props} existingResponseSlice={{ answers: { q1: { value: 'Saved' } } }} />,
    );
    await expectReadableDraftText('Draft answer for Second question?', 'Drafted two');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    const open = mockedStartSessionRealtimeInterview.mock.calls[0][0].instructions;
    // q2's draft is background for the open q3; the drafted q2 itself is not to be asked.
    expect(open).toContain('[q3]');
    expect(open).toContain('EVIDENCE-q2');
    expect(open).not.toContain('[q2]');
    expect(open).toContain('drafts use:\n- (q2) Second question?');
    expect(open).not.toContain('[q1]');
    expect(open).not.toContain('EVIDENCE-q1');
    first.unmount();

    // With nothing left unanswered, the interviewer keeps the whole question list but no drafts for it.
    render(
      <SessionVoiceModeModal
        {...props}
        existingResponseSlice={{ answers: { q1: { value: 'Saved' }, q2: { value: 'Saved' }, q3: { value: 'Saved' } } }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await waitFor(() => expect(mockedStartSessionRealtimeInterview).toHaveBeenCalledTimes(2));
    const answered = mockedStartSessionRealtimeInterview.mock.calls[1][0].instructions;
    for (const prompt of ['What matters?', 'Second question?', 'Third question?'])
      expect(questionBank(answered)).toContain(prompt);
    expect(answered).toContain('Ask which earlier answer, if any, the responder wants to change');
    expect(answered).not.toContain('Already answered (reference only');
    expect(answered).not.toContain('EVIDENCE-q1');
    expect(answered).not.toContain('EVIDENCE-q2');
  });

  it('does not apply signed-in drafts after the hydrated account changes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady={false}
        submitContextToken="demo|111"
        prefillPacket={prefillPacket}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Waiting for session data');

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000002"
        isResponsesCacheReady
        submitContextToken="demo|111"
        prefillPacket={prefillPacket}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('drops deferred interview drafts when the session context changes before login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken="demo|1"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        submitContextToken="other-session|1"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('drops deferred interview drafts when Worker identity changes on the same route before login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken="demo|111|worker-a|session-a"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady
        responseReadinessContextToken="demo|111|worker-b|session-b|0x0000000000000000000000000000000000000001|true"
        submitContextToken="demo|111|worker-b|session-b"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('keeps suggested questions mounted but read-only when the signed-in account cannot author', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [];
    });
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        sessionConfig={{
          interviewMode: { suggestQuestions: true },
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          workerAuthority: { version: 1, participantScopes: ['storage'] },
          storageProfile: { backend: 'cloudflare', resources: { questions: 'active' } },
        }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );

    await screen.findByText('Suggested new questions (1)');
    expect(screen.getByTestId('mock-create-questions')).toBeVisible();

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000002"
        sessionConfig={{
          interviewMode: { suggestQuestions: true },
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          workerAuthority: { version: 1, participantScopes: ['ai'] },
          storageProfile: { backend: 'cloudflare', resources: { questions: 'active' } },
        }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Suggested new questions (1)' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Suggested new questions (1)', hidden: true }).closest('details'),
    ).not.toBeVisible();
    expect(screen.getByTestId('mock-create-questions')).not.toBeVisible();
  });

  it('keeps group suggestions off unless the session turns them on', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({
      availability: 'available',
      recommendations: [{ groupId: 'ai-optimists', reason: 'They asked for accountability groups.' }],
    });
    let finishMapping: ((value: []) => void) | null = null;
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMapping = resolve;
        }),
    );
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      return {
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop: jest.fn(async () => ({
          transcript: 'Responder: I want AI accountability groups.',
          turns: [{ itemId: 'turn-1', role: 'responder' as const, text: 'I want AI accountability groups.' }],
        })),
        getTranscript: () => 'Responder: I want AI accountability groups.',
      };
    });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('mock-group-recommendations')).not.toBeInTheDocument();

    await act(async () => {
      finishMapping?.([]);
    });
    expect(screen.queryByTestId('mock-group-recommendations')).not.toBeInTheDocument();
    expect(
      mockedUseSessionInterviewGroupRecommendations.mock.calls.every(([options]) => options.active === false),
    ).toBe(true);
  });

  it('suggests groups after a voice interview once its drafts are ready, when the session turns them on', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({
      availability: 'available',
      recommendations: [{ groupId: 'ai-optimists', reason: 'They asked for groups.' }],
    });
    const optimists = {
      groupId: 'ai-optimists',
      label: 'AI optimists',
      tags: [],
      joinMode: 'open' as const,
      memberVisibility: 'session' as const,
      requiresAuthentication: true,
      source: 'public' as const,
    };
    mockedLoadDraftingGroupChoices.mockResolvedValue([optimists]);
    let finishMapping: ((value: Array<{ questionId: string; answer: string }>) => void) | null = null;
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      ({ onGroupPicks }) =>
        new Promise((resolve) => {
          finishMapping = (value) => {
            // The AI that drafts the answers picks groups in the same reply.
            onGroupPicks?.([{ groupId: 'ai-optimists', reason: 'Wants accountability groups.' }]);
            resolve(value);
          };
        }),
    );
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      return {
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop: jest.fn(async () => ({ transcript: 'Responder: I want AI accountability groups.', turns: [] })),
        getTranscript: () => 'Responder: I want AI accountability groups.',
      };
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(1));
    // Nothing is suggested while the drafts are still being prepared.
    expect(screen.queryByTestId('mock-group-recommendations')).not.toBeInTheDocument();
    await act(async () => {
      finishMapping?.([{ questionId: 'q1', answer: 'Accountability groups' }]);
    });
    expect(await screen.findByTestId('mock-group-recommendations')).toBeInTheDocument();
    // The groups offered are those the signed-in account could join.
    expect(mockedLoadDraftingGroupChoices).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'demo', workerUrl: 'https://worker.example', account: baseProps.account }),
    );
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
      expect.objectContaining({ groups: [optimists] }),
    );
    expect(mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        active: true,
        request: expect.objectContaining({
          draftResponses: [expect.objectContaining({ questionId: 'q1', answer: 'Accountability groups' })],
          draftingPicks: [{ groupId: 'ai-optimists', reason: 'Wants accountability groups.' }],
        }),
      }),
    );
    // An edit clears the suggestions; Refresh lists the drafting AI's picks again, without drafting anew.
    await editReadableDraftText('Draft answer for What matters?', 'Groups for accountability');
    const lastRequest = () => mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0].request;
    expect(lastRequest()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh group suggestions' }));
    expect(lastRequest()).toEqual(
      expect.objectContaining({ draftingPicks: [{ groupId: 'ai-optimists', reason: 'Wants accountability groups.' }] }),
    );
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(1);
  });

  it('suggests groups after an AI prefill link, from its drafts', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({
      availability: 'available',
      recommendations: [{ groupId: 'dacc', reason: 'You chose “d/acc”.' }],
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Drafted by the AI', confidence: 0.7 }],
        }}
      />,
    );
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted by the AI');
    expect(await screen.findByTestId('mock-group-recommendations')).toBeInTheDocument();
    expect(mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        active: true,
        request: expect.objectContaining({
          draftResponses: [expect.objectContaining({ questionId: 'q1', answer: 'Drafted by the AI' })],
        }),
      }),
    );
  });

  it('suggests groups from kept answers only, and clears them when an answer is removed', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'available', recommendations: [] });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[
          ...baseProps.questionPool,
          { id: 'q2', prompt: 'Which camp?', type: 'freeform' },
          { id: 'q3', prompt: 'Where do you live?', type: 'freeform' },
        ]}
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
        existingResponseSlice={{ answers: { q3: { value: 'My saved answer' } } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [
            { questionId: 'q1', answer: 'Drafted by the AI', confidence: 0.7 },
            { questionId: 'q2', answer: 'd/acc', confidence: 0.7 },
            { questionId: 'q3', answer: 'Lyon', confidence: 0.7 },
          ],
        }}
      />,
    );
    const lastRequest = () => mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0].request;
    // The draft for an already-saved answer is left out, so it doesn't count.
    await waitFor(() =>
      expect(lastRequest()?.draftResponses.map(({ questionId }) => questionId)).toEqual(['q1', 'q2']),
    );
    expect(screen.queryByText('Where do you live?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Which camp?' }));
    expect(lastRequest()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh group suggestions' }));
    expect(lastRequest()?.draftResponses.map(({ questionId }) => questionId)).toEqual(['q1']);
  });

  it.each([
    [{ joinMatchingGroups: true }, true],
    [{ suggestGroups: true }, false],
    [{}, false],
  ])('with %j, matches groups only when the session joins matching groups', async (interviewMode, joins) => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'loading', recommendations: [] });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={{ interviewMode }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Drafted by the AI', confidence: 0.7 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    // The retired suggestGroups setting matches nothing on its own.
    expect(mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ active: joins }),
    );
    if (joins)
      expect(mockGroupArea.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ availability: 'loading', joinRequest: 0, hidden: false }),
      );
    else expect(mockGroupArea).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toHaveAccessibleName('Submit (1)');
  });

  it.each([true, false])(
    'suggests groups with the person’s saved sign-in only once signed in (%s)',
    async (loginComplete) => {
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          loginComplete={loginComplete}
          sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
            responderContext: {},
            responses: [{ questionId: 'q1', answer: 'Drafted by the AI', confidence: 0.7 }],
          }}
        />,
      );
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      expect(mockedUseSessionInterviewGroupRecommendations.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ account: loginComplete ? baseProps.account : '' }),
      );
    },
  );

  it('keeps the Groups section, and its ticks, through another interview round', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'available', recommendations: [] });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'Spoken answer' }]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Drafted by the AI', confidence: 0.7 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    const area = () => mockGroupArea.mock.calls.at(-1)?.[0];
    expect(area()).toEqual(expect.objectContaining({ hidden: false }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    expect(area()).toEqual(expect.objectContaining({ hidden: true }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    await waitFor(() => expect(area()).toEqual(expect.objectContaining({ hidden: false })));
    // Hidden, never unmounted, so what the person ticked survives the round.
    expect(mockGroupAreaMounts).toHaveBeenCalledTimes(1);
  });

  it('says Submit and join while a group is ticked, and joins the ticked groups once submitted', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'available', recommendations: [] });
    const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'submitted' });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        isResponsesCacheReady
        onSubmitResponses={onSubmitResponses}
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          responderContext: { summary: 'My own context' },
          source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
          responses: [{ questionId: 'q1', answer: 'A reviewed answer', confidence: 0.8 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    const area = () => mockGroupArea.mock.calls.at(-1)?.[0];
    const submit = () => screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY);
    expect(submit()).toHaveAccessibleName('Submit (1)');
    act(() => area().onTickedChange(true));
    expect(submit()).toHaveAccessibleName('Submit and join (1)');
    expect(submit().querySelector('.pileSubmitButtonCount')).toHaveTextContent(/^1$/);
    act(() => area().onTickedChange(false));
    expect(submit()).toHaveAccessibleName('Submit (1)');
    act(() => area().onTickedChange(true));
    expect(area().joinRequest).toBe(0);

    fireEvent.click(submit());
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    // Groups join only after the answers are saved.
    await waitFor(() => expect(area().joinRequest).toBeGreaterThan(0));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('says Submitting in the status, and Saving on the button with its seconds, seen but not read out', async () => {
    jest.useFakeTimers();
    try {
      let finish!: (value: unknown) => void;
      const onSubmitResponses = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          isResponsesCacheReady
          onSubmitResponses={onSubmitResponses}
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            responderContext: { summary: 'My own context' },
            source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
            responses: [{ questionId: 'q1', answer: 'A reviewed answer', confidence: 0.8 }],
          }}
        />,
      );
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      // As every Submit reads while it runs.
      const button = screen.getByRole('button', { name: 'Saving' });
      const statusRegion = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS);
      expect(button).toHaveTextContent('Saving · 0s');
      expect(within(button).getByText('· 0s')).toHaveAttribute('aria-hidden', 'true');
      // The time is on the button only, so a phone's header keeps the word whole.
      expect(screen.getByRole('button', { name: 'Interview status: Submitting' })).toHaveTextContent(/^Submitting$/);
      expect(statusRegion.nextElementSibling).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      expect(button).toHaveTextContent('Saving · 2s');
      expect(statusRegion.nextElementSibling).toBeNull();
      await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
      await act(async () => finish({ status: 'submitted' }));
      expect(await screen.findByRole('button', { name: 'Responses submitted' })).not.toHaveTextContent(/\ds/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks the Groups area to join nothing when a submit fails', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({ availability: 'available', recommendations: [] });
    const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'failed', message: 'Storage unavailable' });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        isResponsesCacheReady
        onSubmitResponses={onSubmitResponses}
        sessionConfig={{ interviewMode: { joinMatchingGroups: true } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          responderContext: { summary: 'My own context' },
          source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
          responses: [{ questionId: 'q1', answer: 'A reviewed answer', confidence: 0.8 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    act(() => mockGroupArea.mock.calls.at(-1)?.[0].onTickedChange(true));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(await screen.findByText('Storage unavailable')).toBeInTheDocument();
    expect(mockGroupArea.mock.calls.at(-1)?.[0].joinRequest).toBe(0);
  });

  it('offers the two large requested voice-mode choices, with the AI-prefill option below them', async () => {
    render(<SessionVoiceModeModal {...baseProps} />);
    // Each choice shows its icon and title, and screen readers hear its description with it.
    const interviewAbout = 'Talk with an AI interviewer to answer the session’s questions, then review your responses.';
    const groupAbout = 'Record a group discussion and generate questions and context from it.';
    const interview = screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW);
    expect(interview).toHaveTextContent(/^Interview$/);
    expect(interview).toHaveAccessibleDescription(interviewAbout);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_GROUP)).toHaveAccessibleDescription(groupAbout);
    // One "?" beside the "Voice mode" title explains both, each under its name; the choices carry none of their own.
    const chooser = screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER);
    expect(within(chooser).queryByRole('button', { name: /^About / })).not.toBeInTheDocument();
    const help = screen.getByRole('button', { name: 'About voice mode' });
    expect(help.closest('.modal-header')).toHaveTextContent('Voice mode');
    fireEvent.click(help);
    expect(baseProps.onSelectMode).not.toHaveBeenCalled();
    fireEvent.mouseOver(help);
    const tip = await screen.findByRole('tooltip');
    expect([...tip.querySelectorAll('strong')].map((name) => name.textContent)).toEqual([
      'Interview',
      'Group Conversation',
    ]);
    expect(tip).toHaveTextContent(`Interview ${interviewAbout}Group Conversation ${groupAbout}`);
    fireEvent.mouseOut(help);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    fireEvent.focus(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(groupAbout);
    fireEvent.blur(help);
    expect(help).toHaveAccessibleDescription(`Interview ${interviewAbout} Group Conversation ${groupAbout}`);
    const prefill = screen.getByRole('region', { name: 'Have AI draft your answers' });
    // Its description is only read out with its "?", not shown as text.
    const prefillAbout =
      'Your AI drafts answers from what it knows about you, and you review them here before anything is submitted.';
    expect(within(prefill).getByText(prefillAbout)).not.toBeVisible();
    expect(
      within(prefill).getByRole('button', { name: 'About having AI draft your answers' }),
    ).toHaveAccessibleDescription(prefillAbout);
    expect(prefill).toHaveAttribute('data-testid', E2E_TESTIDS.SESSION_VOICE_PREFILL);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER)).not.toContainElement(prefill);
    expect(
      screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_GROUP).compareDocumentPosition(prefill) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(prefill).getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_GROUP));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('recordGroup');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('finds the session Worker for the AI-prefill card once, even as the page re-renders', async () => {
    let resolveWorker: (url: string) => void = () => {};
    jest.mocked(getCorsProxyUrlOrThrow).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWorker = resolve;
        }),
    );
    const props = { ...baseProps, workerUrl: undefined };
    const view = render(<SessionVoiceModeModal {...props} context={{ account: '0xabc' }} />);
    // The page passes a new context object on every render; the lookup isn't restarted.
    view.rerender(<SessionVoiceModeModal {...props} context={{ account: '0xabc' }} />);
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL)).not.toBeInTheDocument();
    await act(async () => resolveWorker('https://worker.example'));
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL)).toBeInTheDocument();
  });

  it('leaves the AI-prefill card out when the session has no Worker', async () => {
    jest.mocked(getCorsProxyUrlOrThrow).mockRejectedValueOnce(new Error('No session Worker'));
    render(<SessionVoiceModeModal {...baseProps} workerUrl={undefined} />);
    await act(async () => {});
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL)).not.toBeInTheDocument();
  });

  it('offers the AI-prefill prompt on Interview too, until the interview has something to review', async () => {
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).toBeInTheDocument();
    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1 as const,
          sessionSlug: 'demo',
          source: { platform: 'other' as const, modelId: 'unknown', verification: 'self_reported' as const },
          responderContext: { summary: 'Synthetic context' },
        }}
      />,
    );
    await waitFor(() => expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL)).not.toBeInTheDocument());
  });

  it('opens Group Conversation with its input guidance in a title tooltip', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    expect(screen.getByTestId('mock-group-listening')).toHaveAttribute('data-mode', 'recordGroup');
    expect(screen.getByTestId('mock-group-listening')).toHaveAttribute('data-embedded', 'true');
    const help = screen.getByRole('button', { name: 'About Group Conversation' });
    expect(help).toHaveAccessibleDescription('Record, upload audio, or add a transcript.');
    fireEvent.focus(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Record, upload audio, or add a transcript.');
  });

  it('stops audio on close while retaining the transcript for continuing the interview', async () => {
    const stop = jest.fn(async () => ({ transcript: 'Responder: Synthetic retained answer.', turns: [] }));
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      options.onTranscript?.('Responder: Synthetic retained answer.', []);
      return {
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop,
        getTranscript: () => 'Responder: Synthetic retained answer.',
      };
    });
    const onInterviewProgressChange = jest.fn();
    const props = { ...baseProps, mode: 'interview' as const, onInterviewProgressChange };
    const view = render(<SessionVoiceModeModal {...props} />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    await waitFor(() => expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    view.rerender(<SessionVoiceModeModal {...props} isOpen={false} />);
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true);
    view.rerender(<SessionVoiceModeModal {...props} />);
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveTextContent('Continue interview');
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('prevents duplicate realtime sessions and stops a late connection after the modal closes', async () => {
    const stop = jest.fn(async () => ({ transcript: '', turns: [] }));
    let resolveSession: ((session: Awaited<ReturnType<typeof startSessionRealtimeInterview>>) => void) | null = null;
    mockedStartSessionRealtimeInterview.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const start = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START);

    fireEvent.click(start);
    fireEvent.click(start);

    await waitFor(() => expect(mockedStartSessionRealtimeInterview).toHaveBeenCalledTimes(1));
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Connecting…');
    expect(screen.getByRole('button', { name: 'Interview status: Connecting' })).toHaveFocus();
    fireEvent.keyUp(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS), {
      key: 'Escape',
      keyCode: 27,
      which: 27,
    });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);

    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    await act(async () => {
      resolveSession?.({
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop,
        getTranscript: () => '',
      });
      await Promise.resolve();
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('validates on mount and writes in the first click stack after validation', async () => {
    let resolveCatalog: (response: Response) => void = () => {};
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    );
    try {
      render(<SessionVoiceModeModal {...baseProps} />);
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByText('Loading the session’s questions…')).toBeInTheDocument();
      const copy = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
      fireEvent.click(copy);
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      await act(async () =>
        resolveCatalog(
          new Response(
            JSON.stringify({
              type: 'context-engine.interview-question-catalog',
              version: 1,
              sessionSlug: 'demo',
              prefillPromptVersion: 'ce-interview-brief-v4',
              questionSetHash: 'f'.repeat(64),
              questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
            }),
          ),
        ),
      );
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      let inClick = false;
      jest.mocked(navigator.clipboard.writeText).mockImplementation(() => {
        expect(inClick).toBe(true);
        return Promise.resolve();
      });
      inClick = true;
      fireEvent.click(copy);
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      inClick = false;
      await screen.findByRole('button', { name: 'Copied' });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it.each(['rejected', 'unavailable'])('shows the prompt selected when the clipboard is %s', async (failure) => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: 'demo',
          prefillPromptVersion: 'ce-interview-brief-v5',
          questionSetHash: 'f'.repeat(64),
          questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
        }),
      ),
    );
    if (failure === 'rejected')
      jest.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('NotAllowedError'));
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    try {
      render(<SessionVoiceModeModal {...baseProps} />);
      await act(async () => {});
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Copying isn’t allowed here, so the prompt below is selected. Copy it yourself.',
      );
      // The exact prompt, links whole: the formatted view shortens them.
      const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'AI prompt to copy' });
      expect(field.value).toContain('https://');
      expect(field.value).toContain('Context Engine');
      expect(document.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
      expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('says to tap again when Copy is tapped while the session is checked', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(() => undefined));
    try {
      render(<SessionVoiceModeModal {...baseProps} />);
      await act(async () => {});
      expect(screen.getByText('Loading the session’s questions…')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
      expect(
        screen.getByText('Loading the session’s questions. Tap Copy again when this finishes.'),
      ).toBeInTheDocument();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('copies with the older copy command where the clipboard is missing', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: 'demo',
          prefillPromptVersion: 'ce-interview-brief-v5',
          questionSetHash: 'f'.repeat(64),
          questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
        }),
      ),
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const copied: string[] = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => copied.push((document.activeElement as HTMLTextAreaElement).value) > 0,
    });
    try {
      render(<SessionVoiceModeModal {...baseProps} />);
      await act(async () => {});
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
      expect(copied).toHaveLength(1);
      expect(copied[0]).toContain('Context Engine');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
      fetchMock.mockRestore();
    }
  });

  it('refuses to copy or show a kickoff for an unsupported Worker catalog', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'context-engine.interview-question-catalog',
        version: 1,
        sessionSlug: 'demo',
        prefillPromptVersion: 'ce-interview-brief-v9',
        questionSetHash: 'f'.repeat(64),
        questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
      }),
    } as Response);
    try {
      render(<SessionVoiceModeModal {...baseProps} />);
      await act(async () => {});
      await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)));
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('ask the organizer');
      await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE)));
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('retries a failed compatibility check and rechecks when the session changes', async () => {
    const catalog = (slug: string) =>
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: slug,
          prefillPromptVersion: 'ce-interview-brief-v5',
          questionSetHash: 'f'.repeat(64),
          questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
        }),
      );
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog('demo'));
    const view = render(<SessionVoiceModeModal {...baseProps} />);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).toHaveAttribute(
        'aria-disabled',
        'false',
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).toBeVisible();
    let resolveCatalog: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    );
    view.rerender(<SessionVoiceModeModal {...baseProps} sessionSlug="next" />);
    expect(screen.getByText('Loading the session’s questions…')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    await act(async () => resolveCatalog(catalog('next')));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it('copies the AI prompt from one split button, whose caret opens it to read with stand-ins for its values', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'context-engine.interview-question-catalog',
        version: 1,
        sessionSlug: 'demo',
        prefillPromptVersion: 'ce-interview-brief-v4',
        questionSetHash: 'f'.repeat(64),
        questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
      }),
    } as Response);
    render(<SessionVoiceModeModal {...baseProps} />);

    expect(screen.queryByText(/A realtime voice interviewer will cover/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).not.toBeInTheDocument();
    const copyButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    // Until the session's questions are read the button says so, turns and can't be pressed.
    expect(copyButton).toHaveAccessibleName('Loading questions…');
    expect(copyButton).toHaveAttribute('aria-disabled', 'true');
    expect(copyButton.querySelector('[data-icon="spinner"]')).toBeInTheDocument();
    const promptToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE);
    expect(promptToggle).toHaveAccessibleName('Read the AI prompt');
    expect(promptToggle.querySelector('[data-icon="caret-down"]')).toBeInTheDocument();
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    // One button, said once: no second "Prompt" control and no sentence about where to paste.
    expect(screen.queryByRole('button', { name: 'Prompt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/paste this prompt into ChatGPT or Claude/)).not.toBeInTheDocument();

    await waitFor(() => expect(copyButton).toHaveAttribute('aria-disabled', 'false'));
    expect(copyButton.querySelector('[data-icon="copy"]')).toBeInTheDocument();
    await act(async () => fireEvent.click(copyButton));
    const plainPrompt = buildExternalInterviewKickoff({
      questionPriority: { unansweredQuestionIds: ['q1'], answeredQuestionIds: [] },
      // The session's question list, as the card read it before the button could be pressed.
      catalog: {
        sessionSlug: 'demo',
        prefillPromptVersion: 'ce-interview-brief-v4',
        questionSetHash: 'f'.repeat(64),
        questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
      },
      workerUrl: baseProps.workerUrl,
      sessionSlug: baseProps.sessionSlug,
      sessionUrl: `${window.location.origin}${window.location.pathname}`,
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(plainPrompt);
    expect(copyButton).toHaveAccessibleName('Copied');
    expect(copyButton.querySelector('[data-icon="check"]')).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('Hide the AI prompt');
    expect(promptToggle.querySelector('[data-icon="caret-up"]')).toBeInTheDocument();
    expect(promptToggle).toHaveAttribute('aria-expanded', 'true');
    const displayedPrompt = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
    expect(promptToggle).toHaveAttribute('aria-controls', displayedPrompt.id);
    expect(displayedPrompt).toHaveTextContent(/^AI Prompt/);
    // Each value the prompt carries shows as a named stand-in, listed first and again in its place.
    expect(displayedPrompt).toHaveTextContent(
      'Variables: <QuestionsAddress>, <QuestionSetHash>, <QuestionIds>, <ReviewLink>',
    );
    expect(displayedPrompt).toHaveTextContent('never a summary: <QuestionsAddress>');
    expect(displayedPrompt).toHaveTextContent('Question ids: <QuestionIds>');
    expect(displayedPrompt).not.toHaveTextContent('worker.example');
    expect(displayedPrompt).toHaveTextContent('Help me draft my answers for a Context Engine session.');
    // Reading it copies nothing; its corner button copies the whole prompt, values included.
    fireEvent.click(displayedPrompt);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(within(displayedPrompt).getByRole('button', { name: /AI prompt/ })));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(plainPrompt);
    expect(plainPrompt).toContain('{"version":1,"sessionSlug":');

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('Read the AI prompt');
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    fetchMock.mockRestore();
  });

  it('keeps only bounded source and auto-join query state in the copied kickoff return URL', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'context-engine.interview-question-catalog',
        version: 1,
        sessionSlug: 'demo',
        prefillPromptVersion: 'ce-interview-brief-v5',
        questionSetHash: 'f'.repeat(64),
        questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
      }),
    } as Response);
    const priorUrl = window.location.href;
    try {
      window.history.replaceState(
        {},
        '',
        '/session/demo?src=partner launch&joinGroup=EDDY-2026&agentToken=private#prefill=hidden',
      );
      render(<SessionVoiceModeModal {...baseProps} />);

      await act(async () => {});
      await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)));

      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
      const prompt = String(jest.mocked(navigator.clipboard.writeText).mock.calls.at(-1)?.[0] || '');
      expect(prompt).toContain(
        `sessionUrl=${encodeURIComponent(`${window.location.origin}/session/demo?src=partner-launch&joinGroup=eddy-2026`)}`,
      );
      expect(prompt).not.toContain('agentToken');
      expect(prompt).not.toContain('prefill=hidden');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
    fetchMock.mockRestore();
  });

  it('shows a collapsed responder transcript disclosure after the voice interview ends', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'A relevant answer' }]);
    let interviewOptions: Parameters<typeof startSessionRealtimeInterview>[0] | null = null;
    let resolveStop: (() => void) | null = null;
    const stop = jest.fn(
      () =>
        new Promise<{
          transcript: string;
          turns: Array<{ itemId: string; text: string; role: 'responder' }>;
        }>((resolve) => {
          resolveStop = () =>
            resolve({
              transcript: 'Responder: Reversible decisions matter.',
              turns: [{ itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' }],
            });
        }),
    );
    const pause = jest.fn(() => {
      interviewOptions?.onRecordingState?.('paused');
      interviewOptions?.onStatus?.('Paused');
    });
    const resume = jest.fn(() => {
      interviewOptions?.onRecordingState?.('recording');
      interviewOptions?.onStatus?.('Listening');
    });
    const mediaStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      interviewOptions = options;
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      options.onTranscript?.('Responder: Reversible decisions matter.', [
        { itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' },
      ]);
      return {
        mediaStream,
        pause,
        resume,
        stop,
        getTranscript: () => 'Responder: Reversible decisions matter.',
      };
    });

    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Listening',
    );
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Pause interview')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Pause interview'));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Paused');
    fireEvent.click(screen.getByLabelText('Resume interview'));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Listening',
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Pause interview')).toBeDisabled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ending');
    await act(async () => {
      resolveStop?.();
      await Promise.resolve();
    });
    const toggle = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE);
    const startControl = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START);
    expect(startControl.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Right of Discard in the row under the microphone.
    expect(toggle.closest('.sessionInterviewMicRow')?.lastElementChild).toContainElement(toggle);
    expect(toggle).toHaveTextContent(/^Transcript·\d+ words$/);
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Include self-reported AI platform/)).not.toBeInTheDocument();
    // Sharing for research starts on, so its metadata is there to read.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeChecked();
    expect(screen.getByRole('group', { name: 'AI research metadata' })).toBeInTheDocument();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Pause interview')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('4 words');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const transcriptContent = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT);
    expect(transcriptContent).toHaveTextContent('Responder: Reversible decisions matter.');
    await waitFor(() =>
      expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'Responder: Reversible decisions matter.' }),
      ),
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.any(Array),
        null,
        null,
        false,
        true,
        '',
        expect.any(Array),
        { includeResponderName: false },
      ),
    );
  });

  it.each(['ce-interview-brief-v4', 'ce-interview-brief-v5'])(
    'submits unedited multi-select and single-select drafts using their catalog settings (%s)',
    async (promptVersion) => {
      const questionPool = [
        { id: 'multi', prompt: 'Pick topics', type: 'multichoice', options: ['Parks', 'Transit'], singleSelect: false },
        {
          id: 'single',
          prompt: 'Pick a priority',
          type: 'multichoice',
          options: ['Parks', 'Transit'],
          singleSelect: true,
        },
      ];
      const prefillPacket = {
        version: 1 as const,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion,
        source: { platform: 'claude' as const, modelId: 'example', verification: 'self_reported' as const },
        responderContext: {},
        responses: [
          { questionId: 'multi', answer: ['Parks', 'Transit'], confidence: 0.8 },
          { questionId: 'single', answer: 'Transit', confidence: 0.8 },
        ],
      };
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          questionPool={questionPool}
          prefillPacket={prefillPacket}
        />,
      );
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      expect(screen.getAllByRole('checkbox', { name: 'Transit' })).toHaveLength(2);
      expect(
        screen
          .getAllByRole('checkbox', { name: 'Transit' })
          .every((checkbox) => (checkbox as HTMLInputElement).checked),
      ).toBe(true);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('multi', ['Parks', 'Transit']));
      expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('single', 'Transit');
      await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledWith(['multi', 'single']));
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
    },
  );

  it('maps imported context into reviewable drafts and says when one changes an existing answer', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        existingResponseSlice={{
          answers: { q1: { value: 'Existing local draft' } },
          additionalComments: { q1: { value: 'Existing explanation' } },
        }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).toHaveValue('Relevant context');
    expect(screen.getByText('Changes your earlier answer: Existing local draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace with draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove draft for What matters?' })).toBeEnabled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeEnabled();

    await editReadableDraftText('Draft answer for What matters?', 'Reviewed answer');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed answer'));
    // The AI proposed no comment and none was edited, so the existing comment is left as it is.
    expect(baseProps.onApplyAdditional).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1', answer: 'Original prediction' })]),
        prefillPacket.source,
        prefillPacket,
        true,
        true,
        '',
        expect.any(Array),
        { includeResponderName: false },
      ),
    );
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('treats a masked comment as locked instead of showing or re-sending "*"', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', confidence: 0.81 },
    ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
        existingResponseSlice={{
          answers: { q1: { value: 'Existing answer' } },
          additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: '{"v":1}' } },
        }}
      />,
    );

    const review = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(within(review).queryByText('*')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Original prediction'));
    expect(baseProps.onApplyAdditional).not.toHaveBeenCalled();
  });

  it.each(['submitted', 'already-saved'])(
    'shows confirmed %s success before offering results navigation and clears it on edit',
    async (submitStatus) => {
      baseProps.onSubmitResponses.mockResolvedValue({ status: submitStatus });
      jest.useFakeTimers();
      mockedMapInterviewEvidenceToResponses.mockResolvedValue([
        { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
      ]);
      const onViewResults = jest.fn();
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          onViewResults={onViewResults}
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            questionSetHash: 'a'.repeat(64),
            promptVersion: 'ce-interview-brief-v1',
            source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
            responderContext: { summary: 'Relevant context' },
          }}
        />,
      );

      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledTimes(1));

      const submitButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY);
      expect(baseProps.onSubmitResponses).toHaveBeenCalledWith(['q1']);
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(
        submitStatus === 'already-saved' ? 'Responses already saved' : 'Responses submitted',
      );
      expect(submitButton).toHaveTextContent('Responses submitted');
      expect(submitButton.querySelector('[data-icon="check"]')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS)).not.toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(4999);
      });
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS)).not.toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS));
      expect(onViewResults).toHaveBeenCalledTimes(1);

      await editReadableDraftText('Draft answer for What matters?', 'Edited after submit');
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toHaveAccessibleName('Submit (1)');
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS)).not.toBeInTheDocument();
    },
  );

  it('keeps the confirmed success button disabled when no results navigation handler exists', async () => {
    jest.useFakeTimers();
    try {
      mockedMapInterviewEvidenceToResponses.mockResolvedValue([
        { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
      ]);
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            questionSetHash: 'a'.repeat(64),
            promptVersion: 'ce-interview-brief-v1',
            source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
            responderContext: { summary: 'Relevant context' },
          }}
        />,
      );

      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
      await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledTimes(1));

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      const submitButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY);
      expect(submitButton).toHaveTextContent('Responses submitted');
      expect(submitButton).toBeDisabled();
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([true, false])(
    'offers group refresh after edits only while group matching is on (%s)',
    async (joinMatchingGroups) => {
      mockedUseSessionInterviewGroupRecommendations.mockReturnValue({
        availability: 'available',
        recommendations: [],
      });
      mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'Draft answer' }]);
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          sessionConfig={{ interviewMode: { joinMatchingGroups } }}
          prefillPacket={{
            version: 1,
            sessionSlug: 'demo',
            questionSetHash: 'a'.repeat(64),
            promptVersion: 'ce-interview-brief-v1',
            source: { platform: 'other', modelId: 'fixture', verification: 'self_reported' },
            responderContext: { summary: 'Relevant context' },
          }}
        />,
      );

      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      expect(screen.queryByRole('button', { name: 'Refresh group suggestions' })).not.toBeInTheDocument();
      await editReadableDraftText('Draft answer for What matters?', 'Edited answer');
      // An edit clears the suggestions until the person asks for fresh ones.
      expect(screen.queryAllByRole('button', { name: 'Refresh group suggestions' })).toHaveLength(
        joinMatchingGroups ? 1 : 0,
      );
    },
  );

  it('hides manual group refresh after edits when the session has no configured groups', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue({
      availability: 'empty',
      recommendations: [],
    });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'Draft answer' }]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'other', modelId: 'fixture', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
      />,
    );

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    await editReadableDraftText('Draft answer for What matters?', 'Edited answer');
    expect(screen.queryByRole('button', { name: 'Refresh group suggestions' })).not.toBeInTheDocument();
  });

  it('reviews agent-authored predictions with confidence without remapping or misattributing them', async () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v3',
      source: {
        platform: 'claude' as const,
        modelId: 'claude-example',
        verification: 'self_reported' as const,
        researchCoverage: {
          historyChatsSearched: null,
          historyChatsUsed: 8,
          memoryItemsSearched: 20,
          memoryItemsUsed: 4,
          connectedSourcesSearched: 3,
          connectedSourcesUsed: 1,
          userStatementsUsed: 15,
          searchScopeNote: 'Chat search did not expose a total scanned count.',
        },
      },
      responderContext: { summary: 'A tentative related signal.' },
      responses: [
        {
          questionId: 'q1',
          answer: 'A cautious prediction',
          confidence: 0.22,
          evidence: 'A related but indirect statement in authorized conversation history.',
        },
      ],
    };
    try {
      render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

      expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
    const panel = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PANEL);
    // Research coverage shows once, in the AI submission info's metadata, not again under the responses.
    expect(screen.queryByText('Self-reported agent research coverage')).not.toBeInTheDocument();
    const footer = screen.getByRole('group', { name: 'Response submission' });
    expect(footer).toContainElement(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(panel.lastElementChild).toBe(footer);
    const responderContext = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT);
    expect(responderContext).toHaveValue('A tentative related signal.');
    expect(responderContext.closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).not.toBeInTheDocument();
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    expect(metadata).toHaveTextContent('History chats: 8 used');
    expect(metadata).toHaveTextContent('Memories: 4 used / 20 searched');
    expect(metadata).toHaveTextContent('Connected sources: 1 used / 3 searched');
    expect(metadata).toHaveTextContent('15 user statements used');
    expect(metadata).toHaveTextContent('Chat search did not expose a total scanned count.');
    await expectReadableDraftText('Draft answer for What matters?', 'A cautious prediction');
    expect(screen.queryByLabelText('AI-estimated confidence: 22%')).not.toBeInTheDocument();
    expect(screen.queryByText(/Weak inference/)).not.toBeInTheDocument();
    expect(screen.queryByText(/related but indirect statement/i)).not.toBeInTheDocument();
    const basisToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(basisToggle);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('AI-estimated confidence: 22%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'AI-estimated confidence for What matters?' })).toHaveAttribute(
      'aria-valuenow',
      '22',
    );
    expect(screen.getByText('22% AI-estimated confidence')).toBeInTheDocument();

    expect(screen.getByText('AI-estimated support: Weak inference')).toBeInTheDocument();
    expect(screen.getByText(/related but indirect statement/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        [expect.objectContaining({ questionId: 'q1', confidence: 0.22 })],
        prefillPacket.source,
        prefillPacket,
        true,
        true,
        '',
        expect.any(Array),
        { includeResponderName: false },
      ),
    );
  });

  it('starts the realtime interviewer with validated prefill predictions and current review edits', async () => {
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: '', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => '',
      };
    });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: {
        facts: [{ fact: 'The responder prefers reversible decisions.', relatedQuestionIds: ['q1', 'unknown'] }],
      },
      responses: [
        {
          questionId: 'q1',
          answer: 'Predicted answer from memory',
          additionalComments: 'Predicted comment',
          confidence: 0.61,
          evidence: 'Related prior signal.',
        },
        { questionId: 'unknown', answer: 'Unknown question answer', confidence: 0.99 },
      ],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    await expectReadableDraftText('Draft answer for What matters?', 'Predicted answer from memory');
    // A prefill link opens on its drafts, with a status line, and the interview asks about the rest.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).toHaveTextContent(
      'Your AI drafted 1 answer',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Add more by voice');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeEnabled();
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed correction before speaking');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));

    await waitFor(() => expect(mockedStartSessionRealtimeInterview).toHaveBeenCalled());
    const instructions = mockedStartSessionRealtimeInterview.mock.calls[0][0].instructions;
    expect(instructions).toContain('Imported AI prefill and current review state');
    expect(instructions).toContain('untrusted unconfirmed AI predictions');
    expect(instructions).toContain('The responder prefers reversible decisions.');
    expect(instructions).toContain('Predicted answer from memory');
    expect(instructions).toContain('Reviewed correction before speaking');
    expect(instructions).toContain('Related prior signal.');
    expect(instructions).not.toContain('Unknown question answer');
    expect(instructions).not.toContain('claude-example');
  });

  it('notes how many answers any AI prefill drafted, naming only a known platform', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      source: { platform: 'other' as const, modelId: 'other-model', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'Drafted by another AI', confidence: 0.5 }],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);
    await expectReadableDraftText('Draft answer for What matters?', 'Drafted by another AI');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS)).toHaveTextContent(
      /^Your AI drafted 1 answer$/,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Add more by voice');
  });

  it('sends only the reviewed responder context to the interviewer and the draft mapper', async () => {
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onRecordingState?.('recording');
      options.onTranscript?.('Responder: I mostly care about local policy.', []);
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: 'Responder: I mostly care about local policy.', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => '',
      };
    });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v5',
          source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
          responderContext: {
            name: 'Fixture Person',
            facts: [
              { fact: 'Works on local policy', evidence: 'stated', relatedQuestionIds: ['q1'] },
              { fact: 'Removed private detail', evidence: 'inferred', relatedQuestionIds: ['q1'] },
            ],
          },
          responses: [{ questionId: 'q1', answer: 'Local policy', confidence: 0.8 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT), {
      target: { value: 'Works on local policy' },
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    const instructions = mockedStartSessionRealtimeInterview.mock.calls[0][0].instructions;
    expect(instructions).toContain('Works on local policy');
    expect(instructions).not.toContain('Removed private detail');
    expect(instructions).not.toContain('Fixture Person');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalled());
    const { prefillPacket } = mockedMapInterviewEvidenceToResponses.mock.calls[0][0];
    expect(prefillPacket?.responderContext).toEqual({ summary: 'Works on local policy' });
  });

  it('offers drafts for a later round whose connection dropped after earlier drafts exist', async () => {
    const rounds: Array<Parameters<typeof startSessionRealtimeInterview>[0]> = [];
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      rounds.push(options);
      const text = `Responder: Round ${rounds.length} answer.`;
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
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Round 1 draft', confidence: 0.8 },
    ]);
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    await act(async () => {
      rounds[1].onError?.(new Error('Interview connection lost. Generate drafts from the captured transcript.'));
      rounds[1].onRecordingState?.('stopped');
    });

    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(2));
    expect(mockedMapInterviewEvidenceToResponses.mock.calls[1][0].transcript).toContain('Round 2 answer.');
    await waitFor(() => expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument());
  });

  it('uses the pile-view Agree, Unsure, and Disagree control for binary drafts', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q-binary', answer: 'Agree', confidence: 0.65 }],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[{ id: 'q-binary', prompt: 'Proceed?', type: 'binary' }]}
        prefillPacket={prefillPacket}
      />,
    );

    expect(await screen.findByLabelText('Agree')).toBeChecked();
    expect(screen.getByLabelText('Unsure')).not.toBeChecked();
    expect(screen.getByLabelText('Disagree')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Unsure'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q-binary', 'Unsure'));
  });

  it('reviews and submits predicted quadratic votes as an array while retaining the original prediction', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'other' as const, modelId: 'fixture', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q-quadratic', answer: [3, -4], confidence: 0.65 }],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[
          {
            id: 'q-quadratic',
            prompt: 'Allocate project support',
            type: 'quadratic',
            options: ['Parks', 'Transit'],
            voiceCredits: 25,
          },
        ]}
        prefillPacket={prefillPacket}
      />,
    );

    expect(await screen.findByRole('slider', { name: 'Parks' })).toHaveValue('3');
    expect(screen.getByRole('slider', { name: 'Transit' })).toHaveValue('-4');
    fireEvent.change(screen.getByRole('slider', { name: 'Transit' }), { target: { value: '-2' } });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q-quadratic', [3, -2]));
    expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
      expect.any(Array),
      prefillPacket.source,
      prefillPacket,
      true,
      true,
      '',
      [
        expect.objectContaining({
          answer: [3, -2],
          userEditedFields: ['answer'],
          original: expect.objectContaining({ answer: [3, -4] }),
        }),
      ],
      { includeResponderName: false },
    );
  });

  it('removes the entire card and hides the empty review after removing the last draft', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'Draft answer', confidence: 0.7 }],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    const remove = await screen.findByRole('button', { name: 'Remove draft for What matters?' });
    expect(remove).toBeEnabled();
    fireEvent.click(remove);
    expect(remove).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByText('What matters?')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Restore draft' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('explains when the evidence is insufficient and does not offer a futile retry', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
          responderContext: { summary: 'A brief unrelated note.' },
        }}
      />,
    );

    const notice = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE);
    expect(notice).toHaveTextContent('Not enough information to generate response drafts.');
    expect(notice).not.toHaveTextContent('did not contain enough directly relevant detail');
    expect(notice).not.toHaveTextContent('Start another interview and share more detail');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ready');

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT), {
      target: { value: 'Detailed evidence directly related to the question.' },
    });
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).toBeInTheDocument();
  });

  it('starts prediction comparison on by default and records each consent independently', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Draft answer', confidence: 0.76 },
    ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    const includeComparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
    expect(includeComparison).toBeChecked();
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    expect(metadata).toHaveTextContent('Platform');
    expect(metadata).toHaveTextContent('Claude');
    expect(metadata).toHaveTextContent('Question set');
    expect(metadata).not.toHaveTextContent('will not be included');
    expect(metadata).toHaveTextContent('1 selected draft:');
    // Unticked, the comparison leaves the metadata; ticked again, it is the participant's own choice.
    fireEvent.click(includeComparison);
    expect(metadata).not.toHaveTextContent('1 selected draft:');
    fireEvent.click(includeComparison);
    expect(metadata).toHaveTextContent('1 selected draft:');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1' })]),
        expect.objectContaining({ platform: 'claude' }),
        expect.any(Object),
        true,
        true,
        '',
        expect.any(Array),
        { includePredictionComparison: true, includeResponderName: false },
      ),
    );
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('never writes an imported name into the answers', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: { name: 'Ada Example' },
      responses: [{ questionId: 'q1', answer: 'Draft answer', confidence: 0.8 }],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.queryByText(/as the responder name/i)).toBeNull();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.any(Array),
        prefillPacket.source,
        prefillPacket,
        true,
        true,
        '',
        expect.any(Array),
        { includeResponderName: false },
      ),
    );
  });

  it('refuses another session’s drafts before calling the mapper', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'another-session',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'These draft answers are for another session. Ask the AI for a link to this one.',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Error');
    expect(mapInterviewEvidenceToResponses).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(mockedStartSessionRealtimeInterview).not.toHaveBeenCalled();
  });

  // The fingerprint in a packet is compared with nothing: a session's questions may change after an AI
  // read them, and each draft is fitted to its question as it is now.
  const olderSetPacket = (responses: Array<{ questionId: string; answer: unknown; confidence: number }>) => ({
    version: 1 as const,
    sessionSlug: 'demo',
    questionSetHash: 'a'.repeat(64),
    promptVersion: 'ce-interview-brief-v5',
    source: { platform: 'claude' as const, modelId: 'example', verification: 'self_reported' as const },
    responderContext: {},
    responses,
  });

  it('applies the drafts that still fit from a link made for an older question set, and counts the rest', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = jest.fn();
    try {
      render(
        <SessionVoiceModeModal
          {...baseProps}
          mode="interview"
          questionPool={[
            { id: 'q1', prompt: 'What matters?', type: 'freeform' },
            // It offered "Roads" when the AI read it.
            {
              id: 'q2',
              prompt: 'Which first?',
              type: 'multichoice',
              options: ['Parks', 'Transit'],
              singleSelect: true,
            },
          ]}
          // More drafts than the session now has questions, and the one that still fits comes last.
          prefillPacket={olderSetPacket([
            { questionId: 'removed', answer: 'For a question that is gone', confidence: 0.8 },
            { questionId: 'q2', answer: 'Roads', confidence: 0.8 },
            { questionId: 'also-removed', answer: 'For another that is gone', confidence: 0.8 },
            { questionId: 'q1', answer: 'Still fits', confidence: 0.8 },
          ])}
        />,
      );
      await expectReadableDraftText('Draft answer for What matters?', 'Still fits');
      expect(screen.getByText(/Left out 3 drafts from your AI/)).toHaveTextContent(
        'Left out 3 drafts from your AI that don’t fit this session’s questions or their options.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('For a question that is gone')).not.toBeInTheDocument();
      // Nothing is read from the session to decide this.
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('reads the drafts again once a stale cached question set brings a question one of them is for', async () => {
    const fresh = [
      { id: 'q1', prompt: 'What matters?', type: 'freeform' },
      { id: 'q2', prompt: 'Added since the last visit?', type: 'freeform' },
    ];
    const props = {
      ...baseProps,
      mode: 'interview' as const,
      prefillPacket: olderSetPacket([
        { questionId: 'q1', answer: 'First answer', confidence: 0.8 },
        { questionId: 'q2', answer: 'Fresh answer', confidence: 0.8 },
      ]),
    };
    // The pile first shows a cached question set that predates the link.
    const view = render(<SessionVoiceModeModal {...props} questionPool={[fresh[0]]} />);
    await expectReadableDraftText('Draft answer for What matters?', 'First answer');
    expect(screen.getByText(/Left out 1 draft from your AI/)).toBeInTheDocument();

    view.rerender(<SessionVoiceModeModal {...props} questionPool={fresh} />);

    await expectReadableDraftText('Draft answer for Added since the last visit?', 'Fresh answer');
    await expectReadableDraftText('Draft answer for What matters?', 'First answer');
    expect(screen.queryByText(/Left out 1 draft from your AI/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Interview cancellation and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A review an earlier test kept would come back with its prefill, whose drafts put ids in the brief.
    window.localStorage.clear();
    jest
      .mocked(useInterviewReadiness)
      .mockReturnValue({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'New evidence' }]);
  });

  function sessionMock() {
    let options!: Parameters<typeof startSessionRealtimeInterview>[0];
    const stop = jest.fn(async () => ({ transcript: 'Responder: New evidence.', turns: [] }));
    mockedStartSessionRealtimeInterview.mockImplementation(async (value) => {
      options = value;
      value.onStatus?.('Listening');
      value.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop,
        pause: () => {
          value.onStatus?.('Paused');
          value.onRecordingState?.('paused');
        },
        resume: () => {
          value.onStatus?.('Listening');
          value.onRecordingState?.('recording');
        },
        getTranscript: () => 'Responder: New evidence.',
      };
    });
    return { stop, options: () => options };
  }

  it('aborts startup on isOpen=false and ignores callbacks after reopening', async () => {
    let options!: Parameters<typeof startSessionRealtimeInterview>[0];
    let finish!: (session: Awaited<ReturnType<typeof startSessionRealtimeInterview>>) => void;
    mockedStartSessionRealtimeInterview.mockImplementation((value) => {
      options = value;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await waitFor(() => expect(options).toBeDefined());
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    expect(options.signal?.aborted).toBe(true);
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const stop = jest.fn(async () => ({ transcript: 'Old transcript', turns: [] }));
    await act(async () => {
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      options.onTranscript?.('Old transcript', []);
      finish({ mediaStream: {} as MediaStream, stop, pause: jest.fn(), resume: jest.fn(), getTranscript: () => '' });
    });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Ready');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();
    sessionMock();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByLabelText('Pause interview')).toBeInTheDocument();
  });

  it.each([false, true])('stops on close and never starts mapping (paused=%s)', async (paused) => {
    const h = sessionMock();
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    if (paused) fireEvent.click(screen.getByLabelText('Pause interview'));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    expect(h.options().signal?.aborted).toBe(true);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
  });

  it('stops a paused interview, announces preparing/review, focuses drafts, and never submits', async () => {
    const h = sessionMock();
    let finish!: (drafts: { questionId: string; answer: string }[]) => void;
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    fireEvent.click(await screen.findByLabelText('Pause interview'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Preparing responses…'),
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    act(() => {
      h.options().onStatus?.('Listening');
      h.options().onTranscript?.('Stale evidence', []);
    });
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Preparing responses…');
    // The app's spinner shows while it works, beside the words that are read out.
    const pill = screen.getByRole('button', { name: 'Interview status: Preparing responses…' });
    expect(pill).toHaveAttribute('data-tone', 'busy');
    expect(pill.querySelector('svg.fa-spinner.fa-spin')).toHaveAttribute('aria-hidden', 'true');
    // How long drafting has run shows beside the status, outside what is read out.
    const statusRegion = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS);
    expect(statusRegion).not.toHaveTextContent('0:00');
    expect(statusRegion.nextElementSibling).toHaveTextContent(/^0:00$/);
    expect(statusRegion.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
    await act(async () => finish([{ questionId: 'q1', answer: 'New evidence' }]));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS).querySelector('svg.fa-spinner')).toBeNull();
    expect(statusRegion.nextElementSibling).toBeNull();
    expect(screen.getByRole('heading', { name: 'Review proposed responses' }).closest('summary')).toHaveFocus();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts');
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('ignores stop completion after closing and exposes a retry after failure', async () => {
    const h = sessionMock();
    let finish!: () => void;
    h.stop.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ transcript: 'Responder: Old', turns: [] });
        }),
    );
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    await act(async () => finish());
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
    mockedStartSessionRealtimeInterview.mockRejectedValue(new Error('Allow microphone access and try again.'));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByRole('alert')).toHaveTextContent('Allow microphone access');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeEnabled();
  });

  it('continues a validated prefill when new questions arrive during the interview', async () => {
    sessionMock();
    mockedHashInterviewQuestions.mockResolvedValue('a'.repeat(64));
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      source: { platform: 'other' as const, modelId: 'fixture', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'Imported answer', confidence: 0.8 }],
    };
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);
    await expectReadableDraftText('Draft answer for What matters?', 'Imported answer');
    mockedHashInterviewQuestions.mockResolvedValue('b'.repeat(64));
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q2', answer: 'Newly answered', confidence: 0.8 },
    ]);
    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'New question?', type: 'freeform' }]}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for New question?', 'Newly answered');
    await expectReadableDraftText('Draft answer for What matters?', 'Imported answer');
  });

  it('continues the transcript and preserves edits while keeping removed cards hidden after new predictions', async () => {
    const rounds: Parameters<typeof startSessionRealtimeInterview>[0][] = [];
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      rounds.push(options);
      const text = `Responder: Round ${rounds.length}.`;
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
    mockedMapInterviewEvidenceToResponses
      .mockResolvedValueOnce([
        { questionId: 'q1', answer: 'First answer', confidence: 0.6, importance: 6, conviction: 8 },
        { questionId: 'q2', answer: 'Keep this', confidence: 0.8 },
      ])
      .mockResolvedValueOnce([
        { questionId: 'q1', answer: 'Refined AI answer', confidence: 0.9 },
        { questionId: 'q2', answer: 'Refined removed answer', confidence: 0.9 },
        { questionId: 'q3', answer: 'Additional match', confidence: 0.8 },
      ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[
          ...baseProps.questionPool,
          { id: 'q2', prompt: 'Second question?', type: 'freeform' },
          { id: 'q3', prompt: 'Third question?', type: 'freeform' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await editReadableDraftText('Draft answer for What matters?', 'My edit');
    fireEvent.click(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE)[1]);
    expect(screen.queryByText('Second question?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    expect(rounds[1].instructions).toContain('Responder: Round 1.');
    expect(rounds[1].instructions).toContain('Continue the prior interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for Third question?', 'Additional match');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Continue interview');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses.mock.calls.at(-1)?.[0].previousResponses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prediction: expect.objectContaining({ answer: 'First answer', importance: 60, conviction: 80 }),
          reviewed: expect.objectContaining({ answer: 'My edit' }),
        }),
      ]),
    );
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    expect(screen.queryByText('Second question?')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Restore draft' })).not.toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses.mock.calls.at(-1)?.[0].previousResponses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ prediction: expect.objectContaining({ questionId: 'q2' }), selected: false }),
      ]),
    );
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenLastCalledWith(
      expect.objectContaining({ transcript: 'Responder: Round 1.\n\nResponder: Round 2.' }),
    );
    mockedStartSessionRealtimeInterview.mockImplementationOnce(async (options) => {
      options.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: '', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => '',
      };
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(2);
    mockedStartSessionRealtimeInterview.mockRejectedValueOnce(new Error('Connection failed'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).toHaveTextContent('Responder: Round 1.');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).toHaveTextContent('Responder: Round 2.');
  });

  it('maps new speech instead of reusing imported response predictions', async () => {
    sessionMock();
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q2', answer: 'New evidence' }]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'fixture', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Old prediction', confidence: 0.5 }],
        }}
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'Next?', type: 'freeform' }]}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).not.toBeInTheDocument();
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() =>
      expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'Responder: New evidence.' }),
      ),
    );
    await expectReadableDraftText('Draft answer for Next?', 'New evidence');
    await expectReadableDraftText('Draft answer for What matters?', 'Old prediction');
  });
  it('opens the interview and personal AI prompt with the newest unanswered breakout questions', async () => {
    const props = {
      ...baseProps,
      questionPool: [
        { id: 'q1', prompt: 'Opening question', type: 'freeform', storageRef: { createdAt: '2026-10-28T10:00:00Z' } },
        {
          id: 'q2',
          prompt: 'First breakout question',
          type: 'freeform',
          storageRef: { createdAt: '2026-10-29T10:00:00Z' },
        },
        {
          id: 'q3',
          prompt: 'Newest breakout question',
          type: 'freeform',
          storageRef: { createdAt: '2026-10-29T11:00:00Z' },
        },
      ],
      existingResponseSlice: { answers: { q1: { value: 'Private prior answer' } } },
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: 'demo',
          prefillPromptVersion: 'ce-interview-brief-v6',
          questionSetHash: 'f'.repeat(64),
          questions: ['q1', 'q2', 'q3'].map((id) => ({ id, prompt: `${id}?`, type: 'freeform' })),
        }),
      ),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) },
    });
    const openingHook = require('./useInterviewOpening').useInterviewOpening;
    openingHook.mockReturnValue({ opening: 'Already covered opening', notice: '', loading: false });
    mockVoiceRound('');
    const voice = render(<SessionVoiceModeModal {...props} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    const brief = mockedStartSessionRealtimeInterview.mock.lastCall?.[0].instructions || '';
    expect(questionBank(brief)).toContain(
      '1. (freeform) Newest breakout question\n2. (freeform) First breakout question',
    );
    expect(questionBank(brief)).not.toContain('Opening question');
    expect(brief).not.toContain('Already covered opening');
    openingHook.mockReturnValue({ opening: '', notice: '', loading: false });
    voice.unmount();
    render(<SessionVoiceModeModal {...props} mode={null} />);
    const copy = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    await waitFor(() => expect(copy).toHaveAttribute('aria-disabled', 'false'));
    fireEvent.click(copy);
    const prompt = jest.mocked(navigator.clipboard.writeText).mock.lastCall?.[0] || '';
    expect(prompt).toContain(
      'Draft in this order, by position (newest first), then any position not listed: [3,2]. I have already answered [1]: leave those out unless I ask to change them.',
    );
    expect(prompt).not.toContain('Private prior answer');
  });

  it('takes the questions, and gives the personal AI prompt, in the order the session lists them when its question order says so', async () => {
    const props = {
      ...baseProps,
      sessionConfig: { interviewMode: { questionOrder: 'arranged' } },
      questionPool: [
        { id: 'q1', prompt: 'General question', type: 'freeform', storageRef: { createdAt: '2026-10-28T10:00:00Z' } },
        { id: 'q2', prompt: 'Newer detail', type: 'freeform', storageRef: { createdAt: '2026-10-29T10:00:00Z' } },
      ],
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'context-engine.interview-question-catalog',
          version: 1,
          sessionSlug: 'demo',
          prefillPromptVersion: 'ce-interview-brief-v6',
          questionSetHash: 'f'.repeat(64),
          questions: ['q1', 'q2'].map((id) => ({ id, prompt: `${id}?`, type: 'freeform' })),
        }),
      ),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) },
    });
    require('./useInterviewOpening').useInterviewOpening.mockReturnValue({ opening: '', notice: '', loading: false });
    mockVoiceRound('');
    const voice = render(<SessionVoiceModeModal {...props} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    const brief = mockedStartSessionRealtimeInterview.mock.lastCall?.[0].instructions || '';
    expect(questionBank(brief)).toContain('1. (freeform) General question\n2. (freeform) Newer detail');
    voice.unmount();
    render(<SessionVoiceModeModal {...props} mode={null} />);
    const copy = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    await waitFor(() => expect(copy).toHaveAttribute('aria-disabled', 'false'));
    fireEvent.click(copy);
    const prompt = jest.mocked(navigator.clipboard.writeText).mock.lastCall?.[0] || '';
    expect(prompt).toContain('Draft in the order of the positions.');
    expect(prompt).toContain('"promptRevision":"ce-prefill-prompt-5+arranged",');
  });
});
