import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionListeningPanel from './SessionListeningPanel';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  generateQuestionsFromListeningTranscript,
} from './sessionListeningQuestions';

jest.mock('../../utilities/audio/useRollingTranscriptionRecorder', () => ({
  useRollingTranscriptionRecorder: jest.fn(),
}));

jest.mock('./sessionListeningQuestions', () => ({
  generateQuestionsFromListeningTranscript: jest.fn(),
  LISTENING_QUESTION_COUNT: 5,
}));

jest.mock('./CreateQuestionsAndSurveys', () => (props: any) => (
  <div
    data-testid="mock-create-questions"
    data-title={props.preformedSurvey?.title || ''}
    data-count={props.preformedQuestions?.length || 0}
  />
));

const buildRecorder = (overrides: Record<string, unknown> = {}) => ({
  status: 'idle',
  isRecording: false,
  isStopping: false,
  isBusy: false,
  elapsedSeconds: 0,
  transcript: '',
  segments: [],
  pendingSegmentCount: 0,
  errorMessage: '',
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  clearDraft: jest.fn(),
  ...overrides,
});

describe('SessionListeningPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts recording only from the explicit Record control', () => {
    const startRecording = jest.fn();
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({
      startRecording,
    }));

    render(<SessionListeningPanel sessionSlug="demo" />);

    expect(startRecording).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_START));
    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it('generates reviewable draft questions from the stitched transcript', async () => {
    const transcript = 'The group discussed budget timing, operational risk, ownership, rollout scope, and follow-up evidence.';
    (useRollingTranscriptionRecorder as jest.Mock).mockReturnValue(buildRecorder({
      transcript,
      segments: [{ id: 's1', index: 0, status: 'complete', text: transcript, startedAt: 1 }],
    }));
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
      />
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
          workerUrl: 'https://worker.example',
        })
      );
    });
    expect(await screen.findByTestId('mock-create-questions')).toHaveAttribute('data-title', 'Listening Follow-up');
    expect(screen.getByTestId('mock-create-questions')).toHaveAttribute('data-count', '1');
  });
});
