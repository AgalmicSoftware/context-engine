import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import { appendInterviewTranscript, mergeInterviewReview } from './sessionInterviewReviewState';
import { useInterviewReadiness } from './useInterviewReadiness';
import { useInterviewQuestionUpdates } from './useInterviewQuestionUpdates';
import SessionInterviewSuggestions from './SessionInterviewSuggestions';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import SessionInterviewResearchConsent from './SessionInterviewResearchConsent';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';
import { useInterviewOpening } from './useInterviewOpening';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCheck,
  faClipboard,
  faCircle,
  faComments,
  faMicrophone,
  faPause,
  faPlay,
  faSpinner,
  faStop,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import SessionInterviewPrompt from './SessionInterviewPrompt';
import SessionInterviewDraftCard, { type InterviewQuestionControls } from './SessionInterviewDraftCard';
import SessionListeningPanel, {
  formatSessionRecordingElapsed,
  SessionListeningWaveform,
} from './SessionListeningPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import {
  buildExternalInterviewKickoff,
  buildRealtimeInterviewInstructions,
  hashInterviewQuestions,
  mapInterviewEvidenceToResponses,
  normalizeInterviewQuestions,
  readImportedInterviewDraftResponses,
  type InterviewDraftResponse,
  type InterviewPrefillPacket,
  type InterviewQuestion,
  type InterviewResearchCoverage,
  type SessionVoiceMode,
} from './sessionInterview';
import { useSessionInterviewRecorder } from './useSessionInterviewRecorder';

type UnknownRecord = Record<string, unknown>;

type InterviewDraftApplicationProps = InterviewQuestionControls & {
  questionCreatorProps?: React.ComponentProps<typeof SessionInterviewSuggestions>['creatorProps'];
  onSubmitResponses?: () => void | Promise<void>;
  onClose: () => void;
  onApplyAnswer: (questionId: string, answer: unknown) => void | Promise<void>;
  onApplyAdditional: (questionId: string, comments: string) => void | Promise<void>;
  onApplyImportance: (questionId: string, importance: number) => void | Promise<void>;
  onApplyConviction: (questionId: string, conviction: number) => void | Promise<void>;
  onRecordProvenance?: (
    drafts: InterviewDraftResponse[],
    source: InterviewPrefillPacket['source'] | null,
    packet: InterviewPrefillPacket | null,
    included: boolean,
    includePredictionComparison: boolean,
    responderName: string,
    review?: Array<InterviewDraftResponse & { selected: boolean; original: InterviewDraftResponse }>,
  ) => void | Promise<void>;
};

type SessionVoiceModeModalProps = InterviewDraftApplicationProps & {
  isOpen: boolean;
  mode: SessionVoiceMode | null;
  onSelectMode: (mode: SessionVoiceMode) => void;
  sessionSlug?: string;
  sessionConfig?: UnknownRecord | null;
  context?: unknown;
  workerUrl?: string;
  questionPool?: unknown[];
  existingResponseSlice?: UnknownRecord | null;
  prefillPacket?: InterviewPrefillPacket | null;
  initialError?: string;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const responseFieldValue = (slice: UnknownRecord | null | undefined, field: string, questionId: string): unknown =>
  asRecord(asRecord(asRecord(slice)[field])[questionId]).value;

const hasDraftValue = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);

const displayResponderContext = (packet: InterviewPrefillPacket | null): string => {
  if (!packet) return '';
  const summary = String(packet.responderContext?.summary || '').trim();
  if (summary) return summary;
  return (packet.responderContext?.facts || [])
    .map((entry) => String(entry?.fact || '').trim())
    .filter(Boolean)
    .join('\n');
};

const describeResearchCoverage = (coverage: InterviewResearchCoverage | undefined): string[] => {
  if (!coverage) return [];
  const describeResource = (label: string, searched: number | null, used: number | null): string => {
    if (searched === null && used === null) return '';
    if (searched !== null) return `${label}: ${used === null ? 'unknown' : used} used / ${searched} searched`;
    return `${label}: ${used} used`;
  };
  return [
    describeResource('History chats', coverage.historyChatsSearched, coverage.historyChatsUsed),
    describeResource('Memories', coverage.memoryItemsSearched, coverage.memoryItemsUsed),
    describeResource('Connected sources', coverage.connectedSourcesSearched, coverage.connectedSourcesUsed),
    coverage.userStatementsUsed !== null ? `${coverage.userStatementsUsed} user statements used` : '',
  ].filter(Boolean);
};

