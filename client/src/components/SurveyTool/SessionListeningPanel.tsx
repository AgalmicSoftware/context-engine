import { getEffectiveTranscriptionConfig } from '../../utilities/ai/aiSettings';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faCircle,
  faMicrophone,
  faPause,
  faPlay,
  faQuestionCircle,
  faSpinner,
  faStop,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { Button, UncontrolledTooltip } from 'reactstrap';
import styles from './SurveyTool.module.scss';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import { SessionRecordingChunks } from './SessionRecordingChunks';
import SessionRecordingInput from './SessionRecordingInput';
import SessionRecordingHelp from './SessionRecordingHelp';
import { SessionRecordingNotices } from './SessionRecordingNotices';
import { SessionNewDraftsCue } from './SessionNewDraftsCue';
import { SessionListeningTranscript, SessionListeningTranscriptToggle } from './SessionListeningTranscript';
import SessionTranscriptClaimShare from './SessionTranscriptClaimShare';
import SessionTranscriptContextOption from './SessionTranscriptContextOption';
import { useTranscriptContextUpload } from './useTranscriptContextUpload';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import {
  DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
  ONE_VOICE_PARTS_BEFORE_WARNING,
  oneVoicePartsInARow,
  transcriptSpeech,
} from '../../utilities/audio/rollingTranscription';
import { applySpeakerMerges } from '../../utilities/audio/speakerMerges';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SessionListeningWaveform } from './SessionListeningWaveform';
import { formatSessionRecordingElapsed } from './sessionElapsedTime';
export { SessionListeningWaveform } from './SessionListeningWaveform';
import { generateQuestionsFromListeningTranscript, LISTENING_QUESTION_COUNT } from './sessionListeningQuestions';
import type { QuestionDrafts } from '../../utilities/audio/recordingChunkStore';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';

type SessionListeningPanelProps = Record<string, unknown> & {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  defaultTags?: string | string[] | null;
  onClose?: () => void;
  panelMode?: 'recordGroup' | 'listening';
  embeddedInModal?: boolean;
  // The dialog header's spot for the + that adds audio or a transcript.
  headerActionsSlot?: HTMLElement | null;
  closeActionRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  // Lets the dialog ignore backdrop taps and Escape, and turn Back off, while the microphone is capturing or a
  // close is finishing.
  onBusyChange?: (busy: boolean) => void;
};
type CreateQuestionsAndSurveysPanelProps = React.ComponentProps<typeof CreateQuestionsAndSurveys>;
type GeneratedQuestionDraft = {
  id?: unknown;
  prompt?: unknown;
  [key: string]: unknown;
};

const getGeneratedQuestionKey = (question: GeneratedQuestionDraft | null | undefined): string =>
  String(question?.id || question?.prompt || '')
    .trim()
    .toLowerCase();

const getGeneratedQuestionPrompt = (question: GeneratedQuestionDraft | null | undefined): string =>
  String(question?.prompt || '').trim();
// Case, spacing and punctuation aside, the same question.
const samePromptKey = (prompt: string) =>
  prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Drafted prompts include drafts the host removed or submitted, and the session's own questions, so none of them
// comes back.
const mergeGeneratedQuestionDrafts = (
  previous: GeneratedQuestionDraft[],
  incoming: GeneratedQuestionDraft[],
  drafted: string[] = [],
): GeneratedQuestionDraft[] => {
  const seenKeys = new Set(previous.map(getGeneratedQuestionKey).filter(Boolean));
  const seenPrompts = new Set(
    [...previous.map(getGeneratedQuestionPrompt), ...drafted].map(samePromptKey).filter(Boolean),
  );
  const additions = incoming.filter((question) => {
    const key = getGeneratedQuestionKey(question);
    const prompt = samePromptKey(getGeneratedQuestionPrompt(question));
    if ((!key && !prompt) || (key && seenKeys.has(key)) || (prompt && seenPrompts.has(prompt))) return false;
    if (key) seenKeys.add(key);
    if (prompt) seenPrompts.add(prompt);
    return true;
  });
  return additions.length ? [...previous, ...additions] : previous;
};

// In its own file, so a panel that only times a wait need not import this one.
export { formatSessionRecordingElapsed };

const KEEP_AUDIO_HELP =
  'Closes without waiting for transcription. Audio still waiting for it stays on this device and resumes uploading when you reopen this recording.';
const MANY_VOICES_KEY = 'ce:record-more-than-four:v1';
const SPEAKER_AUDIO_KEY = 'ce:record-speaker-audio:v1';
const SPEAKER_AUDIO_LABEL = 'Recording voices coming from this device';
const MANY_VOICES_HELP =
  'Ticked, speakers are labelled Speaker A, B… within each part of the recording only, so a letter may be someone else in the next part. Unticked, up to four voices keep a Person number throughout.';

const getSessionInstructions = (sessionConfig: unknown) =>
  sessionConfig && typeof sessionConfig === 'object'
    ? (sessionConfig as Record<string, unknown>).questionsGenPrompt || ''
    : '';

