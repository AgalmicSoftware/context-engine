import { resolveConsentFlags, summarizeConsentChoice, type InterviewConsentOverrides } from './sessionInterviewConsent';
import { useInterviewSavedAnswers, type InterviewSavedAnswerLoader } from './useInterviewSavedAnswers';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import { getSessionAiSettings } from '../../utilities/ai/aiSettings';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import {
  appendInterviewTranscript,
  changesEarlierAnswer,
  mergeInterviewReview,
  overrulesSavedAnswer,
  sameInterviewAnswer,
} from './sessionInterviewReviewState';
import { useInterviewReadiness } from './useInterviewReadiness';
import { useInterviewQuestionUpdates } from './useInterviewQuestionUpdates';
import SessionInterviewSuggestions from './SessionInterviewSuggestions';
import SessionInterviewRecommendedGroups from './SessionInterviewRecommendedGroups';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import SessionInterviewModalHeader from './SessionInterviewModalHeader';
import SessionInterviewResearchConsent from './SessionInterviewResearchConsent';
import SessionVoiceModeChooser from './SessionVoiceModeChooser';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import {
  useSessionInterviewGroupRecommendations,
  type SessionInterviewGroupRecommendationRequest,
} from './useSessionInterviewGroupRecommendations';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';
import { useInterviewOpening } from './useInterviewOpening';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalHeader } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import SessionInterviewDraftCard, { type InterviewQuestionControls } from './SessionInterviewDraftCard';
import SessionListeningPanel from './SessionListeningPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { ImportedResponderContextEditor, SessionInterviewVoiceControls } from './SessionInterviewVoiceControls';
import { buildInterviewReturnSessionUrl } from './sessionInterviewReturnUrl';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { getAnonymousRateId } from '../../utilities/worker/workerAuthAnonymousHeaders.js';
import {
  buildRealtimeInterviewInstructions,
  mapInterviewEvidenceToResponses,
  normalizeInterviewQuestions,
  readImportedInterviewDraftResponses,
  type InterviewDraftResponse,
  type InterviewPrefillPacket,
  type InterviewQuestion,
  type SessionVoiceMode,
} from './sessionInterview';
import {
  resolveInterviewPrefillQuestions,
  scopeInterviewPrefillToQuestions,
} from './sessionInterviewCatalogValidation';
import { useSessionInterviewRecorder } from './useSessionInterviewRecorder';
import {
  resolveSuggestedQuestionAuthoringState,
  shouldHideSuggestedQuestionSection,
} from './sessionInterviewQuestionAuthoringPolicy';
import { runInterviewDraftSubmit, type InterviewSubmitResult } from './sessionInterviewDraftSubmit';
import {
  hideableInterviewDraftIds,
  pickHiddenInterviewDrafts,
  useInterviewHiddenDrafts,
} from './sessionInterviewHiddenDrafts';
import SessionInterviewFidelityScore, { summarizeOwnInterviewFidelity } from './SessionInterviewFidelityScore';
import type { ParticipantFidelitySummary } from '../../../../shared/agentFidelity.mjs';
import {
  buildResearchPacket,
  describeInterviewPlatform,
  describeResearchCoverage,
  displayResponderContext,
  hasDraftValue,
  responseCommentValue,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

type UnknownRecord = SessionInterviewModalRecord;

// The scrolling modal body's visible height, less its padding.
const visibleBodyHeight = (panel: HTMLElement | null) => {
  const body = panel?.parentElement;
  if (!body) return 0;
  const style = getComputedStyle(body);
  return Math.max(0, body.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0));
};

type InterviewDraftApplicationProps = InterviewQuestionControls & {
  questionCreatorProps?: React.ComponentProps<typeof SessionInterviewSuggestions>['creatorProps'];
  onSubmitResponses?: (questionIds?: string[]) => InterviewSubmitResult | Promise<InterviewSubmitResult>;
  onViewResults?: () => void;
  onClose: () => void;
  onApplyAnswer: (questionId: string, answer: unknown) => void | Promise<void>;
  onApplyAdditional: (questionId: string, comments: string) => void | Promise<void>;
  onApplyImportance: (questionId: string, importance: number) => void | Promise<void>;
  onApplyConviction: (questionId: string, conviction: number) => void | Promise<void>;
  onCaptureResponses?: (questionIds: string[]) => () => void | Promise<void>;
  onRecordProvenance?: (
    drafts: InterviewDraftResponse[],
    source: InterviewPrefillPacket['source'] | null,
    packet: InterviewPrefillPacket | null,
    included: boolean,
    includePredictionComparison: boolean,
    responderName: string,
    review?: Array<InterviewDraftResponse & { selected: boolean; original: InterviewDraftResponse }>,
    consentOverrides?: InterviewConsentOverrides,
  ) => void | Promise<void>;
};

type SessionInterviewPanelBaseProps = InterviewDraftApplicationProps & {
  sessionSlug?: string;
  sessionConfig?: UnknownRecord | null;
  context?: unknown;
  workerUrl?: string;
  existingResponseSlice?: UnknownRecord | null;
  pendingInterviewProvenance?: UnknownRecord;
  onLoadSavedResponses?: InterviewSavedAnswerLoader;
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
  onInterviewProgressChange?: (inProgress: boolean) => void;
  mode: SessionVoiceMode | null;
  onSelectMode: (mode: SessionVoiceMode) => void;
  questionPool?: unknown[];
};

type SessionInterviewPanelProps = SessionInterviewPanelBaseProps & {
  questions: InterviewQuestion[];
  isOpen: boolean;
  onReviewStateChange: (dirty: boolean) => void;
  // Asks the modal to confirm discarding this interview.
  onRequestDiscard: () => void;
};

