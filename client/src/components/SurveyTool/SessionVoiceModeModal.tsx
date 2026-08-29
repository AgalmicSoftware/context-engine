import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCheck,
  faClipboard,
  faComments,
  faMicrophone,
  faSpinner,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import BinaryChoiceInput from './BinaryChoiceInput';
import SessionListeningPanel from './SessionListeningPanel';
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
import {
  startSessionRealtimeInterview,
  type RealtimeInterviewSession,
} from '../../utilities/audio/realtimeInterviewClient';

type UnknownRecord = Record<string, unknown>;

type InterviewDraftApplicationProps = {
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
    responderName: string,
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

const displayAnswer = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const describeConfidence = (value: number): { label: string; percent: number } => {
  const confidence = Math.max(0, Math.min(1, value));
  return {
    percent: Math.round(confidence * 100),
    label: confidence < 0.4 ? 'Weak inference' : confidence < 0.7 ? 'Moderate support' : 'Strong support',
  };
};

const parseEditedAnswer = (value: string, original: unknown): unknown => {
  const trimmed = value.trim();
  if (Array.isArray(original) || (original && typeof original === 'object')) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  if (typeof original === 'boolean') return trimmed.toLowerCase() === 'true';
  if (typeof original === 'number' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return value;
};

const displayResponderContext = (packet: InterviewPrefillPacket | null): string => {
  if (!packet) return '';
  const summary = String(packet.responderContext?.summary || '').trim();
  if (summary) return summary;
  return (packet.responderContext?.facts || [])
    .map((entry) => String(entry?.fact || '').trim())
    .filter(Boolean)
    .join('\n');
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
  questions,
  sessionSlug = '',
  sessionConfig = null,
  context,
  workerUrl = '',
  existingResponseSlice = null,
  prefillPacket = null,
  initialError = '',
  onApplyAnswer,
  onApplyAdditional,
  onApplyImportance,
  onApplyConviction,
  onRecordProvenance,
  onClose,
}: SessionInterviewPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<RealtimeInterviewSession | null>(null);
  const importedRef = useRef(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resolvedWorkerUrl, setResolvedWorkerUrl] = useState(workerUrl);
  const [responderContext, setResponderContext] = useState(() => displayResponderContext(prefillPacket));
  const [status, setStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('');
  const [running, setRunning] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [mappingNotice, setMappingNotice] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(initialError);
  const [drafts, setDrafts] = useState<InterviewDraftResponse[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editedAnswers, setEditedAnswers] = useState<Record<string, string>>({});
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const [includeResponderName, setIncludeResponderName] = useState(false);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (workerUrl) setResolvedWorkerUrl(workerUrl);
  }, [workerUrl]);

  useEffect(() => () => {
    void sessionRef.current?.stop();
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
  }, []);

  const resolveWorkerUrl = useCallback(async () => {
    if (resolvedWorkerUrl) return resolvedWorkerUrl;
    const value = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context,
      allowDemoFallback: false,
    });
    setResolvedWorkerUrl(value);
    return value;
  }, [context, resolvedWorkerUrl, sessionConfig, sessionSlug]);

  useEffect(() => {
    if (resolvedWorkerUrl) return;
    void resolveWorkerUrl().catch(() => {
      // Voice start and draft generation surface an actionable worker error.
      // The ordinary-AI handoff stays hidden until a session Worker is known.
    });
  }, [resolveWorkerUrl, resolvedWorkerUrl]);

  const runMapping = useCallback(async ({ nextTranscript = transcript }: { nextTranscript?: string } = {}) => {
    if (!nextTranscript.trim() && !prefillPacket && !responderContext.trim()) {
      setError('');
      setMappingNotice(
        'Not enough information to generate response drafts. Record an interview or add relevant responder context first.',
      );
      setStatus('Not enough information');
      return;
    }
    setMapping(true);
    setError('');
    setMappingNotice('');
    setStatus('Mapping evidence to questions…');
    try {
      if (prefillPacket?.questionSetHash) {
        const currentQuestionSetHash = await hashInterviewQuestions(questions);
        if (currentQuestionSetHash !== prefillPacket.questionSetHash) {
          throw new Error('This prefill link was created for an older or different question set. Ask the AI for a fresh link.');
        }
      }
      const importedDrafts = readImportedInterviewDraftResponses(prefillPacket, questions);
      let mapped = importedDrafts;
      if (mapped === null) {
        const url = await resolveWorkerUrl();
        const contextPacket: InterviewPrefillPacket | null = prefillPacket || (responderContext.trim()
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
        });
      }
      setDrafts(mapped);
      setEditedAnswers(Object.fromEntries(mapped.map((draft) => [draft.questionId, displayAnswer(draft.answer)])));
      setSelected(Object.fromEntries(mapped.map((draft) => [
        draft.questionId,
        !hasDraftValue(responseFieldValue(existingResponseSlice, 'answers', draft.questionId)),
      ])));
      setMappingNotice(mapped.length
        ? ''
        : 'Not enough information to generate response drafts. The interview evidence did not contain enough directly relevant detail to answer a session question. Start another interview and share more detail, or augment it with relevant memories from Claude or ChatGPT.');
      setStatus(mapped.length ? 'Review the proposed drafts' : 'No questions had enough evidence to prefill');
    } catch (mappingError) {
      setMappingNotice('');
      setError(mappingError instanceof Error ? mappingError.message : 'Could not generate response drafts.');
      setStatus('Mapping failed');
    } finally {
      setMapping(false);
    }
  }, [
    existingResponseSlice,
    prefillPacket,
    questions,
    resolveWorkerUrl,
    responderContext,
    sessionConfig,
    sessionSlug,
    transcript,
  ]);

  useEffect(() => {
    if (!prefillPacket || importedRef.current || !questions.length) return;
    importedRef.current = true;
    void runMapping({ nextTranscript: '' });
  }, [prefillPacket, questions.length, runMapping]);

  const startInterview = async () => {
    if (!audioRef.current) return;
    setError('');
    setMappingNotice('');
    try {
      const url = await resolveWorkerUrl();
      sessionRef.current = await startSessionRealtimeInterview({
        workerUrl: url,
        sessionSlug,
        instructions: buildRealtimeInterviewInstructions({ questions, responderContext }),
        audioElement: audioRef.current,
        onStatus: setStatus,
        onTranscript: setTranscript,
      });
      setRunning(true);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start the interview.');
      setStatus('Could not start');
    }
  };

  const endInterview = async () => {
    const result = await sessionRef.current?.stop();
    sessionRef.current = null;
    setRunning(false);
    const nextTranscript = result?.transcript || transcript;
    setTranscript(nextTranscript);
    setShowTranscript(false);
    await runMapping({ nextTranscript });
  };

  const applyDrafts = async () => {
    const applied = drafts.filter((draft) => selected[draft.questionId]);
    setApplying(true);
    setError('');
    setStatus('Applying selected drafts…');
    try {
      for (const draft of applied) {
        await onApplyAnswer(
          draft.questionId,
          parseEditedAnswer(editedAnswers[draft.questionId] ?? displayAnswer(draft.answer), draft.answer),
        );
        if (draft.additionalComments) await onApplyAdditional(draft.questionId, draft.additionalComments);
        if (draft.importance !== undefined) await onApplyImportance(draft.questionId, draft.importance);
        if (draft.conviction !== undefined) await onApplyConviction(draft.questionId, draft.conviction);
      }
      if (applied.length) {
        const directContextSource = !prefillPacket && !transcript.trim() && responderContext.trim()
          ? { platform: 'other' as const, modelId: 'direct-user-context', verification: 'self_reported' as const }
          : null;
        await onRecordProvenance?.(
          applied,
          prefillPacket?.source || directContextSource,
          prefillPacket,
          includeProvenance,
          includeResponderName ? String(prefillPacket?.responderContext?.name || '').trim() : '',
        );
      }
      onClose();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not apply the selected drafts.');
      setStatus('Draft application failed');
    } finally {
      setApplying(false);
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
  const hasImportedResponderContext = Boolean(
    importedContext?.summary?.trim() || importedContext?.facts?.length,
  );

  return (
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
            disabled={running || mapping}
            className={styles.sessionInterviewContextInput}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT}
          />
        </div>
      ) : null}

      <audio ref={audioRef} className={styles.sessionListeningSrOnly} aria-label="Realtime interviewer audio" />
      {error ? <div className={styles.sessionListeningError} role="alert">{error}</div> : null}
      <div className={styles.sessionInterviewActions}>
        <div className={styles.sessionInterviewPrimaryAction}>
          {!running ? (
            <Button
              color="primary"
              onClick={startInterview}
              disabled={mapping || !questions.length}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_START}
            >
              <FontAwesomeIcon icon={faMicrophone} /> Start voice interview
            </Button>
          ) : (
            <Button color="danger" onClick={endInterview} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STOP}>
              End interview and generate drafts
            </Button>
          )}
          <span
            className={`${styles.sessionInterviewStatusDot} ${error ? styles.sessionInterviewStatusDotError : ''}`}
            role="status"
            aria-label={`Interview status: ${status}`}
            title={status}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STATUS}
          />
        </div>
        {!running &&
        !mappingNotice &&
        !Array.isArray(prefillPacket?.responses) &&
        (transcript.trim() || prefillPacket || responderContext.trim()) ? (
          <Button outline onClick={() => runMapping()} disabled={mapping} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_GENERATE}>
            {mapping ? <><FontAwesomeIcon icon={faSpinner} spin /> Mapping…</> : 'Generate response drafts'}
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

      {!running && transcript.trim() ? (
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
            <strong>Interview transcript</strong>
            <span>{transcript.trim().split(/\s+/).length} words</span>
          </button>
          {showTranscript ? (
            <pre
              id="ce-session-interview-transcript-content"
              className={styles.sessionInterviewTranscript}
              aria-label="Interview transcript"
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT}
            >
              {transcript}
            </pre>
          ) : null}
        </section>
      ) : null}

      {kickoff ? (
        <div className={styles.sessionAgentKickoff}>
          <strong className={styles.sessionAgentKickoffTitle}>
            Paste this prompt to augment interview with history from Claude or ChatGPT
          </strong>
          <button
            type="button"
            className={styles.sessionAgentKickoffToggle}
            onClick={() => setShowAgentPrompt((current) => !current)}
            aria-expanded={showAgentPrompt}
            aria-controls="ce-session-interview-agent-prompt"
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE}
          >
            <span>{showAgentPrompt ? 'Hide prompt' : 'View prompt'}</span>
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
            onClick={() => { void copyAgentPrompt(); }}
            aria-label={promptCopied ? 'Memory augmentation prompt copied' : 'Copy memory augmentation prompt'}
            title={promptCopied ? 'Copied' : 'Copy memory augmentation prompt'}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT}
          >
            <FontAwesomeIcon icon={promptCopied ? faCheck : faClipboard} />
          </button>
          {showAgentPrompt ? (
            <code
              id="ce-session-interview-agent-prompt"
              className={styles.sessionAgentKickoffPrompt}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT}
            >
              {kickoff}
            </code>
          ) : null}
        </div>
      ) : null}

      {drafts.length ? (
        <div className={styles.sessionInterviewReview} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_REVIEW}>
          <div className={styles.sessionInterviewReviewHeader}>
            <h4>Review proposed responses</h4>
            <span>{drafts.filter((draft) => selected[draft.questionId]).length} of {drafts.length} selected</span>
          </div>
          {drafts.map((draft) => {
            const question = questions.find((candidate) => candidate.id === draft.questionId);
            const existing = hasDraftValue(responseFieldValue(existingResponseSlice, 'answers', draft.questionId));
            const isSelected = !!selected[draft.questionId];
            const evidenceId = `ce-session-interview-basis-${draft.questionId}`;
            return (
              <article
                className={`${styles.sessionInterviewDraft} ${!isSelected ? styles.sessionInterviewDraftRemoved : ''}`}
                key={draft.questionId}
                data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT}
                data-ce-question-id={draft.questionId}
              >
                <button
                  type="button"
                  className={styles.sessionInterviewDraftRemove}
                  onClick={() => setSelected((current) => ({ ...current, [draft.questionId]: false }))}
                  aria-label={`Remove draft for ${question?.prompt || draft.questionId}`}
                  title="Remove draft"
                  disabled={!isSelected}
                  data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE}
                  data-ce-question-id={draft.questionId}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
                <div className={styles.sessionInterviewQuestion}>{question?.prompt || draft.questionId}</div>
                {question?.type === 'binary' ? (
                  <div className={styles.sessionInterviewBinaryAnswer}>
                    <BinaryChoiceInput
                      questionId={draft.questionId}
                      value={editedAnswers[draft.questionId] ?? ''}
                      inputNamePrefix="interview-draft"
                      showIcons
                      onChange={(answer) => setEditedAnswers((current) => ({
                        ...current,
                        [draft.questionId]: answer,
                      }))}
                    />
                  </div>
                ) : (
                  <Input
                    type="textarea"
                    value={editedAnswers[draft.questionId] ?? ''}
                    onChange={(event) => setEditedAnswers((current) => ({
                      ...current,
                      [draft.questionId]: event.target.value,
                    }))}
                    className={styles.sessionInterviewAnswerInput}
                    aria-label={`Draft answer for ${question?.prompt || draft.questionId}`}
                  />
                )}
                {draft.confidence !== undefined ? (() => {
                  const confidence = describeConfidence(draft.confidence);
                  return (
                    <div
                      className={styles.sessionInterviewConfidence}
                      aria-label={`Prediction confidence: ${confidence.percent}% (${confidence.label})`}
                      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_CONFIDENCE}
                      data-ce-question-id={draft.questionId}
                    >
                      <div className={styles.sessionInterviewConfidenceMeta}>
                        <strong>{confidence.percent}% confidence</strong>
                        <span>{confidence.label}</span>
                      </div>
                      <div
                        className={styles.sessionInterviewConfidenceTrack}
                        role="progressbar"
                        aria-label={`Confidence for ${question?.prompt || draft.questionId}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={confidence.percent}
                      >
                        <span style={{ width: `${confidence.percent}%` }} />
                      </div>
                    </div>
                  );
                })() : null}
                {draft.evidence ? (
                  <div className={styles.sessionInterviewEvidenceDisclosure}>
                    <button
                      type="button"
                      className={styles.sessionInterviewEvidenceToggle}
                      onClick={() => setExpandedEvidence((current) => ({
                        ...current,
                        [draft.questionId]: !current[draft.questionId],
                      }))}
                      aria-expanded={!!expandedEvidence[draft.questionId]}
                      aria-controls={evidenceId}
                      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE}
                      data-ce-question-id={draft.questionId}
                    >
                      <FontAwesomeIcon
                        icon={faCaretDown}
                        className={`${styles.sessionInterviewEvidenceCaret} ${
                          expandedEvidence[draft.questionId] ? styles.sessionInterviewEvidenceCaretExpanded : ''
                        }`}
                      />
                      Basis
                    </button>
                    {expandedEvidence[draft.questionId] ? (
                      <div id={evidenceId} className={styles.sessionInterviewEvidence}>{draft.evidence}</div>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.sessionInterviewDraftActions}>
                  <button
                    type="button"
                    className={`${styles.sessionInterviewDraftApply} ${isSelected ? styles.sessionInterviewDraftApplySelected : ''}`}
                    onClick={() => setSelected((current) => ({ ...current, [draft.questionId]: true }))}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? <FontAwesomeIcon icon={faCheck} /> : null}
                    {existing ? 'Replace with draft' : 'Apply draft'}
                  </button>
                </div>
              </article>
            );
          })}
          <div className={styles.sessionInterviewReviewActions}>
            <div>
              <Label check className={styles.sessionInterviewProvenance}>
                <Input
                  type="checkbox"
                  checked={includeProvenance}
                  onChange={(event) => setIncludeProvenance(event.target.checked)}
                />{' '}
                Include self-reported AI platform/model provenance with submitted responses
              </Label>
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
              onClick={() => { void applyDrafts(); }}
              disabled={applying || !drafts.some((draft) => selected[draft.questionId])}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_APPLY}
            >
              Apply selected drafts
            </Button>
          </div>
        </div>
      ) : null}
    </div>
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
      contentClassName={styles.sessionVoiceModeModal}
      data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_MODAL}
    >
      <ModalHeader toggle={onClose}>{title}</ModalHeader>
      <ModalBody>
        {!mode ? (
          <div className={styles.sessionVoiceModeChooser} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER}>
            <button type="button" onClick={() => onSelectMode('interview')} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW}>
              <FontAwesomeIcon icon={faMicrophone} />
              <strong>Interview</strong>
              <span>One person. A voice interviewer generates reviewable response drafts.</span>
            </button>
            <button type="button" onClick={() => onSelectMode('recordGroup')} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_GROUP}>
              <FontAwesomeIcon icon={faComments} />
              <strong>Group Conversation</strong>
              <span>Record a group discussion and generate new question drafts from it.</span>
            </button>
          </div>
        ) : mode === 'interview' ? (
          <SessionInterviewPanel {...props} questions={questions} />
        ) : (
          <SessionListeningPanel {...props} panelMode="recordGroup" onClose={onClose} />
        )}
      </ModalBody>
      {!mode ? <ModalFooter><Button outline onClick={onClose}>Cancel</Button></ModalFooter> : null}
    </Modal>
  );
}