export default function SessionListeningPanel(props: SessionListeningPanelProps) {
  const {
    sessionSlug = '',
    sessionConfig = null,
    questionPool,
    context,
    workerUrl,
    defaultTags = null,
    onClose,
    panelMode = 'listening',
    embeddedInModal = false,
    headerActionsSlot = null,
    closeActionRef,
    onBusyChange,
  } = props;
  const [speakerLabelsSupported, setSpeakerLabelsSupported] = useState<boolean | null>(null);
  const [speakerLabelsCheckTimedOut, setSpeakerLabelsCheckTimedOut] = useState(false);
  const recordPressedRef = useRef(false);
  useEffect(() => {
    let current = true;
    let timedOut = false;
    setSpeakerLabelsSupported(null);
    setSpeakerLabelsCheckTimedOut(false);
    const complete = (supported: boolean) => {
      // A late result still applies until Record is pressed, so it never switches labels on during capture.
      if (!current || (timedOut && recordPressedRef.current)) return;
      current = false;
      clearTimeout(timeout);
      setSpeakerLabelsCheckTimedOut(false);
      setSpeakerLabelsSupported(supported);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      setSpeakerLabelsCheckTimedOut(true);
      setSpeakerLabelsSupported(false);
    }, 2000);
    // Checking availability must not unlock credentials or delay Record indefinitely.
    void getEffectiveTranscriptionConfig({ sessionSlug, sessionConfig }).then(
      (config) => complete(config.provider === 'openai'),
      () => complete(false),
    );
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [sessionSlug, sessionConfig]);
  const [recordSpeakerAudio, setRecordSpeakerAudio] = useState(() => {
    try {
      return window.localStorage.getItem(SPEAKER_AUDIO_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const chooseSpeakerAudio = (checked: boolean) => {
    setRecordSpeakerAudio(checked);
    try {
      window.localStorage.setItem(SPEAKER_AUDIO_KEY, String(checked));
    } catch {
      /* The option still works when browser storage is unavailable. */
    }
  };
  // Echo cancellation keeps the voices of a call played through this device out of the recording, and nobody
  // recording a breakout can be expected to know it: a new group recording first asks where the others are. The
  // answer sets the box below, kept on this device; it is the tap that starts recording.
  const [askWhereOthers, setAskWhereOthers] = useState(false);
  const whereOthersRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (askWhereOthers) whereOthersRef.current?.querySelector('button')?.focus();
  }, [askWhereOthers]);
  // More voices than speaker labels keep apart: each part of the recording letters its own speakers, with no voice
  // samples and no part for each person. Ticked until this device chooses otherwise, since a breakout room is
  // usually larger than four; the choice is kept on the device, so a recording reopened in the same room stays as it
  // was.
  const [manyVoices, setManyVoices] = useState(() => {
    try {
      return window.localStorage.getItem(MANY_VOICES_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  // Only where the choice is shown: one kept from an OpenAI session does nothing where labels aren't offered.
  const speakersPerPart = panelMode === 'recordGroup' && manyVoices && speakerLabelsSupported === true;
  const speakerHelpId = `ce-record-speaker-help-${useId().replace(/:/g, '')}`;
  const manyVoicesHelpId = `ce-many-voices-help-${useId().replace(/:/g, '')}`;
  const keepHelpId = `ce-keep-audio-help-${useId().replace(/:/g, '')}`;
  const recordingContext = useMemo(
    () => ({
      ...(context && typeof context === 'object' ? context : {}),
      account: context && typeof context === 'object' && 'account' in context ? context.account : props.account,
    }),
    [context, props.account],
  );
  const recorder = useRollingTranscriptionRecorder({
    sessionSlug,
    sessionConfig,
    context: recordingContext,
    workerUrl,
    chunkMs: DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
    labelSpeakers: panelMode === 'recordGroup' && speakerLabelsSupported === true,
    speakersPerPart,
    recordSpeakerAudio: panelMode === 'recordGroup' && recordSpeakerAudio,
  });
  const transcriptContext = useTranscriptContextUpload({
    sessionSlug,
    sessionConfig,
    context: recordingContext,
    enabled: panelMode === 'recordGroup',
  });
  const latestTranscriptRef = useRef(recorder.transcript);
  latestTranscriptRef.current = recorder.transcript;
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionDraft[]>([]);
  const [pendingDraftCount, setPendingDraftCount] = useState<number | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState('');
  // The last draft added nothing: the discussion supported no new question, which is a result, not an error.
  const [noNewQuestions, setNoNewQuestions] = useState(false);
  // The draft after Stop came back empty twice, so Generate questions sits beside that note until a draft adds one.
  const [offerGenerate, setOfferGenerate] = useState(false);
  // How many drafts the latest generation added, said beside the controls until drafts are removed or sent.
  const [addedDrafts, setAddedDrafts] = useState<{ count: number } | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  // The speaker whose code is showing, chosen by their button or their label in the transcript.
  const [claimPerson, setClaimPerson] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef<HTMLDivElement | null>(null);
  const [closeError, setCloseError] = useState('');
  const isMountedRef = useRef(true);
  const lastAutoRequestedTranscriptRef = useRef('');
  const generationInFlightRef = useRef(false);
  const activeGenerationRequestRef = useRef(0);
  // Recordings begun, so a draft can tell that Record more started a new discussion while it waited.
  const recordingsBegunRef = useRef(0);
  // Kept with the recording (see recordingChunkQueue), so reopening shows the drafts as the host left them and
  // drafts only newer transcript text.
  const keptRef = useRef<QuestionDrafts>({ questions: [], prompts: [], draftedTranscript: '' });
  const { questionDrafts: keptDrafts, saveQuestionDrafts } = recorder;
  const keepDrafts = useCallback(
    (change: Partial<QuestionDrafts>) => {
      keptRef.current = { ...keptRef.current, ...change };
      saveQuestionDrafts(keptRef.current);
    },
    [saveQuestionDrafts],
  );
  // A submit in flight, which closing waits for, so its uploaded drafts leave the kept ones first.
  const submitRef = useRef<{ settled: Promise<void>; settle: () => void } | null>(null);
  const handleSubmittingChange = useCallback((submitting: boolean) => {
    if (submitting && !submitRef.current) {
      let settle = () => {};
      const settled = new Promise<void>((resolve) => (settle = resolve));
      submitRef.current = { settled, settle };
    } else if (!submitting) {
      submitRef.current?.settle();
      submitRef.current = null;
    }
  }, []);
  // Clear deletes the kept drafts, and another recording (as after an account change) has its own; `drafted`
  // is the transcript not to draft again.
  const forgetDrafts = useCallback(
    (drafted: string) => {
      activeGenerationRequestRef.current += 1;
      generationInFlightRef.current = false;
      lastAutoRequestedTranscriptRef.current = drafted;
      keptRef.current = { questions: [], prompts: [], draftedTranscript: '' };
      handleSubmittingChange(false);
      setIsGenerating(false);
      setGeneratedQuestions([]);
      setPendingDraftCount(null);
      setGeneratedTitle('');
      setNoNewQuestions(false);
      setOfferGenerate(false);
      setAddedDrafts(null);
      setGenerationError('');
    },
    [handleSubmittingChange],
  );
  const scopeRef = useRef(recorder.scope);
  useEffect(() => {
    if (scopeRef.current === recorder.scope) return;
    scopeRef.current = recorder.scope;
    forgetDrafts('');
  }, [forgetDrafts, recorder.scope]);
  // Remounts the new-drafts cue, which counts the kept drafts as seen.
  const [keptDraftsShown, setKeptDraftsShown] = useState(0);
  // Before the effect below that drafts new transcript text.
  useEffect(() => {
    if (!keptDrafts) return;
    keptRef.current = keptDrafts;
    lastAutoRequestedTranscriptRef.current = keptDrafts.draftedTranscript;
    setGeneratedQuestions(keptDrafts.questions);
    setKeptDraftsShown((shown) => shown + 1);
  }, [keptDrafts]);
  const handleDraftQuestionsChange = useCallback(
    (questions: QuestionDrafts['questions']) => {
      setPendingDraftCount(questions.length);
      keepDrafts({ questions });
    },
    [keepDrafts],
  );

  const failedCount = useMemo(
    () => recorder.segments.filter((segment) => segment.status === 'failed').length,
    [recorder.segments],
  );
  const onePartSpeakers = useMemo(
    () => [...new Set(recorder.segments.flatMap((segment) => segment.oneOffSpeakers || []))],
    [recorder.segments],
  );
  const unlabelledParts = useMemo(
    () => recorder.segments.filter((segment) => segment.speakersDropped).length,
    [recorder.segments],
  );
  const trimmedTranscript = recorder.transcript.trim();
  const hasTranscript = trimmedTranscript.length > 0;
  // As the host reads it and hands it out: each speaker they merged under the label that speaker joined.
  const shownTranscript = useMemo(
    () => applySpeakerMerges(recorder.transcript, recorder.speakerMerges),
    [recorder.transcript, recorder.speakerMerges],
  );
  // A code chosen for a transcript that has since gone (cleared, another account) mustn't come back with the next.
  useEffect(() => {
    if (!hasTranscript) setClaimPerson('');
  }, [hasTranscript]);
  const draftCount = pendingDraftCount ?? generatedQuestions.length;
  const hasGeneratedDraft = draftCount > 0;
  // The count of drafts added no longer describes the list once any draft is removed or sent.
  const shownDraftCountRef = useRef(draftCount);
  useEffect(() => {
    if (draftCount < shownDraftCountRef.current) setAddedDrafts(null);
    shownDraftCountRef.current = draftCount;
  }, [draftCount]);
  const latestSuccessfulTranscriptAt = useMemo(() => {
    // The latest to complete decides, not the order of parts: text pasted while a chunk transcribes leaves that
    // chunk's questions automatic, and text added after the last chunk waits for an explicit Generate.
    const latestComplete = [...recorder.segments]
      .filter((segment) => segment.status === 'complete')
      .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0) || b.index - a.index)[0];
    if (latestComplete?.source === 'text') return 0;
    return recorder.segments.reduce((latest, segment) => {
      if (segment.source === 'text' || segment.status !== 'complete' || !String(segment.text || '').trim())
        return latest;
      return Math.max(latest, Number(segment.completedAt || segment.startedAt || 0));
    }, 0);
  }, [recorder.segments]);
  const hasVisibleStatus =
    recorder.isRecording ||
    recorder.isPaused ||
    recorder.isBusy ||
    Number(recorder.pendingSegmentCount || 0) > 0 ||
    hasTranscript ||
    hasGeneratedDraft ||
    failedCount > 0 ||
    Boolean(recorder.errorMessage || generationError);
  const isRecorderSessionActive = recorder.isRecording || recorder.isPaused || recorder.isStopping;
  // A group recording drafts the session's number of questions after each chunk, or once it stops.
  const { recordingQuestionCount, recordingQuestionTiming } = normalizeInterviewSettings(sessionConfig?.interviewMode);
  const groupRecording = panelMode === 'recordGroup';
  const draftAtEnd = groupRecording && recordingQuestionTiming === 'end';
  const sessionPrompts = useMemo(
    () =>
      Array.isArray(questionPool)
        ? questionPool.map((question) => getGeneratedQuestionPrompt(question as GeneratedQuestionDraft)).filter(Boolean)
        : [],
    [questionPool],
  );
  const sessionSubject = [sessionConfig?.sessionName, sessionConfig?.sessionInfo]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(': ');
  const isCapturing = isRecorderSessionActive || recorder.isBusy;
  const isBusy = isCapturing || isClosing;
  useEffect(() => {
    if (!isBusy || !onBusyChange) return undefined;
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [isBusy, onBusyChange]);
  const hasPendingTranscription = Number(recorder.pendingSegmentCount || 0) > 0;
  useEffect(() => {
    // Switching Record/Stop removes the focused button; keep Escape inside the modal.
    if (embeddedInModal && document.activeElement === document.body) panelRef.current?.focus();
  }, [embeddedInModal, isRecorderSessionActive]);

  const spokenLength = useMemo(() => transcriptSpeech(trimmedTranscript).length, [trimmedTranscript]);
  const canGenerate = !isClosing && spokenLength >= 50 && !isGenerating && !hasPendingTranscription;
  // Only audio not yet transcribed stays on the device; Clear asks before deleting it.
  const retainedAudioCount = recorder.downloadableChunkIds?.length ?? 0;
  const isStarting = !isRecorderSessionActive && recorder.isBusy;
  // A stopped recorder leads: an older close or generation error must not hide it.
  const visibleError =
    (recorder.status === 'error' && recorder.errorMessage) ||
    closeError ||
    generationError ||
    recorder.errorMessage ||
    '';
  const gapWarning =
    failedCount > 0 ? "Some audio couldn't be transcribed. Retry transcription or download the audio below." : '';
  // Only labelled parts can say how many voices they hold, so this needs speaker labels on.
  const oneVoiceParts = useMemo(
    () => (panelMode === 'recordGroup' ? oneVoicePartsInARow(recorder.segments) : 0),
    [panelMode, recorder.segments],
  );
  const oneVoiceWarning =
    oneVoiceParts < ONE_VOICE_PARTS_BEFORE_WARNING
      ? ''
      : `Only one voice in the last ${oneVoiceParts} parts. If others are on a call through this device, ${
          recordSpeakerAudio
            ? 'play it through speakers, not headphones.'
            : `Stop, tick “${SPEAKER_AUDIO_LABEL}”, play the call through speakers, not headphones, then Record more.`
        }`;
  const isPreparingRecording = panelMode === 'recordGroup' && speakerLabelsSupported === null;
  const recordDisabled =
    isClosing ||
    recorder.isBusy ||
    isPreparingRecording ||
    Boolean(recorder.ownerNotice) ||
    Boolean(recorder.openElsewhere) ||
    Boolean(recorder.importing);
  // Nothing recorded or transcribed yet: Record more, and Record after a reload with audio kept, ask nothing.
  const isNewRecording = !hasTranscript && !recorder.segments.length;
  const recordButtonLabel = isRecorderSessionActive
    ? recorder.isStopping
      ? 'Stopping'
      : 'Stop'
    : isPreparingRecording
      ? 'Preparing recording'
      : isStarting
        ? 'Starting'
        : hasTranscript
          ? 'Record more'
          : 'Record';
  const recordButtonIcon = isRecorderSessionActive
    ? recorder.isStopping
      ? faSpinner
      : faStop
    : isStarting
      ? faSpinner
      : faMicrophone;
  const isRecordButtonSpinning = recorder.isStopping || isStarting;
  const statusLabel = recorder.isStopping ? 'Stopping recorder' : isStarting ? 'Starting recorder' : '';
  const shouldShowMeta = Boolean(statusLabel || hasPendingTranscription || hasTranscript || isGenerating);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationElapsedSeconds(0);
      return undefined;
    }
    setGenerationElapsedSeconds(0);
    const timer = setInterval(() => {
      setGenerationElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => {
    // A group host follows the transcript as it fills, so it opens once text exists; they can still collapse it.
    setIsTranscriptOpen(hasTranscript && panelMode === 'recordGroup');
  }, [hasTranscript, panelMode]);

  const { finalizeRecording, keepAudio } = recorder;
  const settleTranscriptContext = transcriptContext.settled;
  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setCloseError('');
    try {
      await finalizeRecording({ waitForTranscription: true });
      await keepAudio();
      await submitRef.current?.settled;
      await settleTranscriptContext();
      if (isMountedRef.current) onClose?.();
    } catch (error) {
      if (isMountedRef.current)
        setCloseError(error instanceof Error ? error.message : 'Could not finish recording. Try again.');
    } finally {
      closingRef.current = false;
      if (isMountedRef.current) setIsClosing(false);
    }
  }, [onClose, finalizeRecording, keepAudio, settleTranscriptContext]);

  // Closing during capture would end the recording, so it asks first.
  const capturingAudio = recorder.isRecording || recorder.isPaused;
  const requestClose = useCallback(async () => {
    if (capturingAudio) setConfirmStop(true);
    else await handleClose();
  }, [capturingAudio, handleClose]);

  useEffect(() => {
    if (!closeActionRef) return;
    closeActionRef.current = requestClose;
    return () => {
      closeActionRef.current = null;
    };
  }, [closeActionRef, requestClose]);

  const handleGenerateQuestions = useCallback(
    async ({ auto = false }: { auto?: boolean } = {}) => {
      const transcriptSnapshot = recorder.transcript.trim();
      if (!canGenerate || !transcriptSnapshot || generationInFlightRef.current) return;
      if (auto && lastAutoRequestedTranscriptRef.current === transcriptSnapshot) return;
      lastAutoRequestedTranscriptRef.current = transcriptSnapshot;

      const requestId = activeGenerationRequestRef.current + 1;
      activeGenerationRequestRef.current = requestId;
      generationInFlightRef.current = true;
      const begun = recordingsBegunRef.current;
      // Its answer says nothing of a discussion recorded since it was asked.
      const recordingAgain = () => recordingsBegunRef.current !== begun;
      // Every prompt drafted so far, and the host's edits of them.
      const { prompts: drafted, questions: shown } = keptRef.current;
      // Once at the end, the recording's number is a total: Record more then Stop adds what is left, at least one.
      const count = !groupRecording
        ? LISTENING_QUESTION_COUNT
        : draftAtEnd && auto
          ? Math.max(1, recordingQuestionCount - drafted.length)
          : recordingQuestionCount;
      const existingPrompts = [...new Set([...drafted, ...shown.map(getGeneratedQuestionPrompt)])].filter(Boolean);
      setIsGenerating(true);
      setNoNewQuestions(false);
      setAddedDrafts(null);
      setGenerationError('');
      try {
        // Future optional source path is intentionally disabled for now:
        // generateAudioDiscussionSummary -> uploadMarkdownSummaryToArweave -> documentURLs.
        const request = () =>
          generateQuestionsFromListeningTranscript(transcriptSnapshot, {
            sessionSlug,
            sessionConfig,
            context,
            workerUrl,
            defaultTags,
            count,
            sessionInstructions: getSessionInstructions(sessionConfig),
            sourceTypeOverride: 'transcript',
            multiSpeakerHintOverride: 'likely_multiple_speakers',
            existingQuestionPrompts: existingPrompts,
            sessionQuestionPrompts: sessionPrompts,
            sessionSubject,
          });
        const isCurrent = () => isMountedRef.current && activeGenerationRequestRef.current === requestId;
        const merge = (previous: GeneratedQuestionDraft[], incoming: GeneratedQuestionDraft[]) =>
          mergeGeneratedQuestionDrafts(previous, incoming, [...drafted, ...sessionPrompts]);
        let result = await request();
        if (!isCurrent()) return;
        // The model may answer with no questions by chance, where the same request again gives some, so the draft
        // after Stop asks once more before it says there are none.
        const stopDraft = auto && draftAtEnd;
        const addsNone = (statements: GeneratedQuestionDraft[]) =>
          merge(keptRef.current.questions, statements) === keptRef.current.questions;
        if (stopDraft && !recordingAgain() && addsNone(result.statements)) {
          result = await request();
          if (!isCurrent()) return;
        }
        const { statements, surveyTitle } = result;
        const kept = keptRef.current.questions;
        const merged = merge(kept, statements);
        const nothingNew = merged === kept && !recordingAgain();
        setNoNewQuestions(nothingNew);
        setOfferGenerate((offered) => nothingNew && (stopDraft || offered));
        setAddedDrafts(merged.length > kept.length ? { count: merged.length - kept.length } : null);
        setGeneratedQuestions((previous) => merge(previous, statements));
        setGeneratedTitle((previous) => previous || surveyTitle);
        // Kept with the recording at once, so drafts held back while a submit publishes are never lost.
        // Only drafts actually added count towards the recording's number; repeats of session questions don't.
        keepDrafts({
          questions: merged,
          prompts: [...new Set([...drafted, ...merged.slice(kept.length).map(getGeneratedQuestionPrompt)])],
          draftedTranscript: transcriptSnapshot,
        });
      } catch (error) {
        if (!isMountedRef.current || activeGenerationRequestRef.current !== requestId) return;
        const message = error instanceof Error ? error.message : String(error || 'Failed to generate questions.');
        setGenerationError(message);
        // Drafts may hide the Generate questions below the transcript, so a failed draft after Stop offers it here.
        if (auto && draftAtEnd && !recordingAgain()) setOfferGenerate(true);
      } finally {
        if (isMountedRef.current && activeGenerationRequestRef.current === requestId) {
          generationInFlightRef.current = false;
          setIsGenerating(false);
        }
      }
    },
    [
      canGenerate,
      context,
      defaultTags,
      draftAtEnd,
      groupRecording,
      keepDrafts,
      recorder.transcript,
      recordingQuestionCount,
      sessionConfig,
      sessionPrompts,
      sessionSlug,
      sessionSubject,
      workerUrl,
    ],
  );

  // A new recording starts a new discussion, so an older "no new questions" no longer applies.
  useEffect(() => {
    if (!isRecorderSessionActive) return;
    recordingsBegunRef.current += 1;
    setNoNewQuestions(false);
    setOfferGenerate(false);
    setAddedDrafts(null);
  }, [isRecorderSessionActive]);

  useEffect(() => {
    if (!groupRecording) return;
    if (!latestSuccessfulTranscriptAt || !canGenerate) return;
    // Once at the end waits for Stop and the last chunk; a recording reopened stopped drafts once, here.
    if (draftAtEnd && isRecorderSessionActive) return;
    void handleGenerateQuestions({ auto: true });
  }, [
    canGenerate,
    draftAtEnd,
    groupRecording,
    handleGenerateQuestions,
    isRecorderSessionActive,
    latestSuccessfulTranscriptAt,
    trimmedTranscript,
  ]);

  const handleClear = (discardAudio = false) => {
    recorder.clearDraft(discardAudio);
    forgetDrafts(trimmedTranscript);
  };

  const showPanelHeader = !embeddedInModal;
  const generateButton = (
    <Button
      type="button"
      className={styles.sessionListeningGenerate}
      onClick={() => {
        void handleGenerateQuestions();
      }}
      disabled={!canGenerate}
      data-testid={E2E_TESTIDS.SESSION_LISTENING_GENERATE}
    >
      <FontAwesomeIcon icon={isGenerating ? faSpinner : faQuestionCircle} spin={isGenerating} />
      <span>{isGenerating ? `Generating... ${generationElapsedSeconds}s` : 'Generate questions'}</span>
    </Button>
  );

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={[
        styles.sessionListeningPanel,
        embeddedInModal ? styles.sessionListeningPanelEmbedded : '',
        hasGeneratedDraft ? styles.sessionListeningPanelWithDraft : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isClosing}
      data-testid={E2E_TESTIDS.SESSION_LISTENING_PANEL}
    >
      {panelMode === 'recordGroup' ? (
        // Once recording stops, new drafts are scrolled to; while it runs, Stop stays in view and the cue says how
        // many came.
        <SessionNewDraftsCue
          key={keptDraftsShown}
          count={draftCount}
          draftsRef={draftsRef}
          reveal={!isRecorderSessionActive}
        />
      ) : null}
      {isClosing ? <div role="status">Finalizing recording…</div> : null}
      {showPanelHeader ? (
        <div className={styles.sessionListeningHeader}>
          {hasVisibleStatus || panelMode === 'recordGroup' ? (
            <div className={styles.sessionListeningTitle}>
              <FontAwesomeIcon icon={faMicrophone} />
              <span>{panelMode === 'recordGroup' ? 'Group Conversation' : 'Listening'}</span>
              {panelMode === 'recordGroup' ? <SessionRecordingHelp /> : null}
            </div>
          ) : (
            <div aria-hidden="true" />
          )}
          {!embeddedInModal ? (
            <button
              type="button"
              className={styles.sessionListeningClose}
              onClick={() => {
                void requestClose();
              }}
              disabled={isClosing}
              aria-label={isClosing ? 'Finalizing recording before closing' : 'Close listening panel'}
              title={isClosing ? 'Finalizing recording' : 'Close'}
            >
              <FontAwesomeIcon icon={isClosing ? faSpinner : faTimes} spin={isClosing} />
            </button>
          ) : null}
        </div>
      ) : null}

      {panelMode !== 'recordGroup' ? <p>Record, upload audio, or add a transcript.</p> : null}
      <div className={styles.sessionListeningRecordWrap}>
        {isRecorderSessionActive ? (
          <div className={styles.sessionListeningActiveRecorder}>
            <div className={styles.sessionListeningWaveformShell}>
              <SessionListeningWaveform
                key={recorder.captureRestarts}
                streamRef={recorder.mediaStreamRef}
                isActive={isRecorderSessionActive}
                isPaused={recorder.isPaused}
              />
              <div className={styles.sessionListeningWaveformTimer} aria-live="polite" aria-atomic="true">
                <FontAwesomeIcon
                  icon={faCircle}
                  className={
                    recorder.isPaused || recorder.microphonePaused
                      ? styles.sessionListeningTimerDotPaused
                      : styles.sessionListeningTimerDot
                  }
                />
                <span>{recorder.microphonePaused ? 'Mic paused' : recorder.isPaused ? 'Paused' : 'Recording'}</span>
                <span>{formatSessionRecordingElapsed(recorder.elapsedSeconds)}</span>
              </div>
            </div>
            <div className={styles.sessionListeningButtonColumn} role="group" aria-label="Recording controls">
              <button
                type="button"
                className={[styles.sessionListeningAudioButton, styles.sessionListeningStopButton].join(' ')}
                onClick={() => {
                  void recorder.stopRecording();
                }}
                disabled={recorder.isStopping}
                aria-label="Stop recording"
                title="Stop recording"
                data-testid={E2E_TESTIDS.SESSION_LISTENING_STOP}
              >
                <FontAwesomeIcon icon={recorder.isStopping ? faSpinner : faStop} spin={recorder.isStopping} />
                <span className={styles.sessionListeningSrOnly}>Stop</span>
              </button>
              <button
                type="button"
                className={styles.sessionListeningAudioButton}
                onClick={recorder.isPaused ? recorder.resumeRecording : recorder.pauseRecording}
                disabled={recorder.isStopping}
                aria-label={recorder.isPaused ? 'Resume recording' : 'Pause recording'}
                title={recorder.isPaused ? 'Resume recording' : 'Pause recording'}
              >
                <FontAwesomeIcon icon={recorder.isPaused ? faPlay : faPause} />
                <span className={styles.sessionListeningSrOnly}>{recorder.isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          </div>
        ) : askWhereOthers ? (
          <div
            ref={whereOthersRef}
            className={styles.sessionRecordingWhere}
            role="group"
            aria-labelledby={`${speakerHelpId}-where`}
          >
            <strong id={`${speakerHelpId}-where`}>Where are the others?</strong>
            {[
              { onCall: false, label: 'In this room', testId: E2E_TESTIDS.SESSION_RECORDING_OTHERS_ROOM },
              {
                onCall: true,
                label: 'On a call through this device',
                testId: E2E_TESTIDS.SESSION_RECORDING_OTHERS_CALL,
              },
            ].map(({ onCall, label, testId }) => (
              <Button
                key={label}
                type="button"
                className={styles.sessionRecordingButton}
                disabled={recordDisabled}
                data-testid={testId}
                onClick={() => {
                  chooseSpeakerAudio(onCall);
                  setAskWhereOthers(false);
                  recordPressedRef.current = true;
                  void recorder.startRecording({ recordSpeakerAudio: onCall });
                }}
              >
                {label}
                {onCall ? <small>Use speakers, not headphones</small> : null}
              </Button>
            ))}
          </div>
        ) : (
          <Button
            type="button"
            // In the dialog it is a round microphone, as in the voice interview; elsewhere a filled button.
            color={embeddedInModal ? 'link' : 'secondary'}
            className={styles.sessionListeningRecordButton}
            onClick={() => {
              if (panelMode === 'recordGroup' && isNewRecording) {
                setAskWhereOthers(true);
                return;
              }
              recordPressedRef.current = true;
              void recorder.startRecording();
            }}
            disabled={recordDisabled}
            data-testid={E2E_TESTIDS.SESSION_LISTENING_START}
          >
            <span className={styles.sessionListeningRecordIcon} aria-hidden="true">
              <FontAwesomeIcon icon={recordButtonIcon} spin={isRecordButtonSpinning} />
            </span>
            <span className={styles.sessionListeningRecordText}>{recordButtonLabel}</span>
          </Button>
        )}
        <SessionRecordingInput
          disabled={
            isRecorderSessionActive ||
            isClosing ||
            recorder.isBusy ||
            Boolean(recorder.ownerNotice) ||
            Boolean(recorder.openElsewhere)
          }
          onAudio={recorder.addAudio}
          onTranscript={async (text) => {
            await recorder.addTranscript(text);
            setIsTranscriptOpen(true);
          }}
          triggerSlot={headerActionsSlot}
        />
      </div>

      {panelMode === 'recordGroup' ? (
        <div className={styles.sessionRecordingOptions}>
          <span className={styles.sessionRecordingOption}>
            <label>
              <input
                type="checkbox"
                checked={recordSpeakerAudio}
                disabled={isRecorderSessionActive || recorder.isBusy}
                onChange={(event) => chooseSpeakerAudio(event.target.checked)}
              />{' '}
              {SPEAKER_AUDIO_LABEL}
            </label>
            <button
              type="button"
              id={speakerHelpId}
              className={styles.sessionInterviewHeaderButton}
              aria-label="About recording voices coming from this device"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <UncontrolledTooltip target={speakerHelpId} trigger="hover focus" autohide={false}>
              Turns off echo cancellation so the mic also records people heard through this device&apos;s speakers. Use
              speakers, not headphones.
            </UncontrolledTooltip>
          </span>
          {speakerLabelsSupported ? (
            <span className={styles.sessionRecordingOption}>
              <label>
                <input
                  type="checkbox"
                  checked={manyVoices}
                  aria-describedby={`${manyVoicesHelpId}-about`}
                  disabled={isRecorderSessionActive || recorder.isBusy || Boolean(recorder.labelsUnavailableReason)}
                  onChange={(event) => {
                    setManyVoices(event.target.checked);
                    try {
                      window.localStorage.setItem(MANY_VOICES_KEY, String(event.target.checked));
                    } catch {
                      /* The option still works when browser storage is unavailable. */
                    }
                  }}
                />{' '}
                More than 4 people in the room
              </label>
              <button
                type="button"
                id={manyVoicesHelpId}
                className={styles.sessionInterviewHeaderButton}
                aria-label="About more than 4 people in the room"
                aria-describedby={`${manyVoicesHelpId}-about`}
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
              <span id={`${manyVoicesHelpId}-about`} hidden>
                {MANY_VOICES_HELP}
              </span>
              <UncontrolledTooltip target={manyVoicesHelpId} trigger="hover focus" autohide={false}>
                {MANY_VOICES_HELP}
              </UncontrolledTooltip>
            </span>
          ) : null}
        </div>
      ) : null}

      {shouldShowMeta && (
        <div className={styles.sessionListeningMeta} aria-live="polite">
          {statusLabel && <span>{statusLabel}</span>}
          {hasPendingTranscription && (
            <span className={styles.sessionListeningTranscribingStatus}>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Transcribing…</span>
            </span>
          )}
          {hasTranscript && (
            <SessionListeningTranscriptToggle
              length={trimmedTranscript.length}
              open={isTranscriptOpen}
              pending={hasPendingTranscription}
              onToggle={() => setIsTranscriptOpen((open) => !open)}
            />
          )}
          {/* Generate questions beside the note counts the seconds itself. */}
          {isGenerating && !offerGenerate && <span>{`Generating questions... ${generationElapsedSeconds}s`}</span>}
          {!isGenerating && addedDrafts && hasGeneratedDraft ? (
            <span role="status">
              <FontAwesomeIcon icon={faArrowDown} />{' '}
              {addedDrafts.count === 1 ? '1 question added below.' : `${addedDrafts.count} questions added below.`}
            </span>
          ) : null}
          {!isGenerating && noNewQuestions ? (
            <span role="status">
              {offerGenerate
                ? 'No new questions from this discussion. Press Generate questions to ask again.'
                : 'No new questions from this discussion.'}
            </span>
          ) : null}
          {/* Here even beside drafts, where the button below is hidden, and while it generates, so focus stays. */}
          {offerGenerate ? generateButton : null}
        </div>
      )}

      {visibleError && (
        <div className={styles.sessionListeningError} role="alert">
          {visibleError}
        </div>
      )}

      {gapWarning ? <div role="status">{gapWarning}</div> : null}
      {oneVoiceWarning ? (
        <div
          className={styles.sessionRecordingWakeNotice}
          role="status"
          data-testid={E2E_TESTIDS.SESSION_RECORDING_ONE_VOICE}
        >
          {oneVoiceWarning}
        </div>
      ) : null}
      {/* One tap must not end capture: Stop first, then close without waiting for uploads. */}
      {!isCapturing && (hasPendingTranscription || failedCount > 0 || isClosing) && onClose ? (
        <span className={styles.sessionRecordingOption}>
          <Button
            type="button"
            className={styles.sessionRecordingButton}
            aria-describedby={`${keepHelpId}-about`}
            onClick={async () => {
              try {
                await finalizeRecording({ waitForTranscription: false });
                await keepAudio();
                if (isMountedRef.current) onClose();
              } catch (error) {
                setCloseError(
                  error instanceof Error ? error.message : 'Could not keep the audio. Download it before leaving.',
                );
              }
            }}
          >
            Close and keep the audio
          </Button>
          <button
            type="button"
            id={keepHelpId}
            className={styles.sessionInterviewHeaderButton}
            aria-label="About closing and keeping the audio"
            aria-describedby={`${keepHelpId}-about`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${keepHelpId}-about`} hidden>
            {KEEP_AUDIO_HELP}
          </span>
          <UncontrolledTooltip target={keepHelpId} trigger="hover focus" autohide={false}>
            {KEEP_AUDIO_HELP}
          </UncontrolledTooltip>
        </span>
      ) : null}
      <SessionRecordingNotices
        recorder={recorder}
        capturing={isRecorderSessionActive}
        labelCheckTimedOut={panelMode === 'recordGroup' && speakerLabelsCheckTimedOut}
      />

      <SessionRecordingChunks
        segments={recorder.segments}
        downloadableChunkIds={recorder.downloadableChunkIds}
        onRetry={recorder.retryChunk}
        onDownload={recorder.downloadChunk}
        onDownloadRecording={recorder.downloadRecording}
        capturing={isRecorderSessionActive}
        storageFailed={recorder.storageFailed}
      />

      {hasTranscript && isTranscriptOpen && (
        <SessionListeningTranscript
          transcript={shownTranscript}
          clearDisabled={
            isRecorderSessionActive ||
            recorder.isBusy ||
            recorder.segments.some((segment) => !['complete', 'failed'].includes(segment.status))
          }
          onClear={() => setConfirmClear(true)}
          onSelectSpeaker={panelMode === 'recordGroup' ? setClaimPerson : undefined}
        />
      )}

      {/* Parts follow the transcript's labels, not the box: a labelled recording keeps them where the box is ticked. */}
      {panelMode === 'recordGroup' && hasTranscript ? (
        <SessionTranscriptClaimShare
          transcript={shownTranscript}
          sessionSlug={sessionSlug}
          sessionConfig={sessionConfig}
          person={claimPerson}
          onPersonChange={setClaimPerson}
          speakerMerges={recorder.speakerMerges}
          onSpeakerMergesChange={recorder.saveSpeakerMerges}
          waiting={isRecorderSessionActive || hasPendingTranscription}
          failedParts={failedCount}
          onePartSpeakers={onePartSpeakers}
          unlabelledParts={unlabelledParts}
        />
      ) : null}

      <CEConfirmDialog
        isOpen={confirmStop}
        title="Stop recording?"
        body={
          draftAtEnd
            ? 'Stop ends the recording and closes once its audio has uploaded. Its questions are drafted when you reopen it.'
            : 'Stop ends the recording and closes once its audio has uploaded.'
        }
        confirmLabel="Stop"
        cancelLabel="Keep recording"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          void handleClose();
        }}
        testId="ce-recording-stop"
      />

      <CEConfirmDialog
        isOpen={confirmClear}
        title="Clear this recording?"
        body={
          retainedAudioCount
            ? 'This deletes the transcript and the audio not yet transcribed. Download that audio first to keep it.'
            : 'This deletes the transcript from this device.'
        }
        confirmLabel="Clear recording"
        cancelLabel="Keep recording"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          handleClear(true);
        }}
        testId="ce-recording-clear"
      />

      {hasTranscript && !hasGeneratedDraft && !offerGenerate && (
        <div className={styles.sessionListeningActions}>{generateButton}</div>
      )}

      {transcriptContext.status ? (
        <span className={styles.sessionRecordingOption} role="status">
          <span>{transcriptContext.status}</span>
          {transcriptContext.failed ? (
            <Button
              type="button"
              className={styles.sessionRecordingButton}
              onClick={() => void transcriptContext.upload(latestTranscriptRef.current)}
            >
              Try again
            </Button>
          ) : null}
        </span>
      ) : null}

      {generatedQuestions.length > 0 && (
        <div
          ref={draftsRef}
          tabIndex={-1}
          role="region"
          aria-label="Draft questions"
          className={styles.sessionListeningCreateWrap}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_SUGGESTIONS}
        >
          <CreateQuestionsAndSurveys
            {...(props as CreateQuestionsAndSurveysPanelProps)}
            interviewQuestionReview
            appendPreformedQuestions
            questionSubmitLabel={isGenerating ? 'Waiting for new drafts…' : 'Submit questions'}
            submitDisabled={isGenerating}
            onDraftQuestionsChange={handleDraftQuestionsChange}
            onSubmittingChange={handleSubmittingChange}
            preformedQuestions={generatedQuestions as CreateQuestionsAndSurveysPanelProps['preformedQuestions']}
            preformedSurvey={{ title: generatedTitle }}
            preformedMode="questions"
            defaultTags={defaultTags as CreateQuestionsAndSurveysPanelProps['defaultTags']}
            documentURLs={[]}
            submitClassName={styles.sessionListeningSubmitButton}
            submitRowClassName={styles.sessionListeningSubmit}
            submitAccessory={
              transcriptContext.available ? <SessionTranscriptContextOption upload={transcriptContext} /> : null
            }
            onQuestionsSubmitted={() => void transcriptContext.upload(latestTranscriptRef.current)}
          />
        </div>
      )}
    </aside>
  );
}
