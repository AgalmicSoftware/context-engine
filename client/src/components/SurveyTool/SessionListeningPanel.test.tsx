import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionListeningPanel from './SessionListeningPanel';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { generateQuestionsFromListeningTranscript } from './sessionListeningQuestions';
import { readThemeToken, subscribeThemeChanges } from '../../utilities/ui/themeRuntime';

const mockReadThemeToken = readThemeToken as jest.MockedFunction<typeof readThemeToken>;
const mockSubscribeThemeChanges = subscribeThemeChanges as jest.MockedFunction<typeof subscribeThemeChanges>;

jest.mock('../../utilities/audio/useRollingTranscriptionRecorder', () => ({
  useRollingTranscriptionRecorder: jest.fn(),
}));

jest.mock('./sessionListeningQuestions', () => ({
  generateQuestionsFromListeningTranscript: jest.fn(),
  LISTENING_QUESTION_COUNT: 5,
}));

jest.mock('../../utilities/ui/themeRuntime', () => ({
  readThemeToken: jest.fn((...args: unknown[]) => (typeof args[1] === 'string' ? args[1] : '')),
  subscribeThemeChanges: jest.fn(() => jest.fn()),
}));

jest.mock('./CreateQuestionsAndSurveys', () => (props: any) => (
  <div
    data-testid="mock-create-questions"
    data-title={props.preformedSurvey?.title || ''}
    data-count={props.preformedQuestions?.length || 0}
    data-mode={props.preformedMode || ''}
    data-doc-urls={(props.documentURLs || []).join(',')}
  />
));

const buildRecorder = (overrides: Record<string, unknown> = {}) => ({
  status: 'idle',
  isRecording: false,
  isPaused: false,
  isStopping: false,
  isBusy: false,
  elapsedSeconds: 0,
  transcript: '',
  segments: [],
  pendingSegmentCount: 0,
  errorMessage: '',
  mediaStreamRef: { current: null },
  startRecording: jest.fn(),
  pauseRecording: jest.fn(),
  resumeRecording: jest.fn(),
  stopRecording: jest.fn(),
  finalizeRecording: jest.fn(),
  clearDraft: jest.fn(),
  ...overrides,
});

