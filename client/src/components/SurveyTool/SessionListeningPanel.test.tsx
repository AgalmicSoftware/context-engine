import { getEffectiveTranscriptionConfig } from '../../utilities/ai/aiSettings';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionListeningPanel from './SessionListeningPanel';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { generateQuestionsFromListeningTranscript } from './sessionListeningQuestions';
import type { ListeningQuestionGenerationResult } from './sessionListeningQuestions';
import { readThemeToken, subscribeThemeChanges } from '../../utilities/ui/themeRuntime';

jest.mock('../../utilities/ai/aiSettings', () => ({
  getEffectiveTranscriptionConfig: jest.fn(async () => ({ provider: 'openai' })),
}));

let mockCreateQuestionsMountCount = 0;
let mockCreateQuestionsProps: any = null;

const mockReadThemeToken = readThemeToken as jest.MockedFunction<typeof readThemeToken>;
const mockSubscribeThemeChanges = subscribeThemeChanges as jest.MockedFunction<typeof subscribeThemeChanges>;
const mockGenerateQuestionsFromListeningTranscript = generateQuestionsFromListeningTranscript as jest.MockedFunction<
  typeof generateQuestionsFromListeningTranscript
>;

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

let mockTranscriptContext: Record<string, unknown> = {};
jest.mock('./useTranscriptContextUpload', () => ({ useTranscriptContextUpload: () => mockTranscriptContext }));
jest.mock('./SessionTranscriptContextOption', () => ({
  __esModule: true,
  default: () => <span data-testid="mock-transcript-option" />,
}));

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return (props: any) => {
    mockCreateQuestionsProps = props;
    const mountId = React.useRef(null as number | null);
    if (mountId.current === null) {
      mockCreateQuestionsMountCount += 1;
      mountId.current = mockCreateQuestionsMountCount;
    }
    return (
      <div
        data-testid="mock-create-questions"
        data-title={props.preformedSurvey?.title || ''}
        data-count={props.preformedQuestions?.length || 0}
        data-mode={props.preformedMode || ''}
        data-doc-urls={(props.documentURLs || []).join(',')}
        data-append={String(Boolean(props.appendPreformedQuestions))}
        data-submit-class={props.submitRowClassName || ''}
        data-submit-label={props.questionSubmitLabel || ''}
        data-submit-disabled={String(Boolean(props.submitDisabled))}
        data-review={String(Boolean(props.interviewQuestionReview))}
        data-mount-id={String(mountId.current)}
        data-prompts={(props.preformedQuestions || []).map((question: any) => question.prompt).join('|')}
      >
        {props.submitAccessory}
        {(props.preformedQuestions || []).map((question: any) => (
          <div key={question.prompt} data-testid="ce-create-question">
            {question.prompt}
          </div>
        ))}
      </div>
    );
  };
});

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
  keepAudio: jest.fn(),
  clearDraft: jest.fn(),
  addAudio: jest.fn(),
  downloadRecording: jest.fn(async () => {}),
  addTranscript: jest.fn(),
  questionDrafts: null,
  saveQuestionDrafts: jest.fn(),
  speakerMerges: {},
  saveSpeakerMerges: jest.fn(),
  ...overrides,
});
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('SessionListeningPanel', () => {
  beforeEach(() => {
    mockTranscriptContext = {
      available: false,
      status: '',
      failed: false,
      upload: jest.fn(),
      settled: jest.fn(async () => undefined),
    };
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateQuestionsMountCount = 0;
    mockReadThemeToken.mockImplementation((_token, fallback = '') => fallback);
    mockSubscribeThemeChanges.mockImplementation(() => jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets an imported transcript generate questions on demand without automatically starting AI', async () => {
    const transcript =
      'Written group discussion with enough detail to generate useful questions from the participants.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [
          {
            id: 'text-1',
            index: 0,
            source: 'text',
            status: 'complete',
            text: transcript,
            startedAt: 1,
            completedAt: 2,
          },
        ],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
      surveyTitle: '',
      statements: [],
      raw: { questions: [] },
    });
    render(<SessionListeningPanel panelMode="recordGroup" />);
    await waitFor(() => expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeEnabled());
    expect(mockGenerateQuestionsFromListeningTranscript).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE));
    await waitFor(() => expect(mockGenerateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1));
  });

  it('waits for Generate when text is imported after earlier audio', async () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript:
          'Earlier speech. Imported discussion with enough detail about choices and evidence for useful questions.',
        segments: [
          { id: 'audio', index: 0, status: 'complete', text: 'Earlier speech.', startedAt: 1, completedAt: 2 },
          {
            id: 'text',
            index: 1,
            source: 'text',
            status: 'complete',
            text: 'Imported discussion.',
            startedAt: 3,
            completedAt: 4,
          },
        ],
      }),
    );
    render(<SessionListeningPanel panelMode="recordGroup" />);
    await waitFor(() => expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeEnabled());
    expect(mockGenerateQuestionsFromListeningTranscript).not.toHaveBeenCalled();
  });

  it('drafts questions for a chunk transcribed after text pasted while it uploaded', async () => {
    const transcript = 'Recorded speech about choices and evidence that should become useful questions. Pasted notes.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [
          { id: 'audio', index: 0, status: 'complete', text: 'Recorded speech.', startedAt: 1, completedAt: 9 },
          {
            id: 'text',
            index: 1,
            source: 'text',
            status: 'complete',
            text: 'Pasted notes.',
            startedAt: 5,
            completedAt: 5,
          },
        ],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
      surveyTitle: '',
      statements: [],
      raw: { questions: [] },
    });
    render(<SessionListeningPanel panelMode="recordGroup" />);
    await waitFor(() => expect(mockGenerateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1));
    expect(mockGenerateQuestionsFromListeningTranscript.mock.calls[0][0]).toBe(transcript);
  });

  it('keeps an unfinished pasted transcript while microphone capture is active', async () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
    const { rerender } = render(<SessionListeningPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Add input/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste transcript' }));
    fireEvent.change(screen.getByLabelText('Written transcript'), { target: { value: 'Keep these written notes.' } });
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({ isRecording: true, status: 'recording' }),
    );
    rerender(<SessionListeningPanel />);
    expect(screen.getByLabelText('Written transcript')).toHaveValue('Keep these written notes.');
    expect(screen.getByLabelText('Written transcript')).toBeDisabled();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
    rerender(<SessionListeningPanel />);
    expect(screen.getByLabelText('Written transcript')).toHaveValue('Keep these written notes.');
    expect(screen.getByRole('button', { name: 'Add transcript' })).toBeEnabled();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('hides audio parts and exports one recording while keeping recovery actions', async () => {
    const retryChunk = jest.fn();
    const downloadRecording = jest.fn(async () => {});
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: 'Already saved transcript.',
        segments: [{ id: 'stuck', index: 0, status: 'failed', text: '', startedAt: 1 }],
        downloadableChunkIds: ['stuck'],
        retryChunk,
        downloadRecording,
        errorMessage: 'Transcription is unavailable. Retry later.',
      }),
    );
    render(<SessionListeningPanel sessionSlug="workshop" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Transcription is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry transcription' }));
    expect(retryChunk).toHaveBeenCalledWith('stuck');
    expect(screen.queryByTestId('ce-recording-chunks')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download audio' }));
    await waitFor(() => expect(downloadRecording).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('ce-recording-chunks')).not.toBeInTheDocument();
  });

  it('offers the original audio of each part while device storage fails, even during capture', () => {
    const downloadChunk = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isRecording: true,
        status: 'recording',
        segments: [{ id: 'live', index: 0, status: 'recording', text: '', startedAt: 1 }],
        downloadableChunkIds: ['live'],
        downloadChunk,
        storageFailed: true,
        errorMessage: "This recording can't be recovered after a reload.",
      }),
    );
    render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
    expect(screen.getByRole('list', { name: 'Original audio downloads' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download chunk 1' }));
    expect(downloadChunk).toHaveBeenCalledWith('live');
  });

  it('lets the recorder retry a chunk that is stuck uploading, but not one uploading normally', () => {
    const retryChunk = jest.fn();
    const upload = { id: 'stuck-upload', index: 0, status: 'transcribing', text: '', startedAt: 1 };
    // The part has audio, so its original would be listed if anything showed the list during an upload.
    const recorder = (error?: string) =>
      buildRecorder({
        segments: [{ ...upload, error }],
        downloadableChunkIds: ['stuck-upload'],
        pendingSegmentCount: 1,
        retryChunk,
      });
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(recorder());
    const { rerender } = render(<SessionListeningPanel sessionSlug="workshop" />);
    expect(screen.queryByRole('button', { name: 'Retry transcription' })).not.toBeInTheDocument();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      recorder('The upload stopped responding. Retrying.'),
    );
    rerender(<SessionListeningPanel sessionSlug="workshop" />);
    expect(screen.queryByRole('list', { name: 'Original audio downloads' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry transcription' }));
    expect(retryChunk).toHaveBeenCalledWith('stuck-upload');
  });

  it('keeps the hidden-period notice visible after Stop and lets the recorder dismiss it', () => {
    const dismissHiddenPeriods = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        hiddenPeriods: [
          { startedAt: new Date(2026, 9, 30, 14, 2).getTime(), endedAt: new Date(2026, 9, 30, 14, 12).getTime() },
        ],
        dismissHiddenPeriods,
      }),
    );
    render(<SessionListeningPanel sessionSlug="hidden-period" />);
    expect(screen.getByText('The page was hidden 14:02–14:12; recording may have paused.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss hidden-page notice' }));
    expect(dismissHiddenPeriods).toHaveBeenCalledTimes(1);
  });

  it('explains when an active recording page is hidden', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isRecording: true,
        status: 'recording',
        pageHidden: true,
        wakeLockHeld: false,
      }),
    );
    render(<SessionListeningPanel sessionSlug="workshop" />);
    expect(screen.getByText(/Recording page is hidden/)).toBeInTheDocument();
  });

  it('says why Back kept the page while recording', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({ isRecording: true, status: 'recording', wakeLockHeld: true, backBlocked: true }),
    );
    render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" embeddedInModal />);
    expect(screen.getByText('Still recording. Press Stop before leaving.')).toBeInTheDocument();
  });

  it('removes duplicate recorder chrome only when embedded in the voice modal', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());

    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" onClose={jest.fn()} />);

    expect(screen.getByLabelText('Close listening panel')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START)).toBeInTheDocument();

    rerender(<SessionListeningPanel sessionSlug="demo" embeddedInModal onClose={jest.fn()} />);

    expect(screen.queryByLabelText('Close listening panel')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START)).toBeInTheDocument();
  });

  it('keeps embedded recorder states visible without the duplicate modal heading', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isRecording: true,
        status: 'recording',
        errorMessage: 'Permission denied',
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal onClose={jest.fn()} />);

    expect(screen.queryByText('Group Conversation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Close listening panel')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
  });

  it('holds Record while an imported file decodes, so the import stays in one place', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ importing: true }));
    render(<SessionListeningPanel sessionSlug="demo" />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START)).toBeDisabled();
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

  it('shows a failed chunk without hiding its error behind the existing transcript', () => {
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
          { id: 's2', index: 1, status: 'failed', text: '', startedAt: 2 },
        ],
        errorMessage: 'The audio file could not be decoded or its format is not supported.',
      }),
    );

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(screen.getByRole('alert')).toHaveTextContent('could not be decoded');
    expect(screen.getByRole('button', { name: 'Retry transcription' })).toBeInTheDocument();
    expect(screen.queryByText(/1 failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 done/i)).not.toBeInTheDocument();
  });

  it('keeps an unresolved chunk failure visible after another transcript succeeds', () => {
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: 'The conversation recovered with enough later transcript text to keep working.',
        segments: [
          { id: 's1', index: 0, status: 'complete', text: 'Opening text.', startedAt: 1, completedAt: 2 },
          { id: 's2', index: 1, status: 'failed', text: '', startedAt: 3, completedAt: 4 },
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

    expect(screen.getByRole('alert')).toHaveTextContent('could not be decoded');
    expect(screen.getByRole('button', { name: 'Retry transcription' })).toBeInTheDocument();
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
    mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
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

  it('auto-generates group conversation questions when a completed transcript is ready', async () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, startedAt: 1, completedAt: 2 }],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
      surveyTitle: 'Listening Follow-up',
      statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
      raw: { questions: [] },
    });

    render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

    await waitFor(() => {
      expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledWith(
        transcript,
        expect.objectContaining({
          existingQuestionPrompts: [],
          multiSpeakerHintOverride: 'likely_multiple_speakers',
        }),
      );
    });
    expect(await screen.findByTestId('mock-create-questions')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-append', 'true');
    // Below a long draft list, the submit button stays pinned to the bottom of the dialog.
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-class', 'sessionListeningSubmit');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-label', 'Submit questions');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-review', 'true');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).not.toBeInTheDocument();
  });

  it('does not auto-request unchanged group transcripts more than once', async () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, completedAt: 2 }],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
      surveyTitle: 'Listening Follow-up',
      statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
      raw: { questions: [] },
    });

    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

    await waitFor(() => expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1));
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    await waitFor(() => expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-count', '1'));
    expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1);
  });

  it('queues newer transcript text after an in-flight group generation and appends without remounting', async () => {
    const firstTranscript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const secondTranscript = `${firstTranscript} Later they debated community trust and accountability thresholds.`;
    const resolveFirstRef: {
      current:
        ((value: ListeningQuestionGenerationResult | PromiseLike<ListeningQuestionGenerationResult>) => void) | null;
    } = { current: null };
    mockGenerateQuestionsFromListeningTranscript
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRef.current = resolve;
          }),
      )
      .mockResolvedValueOnce({
        surveyTitle: 'Listening Follow-up',
        statements: [
          { id: 'q2', type: 'freeform', prompt: 'How should trust be measured?', tags: ['trust'] },
          { id: 'q1-copy', type: 'freeform', prompt: 'What evidence matters?', tags: [] },
        ],
        raw: { questions: [] },
      });

    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: firstTranscript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: firstTranscript, completedAt: 2 }],
      }),
    );
    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    await waitFor(() => expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1));

    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        isRecording: true,
        transcript: secondTranscript,
        segments: [
          { id: 's1', index: 0, status: 'complete', text: firstTranscript, completedAt: 2 },
          { id: 's2', index: 1, status: 'complete', text: 'Later they debated community trust.', completedAt: 5 },
        ],
      }),
    );
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstRef.current?.({
        surveyTitle: 'Listening Follow-up',
        statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
        raw: { questions: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    const firstMountId = screen.getByTestId('mock-create-questions').getAttribute('data-mount-id');

    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    await waitFor(() => expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-count', '2'));
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-mount-id', firstMountId || '');
    expect(generateQuestionsFromListeningTranscript).toHaveBeenLastCalledWith(
      secondTranscript,
      expect.objectContaining({ existingQuestionPrompts: ['What evidence matters?'] }),
    );
  });

  it('holds Submit, with its reason, while the next drafts generate', async () => {
    const firstTranscript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const firstSegment = { id: 's1', index: 0, status: 'complete', text: firstTranscript, completedAt: 2 };
    const batch = (prompt: string): ListeningQuestionGenerationResult => ({
      surveyTitle: 'Listening Follow-up',
      statements: [{ id: `q-${prompt.length}`, type: 'freeform', prompt, tags: [] }],
      raw: { questions: [] },
    });
    const finishSecond: { current: ((value: ListeningQuestionGenerationResult) => void) | null } = { current: null };
    mockGenerateQuestionsFromListeningTranscript
      .mockResolvedValueOnce(batch('What evidence matters?'))
      .mockImplementationOnce(() => new Promise((resolve) => (finishSecond.current = resolve)));
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({ transcript: firstTranscript, segments: [firstSegment] }),
    );
    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    const drafts = await screen.findByTestId('mock-create-questions');
    expect(drafts).toHaveAttribute('data-submit-disabled', 'false');
    expect(drafts).toHaveAttribute('data-submit-label', 'Submit questions');

    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript: `${firstTranscript} Later they debated community trust and accountability thresholds.`,
        segments: [firstSegment, { id: 's2', index: 1, status: 'complete', text: 'Later.', completedAt: 5 }],
      }),
    );
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    await waitFor(() =>
      expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-disabled', 'true'),
    );
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-label', 'Waiting for new drafts…');

    await act(async () => {
      finishSecond.current?.(batch('Who may trigger a review?'));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-disabled', 'false'),
    );
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-label', 'Submit questions');
  });

  describe('new-drafts cue', () => {
    const firstTranscript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const firstSegment = { id: 's1', index: 0, status: 'complete', text: firstTranscript, completedAt: 2 };
    const result = (...prompts: string[]): ListeningQuestionGenerationResult => ({
      surveyTitle: 'Listening Follow-up',
      statements: prompts.map((prompt, index) => ({
        id: `q-${prompt.length}-${index}`,
        type: 'freeform',
        prompt,
        tags: [],
      })),
      raw: { questions: [] },
    });
    afterEach(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
      delete (globalThis as Partial<typeof globalThis>).IntersectionObserver;
    });

    it('says how many drafts are new, scrolls to them, and then counts only later ones', async () => {
      const scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      mockGenerateQuestionsFromListeningTranscript
        .mockResolvedValueOnce(result('What evidence matters?'))
        .mockResolvedValueOnce(result('How should trust be measured?', 'Who may trigger a review?'));
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: firstTranscript, segments: [firstSegment] }),
      );
      const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

      fireEvent.click(await screen.findByRole('button', { name: '1 new draft question' }));
      const drafts = screen.getByRole('region', { name: 'Draft questions' });
      expect(scrollIntoView.mock.contexts).toEqual([screen.getByText('What evidence matters?')]);
      expect(drafts).toHaveFocus();
      expect(screen.queryByRole('button', { name: /new draft/ })).not.toBeInTheDocument();

      const secondTranscript = `${firstTranscript} Later they debated community trust and accountability thresholds.`;
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({
          transcript: secondTranscript,
          segments: [firstSegment, { id: 's2', index: 1, status: 'complete', text: 'Later.', completedAt: 5 }],
        }),
      );
      rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      fireEvent.click(await screen.findByRole('button', { name: '2 new draft questions' }));
      // The first of the new drafts, not the top of the list.
      expect(scrollIntoView.mock.contexts[1]).toBe(screen.getByText('How should trust be measured?'));
    });

    // Its lane exists only while it shows, so it must not flash, and move the dialog, for drafts in view.
    const observeDrafts = (inView: boolean[]) => {
      const observers: Array<{ onChange: IntersectionObserverCallback; target?: Element }> = [];
      (globalThis as Partial<typeof globalThis>).IntersectionObserver = class {
        constructor(onChange: IntersectionObserverCallback) {
          observers.push({ onChange });
        }
        observe(target: Element) {
          const observer = observers[observers.length - 1];
          observer.target = target;
          observer.onChange(
            [{ isIntersecting: inView.shift() ?? false, target } as IntersectionObserverEntry],
            this as never,
          );
        }
        disconnect() {}
      } as unknown as typeof IntersectionObserver;
      return observers;
    };

    it('never shows for new drafts already on screen', async () => {
      const observers = observeDrafts([true]);
      mockGenerateQuestionsFromListeningTranscript.mockResolvedValueOnce(result('What evidence matters?'));
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: firstTranscript, segments: [firstSegment] }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

      await screen.findByText('What evidence matters?');
      expect(screen.queryByRole('button', { name: /new draft/ })).not.toBeInTheDocument();
      await nextFrame();
      expect(observers.map((observer) => observer.target)).toEqual([screen.getByText('What evidence matters?')]);
      expect(screen.queryByRole('button', { name: /new draft/ })).not.toBeInTheDocument();
    });

    it('shows once the first new draft is out of view, and goes once it is seen', async () => {
      const observers = observeDrafts([false]);
      mockGenerateQuestionsFromListeningTranscript.mockResolvedValueOnce(result('What evidence matters?'));
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: firstTranscript, segments: [firstSegment] }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

      await screen.findByRole('button', { name: '1 new draft question' });
      const [{ onChange, target }] = observers;
      act(() => onChange([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as never));
      expect(screen.queryByRole('button', { name: /new draft/ })).not.toBeInTheDocument();
    });
  });

  // Closing the dialog unmounts the panel, and a reload loses the page, so the drafts are kept with the recording.
  describe('drafts kept with the recording', () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const segment = { id: 's1', index: 0, status: 'complete', text: transcript, completedAt: 2 };
    const kept = {
      questions: [{ id: 'q1-edited', type: 'binary', prompt: 'Edited by the host?' }],
      prompts: ['What evidence matters?', 'Removed by the host?'],
      draftedTranscript: transcript,
    };

    it('reopens with the drafts as the host left them, without drafting the same transcript again', async () => {
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript, segments: [segment], questionDrafts: kept }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      expect(await screen.findByTestId('mock-create-questions')).toHaveAttribute('data-prompts', 'Edited by the host?');
      await nextFrame();
      expect(generateQuestionsFromListeningTranscript).not.toHaveBeenCalled();
      // The host has seen them.
      expect(screen.queryByRole('button', { name: /new draft/ })).not.toBeInTheDocument();
    });

    it('drafts only newer transcript text, and never a prompt it drafted before', async () => {
      const saveQuestionDrafts = jest.fn();
      const later = `${transcript} Later they debated community trust and accountability thresholds.`;
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({
          transcript: later,
          segments: [segment, { id: 's2', index: 1, status: 'complete', text: 'Later.', completedAt: 5 }],
          questionDrafts: kept,
          saveQuestionDrafts,
        }),
      );
      mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
        surveyTitle: '',
        statements: [
          { id: 'q2', type: 'freeform', prompt: 'Removed by the host?', tags: [] },
          { id: 'q3', type: 'freeform', prompt: 'Who may trigger a review?', tags: [] },
        ],
        raw: { questions: [] },
      });
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      await waitFor(() =>
        expect(screen.getByTestId('mock-create-questions')).toHaveAttribute(
          'data-prompts',
          'Edited by the host?|Who may trigger a review?',
        ),
      );
      expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1);
      expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledWith(
        later,
        expect.objectContaining({
          existingQuestionPrompts: ['What evidence matters?', 'Removed by the host?', 'Edited by the host?'],
        }),
      );
      // Saved with the recording at once, so a batch held back by a submit is never lost.
      expect(saveQuestionDrafts).toHaveBeenLastCalledWith({
        questions: [...kept.questions, expect.objectContaining({ prompt: 'Who may trigger a review?' })],
        prompts: ['What evidence matters?', 'Removed by the host?', 'Who may trigger a review?'],
        draftedTranscript: later,
      });
    });

    it('starts another recording, as after an account change, with only its own drafts', async () => {
      const saveQuestionDrafts = jest.fn();
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ scope: 'a', transcript, segments: [segment], questionDrafts: kept, saveQuestionDrafts }),
      );
      const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      await screen.findByTestId('mock-create-questions');
      const other = 'Another recording discussed school meals, transport passes, library hours and park lighting.';
      mockGenerateQuestionsFromListeningTranscript.mockResolvedValue({
        surveyTitle: '',
        statements: [{ id: 'q9', type: 'freeform', prompt: 'Which service matters most?', tags: [] }],
        raw: { questions: [] },
      });
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({
          scope: 'b',
          transcript: other,
          segments: [{ ...segment, text: other }],
          questionDrafts: null,
          saveQuestionDrafts,
        }),
      );
      rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      await waitFor(() =>
        expect(screen.getByTestId('mock-create-questions')).toHaveAttribute(
          'data-prompts',
          'Which service matters most?',
        ),
      );
      expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledWith(
        other,
        expect.objectContaining({ existingQuestionPrompts: [] }),
      );
      expect(saveQuestionDrafts).toHaveBeenLastCalledWith({
        questions: [expect.objectContaining({ prompt: 'Which service matters most?' })],
        prompts: ['Which service matters most?'],
        draftedTranscript: other,
      });
    });

    it('offers the transcript box only where it can be used, and uploads the latest text after a submit', async () => {
      const upload = jest.fn(async (_transcript: string) => undefined);
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript, segments: [segment], questionDrafts: kept }),
      );
      const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      await screen.findByTestId('mock-create-questions');
      expect(screen.queryByTestId('mock-transcript-option')).toBeNull();

      mockTranscriptContext = { ...mockTranscriptContext, available: true, upload };
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: `${transcript} More.`, segments: [segment], questionDrafts: kept }),
      );
      rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      expect(screen.getByTestId('mock-transcript-option')).toBeInTheDocument();
      expect(upload).not.toHaveBeenCalled();
      act(() => mockCreateQuestionsProps.onQuestionsSubmitted());
      expect(upload).toHaveBeenCalledWith(`${transcript} More.`);
    });

    it('says when the transcript failed to upload and tries again', async () => {
      const upload = jest.fn(async (_transcript: string) => undefined);
      mockTranscriptContext = {
        ...mockTranscriptContext,
        available: true,
        upload,
        failed: true,
        status: 'The transcript wasn’t added to context: no.',
      };
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript, segments: [segment], questionDrafts: kept }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      expect(await screen.findByText('The transcript wasn’t added to context: no.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(upload).toHaveBeenCalledWith(transcript);
    });

    it('waits for a transcript upload under way before closing', async () => {
      let finish = () => {};
      const settled = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      mockTranscriptContext = { ...mockTranscriptContext, settled };
      const onClose = jest.fn();
      const closeActionRef: { current: (() => Promise<void>) | null } = { current: null };
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({
          transcript,
          segments: [segment],
          questionDrafts: kept,
          finalizeRecording: jest.fn(async () => {}),
        }),
      );
      render(
        <SessionListeningPanel
          sessionSlug="demo"
          panelMode="recordGroup"
          embeddedInModal
          onClose={onClose}
          closeActionRef={closeActionRef}
        />,
      );
      await screen.findByTestId('mock-create-questions');
      await act(async () => {
        void closeActionRef.current?.();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(settled).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => finish());
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('gives each speaker a button only in a group recording', async () => {
      const labelled =
        'Person 1: Enough words here for a whole part of the talk.\nPerson 2: And quite a lot more from another person.';
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript: labelled }));
      const { unmount } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      expect(screen.getByRole('button', { name: 'Person 2' })).toBeInTheDocument();
      // A label in the transcript, open from the start in a group recording, gives the same person their code.
      fireEvent.click(screen.getByRole('button', { name: 'Person 2:' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent('Person 2');
      unmount();
      render(<SessionListeningPanel sessionSlug="demo" />);
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_CLAIM_SHARE)).toBeNull();
    });

    it('holds codes back while a recording runs or a part is still transcribing', async () => {
      const labelled =
        'Person 1: Enough words here for a whole part of the talk.\nPerson 2: And quite a lot more from another person.';
      const panel = () => <SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />;
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: labelled, pendingSegmentCount: 1 }),
      );
      const { rerender } = render(panel());
      fireEvent.click(screen.getByRole('button', { name: 'Person 2' }));
      expect(screen.getByText('Codes open once every part is transcribed.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: labelled, isRecording: true }),
      );
      rerender(panel());
      expect(screen.getByText('Codes open once every part is transcribed.')).toBeInTheDocument();
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript: labelled }));
      rerender(panel());
      fireEvent.click(screen.getByRole('button', { name: 'Person 2' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent('Person 2');
    });

    it('shows merged speakers under the label they joined, and keeps a split with the recording', () => {
      const labelled =
        'Person 1: Enough words here for a whole part of the talk.\nPerson 3: And a little more from the same voice.';
      const saveSpeakerMerges = jest.fn();
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript: labelled, speakerMerges: { 'Person 3': 'Person 1' }, saveSpeakerMerges }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      const lines = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT);
      expect(lines).toHaveTextContent('Person 1: And a little more from the same voice.');
      expect(lines).not.toHaveTextContent('Person 3');
      // The buttons read the same merged transcript: one person, with one code.
      expect(screen.getByRole('button', { name: 'Person 1 + 3' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Person 3' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Split Person 1 + 3' }));
      expect(saveSpeakerMerges).toHaveBeenCalledWith({});
    });

    it('forgets a chosen code once the transcript is gone, so it can’t reopen unasked', async () => {
      const labelled =
        'Person 1: Enough words here for a whole part of the talk.\nPerson 2: And quite a lot more from another person.';
      // A fresh element each time, so the recorder's new state reaches the panel.
      const panel = () => <SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />;
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript: labelled }));
      const { rerender } = render(panel());
      fireEvent.click(screen.getByRole('button', { name: 'Person 2' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent('Person 2');
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript: '' }));
      rerender(panel());
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript: labelled }));
      rerender(panel());
      expect(await screen.findByRole('button', { name: 'Person 2' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Closing mid-upload would bring the uploaded drafts back, and lose a batch held back meanwhile.
    it('closes only once a submit in flight has settled', async () => {
      const onClose = jest.fn();
      const closeActionRef: { current: (() => Promise<void>) | null } = { current: null };
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({
          transcript,
          segments: [segment],
          questionDrafts: kept,
          finalizeRecording: jest.fn(async () => {}),
        }),
      );
      render(
        <SessionListeningPanel
          sessionSlug="demo"
          panelMode="recordGroup"
          embeddedInModal
          onClose={onClose}
          closeActionRef={closeActionRef}
        />,
      );
      await screen.findByTestId('mock-create-questions');
      act(() => mockCreateQuestionsProps.onSubmittingChange(true));
      await act(async () => {
        void closeActionRef.current?.();
        await Promise.resolve();
      });
      expect(screen.getByRole('status')).toHaveTextContent('Finalizing recording…');
      expect(onClose).not.toHaveBeenCalled();
      act(() => mockCreateQuestionsProps.onSubmittingChange(false));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("keeps the host's edits and removals", async () => {
      const saveQuestionDrafts = jest.fn();
      (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
        buildRecorder({ transcript, segments: [segment], questionDrafts: kept, saveQuestionDrafts }),
      );
      render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
      await screen.findByTestId('mock-create-questions');
      const edited = [{ id: 'q1-again', type: 'binary', prompt: 'Edited again?' }];
      act(() => mockCreateQuestionsProps.onDraftQuestionsChange(edited));
      expect(saveQuestionDrafts).toHaveBeenLastCalledWith({ ...kept, questions: edited });
      act(() => mockCreateQuestionsProps.onDraftQuestionsChange([]));
      expect(saveQuestionDrafts).toHaveBeenLastCalledWith({ ...kept, questions: [] });
    });
  });

  it('keeps cleared transcript state from being repopulated by a stale generation response', async () => {
    const clearDraft = jest.fn();
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const resolveGenerationRef: {
      current:
        ((value: ListeningQuestionGenerationResult | PromiseLike<ListeningQuestionGenerationResult>) => void) | null;
    } = { current: null };
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        clearDraft,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, completedAt: 2 }],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerationRef.current = resolve;
        }),
    );

    render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    await waitFor(() => expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1));
    // A group transcript is already open.
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_CLEAR));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear recording' }));

    await act(async () => {
      resolveGenerationRef.current?.({
        surveyTitle: 'Listening Follow-up',
        statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
        raw: { questions: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mock-create-questions')).not.toBeInTheDocument();
  });

  it('shows auto-generation errors once and allows explicit retry for the same transcript', async () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, completedAt: 2 }],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript
      .mockRejectedValueOnce(new Error('AI unavailable'))
      .mockResolvedValueOnce({
        surveyTitle: 'Listening Follow-up',
        statements: [{ id: 'q1', type: 'freeform', prompt: 'What evidence matters?', tags: [] }],
        raw: { questions: [] },
      });

    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);

    expect(await screen.findByRole('alert')).toHaveTextContent('AI unavailable');
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE));
    await waitFor(() => expect(generateQuestionsFromListeningTranscript).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('mock-create-questions')).toHaveAttribute('data-count', '1');
  });

  it('shows a stopped recorder ahead of an earlier question-generation error', async () => {
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    const segments = [{ id: 's1', index: 0, status: 'complete', text: transcript, completedAt: 2 }];
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript, segments }));
    mockGenerateQuestionsFromListeningTranscript.mockRejectedValueOnce(new Error('AI unavailable'));
    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(await screen.findByRole('alert')).toHaveTextContent('AI unavailable');
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments,
        status: 'error',
        errorMessage: 'Microphone access ended. Restore microphone permission, then press Record to continue.',
      }),
    );
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Microphone access ended/);
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
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent(transcript);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_CLEAR));
    // With no audio left, Clear still asks, since the transcript is all that remains.
    expect(clearDraft).not.toHaveBeenCalled();
    expect(screen.getByText('This deletes the transcript from this device.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear recording' }));
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('opens a group transcript once text exists and leaves it as the host sets it', () => {
    const transcript = 'Person 1: The group discussed budget timing, operational risk, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
    const { rerender } = render(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).not.toBeInTheDocument();

    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ transcript }));
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    const transcriptButton = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent(transcript);

    // A host who collapses it keeps it collapsed as later chunks arrive.
    fireEvent.click(transcriptButton);
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({ transcript: `${transcript}\nPerson 2: And who reviews it?` }),
    );
    rerender(<SessionListeningPanel sessionSlug="demo" panelMode="recordGroup" embeddedInModal />);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).not.toBeInTheDocument();
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
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS)).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeDisabled();
  });

  it('shows elapsed seconds while question generation is running', async () => {
    jest.useFakeTimers();
    const transcript =
      'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    let resolveGeneration:
      ((value: ListeningQuestionGenerationResult | PromiseLike<ListeningQuestionGenerationResult>) => void) | null =
      null;
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
      buildRecorder({
        transcript,
        segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, startedAt: 1 }],
      }),
    );
    mockGenerateQuestionsFromListeningTranscript.mockImplementation(
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

    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-submit-label', 'Submit questions');
  });

  it('finalizes active recorder audio before closing the panel', async () => {
    const resolveFinalizeRef: { current: (() => void) | null } = { current: null };
    const finalizeRecording = jest.fn(
      (_options?: { waitForTranscription: boolean }) =>
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

    // A paused recording is still open, so closing asks before it stops.
    fireEvent.click(screen.getByLabelText('Close listening panel'));
    expect(await screen.findByText('Stop recording?')).toBeInTheDocument();
    expect(finalizeRecording).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(finalizeRecording).toHaveBeenCalledWith({ waitForTranscription: true });
    expect(onClose).not.toHaveBeenCalled();

    resolveFinalizeRef.current?.();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

it('remembers the optional speaker-audio setting and locks it while recording', () => {
  window.localStorage.removeItem('ce:record-speaker-audio:v1');
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
  const { rerender, unmount } = render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  const toggle = screen.getByRole('checkbox', { name: 'Recording voices coming from this device' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(
    expect.objectContaining({ recordSpeakerAudio: true }),
  );
  expect(window.localStorage.getItem('ce:record-speaker-audio:v1')).toBe('true');
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ isRecording: true, status: 'recording', wakeLockHeld: false }),
  );
  rerender(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  expect(screen.getByRole('checkbox', { name: 'Recording voices coming from this device' })).toBeDisabled();
  expect(
    screen.getByText('Screen lock is unavailable. Keep this page visible and the screen unlocked.'),
  ).toBeInTheDocument();
  unmount();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
  render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  expect(screen.getByRole('checkbox', { name: 'Recording voices coming from this device' })).toBeChecked();
  window.localStorage.removeItem('ce:record-speaker-audio:v1');
});

it('defaults speaker labels on for OpenAI Group Conversation and lets the recorder opt out', async () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
  const { rerender } = render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  const toggle = await screen.findByRole('checkbox', { name: 'Label speakers' });
  expect(toggle).toBeChecked();
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: true }));
  fireEvent.click(toggle);
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: false }));
  rerender(<SessionListeningPanel sessionSlug="workshop" panelMode="listening" />);
  expect(screen.queryByRole('checkbox', { name: 'Label speakers' })).not.toBeInTheDocument();
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: false }));
});