type SessionInterviewPanelProps = InterviewDraftApplicationProps & {
  questions: InterviewQuestion[];
  sessionSlug?: string;
  sessionConfig?: UnknownRecord | null;
  context?: unknown;
  workerUrl?: string;
  existingResponseSlice?: UnknownRecord | null;
  prefillPacket?: InterviewPrefillPacket | null;
  initialError?: string;
};

function SessionInterviewPanel({
  questions: initialQuestions,
  sessionSlug = '',
  sessionConfig = null,
  context,
  workerUrl = '',
  existingResponseSlice = null,
  prefillPacket = null,
  initialError = '',
  questionCreatorProps,
  onApplyAnswer,
  onApplyAdditional,
  onApplyImportance,
  onApplyConviction,
  onRecordProvenance,
  onSubmitResponses,
  renderAnswerInput,
  renderAdditionalInput,
  renderFieldLock,
  onClose,
}: SessionInterviewPanelProps) {
  const disposedRef = useRef(false);
  const importedRef = useRef(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resolvedWorkerUrl, setResolvedWorkerUrl] = useState(workerUrl);
  const readiness = useInterviewReadiness(resolvedWorkerUrl, sessionSlug);
  const interviewOpening = useInterviewOpening({
    config: sessionConfig,
    workerUrl: resolvedWorkerUrl,
    sessionSlug,
    hasQuestions: initialQuestions.length > 0,
  });
  const [responderContext, setResponderContext] = useState(() => displayResponderContext(prefillPacket));
  const [status, setStatus] = useState(initialError ? 'Error' : 'Ready');
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const roundBaseTranscriptRef = useRef('');
  const receiveTranscript = (current: string) => {
    const combined = appendInterviewTranscript(roundBaseTranscriptRef.current, current);
    transcriptRef.current = combined;
    setTranscript(combined);
  };
  const [mapping, setMapping] = useState(false);
  const [mappingNotice, setMappingNotice] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(initialError);
  const [suggestedQuestions, setSuggestedQuestions] = useState<GeneratedSurveyStatement[]>([]);
  const [drafts, setDrafts] = useState<InterviewDraftResponse[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editedDrafts, setEditedDrafts] = useState<Record<string, InterviewDraftResponse>>({});
  const hasAiPrefill = Boolean(prefillPacket && prefillPacket.source.modelId !== 'direct-user-context');
  const hasPredictionRevisions = drafts.some((draft) => (draft.revisions?.length || 0) > 1);
  const researchAvailable = hasAiPrefill || hasPredictionRevisions;
  const researchPacket: InterviewPrefillPacket = prefillPacket || {
    version: 1,
    sessionSlug,
    source: { platform: 'other', modelId: DEFAULT_AI_MODEL, verification: 'self_reported' },
    responderContext: {},
  };
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const [includePredictionComparison, setIncludePredictionComparison] = useState(true);
  const [includeResponderName, setIncludeResponderName] = useState(false);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  useEffect(() => {
    if (workerUrl) setResolvedWorkerUrl(workerUrl);
  }, [workerUrl]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const resolveWorkerUrl = useCallback(async () => {
    if (resolvedWorkerUrl) return resolvedWorkerUrl;
    const value = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context,
      allowDemoFallback: false,
    });
    if (!disposedRef.current) setResolvedWorkerUrl(value);
    return value;
  }, [context, resolvedWorkerUrl, sessionConfig, sessionSlug]);

  useEffect(() => {
    if (resolvedWorkerUrl) return;
    void resolveWorkerUrl().catch(() => {
      if (!disposedRef.current)
        setError('The session Worker is unavailable. Check the session connection and try again.');
    });
  }, [resolveWorkerUrl, resolvedWorkerUrl]);

  const recorder = useSessionInterviewRecorder({
    sessionSlug,
    resolveWorkerUrl,
    onStatus: setStatus,
    onError: setError,
    onTranscript: receiveTranscript,
  });
  const { audioRef, mediaStreamRef, recordingState, recordingElapsedSeconds } = recorder;
  const reviewRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef<HTMLButtonElement | null>(null);
  const stopControlRef = useRef<HTMLButtonElement | null>(null);
  const previousRecordingState = useRef(recordingState);
  const mappingRef = useRef(false);
  const applyingRef = useRef(false);
  const isStarting = recordingState === 'starting';
  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const isStopping = recordingState === 'stopping';
  const isRecorderSessionActive = isRecording || isPaused || isStopping;
  const isInterviewBusy = isStarting || isRecorderSessionActive;
  const updates = useInterviewQuestionUpdates({
    initialQuestions,
    config: sessionConfig,
    workerUrl: resolvedWorkerUrl,
    sessionSlug,
    active: isRecording,
    append: recorder.appendInstructions,
  });
  const questions = updates.questions;

  useEffect(() => {
    if (isStarting || mapping) statusRef.current?.focus();
    else if (isRecording && previousRecordingState.current === 'starting') stopControlRef.current?.focus();
    previousRecordingState.current = recordingState;
  }, [isStarting, isRecording, recordingState, mapping]);

  const runMapping = useCallback(
    async ({ nextTranscript = transcript }: { nextTranscript?: string } = {}) => {
      if (disposedRef.current || mappingRef.current) return;
      if (!nextTranscript.trim() && !prefillPacket && !responderContext.trim()) {
        setError('');
        setMappingNotice(
          'Not enough information to generate response drafts. Record an interview or add relevant responder context first.',
        );
        setStatus('Not enough information');
        return;
      }
      mappingRef.current = true;
      setMapping(true);
      setError('');
      setMappingNotice('');
      setStatus('Preparing drafts');
      try {
        if (prefillPacket?.questionSetHash) {
          const currentQuestionSetHash = await hashInterviewQuestions(questions);
          if (disposedRef.current) return;
          if (currentQuestionSetHash !== prefillPacket.questionSetHash) {
            throw new Error(
              'This prefill link was created for an older or different question set. Ask the AI for a fresh link.',
            );
          }
        }
        const importedDrafts = nextTranscript.trim()
          ? null
          : readImportedInterviewDraftResponses(prefillPacket, questions);
        let mapped = importedDrafts;
        let proposedQuestions: GeneratedSurveyStatement[] = [];
        if (mapped === null) {
          const url = await resolveWorkerUrl();
          if (disposedRef.current) return;
          const contextPacket: InterviewPrefillPacket | null =
            prefillPacket ||
            (responderContext.trim()
              ? {
                  version: 1,
                  sessionSlug,
                  source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
                  responderContext: { summary: responderContext.trim() },
                }
              : null);
          mapped = await mapInterviewEvidenceToResponses({
            questions,
            transcript: nextTranscript,
            prefillPacket: contextPacket,
            sessionSlug,
            sessionConfig,
            workerUrl: url,
            previousResponses: drafts.map(({ revisions: _revisions, ...prediction }) => ({
              prediction,
              reviewed: {
                answer: editedDrafts[prediction.questionId]?.answer,
                additionalComments: editedDrafts[prediction.questionId]?.additionalComments,
              },
              selected: selected[prediction.questionId],
            })),
            onSuggestedQuestions: (next) => {
              proposedQuestions = next;
            },
          });
        }
        if (disposedRef.current) return;
        const combinedQuestions = [...suggestedQuestions];
        const knownPrompts = new Set(combinedQuestions.map((question) => question.prompt.trim().toLowerCase()));
        for (const question of proposedQuestions) {
          if (!knownPrompts.has(question.prompt.trim().toLowerCase())) {
            combinedQuestions.push(question);
            knownPrompts.add(question.prompt.trim().toLowerCase());
          }
        }
        setSuggestedQuestions(combinedQuestions);
        const review = mergeInterviewReview(
          drafts,
          editedDrafts,
          selected,
          mapped,
          (id) => !hasDraftValue(responseFieldValue(existingResponseSlice, 'answers', id)),
          importedDrafts ? prefillPacket?.source.modelId : DEFAULT_AI_MODEL,
        );
        for (const draft of review.drafts) {
          if (!editedDrafts[draft.questionId] && !review.edited[draft.questionId]?.additionalComments) {
            review.edited[draft.questionId] = {
              ...review.edited[draft.questionId],
              additionalComments: String(
                responseFieldValue(existingResponseSlice, 'additionalComments', draft.questionId) || '',
              ),
            };
          }
        }
        setDrafts(review.drafts);
        setEditedDrafts(review.edited);
        setSelected(review.selected);
        setMappingNotice(
          review.drafts.length
            ? ''
            : combinedQuestions.length
              ? 'No response drafts matched the current bank. Review the suggested new questions below.'
              : 'Not enough information to generate response drafts. The interview evidence did not contain enough directly relevant detail to answer a session question. Start another interview and share more detail, or augment it with relevant memories from Claude or ChatGPT.',
        );
        setStatus(review.drafts.length || combinedQuestions.length ? 'Review drafts' : 'Ready');
      } catch (mappingError) {
        if (disposedRef.current) return;
        setMappingNotice('');
        setError(mappingError instanceof Error ? mappingError.message : 'Could not generate response drafts.');
        setStatus('Error');
      } finally {
        mappingRef.current = false;
        if (!disposedRef.current) setMapping(false);
      }
    },
    [
      drafts,
      editedDrafts,
      selected,
      suggestedQuestions,
      existingResponseSlice,
      prefillPacket,
      questions,
      resolveWorkerUrl,
      responderContext,
      sessionConfig,
      sessionSlug,
      transcript,
    ],
  );

  useEffect(() => {
    if (!prefillPacket || importedRef.current || !questions.length) return;
    importedRef.current = true;
    void runMapping({ nextTranscript: '' });
  }, [prefillPacket, questions.length, runMapping]);

  useEffect(() => {
    if (drafts.length && !mapping) {
      reviewRef.current?.focus();
      reviewRef.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [drafts, mapping]);

  const startInterview = () => {
    if (isInterviewBusy || mappingRef.current || applying) return;
    setMappingNotice('');
    roundBaseTranscriptRef.current = transcriptRef.current;
    setShowTranscript(false);
    void recorder.start(
      buildRealtimeInterviewInstructions({
        questions,
        responderContext,
        openingPrompt: interviewOpening.opening,
        previousTranscript: transcriptRef.current,
      }),
    );
  };

  const endInterview = async () => {
    try {
      const result = await recorder.stop();
      if (!result || disposedRef.current) return;
      const combined = appendInterviewTranscript(roundBaseTranscriptRef.current, result.transcript);
      transcriptRef.current = combined;
      setTranscript(combined);
      setShowTranscript(false);
      if (!result.transcript.trim() && roundBaseTranscriptRef.current.trim()) {
        setStatus(drafts.length || suggestedQuestions.length ? 'Review drafts' : 'Ready');
        return;
      }
      await runMapping({ nextTranscript: combined });
    } catch (stopError) {
      if (disposedRef.current) return;
      setError(
        stopError instanceof Error
          ? stopError.message
          : 'Could not finish the interview. Retry draft generation from the captured transcript.',
      );
      setStatus('Error');
    }
  };

  const applyDrafts = async () => {
    if (applyingRef.current || isInterviewBusy || mappingRef.current) return;
    const applied = drafts.filter((draft) => selected[draft.questionId]);
    if (!applied.length) return;
    applyingRef.current = true;
    setApplying(true);
    setError('');
    setStatus('Preparing submission…');
    try {
      for (const original of applied) {
        if (disposedRef.current) return;
        const draft = editedDrafts[original.questionId] || original;
        await onApplyAnswer(draft.questionId, draft.answer);
        await onApplyAdditional(draft.questionId, draft.additionalComments || '');
        if (draft.importance !== undefined) await onApplyImportance(draft.questionId, draft.importance);
        if (draft.conviction !== undefined) await onApplyConviction(draft.questionId, draft.conviction);
      }
      if (disposedRef.current) return;
      if (applied.length) {
        const directContextSource =
          !prefillPacket && !transcript.trim() && responderContext.trim()
            ? { platform: 'other' as const, modelId: 'direct-user-context', verification: 'self_reported' as const }
            : null;
        await onRecordProvenance?.(
          applied,
          prefillPacket?.source || directContextSource,
          prefillPacket,
          hasAiPrefill && includeProvenance,
          researchAvailable && includePredictionComparison,
          includeResponderName ? String(prefillPacket?.responderContext?.name || '').trim() : '',
          drafts.map((draft) => ({
            ...editedDrafts[draft.questionId],
            original: draft,
            selected: Boolean(selected[draft.questionId]),
          })),
        );
      }
      if (disposedRef.current) return;
      onClose();
      await onSubmitResponses?.();
    } catch (applyError) {
      if (disposedRef.current) return;
      setError(applyError instanceof Error ? applyError.message : 'Could not apply the selected drafts.');
      setStatus('Draft application failed');
    } finally {
      applyingRef.current = false;
      if (!disposedRef.current) setApplying(false);
    }
  };

  const copyAgentPrompt = async () => {
    if (!kickoff || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(kickoff);
      setPromptCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  };

  const sessionUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const kickoff = resolvedWorkerUrl
    ? buildExternalInterviewKickoff({ workerUrl: resolvedWorkerUrl, sessionSlug, sessionUrl })
    : '';
  const importedContext = prefillPacket?.responderContext;
  const importedResponderName = String(importedContext?.name || '').trim();
  const researchCoverage = prefillPacket?.source?.researchCoverage;
  const researchCoverageDetails = describeResearchCoverage(researchCoverage);
  const hasImportedResponderContext = Boolean(importedContext?.summary?.trim() || importedContext?.facts?.length);

  const guidance = isPaused
    ? 'Microphone and interviewer sound are paused. Resume to continue, or stop to prepare drafts.'
    : isRecording
      ? 'Microphone is on. Stop when you are ready to review your drafts.'
      : isStarting
        ? 'Connecting your microphone and voice session. Close this dialog to cancel.'
        : drafts.length
          ? 'Review and edit your answers and privacy settings, then select Submit responses. You will be asked to sign in if needed.'
          : 'Speak with an AI interviewer. Stopping prepares drafts for your review. You choose when to submit responses.';
  const idle = !isInterviewBusy && !mapping && !applying;
  const statusLabel = error
    ? 'Error'
    : mapping
      ? 'Preparing drafts'
      : applying
        ? 'Submitting'
        : idle && !questions.length
          ? 'No questions'
          : idle && readiness.state === 'checking'
            ? 'Checking setup'
            : idle && readiness.state === 'unavailable'
              ? 'Setup needed'
              : idle && readiness.state === 'unknown'
                ? 'Not checked'
                : idle && interviewOpening.loading
                  ? 'Preparing opening'
                  : status;
  const statusTone =
    error || (idle && (!questions.length || readiness.state === 'unavailable'))
      ? 'error'
      : isStarting ||
          isPaused ||
          isStopping ||
          mapping ||
          applying ||
          (idle && (readiness.state !== 'ready' || interviewOpening.loading))
        ? 'pending'
        : 'ready';
  const startLabel = interviewOpening.loading
    ? 'Preparing opening…'
    : isStarting
      ? 'Connecting…'
      : transcript.trim()
        ? 'Continue interview'
        : 'Start voice interview';

  return (
    <>
      <ModalHeader toggle={onClose}>
        <span className={styles.sessionInterviewHeader}>
          <span id="ce-session-voice-mode-title">Interview</span>
          <button
            type="button"
            id="ce-interview-help"
            className={styles.sessionInterviewHeaderButton}
            aria-label="About Interview"
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <UncontrolledTooltip target="ce-interview-help" placement="bottom" trigger="hover focus" autohide={false}>
            {guidance}
          </UncontrolledTooltip>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Interview status: ${statusLabel}`}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STATUS}
          >
            <button
              type="button"
              id="ce-interview-status-help"
              ref={statusRef}
              className={styles.sessionInterviewStatusPill}
              data-tone={statusTone}
              onClick={idle ? readiness.retry : undefined}
              aria-label={`Interview status: ${statusLabel}`}
            >
              <span className={styles.sessionInterviewStatusDot} data-tone={statusTone} aria-hidden="true" />
              <span>{statusLabel}</span>
            </button>
          </span>
          <UncontrolledTooltip
            target="ce-interview-status-help"
            placement="bottom"
            trigger="hover focus"
            autohide={false}
          >
            {idle ? `${readiness.detail} Click to check again.` : guidance}
          </UncontrolledTooltip>
        </span>
      </ModalHeader>
      <ModalBody>
        <div className={styles.sessionInterviewPanel} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_PANEL}>
          {hasImportedResponderContext ? (
            <div className={styles.sessionInterviewContext}>
              <Label for="ce-interview-context">Imported responder context</Label>
              <Input
                id="ce-interview-context"
                type="textarea"
                value={responderContext}
                onChange={(event) => {
                  setResponderContext(event.target.value);
                  setMappingNotice('');
                }}
                disabled={isInterviewBusy || mapping}
                className={styles.sessionInterviewContextInput}
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT}
              />
            </div>
          ) : null}

          {researchCoverage ? (
            <section
              className={styles.sessionInterviewResearchCoverage}
              aria-label="Self-reported agent research coverage"
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_RESEARCH_COVERAGE}
            >
              <strong>Self-reported agent research coverage</strong>
              <span>{researchCoverageDetails.join(' · ') || 'Coverage counts unavailable'}</span>
              {researchCoverage.searchScopeNote ? <small>{researchCoverage.searchScopeNote}</small> : null}
            </section>
          ) : null}

          {updates.notice ? <p role="status">{updates.notice}</p> : null}
          {interviewOpening.notice ? <p>{interviewOpening.notice}</p> : null}
          {!questions.length ? <p>No accessible questions are available for this interview.</p> : null}
          <audio ref={audioRef} className={styles.sessionListeningSrOnly} aria-label="Realtime interviewer audio" />
          {idle && readiness.state === 'unavailable' && !error ? (
            <p role="alert">
              {readiness.detail}{' '}
              <button type="button" onClick={readiness.retry}>
                Check again
              </button>
            </p>
          ) : null}
          {error ? (
            <div className={styles.sessionListeningError} role="alert">
              {error}
            </div>
          ) : null}
          <div className={styles.sessionInterviewActions}>
            {!isRecorderSessionActive ? (
              <div className={styles.sessionInterviewPrimaryAction}>
                <Button
                  color="link"
                  className={styles.sessionInterviewMicrophone}
                  aria-label={startLabel}
                  onClick={() => {
                    void startInterview();
                  }}
                  disabled={mapping || applying || !questions.length || isStarting || interviewOpening.loading}
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_START}
                >
                  <FontAwesomeIcon icon={isStarting ? faSpinner : faMicrophone} spin={isStarting} />
                  <span>{startLabel}</span>
                </Button>
              </div>
            ) : (
              <div className={styles.sessionListeningActiveRecorder}>
                <div className={styles.sessionListeningWaveformShell}>
                  <SessionListeningWaveform
                    streamRef={mediaStreamRef}
                    isActive={isRecorderSessionActive}
                    isPaused={isPaused || isStopping}
                  />
                  <div className={styles.sessionListeningWaveformTimer}>
                    <FontAwesomeIcon
                      icon={isStopping ? faSpinner : faCircle}
                      spin={isStopping}
                      className={isPaused ? styles.sessionListeningTimerDotPaused : styles.sessionListeningTimerDot}
                    />
                    <span>{isStopping ? 'Ending' : isPaused ? 'Paused' : 'Listening'}</span>
                    <span>{formatSessionRecordingElapsed(recordingElapsedSeconds)}</span>
                  </div>
                </div>
                <div
                  className={styles.sessionListeningButtonColumn}
                  role="group"
                  aria-label="Interview recording controls"
                >
                  <button
                    type="button"
                    ref={stopControlRef}
                    className={[styles.sessionListeningAudioButton, styles.sessionListeningStopButton].join(' ')}
                    onClick={() => {
                      void endInterview();
                    }}
                    disabled={isStopping}
                    aria-label={isStopping ? 'Stopping interview' : 'Stop interview'}
                    title={isStopping ? 'Stopping interview' : 'Stop interview and generate drafts'}
                    data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STOP}
                  >
                    <FontAwesomeIcon icon={isStopping ? faSpinner : faStop} spin={isStopping} />
                    <span className={styles.sessionListeningSrOnly}>{isStopping ? 'Stopping' : 'Stop'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.sessionListeningAudioButton}
                    onClick={isPaused ? recorder.resume : recorder.pause}
                    disabled={isStopping}
                    aria-label={isPaused ? 'Resume interview' : 'Pause interview'}
                    title={isPaused ? 'Resume interview' : 'Pause interview'}
                  >
                    <FontAwesomeIcon icon={isPaused ? faPlay : faPause} />
                    <span className={styles.sessionListeningSrOnly}>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                </div>
              </div>
            )}
            {!isInterviewBusy &&
            !drafts.length &&
            !mappingNotice &&
            (transcript.trim() || !Array.isArray(prefillPacket?.responses)) &&
            (transcript.trim() || prefillPacket || responderContext.trim()) ? (
              <Button
                outline
                onClick={() => runMapping()}
                disabled={mapping}
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_GENERATE}
              >
                {mapping ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> Mapping…
                  </>
                ) : (
                  'Generate response drafts'
                )}
              </Button>
            ) : null}
          </div>

          {mappingNotice ? (
            <div
              className={styles.sessionInterviewMappingNotice}
              role="status"
              aria-live="polite"
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE}
            >
              {mappingNotice}
            </div>
          ) : null}

          <div className={styles.sessionInterviewResources}>
            {!isInterviewBusy && transcript.trim() ? (
              <section className={styles.sessionInterviewTranscriptDisclosure}>
                <button
                  type="button"
                  className={styles.sessionInterviewTranscriptToggle}
                  onClick={() => setShowTranscript((current) => !current)}
                  aria-expanded={showTranscript}
                  aria-controls="ce-session-interview-transcript-content"
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE}
                >
                  <FontAwesomeIcon
                    icon={faCaretDown}
                    className={`${styles.sessionInterviewTranscriptCaret} ${
                      showTranscript ? '' : styles.sessionInterviewTranscriptCaretCollapsed
                    }`}
                  />
                  <strong>Transcript</strong>
                  <span>{transcript.trim().split(/\s+/).length} words</span>
                </button>
              </section>
            ) : null}

            {kickoff ? (
              <div className={styles.sessionAgentKickoff}>
                <button
                  type="button"
                  className={styles.sessionAgentKickoffTitle}
                  onClick={() => {
                    void copyAgentPrompt();
                  }}
                >
                  Copy and paste this prompt (into your Claude or ChatGPT) to augment interview with relevant memories
                  <span className={styles.sessionAgentKickoffExplanation}>
                    {' '}
                    – this allows your agent to predict your responses
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.sessionAgentKickoffToggle}
                  onClick={() => setShowAgentPrompt((current) => !current)}
                  aria-expanded={showAgentPrompt}
                  aria-controls="ce-session-interview-agent-prompt"
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE}
                >
                  <span>Prompt</span>
                  <FontAwesomeIcon
                    icon={faCaretDown}
                    className={`${styles.sessionAgentKickoffCaret} ${
                      showAgentPrompt ? styles.sessionAgentKickoffCaretExpanded : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  className={`${styles.sessionAgentKickoffCopy} ${promptCopied ? styles.sessionAgentKickoffCopied : ''}`}
                  onClick={() => {
                    void copyAgentPrompt();
                  }}
                  aria-label={promptCopied ? 'Memory augmentation prompt copied' : 'Copy memory augmentation prompt'}
                  title={promptCopied ? 'Copied' : 'Copy memory augmentation prompt'}
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT}
                >
                  <FontAwesomeIcon icon={promptCopied ? faCheck : faClipboard} />
                </button>
              </div>
            ) : null}

            {showTranscript ? (
              <pre
                id="ce-session-interview-transcript-content"
                className={styles.sessionInterviewTranscript}
                aria-label="Transcript"
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT}
              >
                {transcript}
              </pre>
            ) : null}
            {showAgentPrompt ? (
              <div
                id="ce-session-interview-agent-prompt"
                className={styles.sessionAgentKickoffPrompt}
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT}
              >
                <SessionInterviewPrompt prompt={kickoff} />
              </div>
            ) : null}
          </div>

          {drafts.length && !isInterviewBusy && !mapping ? (
            <SessionInterviewReviewSection
              title="Review proposed responses"
              summaryRef={reviewRef}
              testId={E2E_TESTIDS.SESSION_INTERVIEW_REVIEW}
              count={`${drafts.filter((draft) => selected[draft.questionId]).length} of ${drafts.length} selected`}
            >
              {drafts.map((draft) => (
                <SessionInterviewDraftCard
                  key={draft.questionId}
                  draft={draft}
                  edited={editedDrafts[draft.questionId] || draft}
                  question={questions.find((question) => question.id === draft.questionId)}
                  selected={Boolean(selected[draft.questionId])}
                  existing={hasDraftValue(responseFieldValue(existingResponseSlice, 'answers', draft.questionId))}
                  disabled={applying}
                  onSelect={(value) => setSelected((current) => ({ ...current, [draft.questionId]: value }))}
                  onEdit={(patch) =>
                    setEditedDrafts((current) => ({
                      ...current,
                      [draft.questionId]: { ...current[draft.questionId], ...patch },
                    }))
                  }
                  renderAnswerInput={renderAnswerInput}
                  renderAdditionalInput={renderAdditionalInput}
                  renderFieldLock={renderFieldLock}
                />
              ))}
              <div className={styles.sessionInterviewReviewActions}>
                <div className={styles.sessionInterviewConsentOptions}>
                  {researchAvailable ? (
                    <SessionInterviewResearchConsent
                      packet={researchPacket}
                      showProvenance={hasAiPrefill}
                      revisionCount={drafts.reduce((count, draft) => count + (draft.revisions?.length || 0), 0)}
                      includeProvenance={includeProvenance}
                      includeComparison={includePredictionComparison}
                      onProvenanceChange={setIncludeProvenance}
                      onComparisonChange={setIncludePredictionComparison}
                      coverageDetails={researchCoverageDetails}
                      selectedCount={drafts.filter((draft) => selected[draft.questionId]).length}
                      unselectedCount={drafts.filter((draft) => !selected[draft.questionId]).length}
                      disabled={applying}
                    />
                  ) : null}
                  {importedResponderName ? (
                    <Label check className={styles.sessionInterviewProvenance}>
                      <Input
                        type="checkbox"
                        checked={includeResponderName}
                        onChange={(event) => setIncludeResponderName(event.target.checked)}
                        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME}
                      />{' '}
                      Include “{importedResponderName}” as the responder name with submitted responses
                    </Label>
                  ) : null}
                </div>
                <Button
                  color="primary"
                  onClick={() => {
                    void applyDrafts();
                  }}
                  disabled={
                    applying || mapping || isInterviewBusy || !drafts.some((draft) => selected[draft.questionId])
                  }
                  className={styles.sessionInterviewSubmitButton}
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_APPLY}
                >
                  {applying ? 'Preparing submission…' : 'Submit responses'}
                </Button>
              </div>
            </SessionInterviewReviewSection>
          ) : null}
          {suggestedQuestions.length > 0 ? (
            <SessionInterviewSuggestions
              questions={suggestedQuestions}
              creatorProps={questionCreatorProps || {}}
              hidden={isInterviewBusy || mapping}
            />
          ) : null}
        </div>
      </ModalBody>
    </>
  );
}