describe('SessionListeningPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadThemeToken.mockImplementation((_token, fallback = '') => fallback);
    mockSubscribeThemeChanges.mockImplementation(() => jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts recording only from the explicit Record control', () => {
    const startRecording = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        startRecording,
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(startRecording).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START));
    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it('resolves and refreshes canvas colors through the app-theme runtime', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({ isRecording: true, status: 'recording' }),
    );
    let onThemeChange: (() => void) | undefined;
    mockSubscribeThemeChanges.mockImplementation((listener) => {
      onThemeChange = () => listener({ id: 'context-engine', source: 'user' });
      return jest.fn();
    });

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(readThemeToken).toHaveBeenCalledWith('ce-control-face', 'Canvas');
    expect(readThemeToken).toHaveBeenCalledWith('ce-action-primary', 'Highlight');
    expect(subscribeThemeChanges).toHaveBeenCalledTimes(1);

    mockReadThemeToken.mockClear();
    act(() => onThemeChange?.());
    expect(readThemeToken).toHaveBeenCalledWith('ce-control-face', 'Canvas');
    expect(readThemeToken).toHaveBeenCalledWith('ce-action-primary', 'Highlight');
  });

  it('keeps the initial recorder surface focused on the record button', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());

    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 done/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();

    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: 'Short transcript',
      }),
    );
    rerender(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeDisabled();
  });

  it('shows waveform, elapsed time, stop, and pause controls while recording', () => {
    const pauseRecording = jest.fn();
    const stopRecording = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isRecording: true,
        status: 'recording',
        elapsedSeconds: 125,
        pauseRecording,
        stopRecording,
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getAllByText('Recording')).toHaveLength(1);
    expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    expect(screen.getByLabelText('Pause recording')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_START)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Pause recording'));
    expect(pauseRecording).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Stop recording'));
    expect(stopRecording).toHaveBeenCalledTimes(1);
  });

  it('shows a resume control and keeps the elapsed timer visible while paused', () => {
    const resumeRecording = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isPaused: true,
        status: 'paused',
        elapsedSeconds: 45,
        resumeRecording,
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getAllByText('Paused')).toHaveLength(1);
    expect(screen.getByText('0:45')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Resume recording'));
    expect(resumeRecording).toHaveBeenCalledTimes(1);
  });

  it('does not expose internal chunk counters when a transcription segment fails', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: 'The conversation included enough captured text to keep working.',
        segments: [
          {
            id: 's1',
            index: 0,
            status: 'complete',
            text: 'The conversation included enough captured text to keep working.',
            startedAt: 1,
          },
          { id: 's2', index: 1, status: 'error', text: '', startedAt: 2 },
        ],
        errorMessage: 'The audio file could not be decoded or its format is not supported.',
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Some audio could not be transcribed.');
    expect(screen.queryByText(/could not be decoded/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 done/i)).not.toBeInTheDocument();
  });

  it('suppresses stale transcription failure warnings after a newer successful chunk', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: 'The conversation recovered with enough later transcript text to keep working.',
        segments: [
          { id: 's1', index: 0, status: 'complete', text: 'Opening text.', startedAt: 1, completedAt: 2 },
          { id: 's2', index: 1, status: 'error', text: '', startedAt: 3, completedAt: 4 },
          {
            id: 's3',
            index: 2,
            status: 'complete',
            text: 'The conversation recovered with enough later transcript text to keep working.',
            startedAt: 5,
            completedAt: 6,
          },
        ],
        errorMessage: 'The audio file could not be decoded or its format is not supported.',
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS)).toBeInTheDocument();
  });

  it('generates reviewable draft questions from the stitched transcript', async () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, startedAt: 1 }],
      }),
    );
    (generateQuestionsFromListeningTranscript as jest.Mock).mockResolvedValue({
      surveyTitle: 'Listening Follow-up',
      statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
      raw: { questions: [] },
    });

    render(
      <SessionListeningPanel
        sessionSlug="demo"
        sessionConfig={{ questionsGenPrompt: 'Prefer operational questions.' }}
        defaultTags={['ops']}
        workerUrl="https://worker.example"
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE));

    await waitFor(() => {
      expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledWith(
        transcript,
        expect.objectContaining({
          sessionSlug: 'demo',
          defaultTags: ['ops'],
          count: 5,
          sessionInstructions: 'Prefer operational questions.',
          sourceTypeOverride: 'transcript',
          workerUrl: 'https://worker.example',
        }),
      );
    });
    expect(await screen.findByTestId('mock-create-questions')).toHaveAttribute('data-title', 'Listening Follow-up');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-mode', 'questions');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-doc-urls', '');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS)).toBeInTheDocument();
  });

  it('keeps the transcript behind a compact button and clears it from the textarea overlay control', () => {
    const clearDraft = jest.fn();
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        clearDraft,
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    const transcriptButton = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS);
    expect(transcriptButton).toHaveTextContent('Transcript');
    expect(transcriptButton).toHaveTextContent(`${transcript.length} chars`);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'false');
    expect(transcriptButton.querySelector('[data-icon="caret-down"]')).toBeInTheDocument();
    expect(screen.queryByText('Transcript ready')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).not.toBeInTheDocument();

    fireEvent.click(transcriptButton);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveValue(transcript);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_CLEAR));
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('shows transcription progress and blocks question generation until pending audio is mapped', () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        pendingSegmentCount: 1,
        segments: [{ id: 's2', index: 1, status: 'transcribing', text: '', startedAt: 2 }],
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getByText('Transcribing…')).toBeInTheDocument();
    expect(screen.queryByText('Transcript ready')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS)).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeDisabled();
  });

  it('shows elapsed seconds while question generation is running', async () => {
    jest.useFakeTimers();
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    let resolveGeneration: ((value: unknown) => void) | null = null;
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, startedAt: 1 }],
      }),
    );
    (generateQuestionsFromListeningTranscript as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toHaveTextContent('Generating... 0s');

    act(() => {
      jest.advanceTimersByTime(12_000);
    });
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toHaveTextContent('Generating... 12s');

    await act(async () => {
      resolveGeneration?.({
        surveyTitle: 'Listening Follow-up',
        statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
        raw: { questions: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toHaveTextContent('Generate questions');
  });

  it('finalizes active recorder audio before closing the panel', async () => {
    const resolveFinalizeRef: { current: (() => void) | null } = { current: null };
    const finalizeRecording = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFinalizeRef.current = resolve;
        }),
    );
    const onClose = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isPaused: true,
        status: 'paused',
        elapsedSeconds: 9,
        finalizeRecording,
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close listening panel'));

    expect(finalizeRecording).toHaveBeenCalledWith({ waitForTranscription: true });
    expect(onClose).not.toHaveBeenCalled();

    resolveFinalizeRef.current?.();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