it.each(['custom', 'local'])('hides speaker labels for the effective %s transcription provider', async (provider) => {
  jest
    .mocked(getEffectiveTranscriptionConfig)
    .mockResolvedValueOnce({ provider } as Awaited<ReturnType<typeof getEffectiveTranscriptionConfig>>);
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
  render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  await waitFor(() => expect(getEffectiveTranscriptionConfig).toHaveBeenCalled());
  expect(screen.queryByRole('checkbox', { name: 'Label speakers' })).not.toBeInTheDocument();
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: false }));
});

it('shows when recording continues without speaker labels', async () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ labelsUnavailableReason: 'Labels unavailable. Continuing with plain transcription.' }),
  );
  render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  expect(await screen.findByRole('status')).toHaveTextContent('Continuing with plain transcription');
});

it('lets the host turn speaker labels back on after they went off', async () => {
  const restoreSpeakerLabels = jest.fn();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ labelsUnavailableReason: 'Speaker labels are unavailable.', restoreSpeakerLabels }),
  );
  render(<SessionListeningPanel sessionSlug="workshop" panelMode="recordGroup" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Turn labels back on' }));
  expect(restoreSpeakerLabels).toHaveBeenCalledTimes(1);
});

it('waits for the transcription provider before starting Group Conversation with labels', async () => {
  type Config = Awaited<ReturnType<typeof getEffectiveTranscriptionConfig>>;
  let resolve!: (config: Config) => void;
  jest.mocked(getEffectiveTranscriptionConfig).mockImplementationOnce(
    () =>
      new Promise<Config>((done) => {
        resolve = done;
      }),
  );
  const startRecording = jest.fn();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ startRecording }));
  render(<SessionListeningPanel sessionSlug="pending-provider" panelMode="recordGroup" />);
  const start = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START);
  expect(start).toBeDisabled();
  fireEvent.click(start);
  expect(startRecording).not.toHaveBeenCalled();
  await act(async () => {
    resolve({ provider: 'openai' } as Config);
  });
  expect(start).toBeEnabled();
  expect(screen.getByRole('checkbox', { name: 'Label speakers' })).toBeChecked();
  expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: true }));
  fireEvent.click(start);
  expect(startRecording).toHaveBeenCalledTimes(1);
});

