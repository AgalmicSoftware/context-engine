import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBroom,
  faMicrophone,
  faQuestionCircle,
  faSpinner,
  faStop,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';
import styles from './SurveyTool.module.scss';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS } from '../../utilities/audio/rollingTranscription';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  generateQuestionsFromListeningTranscript,
  LISTENING_QUESTION_COUNT,
} from './sessionListeningQuestions';

type SessionListeningPanelProps = Record<string, unknown> & {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  defaultTags?: string | string[] | null;
  onClose?: () => void;
};

const formatElapsed = (secondsRaw: unknown) => {
  const seconds = Math.max(0, Math.floor(Number(secondsRaw || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const getSessionInstructions = (sessionConfig: unknown) => (
  sessionConfig && typeof sessionConfig === 'object'
    ? (sessionConfig as Record<string, unknown>).questionsGenPrompt || ''
    : ''
);

export default function SessionListeningPanel(props: SessionListeningPanelProps) {
  const {
    sessionSlug = '',
    sessionConfig = null,
    context,
    workerUrl,
    defaultTags = null,
    onClose,
  } = props;
  const recorder = useRollingTranscriptionRecorder({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    chunkMs: DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<unknown[]>([]);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generationKey, setGenerationKey] = useState(0);

  const completedCount = useMemo(
    () => recorder.segments.filter((segment) => segment.status === 'complete').length,
    [recorder.segments],
  );
  const failedCount = useMemo(
    () => recorder.segments.filter((segment) => segment.status === 'error').length,
    [recorder.segments],
  );
  const canGenerate = recorder.transcript.trim().length >= 50 && !isGenerating;

  const handleGenerateQuestions = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerationError('');
    try {
      const result = await generateQuestionsFromListeningTranscript(recorder.transcript, {
        sessionSlug,
        sessionConfig,
        context,
        workerUrl,
        defaultTags,
        count: LISTENING_QUESTION_COUNT,
        sessionInstructions: getSessionInstructions(sessionConfig),
      });
      setGeneratedQuestions(result.statements);
      setGeneratedTitle(result.surveyTitle);
      setGenerationKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'Failed to generate questions.');
      setGenerationError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    recorder.clearDraft();
    setGeneratedQuestions([]);
    setGeneratedTitle('');
    setGenerationError('');
  };

  return (
    <aside className={styles.sessionListeningPanel} data-testid={E2E_TESTIDS.SESSION_LISTENING_PANEL}>
      <div className={styles.sessionListeningHeader}>
        <div className={styles.sessionListeningTitle}>
          <FontAwesomeIcon icon={faMicrophone} />
          <span>Listening</span>
        </div>
        <button
          type="button"
          className={styles.sessionListeningClose}
          onClick={onClose}
          aria-label="Close listening panel"
          title="Close"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      <div className={styles.sessionListeningControls}>
        {recorder.isRecording ? (
          <Button
            type="button"
            className={styles.sessionListeningPrimary}
            onClick={recorder.stopRecording}
            disabled={recorder.isStopping}
            data-testid={E2E_TESTIDS.SESSION_LISTENING_STOP}
          >
            <FontAwesomeIcon icon={recorder.isStopping ? faSpinner : faStop} spin={recorder.isStopping} />
            <span>Stop</span>
          </Button>
        ) : (
          <Button
            type="button"
            className={styles.sessionListeningPrimary}
            onClick={recorder.startRecording}
            disabled={recorder.isBusy}
            data-testid={E2E_TESTIDS.SESSION_LISTENING_START}
          >
            <FontAwesomeIcon icon={recorder.isBusy ? faSpinner : faMicrophone} spin={recorder.isBusy} />
            <span>Record</span>
          </Button>
        )}

        <button
          type="button"
          className={styles.sessionListeningIconButton}
          onClick={handleClear}
          disabled={recorder.isRecording || recorder.isBusy}
          aria-label="Clear listening draft"
          title="Clear draft"
        >
          <FontAwesomeIcon icon={faBroom} />
        </button>

        <div className={styles.sessionListeningMeta} aria-live="polite">
          <span>{formatElapsed(recorder.elapsedSeconds)}</span>
          <span>{completedCount} done</span>
          {recorder.pendingSegmentCount > 0 && <span>{recorder.pendingSegmentCount} pending</span>}
          {failedCount > 0 && <span>{failedCount} failed</span>}
        </div>
      </div>

      {(recorder.errorMessage || generationError) && (
        <div className={styles.sessionListeningError} role="alert">
          {recorder.errorMessage || generationError}
        </div>
      )}

      <textarea
        className={styles.sessionListeningTranscript}
        value={recorder.transcript}
        readOnly
        placeholder="Transcript"
        data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT}
      />

      <div className={styles.sessionListeningActions}>
        <Button
          type="button"
          className={styles.sessionListeningGenerate}
          onClick={handleGenerateQuestions}
          disabled={!canGenerate}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_GENERATE}
        >
          <FontAwesomeIcon icon={isGenerating ? faSpinner : faQuestionCircle} spin={isGenerating} />
          <span>{isGenerating ? 'Generating' : 'Generate questions'}</span>
        </Button>
      </div>

      {generatedQuestions.length > 0 && (
        <div className={styles.sessionListeningCreateWrap} data-testid={E2E_TESTIDS.SESSION_LISTENING_SUGGESTIONS}>
          <CreateQuestionsAndSurveys
            {...(props as any)}
            key={`listening-generated-${generationKey}`}
            preformedQuestions={generatedQuestions as any}
            preformedSurvey={{ title: generatedTitle }}
            defaultTags={defaultTags as any}
            documentURLs={[]}
          />
        </div>
      )}
    </aside>
  );
}