function SessionInterviewPanel({
  questions: initialQuestions,
  isOpen,
  sessionSlug = '',
  sessionConfig = null,
  context,
  workerUrl = '',
  existingResponseSlice: formResponseSlice = null,
  pendingInterviewProvenance,
  onLoadSavedResponses,
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
  onCaptureResponses,
  onRecordProvenance,
  onSubmitResponses,
  onViewResults,
  renderAnswerInput,
  renderAdditionalInput,
  renderFieldLock,
  onClose,
  onReviewStateChange,
  onRequestDiscard,
}: SessionInterviewPanelProps) {
  const disposedRef = useRef(false);
  const importedRef = useRef(false);
  const validatedPrefillRef = useRef<InterviewPrefillPacket | null>(null);
  const catalogAbortRef = useRef<AbortController | null>(null);
  const validatedPrefillQuestionsRef = useRef<InterviewQuestion[] | null>(null);
  // The question set a prefill link was last checked against.
  const checkedPrefillQuestionsRef = useRef<InterviewQuestion[] | null>(null);
  const viewResultsRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // The transcript the current drafts came from; a later round that was not mapped can still be.
  const [mappedTranscript, setMappedTranscript] = useState('');
  const receiveTranscript = (current: string) => {
    const combined = appendInterviewTranscript(roundBaseTranscriptRef.current, current);
    transcriptRef.current = combined;
    setTranscript(combined);
  };
  const [mapping, setMapping] = useState(false);
  const [mappingNotice, setMappingNotice] = useState('');
  // Drafts left out of review because the person already answered their questions.
  const [leftOutIds, setLeftOutIds] = useState<string[]>([]);
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
  // Explicitly removed cards stay hidden; saved-answer conflicts still need review.
  const [removedDraftIds, setRemovedDraftIds] = useState<Record<string, boolean>>({});
  const [editedDrafts, setEditedDrafts] = useState<Record<string, InterviewDraftResponse>>({});
  // The latest review, for work that resumes after an await.
  const latestReviewRef = useRef({ drafts, selected, editedDrafts, removedDraftIds });
  latestReviewRef.current = { drafts, selected, editedDrafts, removedDraftIds };
  const isDirectUserContextPrefill = prefillPacket?.source?.modelId === 'direct-user-context';
  const hasAiPrefill = Boolean(prefillPacket?.source && !isDirectUserContextPrefill);
  const hasPredictionRevisions = drafts.some((draft) => (draft.revisions?.length || 0) > 1);
  const hasAiGeneratedReview = drafts.length > 0 && !isDirectUserContextPrefill;
  const researchAvailable = hasAiPrefill || hasPredictionRevisions || hasAiGeneratedReview;
  const mappingModelId = useMemo(
    () => getSessionAiSettings(sessionSlug, sessionConfig).models.thinking,
    [sessionSlug, sessionConfig],
  );
  const researchPacket = buildResearchPacket(prefillPacket, sessionSlug, mappingModelId);
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const [researchSharingChoice, setResearchSharingChoice] = useState<{
    contextToken: string;
    included: boolean;
  } | null>(null);
  const [includeResponderName, setIncludeResponderName] = useState(false);
  const [consentOverrides, setConsentOverrides] = useState<InterviewConsentOverrides>({});
  const [submissionInfoOpen, setSubmissionInfoOpen] = useState(false);
  const sessionResearchDetail = normalizeInterviewSettings(sessionConfig?.interviewMode).researchDetail;
  // What the consent text described. It only ever narrows, so settings that load late can't widen
  // what someone already agreed to share.
  const [shownResearchDetail, setShownResearchDetail] = useState(sessionResearchDetail);
  useEffect(() => {
    if (sessionResearchDetail === 'minimal') setShownResearchDetail('minimal');
  }, [sessionResearchDetail]);
  const [showTranscript, setShowTranscript] = useState(false);
  // The questions an imported AI prefill drafted; its status line counts those still in review.
  const [prefillDraftIds, setPrefillDraftIds] = useState<string[]>([]);
  const prefillDraftCount = drafts.filter((draft) => prefillDraftIds.includes(draft.questionId)).length;
  const [contextExpanded, setContextExpanded] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  // After a submit, how well the person's AI predicted them, and the panel height it keeps
  // so the shorter score doesn't move the footer button.
  const [fidelityScore, setFidelityScore] = useState<{ summary: ParticipantFidelitySummary; height: number } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const showFidelityScore = normalizeInterviewSettings(sessionConfig?.interviewMode).showFidelityScore;
  // Off by default: the session's open groups that fit the person's answers, never joined for them.
  const suggestGroups = normalizeInterviewSettings(sessionConfig?.interviewMode).suggestGroups;
  const [showViewResults, setShowViewResults] = useState(false);
  const [hasRefreshableGroups, setHasRefreshableGroups] = useState(false);
  useEffect(() => {
    if (workerUrl) setResolvedWorkerUrl(workerUrl);
  }, [workerUrl]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      catalogAbortRef.current?.abort();
      if (viewResultsRevealRef.current) clearTimeout(viewResultsRevealRef.current);
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
  const suspendRecorder = recorder.suspend;
  const closeGenerationRef = useRef(0);
  useEffect(() => {
    if (isOpen) return;
    closeGenerationRef.current += 1;
    const captured = suspendRecorder();
    if (captured.trim()) {
      const combined = appendInterviewTranscript(roundBaseTranscriptRef.current, captured);
      transcriptRef.current = combined;
      setTranscript(combined);
    }
    setStatus('Ready');
  }, [isOpen, suspendRecorder]);
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
  // Resolve late-loaded session defaults until the participant chooses. Keep that
  // choice through login without carrying it into a different session's review.
  const includePredictionComparison =
    researchSharingChoice?.contextToken === baseSubmitContextToken
      ? researchSharingChoice.included
      : normalizeInterviewSettings(sessionConfig?.interviewMode).shareDraftChangesByDefault;
  const activeSubmitContextToken = [
    baseSubmitContextToken,
    String(account || '')
      .trim()
      .toLowerCase(),
    String(Boolean(loginComplete)),
  ].join('|');
  const hasReadinessContextToken =
    responseReadinessContextToken !== undefined && responseReadinessContextToken !== null;
  // Drafts the person changed, or submitted from this review, are theirs to decide on.
  const submittedDraftIdsRef = useRef(new Set<string>());
  // Questions whose drafts last came from the person's own words in this interview.
  const ownEvidenceIdsRef = useRef(new Set<string>());
  const participantOwned = useCallback(
    (questionId: string) =>
      Boolean(editedDrafts[questionId]?.userEditedFields?.length) || submittedDraftIdsRef.current.has(questionId),
    [editedDrafts],
  );
  // Removes drafts from review as if they were never proposed.
  const dropDrafts = useCallback((questionIds: string[]) => {
    if (!questionIds.length) return;
    const dropped = new Set(questionIds);
    const keep = <T,>(record: Record<string, T>) =>
      Object.fromEntries(Object.entries(record).filter(([id]) => !dropped.has(id)));
    setDrafts((current) => current.filter((draft) => !dropped.has(draft.questionId)));
    setSelected(keep);
    setEditedDrafts(keep);
    setRemovedDraftIds(keep);
    // A draft the person already dismissed isn't news.
    const counted = questionIds.filter((id) => !latestReviewRef.current.removedDraftIds[id]);
    setLeftOutIds((current) => [...new Set([...current, ...counted])]);
  }, []);
  // Saved answers can load after drafts entered review. An answered question gets no suggestion,
  // so untouched drafts go. The person's own drafts, and their own words in this interview giving
  // a different answer, stay as they are; their cards say which answer they change. A queued
  // submit waits for the person to check them.
  const reviewSavedConflicts = useCallback(
    (slice: SessionInterviewModalRecord | null | undefined) => {
      const saved = (draft: InterviewDraftResponse) => responseFieldValue(slice, 'answers', draft.questionId);
      const conflicts = drafts.filter((draft) => hasDraftValue(saved(draft)));
      if (!conflicts.length) return false;
      const kept = conflicts.filter(
        (draft) =>
          participantOwned(draft.questionId) ||
          (ownEvidenceIdsRef.current.has(draft.questionId) && overrulesSavedAnswer(draft.answer, saved(draft))),
      );
      const dropped = conflicts.filter((draft) => !kept.includes(draft));
      dropDrafts(dropped.map((draft) => draft.questionId));
      pendingSubmitBaseContextRef.current = '';
      pendingSubmitActiveContextRef.current = '';
      setPendingSubmitAfterLogin(false);
      setStatus(
        kept.some((draft) => changesEarlierAnswer(editedDrafts[draft.questionId]?.answer ?? draft.answer, saved(draft)))
          ? 'Saved answers loaded. Check drafts that change an earlier answer, then submit.'
          : drafts.length > dropped.length || suggestedQuestions.length
            ? 'Review drafts'
            : 'Ready',
      );
      return true;
    },
    [drafts, dropDrafts, editedDrafts, participantOwned, suggestedQuestions.length],
  );
  const ownAnswers = useInterviewSavedAnswers({
    load: onLoadSavedResponses,
    contextKey: activeSubmitContextToken,
    questionIds: [...questions.map((question) => question.id), ...drafts.map((draft) => draft.questionId)],
    active: authenticatedForSubmit,
    onLoaded: reviewSavedConflicts,
  });
  // Review starts from the form, unsaved edits included; the own-answer read merges saved answers into it.
  const existingResponseSlice = formResponseSlice || ownAnswers.slice;
  const hiddenDrafts = useInterviewHiddenDrafts({
    questions,
    editedDrafts,
    savedResponses: existingResponseSlice,
    researchOn: includePredictionComparison,
    onAnswered: (questionIds) => dropDrafts(questionIds.filter((id) => !participantOwned(id))),
  });
  const {
    assign: assignHiddenDrafts,
    isConcealed: isDraftConcealed,
    reviewedValues: reviewedDraftValues,
    prepareSubmit: prepareHiddenDraftSubmit,
  } = hiddenDrafts;
  const submittableSelection = hiddenDrafts.submittable(selected);
  useEffect(() => {
    setConsentOverrides({});
  }, [activeSubmitContextToken]);
  const savedConsent = {
    ...((existingResponseSlice?.interviewProvenance || {}) as Record<string, UnknownRecord>),
    ...pendingInterviewProvenance,
  } as Record<string, UnknownRecord>;
  const selectedDrafts = drafts.filter((draft) => selected[draft.questionId]);
  const visibleDrafts = drafts.filter((draft) => !removedDraftIds[draft.questionId]);
  const consentDrafts = selectedDrafts.length ? selectedDrafts : drafts;
  const aiChoice = summarizeConsentChoice(
    consentDrafts.map((draft) =>
      savedConsent[draft.questionId]
        ? resolveConsentFlags(savedConsent[draft.questionId]).includeAiProvenance
        : hasAiPrefill && includeProvenance,
    ),
    consentOverrides.includeAiProvenance,
  );
  const comparisonChoice = summarizeConsentChoice(
    consentDrafts.map((draft) =>
      savedConsent[draft.questionId]
        ? resolveConsentFlags(savedConsent[draft.questionId]).includePredictionComparison
        : includePredictionComparison,
    ),
    consentOverrides.includePredictionComparison,
  );
  const nameChoice = summarizeConsentChoice(
    consentDrafts.map((draft) =>
      savedConsent[draft.questionId] ? !!savedConsent[draft.questionId].responderName : includeResponderName,
    ),
    consentOverrides.includeResponderName,
  );
  const hasSavedName = consentDrafts.some((draft) => !!savedConsent[draft.questionId]?.responderName);
  const hasSavedAi = consentDrafts.some(
    (draft) => resolveConsentFlags(savedConsent[draft.questionId]).includeAiProvenance,
  );
  // Research sharing that starts on, such as from the session default, must be
  // seen before submitting, so open the submission info until the participant chooses.
  const researchSharingStartsOn =
    (researchAvailable || hasSavedAi) &&
    consentOverrides.includePredictionComparison === undefined &&
    (comparisonChoice.checked || comparisonChoice.mixed);
  useEffect(() => {
    if (researchSharingStartsOn) setSubmissionInfoOpen(true);
  }, [researchSharingStartsOn]);

  const existingResponsesRef = useRef(existingResponseSlice);
  existingResponsesRef.current = existingResponseSlice;
  const responseStateReadyForSubmit =
    onLoadSavedResponses && !ownAnswers.legacy
      ? ownAnswers.ready
      : isResponsesCacheReady !== false &&
        (!hasReadinessContextToken || responseReadinessContextToken === activeSubmitContextToken);
  const suggestedQuestionAuthoringState = resolveSuggestedQuestionAuthoringState({
    account,
    loginComplete,
    sessionConfig,
    sessionSlug,
  });
  const generatedGroupRecommendationState = useSessionInterviewGroupRecommendations({
    active: suggestGroups && !isInterviewBusy && !mapping,
    request: groupRecommendationRequest,
    questions,
    sessionConfig,
    sessionSlug,
    workerUrl: resolvedWorkerUrl,
  });
  const generatedGroupRecommendations = generatedGroupRecommendationState.recommendations;

  useEffect(() => {
    if (generatedGroupRecommendationState.availability === 'available') {
      setHasRefreshableGroups(true);
    } else if (
      groupRecommendationRequest &&
      ['empty', 'unsupported', 'error'].includes(generatedGroupRecommendationState.availability)
    ) {
      setHasRefreshableGroups(false);
    }
  }, [generatedGroupRecommendationState.availability, groupRecommendationRequest]);

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
    if (pendingSubmitAfterLogin && authenticatedForSubmit && loginModalToggled) {
      toggleLoginModal?.(false);
    }
  }, [authenticatedForSubmit, loginModalToggled, pendingSubmitAfterLogin, toggleLoginModal]);
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
        setMappingNotice('Not enough information to generate response drafts.');
        setStatus('Not enough information');
        return;
      }
      mappingRef.current = true;
      setMapping(true);
      setError('');
      setMappingNotice('');
      setLeftOutIds([]);
      setSubmitSucceeded(false);
      setShowViewResults(false);
      if (viewResultsRevealRef.current) {
        clearTimeout(viewResultsRevealRef.current);
        viewResultsRevealRef.current = null;
      }
      setStatus('Preparing responses…');
      try {
        if (prefillPacket?.questionSetHash && validatedPrefillRef.current !== prefillPacket) {
          checkedPrefillQuestionsRef.current = questions;
          catalogAbortRef.current = new AbortController();
          const matchedQuestions = await resolveInterviewPrefillQuestions({
            packet: prefillPacket,
            questions,
            sessionSlug,
            loadWorkerUrl: resolveWorkerUrl,
            sessionUrl: buildInterviewReturnSessionUrl(),
            signal: catalogAbortRef.current.signal,
          });
          if (disposedRef.current) return;
          // Validate imported evidence once; later additions must not block continued interviews.
          validatedPrefillRef.current = prefillPacket;
          validatedPrefillQuestionsRef.current = matchedQuestions;
        }
        const importedDrafts = nextTranscript.trim()
          ? null
          : readImportedInterviewDraftResponses(prefillPacket, validatedPrefillQuestionsRef.current || questions);
        const contextPacket: InterviewPrefillPacket | null =
          (prefillPacket
            ? scopeInterviewPrefillToQuestions(
                prefillPacket,
                validatedPrefillQuestionsRef.current || questions,
                responderContext,
              )
            : null) ||
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
          // The mapper hears no AI prediction for an answered question, so it can't hand one back
          // as new evidence. Drafts under review keep theirs.
          const inReview = new Set(latestReviewRef.current.drafts.map((draft) => draft.questionId));
          mapped = await mapInterviewEvidenceToResponses({
            questions:
              !nextTranscript.trim() && prefillPacket ? validatedPrefillQuestionsRef.current || questions : questions,
            transcript: nextTranscript,
            prefillPacket: contextPacket?.responses
              ? {
                  ...contextPacket,
                  responses: contextPacket.responses.filter(
                    ({ questionId }) =>
                      inReview.has(questionId) ||
                      !hasDraftValue(responseFieldValue(existingResponsesRef.current, 'answers', questionId)),
                  ),
                }
              : contextPacket,
            sessionSlug,
            sessionConfig,
            workerUrl: url,
            // A hidden draft isn't part of the review until its guess is shown.
            previousResponses: drafts
              .filter((draft) => !isDraftConcealed(draft.questionId))
              .map(({ revisions: _revisions, ...prediction }) => ({
                // The mapping prompt rates importance/conviction 0-100.
                prediction: {
                  ...prediction,
                  ...(prediction.importance !== undefined ? { importance: prediction.importance * 10 } : {}),
                  ...(prediction.conviction !== undefined ? { conviction: prediction.conviction * 10 } : {}),
                },
                reviewed: {
                  answer: reviewedDraftValues(prediction.questionId)?.answer,
                  additionalComments: reviewedDraftValues(prediction.questionId)?.additionalComments,
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
        // Saved answers can load while the mapper works, so merge into the review as it is now.
        const latest = latestReviewRef.current;
        // Only the person's own words can overrule an answer they gave; an AI prefill's prediction
        // can't, even when the mapper hands it back.
        const predicted = new Map(
          (importedDrafts || !hasAiPrefill
            ? []
            : readImportedInterviewDraftResponses(prefillPacket, validatedPrefillQuestionsRef.current || questions) ||
              []
          ).map((draft) => [draft.questionId, draft.answer]),
        );
        const ownEvidence = (draft: InterviewDraftResponse) =>
          importedDrafts
            ? !hasAiPrefill
            : !predicted.has(draft.questionId) || !sameInterviewAnswer(draft.answer, predicted.get(draft.questionId));
        const review = mergeInterviewReview(
          latest.drafts,
          latest.editedDrafts,
          latest.selected,
          mapped,
          (id) => responseFieldValue(existingResponsesRef.current, 'answers', id),
          importedDrafts ? prefillPacket?.source.modelId : mappingModelId,
          (id) => responseCommentValue(existingResponsesRef.current, id),
          ownEvidence,
        );
        for (const draft of mapped) {
          if (review.leftOut.includes(draft.questionId)) continue;
          if (ownEvidence(draft)) ownEvidenceIdsRef.current.add(draft.questionId);
          else ownEvidenceIdsRef.current.delete(draft.questionId);
        }
        for (const draft of review.drafts) {
          if (!latest.editedDrafts[draft.questionId] && !review.edited[draft.questionId]?.additionalComments) {
            review.edited[draft.questionId] = {
              ...review.edited[draft.questionId],
              additionalComments: responseCommentValue(existingResponsesRef.current, draft.questionId),
            };
          }
        }
        setDrafts(review.drafts);
        setEditedDrafts(review.edited);
        setSelected(review.selected);
        setLeftOutIds((current) => [...new Set([...current, ...review.leftOut])]);
        if (importedDrafts) setPrefillDraftIds(importedDrafts.map((draft) => draft.questionId));
        let newlyHidden: string[] = [];
        if (review.drafts.length) {
          // Chosen once per review, and only while research sharing is on.
          const share = normalizeInterviewSettings(sessionConfig?.interviewMode).hiddenDraftShare;
          const participant = authenticatedForSubmit ? String(account).trim().toLowerCase() : getAnonymousRateId();
          newlyHidden = assignHiddenDrafts(
            includePredictionComparison && share > 0
              ? pickHiddenInterviewDrafts(
                  hideableInterviewDraftIds(review.drafts, questions, prefillPacket, (id) =>
                    hasDraftValue(responseFieldValue(existingResponsesRef.current, 'answers', id)),
                  ),
                  share,
                  `${sessionSlug}|${participant}`,
                )
              : [],
          );
        }
        setMappedTranscript(nextTranscript);
        if (review.drafts.length) {
          setGroupRecommendationRequest({
            requestId: Date.now(),
            transcript: nextTranscript,
            prefillPacket: contextPacket,
            // Only answers the person keeps count; a hidden draft's guess stays out until it is shown.
            draftResponses: review.drafts
              .filter(
                ({ questionId }) =>
                  review.selected[questionId] && !newlyHidden.includes(questionId) && !isDraftConcealed(questionId),
              )
              .map((draft) => ({ ...draft, ...(review.edited[draft.questionId] || {}) })),
          });
        } else {
          setGroupRecommendationRequest(null);
        }
        setMappingNotice(
          review.drafts.length || review.leftOut.length
            ? ''
            : combinedQuestions.length
              ? 'No matching answers yet. Review the suggested questions below.'
              : 'Not enough information to generate response drafts.',
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
      account,
      assignHiddenDrafts,
      authenticatedForSubmit,
      drafts,
      hasAiPrefill,
      includePredictionComparison,
      isDraftConcealed,
      reviewedDraftValues,
      selected,
      suggestedQuestions,
      mappingModelId,
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
      prefillPacket: prefillPacket
        ? scopeInterviewPrefillToQuestions(
            prefillPacket,
            validatedPrefillQuestionsRef.current || questions,
            responderContext,
          )
        : null,
      draftResponses: drafts
        .filter(({ questionId }) => selected[questionId] && !isDraftConcealed(questionId))
        .map((draft) => ({ ...draft, ...(editedDrafts[draft.questionId] || {}) })),
    });
  }, [
    drafts,
    editedDrafts,
    isDraftConcealed,
    isInterviewBusy,
    mapping,
    prefillPacket,
    questions,
    responderContext,
    selected,
    transcript,
  ]);

  useEffect(() => {
    if (!prefillPacket || !questions.length || mapping) return;
    // A link rejected against an older cached question set is checked again once the set refreshes.
    const recheck =
      !!prefillPacket.questionSetHash &&
      validatedPrefillRef.current !== prefillPacket &&
      checkedPrefillQuestionsRef.current !== questions;
    if (importedRef.current && !recheck) return;
    importedRef.current = true;
    void runMapping({ nextTranscript: '' });
  }, [mapping, prefillPacket, questions, runMapping]);

  useEffect(() => {
    if (drafts.length && !mapping && !importedRef.current) {
      reviewRef.current?.focus();
      reviewRef.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [drafts, mapping]);

  const startInterview = () => {
    if (isInterviewBusy || mappingRef.current || applying) return;
    if (prefillPacket?.questionSetHash && validatedPrefillRef.current !== prefillPacket) {
      setError('This prefill link was created for an older or different question set. Ask the AI for a fresh link.');
      setStatus('Error');
      return;
    }
    setMappingNotice('');
    setLeftOutIds([]);
    setSubmitSucceeded(false);
    roundBaseTranscriptRef.current = transcriptRef.current;
    setShowTranscript(false);
    const validatedPrefillPacket =
      prefillPacket && (!prefillPacket.questionSetHash || validatedPrefillRef.current === prefillPacket)
        ? scopeInterviewPrefillToQuestions(
            prefillPacket,
            validatedPrefillQuestionsRef.current || questions,
            responderContext,
          )
        : null;
    const answered = (questionId: string) =>
      hasDraftValue(responseFieldValue(existingResponsesRef.current, 'answers', questionId));
    // The interviewer never hears a hidden draft's guess, nor a draft for an answered question.
    const shown = (draft: InterviewDraftResponse) => !isDraftConcealed(draft.questionId) && !answered(draft.questionId);
    const importedDrafts = validatedPrefillPacket
      ? readImportedInterviewDraftResponses(
          validatedPrefillPacket,
          validatedPrefillQuestionsRef.current || questions,
        )?.filter(shown) || null
      : null;
    // It spends the conversation on unanswered questions while any remain.
    const openQuestions = questions.filter((question) => !answered(question.id));
    try {
      const instructions = buildRealtimeInterviewInstructions({
        questions: openQuestions.length ? openQuestions : questions,
        responderContext,
        openingPrompt: interviewOpening.opening,
        steeringPrompt: interviewOpening.steeringPrompt,
        previousTranscript: transcriptRef.current,
        prefillPacket: validatedPrefillPacket,
        importedDrafts,
        onContextLimited: setMappingNotice,
        reviewedResponses: drafts.filter(shown).map((draft) => ({
          prediction: draft,
          reviewed: reviewedDraftValues(draft.questionId),
        })),
      });
      void recorder.start(instructions);
    } catch (instructionError) {
      setError(instructionError instanceof Error ? instructionError.message : 'Could not prepare voice context.');
      setStatus('Error');
    }
  };

  const endInterview = async () => {
    const closeGeneration = closeGenerationRef.current;
    try {
      const result = await recorder.stop();
      if (!result || disposedRef.current || closeGeneration !== closeGenerationRef.current) return;
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
    // Hidden drafts submit only the person's own answer, with the one given before the reveal.
    const review = prepareHiddenDraftSubmit(selected);
    const score = showFidelityScore
      ? summarizeOwnInterviewFidelity({
          drafts,
          editedDrafts: review.editedDrafts,
          selected: review.selected,
          questions,
          packet: prefillPacket,
        })
      : null;
    await runInterviewDraftSubmit({
      activeSubmitContextToken,
      authenticatedForSubmit,
      baseSubmitContextToken,
      drafts,
      editedDrafts: review.editedDrafts,
      hasAiPrefill,
      includePredictionComparison,
      includeProvenance,
      includeResponderName,
      // Forward the shown detail only when it is narrower than the session's current one.
      consentOverrides:
        shownResearchDetail === sessionResearchDetail
          ? consentOverrides
          : { ...consentOverrides, researchDetail: shownResearchDetail },
      isInterviewBusy,
      researchAvailable,
      responderContext,
      responseStateReadyForSubmit,
      selected: review.selected,
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
      onCaptureResponses,
      onRecordProvenance,
      onSubmitResponses,
      onSubmitted: () => {
        // A later load of saved answers finds these; they stay in review rather than being dropped.
        for (const draft of drafts)
          if (review.selected[draft.questionId]) submittedDraftIdsRef.current.add(draft.questionId);
        setFidelityScore(score ? { summary: score, height: visibleBodyHeight(panelRef.current) } : null);
        setSubmitSucceeded(true);
        setShowViewResults(false);
        if (viewResultsRevealRef.current) clearTimeout(viewResultsRevealRef.current);
        viewResultsRevealRef.current = setTimeout(() => {
          if (!disposedRef.current) setShowViewResults(true);
        }, 5000);
      },
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
    hasAiPrefill,
    includePredictionComparison,
    includeProvenance,
    includeResponderName,
    consentOverrides,
    shownResearchDetail,
    sessionResearchDetail,
    isInterviewBusy,
    isSubmitContextCurrent,
    onApplyAdditional,
    onApplyAnswer,
    onApplyConviction,
    onApplyImportance,
    onCaptureResponses,
    onRecordProvenance,
    onSubmitResponses,
    prefillPacket,
    prepareHiddenDraftSubmit,
    questions,
    researchAvailable,
    responderContext,
    responseStateReadyForSubmit,
    selected,
    showFidelityScore,
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
    // Legacy Workers have no own-answer load, so check the hydrated form state here.
    if (ownAnswers.legacy && reviewSavedConflicts(existingResponsesRef.current)) return;
    void applyDrafts();
  }, [
    activeSubmitContextToken,
    applyDrafts,
    applying,
    authenticatedForSubmit,
    baseSubmitContextToken,
    isInterviewBusy,
    ownAnswers.legacy,
    pendingSubmitAfterLogin,
    responseStateReadyForSubmit,
    reviewSavedConflicts,
  ]);

  const importedContext = prefillPacket?.responderContext;
  const importedResponderName = String(importedContext?.name || '').trim();
  const displayedResponderNames =
    hasSavedName && (consentOverrides.includeResponderName === undefined || !importedResponderName)
      ? [...new Set(consentDrafts.map((draft) => savedConsent[draft.questionId]?.responderName).filter(Boolean))]
      : [importedResponderName];
  // The responder-name choice sits with the other sharing choices.
  const nameOption =
    importedResponderName || hasSavedName ? (
      <Label check className={styles.sessionInterviewProvenance}>
        <Input
          type="checkbox"
          checked={nameChoice.mixed ? false : nameChoice.checked}
          aria-checked={nameChoice.mixed ? 'mixed' : nameChoice.checked}
          innerRef={(element: HTMLInputElement | null) => {
            if (element) element.indeterminate = nameChoice.mixed;
          }}
          disabled={applying}
          onChange={(event) => {
            const included = event.target.checked;
            setIncludeResponderName(included);
            setConsentOverrides((prev) => ({ ...prev, includeResponderName: included }));
          }}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME}
        />{' '}
        {`Include ${displayedResponderNames.map((name) => `“${name}”`).join(', ')} as the responder ${displayedResponderNames.length > 1 ? 'names' : 'name'} with submitted responses`}
        {nameChoice.mixed ? ' (mixed saved choices)' : ''}
      </Label>
    ) : null;
  const researchCoverage = prefillPacket?.source?.researchCoverage;
  const researchCoverageDetails = describeResearchCoverage(researchCoverage);
  const hasImportedResponderContext = Boolean(importedContext?.summary?.trim() || importedContext?.facts?.length);
  const canManuallyRefreshGroupRecommendations = hasRefreshableGroups && drafts.length > 0;

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
  const hasUnsavedReview =
    isInterviewBusy ||
    mapping ||
    applying ||
    (!submitSucceeded &&
      Boolean(
        transcript.trim() || drafts.length || prefillPacket || responderContext.trim() || suggestedQuestions.length,
      ));
  useEffect(() => {
    onReviewStateChange(hasUnsavedReview);
  }, [hasUnsavedReview, onReviewStateChange]);
  const scoreScreenShown = Boolean(submitSucceeded && fidelityScore);
  useEffect(() => {
    // The submission choices are settled; fold them away so the score has the room.
    if (scoreScreenShown) setSubmissionInfoOpen(false);
  }, [scoreScreenShown]);
  const hasTranscript = !isInterviewBusy && Boolean(transcript.trim());
  // A prefill link goes straight to its drafts; the interview then talks them through.
  const showPrefillStatus = hasAiPrefill && prefillDraftCount > 0;
  const prefillPlatform = prefillPacket?.source.platform;
  const startLabel = interviewOpening.loading
    ? 'Preparing opening…'
    : isStarting
      ? 'Connecting…'
      : transcript.trim()
        ? 'Continue interview'
        : showPrefillStatus
          ? 'Talk through your drafts'
          : 'Start voice interview';
  const leftOutCount = leftOutIds.length;
  const leftOutNotice = !leftOutCount
    ? ''
    : drafts.length
      ? `Left out ${leftOutCount} ${leftOutCount === 1 ? 'draft for a question' : 'drafts for questions'} you’ve already answered.`
      : leftOutCount === 1
        ? 'You’ve already answered the question this draft covers.'
        : 'You’ve already answered every question these drafts cover.';
  // Drafts that were left out came from the evidence already mapped, so mapping it again won't help.
  const canGenerateDrafts = Boolean(
    !isInterviewBusy &&
    !mapping &&
    !mappingNotice &&
    (drafts.length || leftOutCount
      ? transcript.trim() && transcript !== mappedTranscript
      : (transcript.trim() || !Array.isArray(prefillPacket?.responses)) &&
        (transcript.trim() || prefillPacket || responderContext.trim())),
  );

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
        <div
          ref={panelRef}
          className={styles.sessionInterviewPanel}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_PANEL}
          style={submitSucceeded && fidelityScore?.height ? { minHeight: fidelityScore.height } : undefined}
        >
          {hasImportedResponderContext ? (
            <ImportedResponderContextEditor
              expanded={contextExpanded}
              value={responderContext}
              disabled={isInterviewBusy || mapping}
              onExpandedChange={setContextExpanded}
              onChange={(value) => {
                setResponderContext(value);
                setMappingNotice('');
                setLeftOutIds([]);
              }}
            />
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
          <SessionInterviewVoiceControls
            isRecorderSessionActive={isRecorderSessionActive}
            isPaused={isPaused}
            isStopping={isStopping}
            isStarting={isStarting}
            startLabel={startLabel}
            startDisabled={mapping || applying || !questions.length || isStarting || interviewOpening.loading}
            hasTranscript={hasTranscript}
            showTranscript={showTranscript}
            transcript={transcript}
            mediaStreamRef={mediaStreamRef}
            recordingElapsedSeconds={recordingElapsedSeconds}
            stopControlRef={stopControlRef}
            canGenerateDrafts={canGenerateDrafts}
            onStartInterview={() => {
              void startInterview();
            }}
            onEndInterview={() => {
              void endInterview();
            }}
            onPause={recorder.pause}
            onResume={recorder.resume}
            onToggleTranscript={() => setShowTranscript((current) => !current)}
            onGenerateDrafts={() => {
              void runMapping();
            }}
            onDiscard={hasUnsavedReview || scoreScreenShown ? onRequestDiscard : undefined}
            discardDisabled={mapping || applying || isStarting}
          />

          {hasTranscript && showTranscript ? (
            <div className={styles.sessionInterviewTranscriptArea}>
              <pre
                id="ce-session-interview-transcript-content"
                className={styles.sessionInterviewTranscript}
                aria-label="Transcript"
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT}
              >
                {transcript}
              </pre>
            </div>
          ) : null}

          {mappingNotice || leftOutNotice ? (
            <div
              className={styles.sessionInterviewMappingNotice}
              role="status"
              aria-live="polite"
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE}
            >
              {[leftOutNotice, mappingNotice].filter(Boolean).join(' ')}
            </div>
          ) : null}

          {showPrefillStatus ? (
            <p
              className={styles.sessionInterviewPrefillStatus}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS}
            >
              Your AI drafted {prefillDraftCount} {prefillDraftCount === 1 ? 'answer' : 'answers'}
              {prefillPlatform && prefillPlatform !== 'other'
                ? ` · ${describeInterviewPlatform(prefillPlatform)}, self-reported`
                : ''}
            </p>
          ) : null}

          {ownAnswers.error ? (
            <div className={styles.sessionListeningError} role="alert">
              Could not load your saved answers: {ownAnswers.error}
              <Button onClick={ownAnswers.retry}>Retry saved answers</Button>
            </div>
          ) : null}
          {submitSucceeded && fidelityScore ? (
            <SessionInterviewFidelityScore summary={fidelityScore.summary} questions={questions} />
          ) : visibleDrafts.length && !isInterviewBusy && !mapping ? (
            <SessionInterviewReviewSection
              title="Review proposed responses"
              summaryRef={reviewRef}
              testId={E2E_TESTIDS.SESSION_INTERVIEW_REVIEW}
            >
              {visibleDrafts.map((draft) => {
                const hiddenView = hiddenDrafts.view(draft);
                return (
                  <SessionInterviewDraftCard
                    key={draft.questionId}
                    draft={hiddenView?.draft || draft}
                    edited={hiddenView?.edited || editedDrafts[draft.questionId] || draft}
                    blindNote={hiddenView?.note}
                    question={questions.find((question) => question.id === draft.questionId)}
                    selected={Boolean(selected[draft.questionId])}
                    existing={hasDraftValue(responseFieldValue(existingResponseSlice, 'answers', draft.questionId))}
                    earlierAnswer={responseFieldValue(existingResponseSlice, 'answers', draft.questionId)}
                    savedComment={responseCommentValue(existingResponseSlice, draft.questionId)}
                    disabled={applying}
                    onSelect={(value) => {
                      // Dismissing a draft that isn't chosen changes nothing to submit.
                      if (!value && !selected[draft.questionId]) {
                        setRemovedDraftIds((current) => ({ ...current, [draft.questionId]: true }));
                        return;
                      }
                      setSubmitSucceeded(false);
                      setShowViewResults(false);
                      if (viewResultsRevealRef.current) {
                        clearTimeout(viewResultsRevealRef.current);
                        viewResultsRevealRef.current = null;
                      }
                      setSelected((current) => ({ ...current, [draft.questionId]: value }));
                      setRemovedDraftIds((current) => ({ ...current, [draft.questionId]: !value }));
                      setGroupRecommendationRequest(null);
                    }}
                    onEdit={(patch) => {
                      hiddenDrafts.noteEdit(draft.questionId, patch);
                      setGroupRecommendationRequest(null);
                      setEditedDrafts((current) => ({
                        ...current,
                        [draft.questionId]: { ...current[draft.questionId], ...patch },
                      }));
                      setSubmitSucceeded(false);
                      setShowViewResults(false);
                      if (viewResultsRevealRef.current) {
                        clearTimeout(viewResultsRevealRef.current);
                        viewResultsRevealRef.current = null;
                      }
                    }}
                    renderAnswerInput={renderAnswerInput}
                    renderAdditionalInput={renderAdditionalInput}
                    renderFieldLock={renderFieldLock}
                  />
                );
              })}
            </SessionInterviewReviewSection>
          ) : null}
          {suggestedQuestions.length > 0 ? (
            <SessionInterviewSuggestions
              questions={suggestedQuestions}
              creatorProps={questionCreatorProps || {}}
              hidden={isInterviewBusy || mapping || shouldHideSuggestedQuestionSection(suggestedQuestionAuthoringState)}
            />
          ) : null}
          {suggestGroups &&
          !isInterviewBusy &&
          !mapping &&
          canManuallyRefreshGroupRecommendations &&
          !groupRecommendationRequest ? (
            <Button
              outline
              onClick={() => {
                refreshGroupRecommendations();
                // The button goes away once clicked; keep keyboard focus on a control that stays.
                (reviewRef.current || statusRef.current)?.focus({ preventScroll: true });
              }}
            >
              Refresh group suggestions
            </Button>
          ) : null}
          {suggestGroups && !isInterviewBusy && !mapping ? (
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
          {drafts.length && !isInterviewBusy && !mapping ? (
            <div className={styles.sessionInterviewReviewActions} role="group" aria-label="Response submission">
              {researchAvailable || importedResponderName || hasSavedName || hasSavedAi ? (
                <div
                  className={`${styles.sessionInterviewConsentGroup} ${submissionInfoOpen ? styles.sessionInterviewConsentGroupOpen : ''}`}
                >
                  <details
                    className={styles.sessionInterviewConsentOptions}
                    open={submissionInfoOpen}
                    onToggle={(event) => setSubmissionInfoOpen(event.currentTarget.open)}
                  >
                    <summary>AI submission info</summary>
                    <div className={styles.sessionInterviewChoicesPanel}>
                      {researchAvailable || hasSavedAi ? (
                        <SessionInterviewResearchConsent
                          packet={researchPacket}
                          showProvenance={hasAiPrefill || hasSavedAi}
                          revisionCount={drafts.reduce((count, draft) => count + (draft.revisions?.length || 0), 0)}
                          includeProvenance={aiChoice.checked}
                          includeComparison={comparisonChoice.checked}
                          provenanceMixed={aiChoice.mixed}
                          comparisonMixed={comparisonChoice.mixed}
                          preserveSavedProvenance={hasSavedAi && consentOverrides.includeAiProvenance === undefined}
                          onProvenanceChange={(included) => {
                            setIncludeProvenance(included);
                            setConsentOverrides((prev) => ({ ...prev, includeAiProvenance: included }));
                          }}
                          onComparisonChange={(included) => {
                            setResearchSharingChoice({ contextToken: baseSubmitContextToken, included });
                            setConsentOverrides((prev) => ({ ...prev, includePredictionComparison: included }));
                          }}
                          coverageDetails={researchCoverageDetails}
                          selectedCount={drafts.filter((draft) => submittableSelection[draft.questionId]).length}
                          unselectedCount={drafts.filter((draft) => !submittableSelection[draft.questionId]).length}
                          disabled={applying}
                          researchDetail={shownResearchDetail}
                        >
                          {nameOption}
                        </SessionInterviewResearchConsent>
                      ) : null}
                      {researchAvailable || hasSavedAi ? null : nameOption}
                    </div>
                  </details>
                  {/* Sharing can be on by default, so say so without opening the panel. */}
                  {researchAvailable && (comparisonChoice.checked || comparisonChoice.mixed) ? (
                    <small className={styles.sessionInterviewSharingStatus}>
                      {comparisonChoice.mixed
                        ? 'Sharing AI draft changes for research on some responses'
                        : submitSucceeded
                          ? 'Shared your AI’s predictions and your changes for research'
                          : 'Sharing your AI’s predictions and your changes for research'}
                    </small>
                  ) : null}
                </div>
              ) : null}
              <Button
                color="primary"
                onClick={() => {
                  if (submitSucceeded && showViewResults && onViewResults) {
                    onViewResults();
                    return;
                  }
                  void applyDrafts();
                }}
                disabled={
                  applying ||
                  mapping ||
                  isInterviewBusy ||
                  (submitSucceeded && (!showViewResults || !onViewResults)) ||
                  !drafts.some((draft) => submittableSelection[draft.questionId])
                }
                className={styles.sessionInterviewSubmitButton}
                data-testid={
                  submitSucceeded && showViewResults && onViewResults
                    ? E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS
                    : E2E_TESTIDS.SESSION_INTERVIEW_APPLY
                }
              >
                {submitSucceeded && showViewResults && onViewResults ? (
                  'View results'
                ) : submitSucceeded ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} /> Responses submitted
                  </>
                ) : applying ? (
                  'Preparing submission…'
                ) : pendingSubmitAfterLogin && !authenticatedForSubmit ? (
                  'Submit after login'
                ) : (
                  'Submit responses'
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </ModalBody>
    </>
  );
}

export default function SessionVoiceModeModal(props: SessionVoiceModeModalProps) {
  const { isOpen, mode, onSelectMode, onClose, questionPool = [] } = props;
  const [hasUnsavedReview, setHasUnsavedReview] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [interviewVersion, setInterviewVersion] = useState(0);
  const [discardedPrefill, setDiscardedPrefill] = useState<InterviewPrefillPacket | null>(null);
  const prefillPacket = props.prefillPacket === discardedPrefill ? null : props.prefillPacket;
  // Closing retains this review, but importing different evidence starts a new
  // review. Equivalent packet objects must not erase the participant's edits.
  const prefillIdentity = useMemo(() => JSON.stringify(prefillPacket || null), [prefillPacket]);
  const onInterviewProgressChange = props.onInterviewProgressChange;
  useEffect(() => {
    onInterviewProgressChange?.(hasUnsavedReview);
  }, [hasUnsavedReview, onInterviewProgressChange]);
  const requestClose = onClose;
  const questions = useMemo(() => normalizeInterviewQuestions(questionPool), [questionPool]);
  const title = mode === 'interview' ? 'Interview' : mode === 'recordGroup' ? 'Group Conversation' : 'Voice mode';
  return (
    <>
      <Modal
        isOpen={isOpen}
        unmountOnClose={mode !== 'interview'}
        toggle={requestClose}
        size="lg"
        centered
        labelledBy="ce-session-voice-mode-title"
        returnFocusAfterClose
        contentClassName={styles.sessionVoiceModeModal}
        data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_MODAL}
      >
        {mode === 'interview' ? (
          <SessionInterviewPanel
            key={`${interviewVersion}:${prefillIdentity}`}
            {...props}
            prefillPacket={prefillPacket}
            onClose={requestClose}
            questions={questions}
            onReviewStateChange={setHasUnsavedReview}
            onRequestDiscard={() => setConfirmDiscard(true)}
          />
        ) : (
          <>
            <ModalHeader id="ce-session-voice-mode-title" toggle={requestClose}>
              {title}
            </ModalHeader>
            <ModalBody>
              {!mode ? (
                <SessionVoiceModeChooser onSelectMode={onSelectMode}>
                  <SessionVoicePrefillCard
                    sessionSlug={props.sessionSlug}
                    sessionConfig={props.sessionConfig}
                    context={props.context}
                    workerUrl={props.workerUrl}
                  />
                </SessionVoiceModeChooser>
              ) : (
                <SessionListeningPanel {...props} panelMode="recordGroup" embeddedInModal onClose={onClose} />
              )}
            </ModalBody>
          </>
        )}
      </Modal>
      <CEConfirmDialog
        isOpen={isOpen && confirmDiscard}
        title="Discard this interview?"
        body="Your transcript, imported prefill, and unsaved review edits will be lost. Responses you’ve already submitted are kept."
        confirmLabel="Discard interview"
        cancelLabel="Keep reviewing"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          setHasUnsavedReview(false);
          setDiscardedPrefill(props.prefillPacket || null);
          setInterviewVersion((version) => version + 1);
          onClose();
        }}
        testId="ce-interview-discard"
      />
    </>
  );
}