it('generates with a gap warning and offers closing while keeping pending audio', async () => {
  const finalizeRecording = jest.fn(async (_options?: { waitForTranscription?: boolean }) => undefined);
  const keepAudio = jest.fn(async () => undefined);
  const onClose = jest.fn();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      transcript:
        'A useful transcript with enough detail to generate questions. [Recording gap: chunk 2 could not be transcribed.]',
      segments: [
        {
          id: 'done',
          index: 0,
          status: 'complete',
          text: 'A useful transcript with enough detail to generate questions.',
          startedAt: 1,
        },
        { id: 'failed', index: 1, status: 'failed', text: '', startedAt: 2 },
      ],
      downloadableChunkIds: ['failed'],
      finalizeRecording,
      keepAudio,
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" onClose={onClose} />);
  expect(screen.getByText(/Some audio couldn't be transcribed/)).toBeInTheDocument();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep the audio' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(finalizeRecording).toHaveBeenCalledWith({ waitForTranscription: false });
  expect(keepAudio).toHaveBeenCalledTimes(1);
});

it('clears a recording with a Failed chunk only after confirming that its audio will be deleted', async () => {
  const clearDraft = jest.fn();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      transcript: 'Saved speech before the gap. [Recording gap: chunk 2 could not be transcribed.]',
      segments: [
        { id: 'done', index: 0, status: 'complete', text: 'Saved speech before the gap.', startedAt: 1 },
        { id: 'failed', index: 1, status: 'failed', text: '', startedAt: 2 },
      ],
      downloadableChunkIds: ['failed'],
      clearDraft,
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" />);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_CLEAR));
  expect(clearDraft).not.toHaveBeenCalled();
  expect(await screen.findByText(/the audio not yet transcribed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep recording' }));
  expect(clearDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_CLEAR));
  fireEvent.click(await screen.findByRole('button', { name: 'Clear recording' }));
  expect(clearDraft).toHaveBeenCalledWith(true);
});

it('does not generate questions from a transcript that only marks recording gaps', () => {
  const gapOnly = '[Recording gap: chunk 1 could not be transcribed.]';
  expect(gapOnly.length).toBeGreaterThanOrEqual(50);
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      transcript: gapOnly,
      segments: [{ id: 'failed', index: 0, status: 'failed', text: '', startedAt: 1 }],
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" />);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeDisabled();
});

it('does not count Person labels as speech toward generating questions', () => {
  const transcript = 'Person 1: Should we?\nPerson 2: Yes.\nPerson 3: Fine.\nPerson 1: Vote now.';
  expect(transcript.length).toBeGreaterThanOrEqual(50);
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      transcript,
      segments: [{ id: 'done', index: 0, status: 'complete', text: 'Should we? Yes. Fine. Vote now.', startedAt: 1 }],
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" />);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_GENERATE)).toBeDisabled();
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS));
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent(transcript.replace(/\n/g, ''));
});

it('explains speaker numbering without exposing audio parts, with the reason behind a question mark', async () => {
  const chunk = (index: number, speakersRenumbered?: boolean) => ({
    id: `chunk-${index}`,
    index,
    status: 'complete',
    text: 'Speech.',
    startedAt: index,
    speakersRenumbered,
  });
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ transcript: 'Person 1: Speech.', segments: [chunk(0), chunk(1, true), chunk(2, true)] }),
  );
  render(<SessionListeningPanel sessionSlug="room" panelMode="recordGroup" />);
  expect(await screen.findByText('Some speaker numbers may change during the conversation.')).toBeInTheDocument();
  const help = screen.getByRole('button', { name: 'About restarted Person numbers' });
  expect(help).toHaveAccessibleDescription(/Person number may refer to someone different/);
});

