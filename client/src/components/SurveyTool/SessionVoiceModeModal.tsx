import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import { appendInterviewTranscript, mergeInterviewReview } from './sessionInterviewReviewState';
import { useInterviewReadiness } from './useInterviewReadiness';
import { useInterviewQuestionUpdates } from './useInterviewQuestionUpdates';
import SessionInterviewSuggestions from './SessionInterviewSuggestions';
import SessionInterviewRecommendedGroups from './SessionInterviewRecommendedGroups';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import SessionInterviewModalHeader from './SessionInterviewModalHeader';
import SessionInterviewResearchConsent from './SessionInterviewResearchConsent';
import SessionVoiceModeChooser from './SessionVoiceModeChooser';
import {
  useSessionInterviewGroupRecommendations,
  type SessionInterviewGroupRecommendationRequest,
} from './useSessionInterviewGroupRecommendations';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';
import { useInterviewOpening } from './useInterviewOpening';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCheck,
  faCopy,
  faCircle,
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
  type SessionVoiceMode,
} from './sessionInterview';
import { useSessionInterviewRecorder } from './useSessionInterviewRecorder';
import {
  resolveSuggestedQuestionAuthoringState,
  shouldHideSuggestedQuestionSection,
} from './sessionInterviewQuestionAuthoringPolicy';
import { runInterviewDraftSubmit, type InterviewSubmitResult } from './sessionInterviewDraftSubmit';
import {
  buildResearchPacket,
  describeResearchCoverage,
  displayResponderContext,
  hasDraftValue,
  responseFieldValue,
  shouldIgnorePromptCopyEvent,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

type UnknownRecord = SessionInterviewModalRecord;

type InterviewDraftApplicationProps = InterviewQuestionControls & {
  questionCreatorProps?: React.ComponentProps<typeof SessionInterviewSuggestions>['creatorProps'];
  onSubmitResponses?: () => InterviewSubmitResult | Promise<InterviewSubmitResult>;
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

type SessionInterviewPanelBaseProps = InterviewDraftApplicationProps & {
  sessionSlug?: string;
  sessionConfig?: UnknownRecord | null;
  context?: unknown;
  workerUrl?: string;
  existingResponseSlice?: UnknownRecord | null;
  prefillPacket?: InterviewPrefillPacket | null;
  initialError?: string;
  account?: unknown;
  provider?: unknown;
  network?: unknown;
  loginComplete?: boolean;
  loginModalToggled?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  isResponsesCacheReady?: boolean;
  responseReadinessContextToken?: string;
  submitContextToken?: string;
};

type SessionVoiceModeModalProps = SessionInterviewPanelBaseProps & {
  isOpen: boolean;
  mode: SessionVoiceMode | null;
  onSelectMode: (mode: SessionVoiceMode) => void;
  questionPool?: unknown[];
};

type SessionInterviewPanelProps = SessionInterviewPanelBaseProps & {
  questions: InterviewQuestion[];
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
  account = '',
  provider,
  network,
  loginComplete = false,
  loginModalToggled = false,
  toggleLoginModal,
  isResponsesCacheReady,
  responseReadinessContextToken,
  submitContextToken = '',
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
  const validatedPrefillRef = useRef<InterviewPrefillPacket | null>(null);
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
  const [pendingSubmitAfterLogin, setPendingSubmitAfterLogin] = useState(false);
  const pendingSubmitBaseContextRef = useRef('');
  const pendingSubmitActiveContextRef = useRef('');
  const submitContextTokenRef = useRef('');
  const previousLoginModalToggledRef = useRef(Boolean(loginModalToggled));
  const [error, setError] = useState(initialError);
  const [suggestedQuestions, setSuggestedQuestions] = useState<GeneratedSurveyStatement[]>([]);
  const [groupRecommendationRequest, setGroupRecommendationRequest] =
    useState<SessionInterviewGroupRecommendationRequest | null>(null);
  const [drafts, setDrafts] = useState<InterviewDraftResponse[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editedDrafts, setEditedDrafts] = useState<Record<string, InterviewDraftResponse>>({});
  const isDirectUserContextPrefill = prefillPacket?.source.modelId === 'direct-user-context';
  const hasAiPrefill = Boolean(prefillPacket && !isDirectUserContextPrefill);
  const hasPredictionRevisions = drafts.some((draft) => (draft.revisions?.length || 0) > 1);
  const hasAiGeneratedReview = drafts.length > 0 && !isDirectUserContextPrefill;
  const researchAvailable = hasAiPrefill || hasPredictionRevisions || hasAiGeneratedReview;
  const researchPacket = buildResearchPacket(prefillPacket, sessionSlug);
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const [includePredictionComparison, setIncludePredictionComparison] = useState(false);
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
  const authenticatedForSubmit = Boolean(loginComplete && String(account || '').trim());
  const baseSubmitContextToken = submitContextToken || sessionSlug;
  const activeSubmitContextToken = [
    baseSubmitContextToken,
    String(account || '')
      .trim()
      .toLowerCase(),
    String(Boolean(loginComplete)),
  ].join('|');
  const hasReadinessContextToken =
    responseReadinessContextToken !== undefined && responseReadinessContextToken !== null;
  const responseStateReadyForSubmit =
    isResponsesCacheReady !== false &&
    (!hasReadinessContextToken || responseReadinessContextToken === activeSubmitContextToken);
  const suggestedQuestionAuthoringState = resolveSuggestedQuestionAuthoringState({
    account,
    loginComplete,
    sessionConfig,
    sessionSlug,
  });
  const generatedGroupRecommendations = useSessionInterviewGroupRecommendations({
    active: !isInterviewBusy && !mapping,
    request: groupRecommendationRequest,
    questions,
    sessionConfig,
    sessionSlug,
    workerUrl: resolvedWorkerUrl,
  });

  useEffect(() => {
    if (isStarting || mapping) statusRef.current?.focus();
    else if (isRecording && previousRecordingState.current === 'starting') stopControlRef.current?.focus();
    previousRecordingState.current = recordingState;
  }, [isStarting, isRecording, recordingState, mapping]);
  useEffect(() => {
    submitContextTokenRef.current = activeSubmitContextToken;
  }, [activeSubmitContextToken]);
  const isSubmitContextCurrent = useCallback(
    (token: string) => !disposedRef.current && submitContextTokenRef.current === token,
    [],
  );
  useEffect(() => {
    if (
      !pendingSubmitAfterLogin ||
      (pendingSubmitBaseContextRef.current === baseSubmitContextToken &&
        (!pendingSubmitActiveContextRef.current || pendingSubmitActiveContextRef.current === activeSubmitContextToken))
    ) {
      return;
    }
    pendingSubmitBaseContextRef.current = '';
    pendingSubmitActiveContextRef.current = '';
    setPendingSubmitAfterLogin(false);
    setStatus('Review drafts');
  }, [activeSubmitContextToken, baseSubmitContextToken, pendingSubmitAfterLogin]);
  useEffect(() => {
    const wasOpen = previousLoginModalToggledRef.current;
    const isOpen = Boolean(loginModalToggled);
    previousLoginModalToggledRef.current = isOpen;
    if (!pendingSubmitAfterLogin || !wasOpen || isOpen || authenticatedForSubmit) return;
    pendingSubmitBaseContextRef.current = '';
    pendingSubmitActiveContextRef.current = '';
    setPendingSubmitAfterLogin(false);
    setStatus('Login required');
  }, [authenticatedForSubmit, loginModalToggled, pendingSubmitAfterLogin]);
  useEffect(() => {
    if (!pendingSubmitAfterLogin || !authenticatedForSubmit || responseStateReadyForSubmit || applying) return;
    setStatus('Waiting for session data…');
  }, [applying, authenticatedForSubmit, pendingSubmitAfterLogin, responseStateReadyForSubmit]);

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
      setStatus('Preparing responses…');
      try {
        if (prefillPacket?.questionSetHash && validatedPrefillRef.current !== prefillPacket) {
          const currentQuestionSetHash = await hashInterviewQuestions(questions);
          if (disposedRef.current) return;
          if (currentQuestionSetHash !== prefillPacket.questionSetHash) {
            throw new Error(
              'This prefill link was created for an older or different question set. Ask the AI for a fresh link.',
            );
          }
          // Validate imported evidence once; later additions must not block continued interviews.
          validatedPrefillRef.current = prefillPacket;
        }
        const importedDrafts = nextTranscript.trim()
          ? null
          : readImportedInterviewDraftResponses(prefillPacket, questions);
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
        let mapped = importedDrafts;
        let proposedQuestions: GeneratedSurveyStatement[] = [];
        if (mapped === null) {
          const url = await resolveWorkerUrl();
          if (disposedRef.current) return;
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
        setGroupRecommendationRequest({
          requestId: Date.now(),
          transcript: nextTranscript,
          prefillPacket: contextPacket,
          draftResponses: review.drafts.map((draft) => ({
            ...draft,
            ...(review.edited[draft.questionId] || {}),
          })),
        });
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

  const refreshGroupRecommendations = useCallback(() => {
    if (!drafts.length || isInterviewBusy || mapping) return;
    setGroupRecommendationRequest({
      requestId: Date.now(),
      transcript,
      prefillPacket,
      draftResponses: drafts.map((draft) => ({ ...draft, ...(editedDrafts[draft.questionId] || {}) })),
    });
  }, [drafts, editedDrafts, isInterviewBusy, mapping, prefillPacket, transcript]);

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

  const applyDrafts = useCallback(async () => {
    await runInterviewDraftSubmit({
      activeSubmitContextToken,
      authenticatedForSubmit,
      baseSubmitContextToken,
      drafts,
      editedDrafts,
      hasAiPrefill,
      includePredictionComparison,
      includeProvenance,
      includeResponderName,
      isInterviewBusy,
      researchAvailable,
      responderContext,
      responseStateReadyForSubmit,
      selected,
      transcript,
      applyingRef,
      disposedRef,
      mappingRef,
      pendingSubmitActiveContextRef,
      pendingSubmitBaseContextRef,
      prefillPacket,
      isSubmitContextCurrent,
      onApplyAdditional,
      onApplyAnswer,
      onApplyConviction,
      onApplyImportance,
      onRecordProvenance,
      onSubmitResponses,
      onRequestLogin: () => toggleLoginModal?.(true),
      setApplying,
      setError,
      setPendingSubmitAfterLogin,
      setStatus,
    });
  }, [
    activeSubmitContextToken,
    authenticatedForSubmit,
    baseSubmitContextToken,
    drafts,
    editedDrafts,
    hasAiPrefill,
    includePredictionComparison,
    includeProvenance,
    includeResponderName,
    isInterviewBusy,
    isSubmitContextCurrent,
    onApplyAdditional,
    onApplyAnswer,
    onApplyConviction,
    onApplyImportance,
    onRecordProvenance,
    onSubmitResponses,
    prefillPacket,
    researchAvailable,
    responderContext,
    responseStateReadyForSubmit,
    selected,
    toggleLoginModal,
    transcript,
  ]);

  useEffect(() => {
    if (
      !pendingSubmitAfterLogin ||
      !authenticatedForSubmit ||
      !responseStateReadyForSubmit ||
      applying ||
      isInterviewBusy ||
      mappingRef.current
    ) {
      return;
    }
    if (pendingSubmitBaseContextRef.current !== baseSubmitContextToken) return;
    if (pendingSubmitActiveContextRef.current && pendingSubmitActiveContextRef.current !== activeSubmitContextToken)
      return;
    void applyDrafts();
  }, [
    activeSubmitContextToken,
    applyDrafts,
    applying,
    authenticatedForSubmit,
    baseSubmitContextToken,
    isInterviewBusy,
    pendingSubmitAfterLogin,
    responseStateReadyForSubmit,
  ]);

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
      ? 'Preparing responses…'
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
      <SessionInterviewModalHeader
        guidance={guidance}
        idle={idle}
        onClose={onClose}
        readinessDetail={readiness.detail}
        readinessRetry={readiness.retry}
        statusLabel={statusLabel}
        statusTone={statusTone}
        statusRef={statusRef}
      />
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
                  <span className={styles.sessionInterviewActionCircle} aria-hidden="true">
                    <FontAwesomeIcon icon={isStarting ? faSpinner : faMicrophone} spin={isStarting} />
                  </span>
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
            !mapping &&
            !mappingNotice &&
            (transcript.trim() || !Array.isArray(prefillPacket?.responses)) &&
            (transcript.trim() || prefillPacket || responderContext.trim()) ? (
              <Button outline onClick={() => runMapping()} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_GENERATE}>
                Generate response drafts
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
              <div
                className={styles.sessionAgentKickoff}
                onClick={(event) => {
                  if (!shouldIgnorePromptCopyEvent(event.target)) void copyAgentPrompt();
                }}
              >
                <div className={styles.sessionAgentKickoffRow}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`${styles.sessionAgentKickoffCopyTarget} ${promptCopied ? styles.sessionAgentKickoffCopied : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void copyAgentPrompt();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void copyAgentPrompt();
                      }
                    }}
                    aria-label={promptCopied ? 'Memory augmentation prompt copied' : 'Copy memory augmentation prompt'}
                    title={promptCopied ? 'Copied' : 'Copy memory augmentation prompt'}
                    data-ce-control-appearance="frameless"
                    data-testid={E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT}
                  >
                    <span className={styles.sessionAgentKickoffTitle}>
                      <span className={styles.sessionAgentKickoffCopyBadge} aria-hidden="true">
                        <FontAwesomeIcon icon={promptCopied ? faCheck : faCopy} />
                        <span>{promptCopied ? 'Copied' : 'Copy'}</span>
                      </span>
                      <span>
                        {promptCopied
                          ? ' prompt to clipboard'
                          : ' and paste this prompt into Claude or ChatGPT to augment interview'}
                      </span>
                    </span>
                  </div>
                  <div className={styles.sessionAgentKickoffActions}>
                    <button
                      type="button"
                      id="ce-interview-agent-prompt-help"
                      className={styles.sessionInterviewHeaderButton}
                      aria-label="About the interview prompt"
                    >
                      <FontAwesomeIcon icon={faQuestionCircle} />
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
                    <UncontrolledTooltip
                      target="ce-interview-agent-prompt-help"
                      placement="top-end"
                      fade={false}
                      trigger="hover focus"
                      autohide={false}
                    >
                      Allows your agent to predict your responses and raise better interview questions.
                    </UncontrolledTooltip>
                  </div>
                </div>
                {showAgentPrompt ? (
                  <div
                    id="ce-session-interview-agent-prompt"
                    className={styles.sessionAgentKickoffPrompt}
                    data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT}
                    data-ce-no-background-copy="true"
                  >
                    <SessionInterviewPrompt prompt={kickoff} />
                  </div>
                ) : null}
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
          </div>

          {drafts.length && !isInterviewBusy && !mapping ? (
            <SessionInterviewReviewSection
              title="Review proposed responses"
              summaryRef={reviewRef}
              testId={E2E_TESTIDS.SESSION_INTERVIEW_REVIEW}
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
                  onEdit={(patch) => {
                    setGroupRecommendationRequest(null);
                    setEditedDrafts((current) => ({
                      ...current,
                      [draft.questionId]: { ...current[draft.questionId], ...patch },
                    }));
                  }}
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
                  {applying
                    ? 'Preparing submission…'
                    : pendingSubmitAfterLogin && !authenticatedForSubmit
                      ? 'Submit after login'
                      : 'Submit responses'}
                </Button>
              </div>
            </SessionInterviewReviewSection>
          ) : null}
          {suggestedQuestions.length > 0 ? (
            <SessionInterviewSuggestions
              questions={suggestedQuestions}
              creatorProps={questionCreatorProps || {}}
              hidden={isInterviewBusy || mapping || shouldHideSuggestedQuestionSection(suggestedQuestionAuthoringState)}
            />
          ) : null}
          {!isInterviewBusy && !mapping && drafts.length && !groupRecommendationRequest ? (
            <Button outline onClick={refreshGroupRecommendations}>
              Refresh group suggestions
            </Button>
          ) : null}
          {!isInterviewBusy && !mapping ? (
            <SessionInterviewRecommendedGroups
              recommendations={generatedGroupRecommendations}
              account={account}
              provider={provider}
              network={network}
              loginComplete={loginComplete}
              loginModalToggled={loginModalToggled}
              toggleLoginModal={toggleLoginModal}
              sessionConfig={sessionConfig}
              sessionSlug={sessionSlug}
              workerUrl={resolvedWorkerUrl}
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
              <SessionVoiceModeChooser onSelectMode={onSelectMode} />
            ) : (
              <SessionListeningPanel {...props} panelMode="recordGroup" onClose={onClose} />
            )}
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