export default function SessionVoiceModeModal(props: SessionVoiceModeModalProps) {
  const { isOpen, mode, onSelectMode, onClose, questionPool = [] } = props;
  const questions = useMemo(() => normalizeInterviewQuestions(questionPool), [questionPool]);
  const title = mode === 'interview' ? 'Interview' : mode === 'recordGroup' ? 'Group Conversation' : 'Voice mode';
  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      size="lg"
      centered
      labelledBy="ce-session-voice-mode-title"
      returnFocusAfterClose
      contentClassName={styles.sessionVoiceModeModal}
      data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_MODAL}
    >
      {mode === 'interview' ? (
        isOpen ? (
          <SessionInterviewPanel {...props} questions={questions} />
        ) : null
      ) : (
        <>
          <ModalHeader id="ce-session-voice-mode-title" toggle={onClose}>
            {title}
          </ModalHeader>
          <ModalBody>
            {!mode ? (
              <div className={styles.sessionVoiceModeChooser} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER}>
                <button
                  type="button"
                  onClick={() => onSelectMode('interview')}
                  data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW}
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                  <strong>Interview</strong>
                  <span>One person. A voice interviewer generates reviewable response drafts.</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMode('recordGroup')}
                  data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_GROUP}
                >
                  <FontAwesomeIcon icon={faComments} />
                  <strong>Group Conversation</strong>
                  <span>Record a group discussion and generate new question drafts from it.</span>
                </button>
              </div>
            ) : (
              <SessionListeningPanel {...props} panelMode="recordGroup" onClose={onClose} />
            )}
          </ModalBody>
        </>
      )}
      {!mode ? (
        <ModalFooter>
          <Button outline onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      ) : null}
    </Modal>
  );
}