it('stays busy while a close finishes, so the dialog keeps Back off until it has', async () => {
  const onBusyChange = jest.fn();
  let finish = () => {};
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      finalizeRecording: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
      keepAudio: jest.fn(async () => {}),
    }),
  );
  const onClose = jest.fn();
  render(<SessionListeningPanel sessionSlug="room" onClose={onClose} onBusyChange={onBusyChange} />);
  expect(onBusyChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Close listening panel'));
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => finish());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it('offers Close and keep the audio only after capture stops, with its explanation behind a question mark', () => {
  const onBusyChange = jest.fn();
  const pending = { segments: [{ id: 'up', index: 0, status: 'transcribing', text: '', startedAt: 1 }] };
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ ...pending, pendingSegmentCount: 1, isRecording: true, status: 'recording' }),
  );
  const { rerender } = render(
    <SessionListeningPanel sessionSlug="room" onClose={jest.fn()} onBusyChange={onBusyChange} />,
  );
  expect(screen.queryByRole('button', { name: 'Close and keep the audio' })).not.toBeInTheDocument();
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ ...pending, pendingSegmentCount: 1 }));
  rerender(<SessionListeningPanel sessionSlug="room" onClose={jest.fn()} onBusyChange={onBusyChange} />);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  const keep = screen.getByRole('button', { name: 'Close and keep the audio' });
  const help = screen.getByRole('button', { name: 'About closing and keeping the audio' });
  expect(keep).toHaveAccessibleDescription(/resumes uploading when you reopen this recording/);
  expect(help).toHaveAccessibleDescription(/resumes uploading when you reopen this recording/);
});

it('applies a provider check that answers after two seconds as long as Record has not been pressed', async () => {
  jest.useFakeTimers();
  type Config = Awaited<ReturnType<typeof getEffectiveTranscriptionConfig>>;
  let resolve!: (config: Config) => void;
  jest.mocked(getEffectiveTranscriptionConfig).mockImplementationOnce(
    () =>
      new Promise<Config>((done) => {
        resolve = done;
      }),
  );
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder());
  try {
    render(<SessionListeningPanel sessionSlug="slow-provider" panelMode="recordGroup" />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText(/Speaker label check timed out/)).toBeInTheDocument();
    await act(async () => {
      resolve({ provider: 'openai' } as Config);
    });
    expect(screen.getByRole('checkbox', { name: 'Label speakers' })).toBeChecked();
    expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: true }));
    expect(screen.queryByText(/Speaker label check timed out/)).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

it('makes Record available with plain transcription after two seconds and ignores a late provider result', async () => {
  jest.useFakeTimers();
  type Config = Awaited<ReturnType<typeof getEffectiveTranscriptionConfig>>;
  let resolve!: (config: Config) => void;
  jest.mocked(getEffectiveTranscriptionConfig).mockImplementationOnce(
    () =>
      new Promise<Config>((done) => {
        resolve = done;
      }),
  );
  const startRecording = jest.fn();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({ startRecording }));
  try {
    render(<SessionListeningPanel sessionSlug="timed-provider" panelMode="recordGroup" />);
    const start = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1999);
    });
    expect(start).toBeDisabled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(start).toBeEnabled();
    expect(screen.getByText(/Speaker label check timed out/)).toHaveTextContent('plain transcription');
    fireEvent.click(start);
    expect(startRecording).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ provider: 'openai' } as Config);
    });
    expect(useRollingTranscriptionRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ labelSpeakers: false }));
    expect(screen.queryByRole('checkbox', { name: 'Label speakers' })).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

it('says when the device has paused the microphone, and that recording resumes', () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ isRecording: true, status: 'recording', wakeLockHeld: true, microphonePaused: true }),
  );
  const { rerender } = render(<SessionListeningPanel sessionSlug="room" panelMode="recordGroup" />);
  expect(screen.getByText('Microphone paused by the device. Recording resumes when it returns.')).toHaveAttribute(
    'role',
    'status',
  );
  expect(screen.getByText('Mic paused')).toBeInTheDocument();
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ isRecording: true, status: 'recording', wakeLockHeld: true }),
  );
  rerender(<SessionListeningPanel sessionSlug="room" panelMode="recordGroup" />);
  expect(screen.queryByText(/Microphone paused by the device/)).not.toBeInTheDocument();
  expect(screen.getByText('Recording')).toBeInTheDocument();
});

it('keeps Record off while another tab has the recording open', () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({ openElsewhere: true, errorMessage: 'This recording is open in another tab.' }),
  );
  render(<SessionListeningPanel sessionSlug="room" />);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START)).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('This recording is open in another tab.');
});

it('says when the recorder restarted the microphone because no audio arrived', () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      isRecording: true,
      status: 'recording',
      wakeLockHeld: true,
      captureRestarts: 1,
      captureNotice: 'No audio arrived for a while, so the microphone was restarted.',
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" panelMode="recordGroup" />);
  expect(screen.getByText('No audio arrived for a while, so the microphone was restarted.')).toHaveAttribute(
    'role',
    'status',
  );
});

it('gives the recorder text actions one outlined button style', () => {
  (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(
    buildRecorder({
      hiddenPeriods: [{ startedAt: 1_000, endedAt: 2_000 }],
      dismissHiddenPeriods: jest.fn(),
      // A stalled upload offers Retry.
      segments: [
        { id: 'up', index: 0, status: 'transcribing', text: '', startedAt: 1, error: 'The upload stopped responding.' },
      ],
      pendingSegmentCount: 1,
      downloadableChunkIds: ['up'],
    }),
  );
  render(<SessionListeningPanel sessionSlug="room" panelMode="recordGroup" onClose={jest.fn()} />);
  // The default secondary button is white on a light dialog, and Minimal drops button borders.
  ['Dismiss hidden-page notice', 'Close and keep the audio', 'Retry transcription', 'Download audio'].forEach((name) =>
    expect(screen.getByRole('button', { name })).toHaveClass('sessionRecordingButton'),
  );
});
