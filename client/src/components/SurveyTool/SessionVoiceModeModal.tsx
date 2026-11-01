import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import SessionInterviewPanel from './SessionInterviewPanel';
import SessionListeningPanel from './SessionListeningPanel';
import SessionRecordingHelp from './SessionRecordingHelp';
import SessionVoiceModeChooser from './SessionVoiceModeChooser';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { useKeptRecordingChunks } from '../../utilities/audio/useRecordingChunkQueue';
import { sortInterviewQuestionPoolNewestFirst } from './sessionInterviewQuestionOrder';
import { normalizeInterviewQuestions, type InterviewPrefillPacket } from './sessionInterview';
import type { SessionVoiceModeModalProps } from './sessionVoiceModeTypes';
import styles from './SurveyTool.module.scss';

// The listening panel's anchor stops being fixed on narrow screens, where this notice must still show. Its
// card is light in every theme, so its small buttons use the transcript pill's dark text.
const KEPT_AUDIO_NOTICE_POSITION: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  left: 16,
  zIndex: 60,
  display: 'flex',
  justifyContent: 'flex-end',
  pointerEvents: 'none',
};

const KEPT_AUDIO_HELP =
  'Close and keep the audio left it unsent. It stays on this device until it uploads; reopen the recording to finish.';

export default function SessionVoiceModeModal(props: SessionVoiceModeModalProps) {
  const { isOpen, mode, onSelectMode, onClose, questionPool = [], context } = props;
  const keptHelpId = `ce-kept-audio-help-${useId().replace(/:/g, '')}`;
  // Dismissed until the dialog next closes, so it never covers the page for good.
  const [keptDismissed, setKeptDismissed] = useState(false);
  useEffect(() => {
    if (isOpen) setKeptDismissed(false);
  }, [isOpen]);
  // While closed, audio a Group Conversation kept on this device still has to be uploaded.
  const keptChunks = useKeptRecordingChunks(
    {
      sessionSlug: props.sessionSlug || '',
      sessionConfig: props.sessionConfig || null,
      workerUrl: props.workerUrl,
      context: {
        account: context && typeof context === 'object' && 'account' in context ? context.account : props.account,
      },
    },
    !isOpen,
  );
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
  const groupCloseRef = useRef<(() => Promise<void>) | null>(null);
  // A tap outside or Escape must not end a recording; the header close button still stops and saves it.
  const [groupCapturing, setGroupCapturing] = useState(false);
  const requestClose = () => {
    if (mode === 'recordGroup' && groupCloseRef.current) void groupCloseRef.current();
    else onClose();
  };
  const questions = useMemo(
    () => normalizeInterviewQuestions(sortInterviewQuestionPoolNewestFirst(questionPool)),
    [questionPool],
  );
  const title = mode === 'interview' ? 'Interview' : mode === 'recordGroup' ? 'Group Conversation' : 'Voice mode';
  return (
    <>
      <Modal
        isOpen={isOpen}
        unmountOnClose={mode !== 'interview'}
        toggle={requestClose}
        backdrop={groupCapturing ? 'static' : true}
        keyboard={!groupCapturing}
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
              <span className={styles.sessionRecordingHeading}>
                {title}
                {mode === 'recordGroup' ? <SessionRecordingHelp /> : null}
              </span>
            </ModalHeader>
            <ModalBody>
              {!mode ? (
                <SessionVoiceModeChooser onSelectMode={onSelectMode}>
                  <SessionVoicePrefillCard
                    questionPool={questionPool}
                    existingResponseSlice={props.existingResponseSlice}
                    sessionSlug={props.sessionSlug}
                    sessionConfig={props.sessionConfig}
                    context={props.context}
                    workerUrl={props.workerUrl}
                  />
                </SessionVoiceModeChooser>
              ) : (
                <SessionListeningPanel
                  {...props}
                  panelMode="recordGroup"
                  embeddedInModal
                  onClose={onClose}
                  closeActionRef={groupCloseRef}
                  onCaptureChange={setGroupCapturing}
                />
              )}
            </ModalBody>
          </>
        )}
      </Modal>
      {keptChunks > 0 && !keptDismissed ? (
        <div style={KEPT_AUDIO_NOTICE_POSITION}>
          <aside className={styles.sessionListeningPanel} aria-label="Kept recording audio">
            <span className={styles.sessionRecordingOption}>
              <span role="status">Saved audio is waiting to upload.</span>
              <button
                type="button"
                id={keptHelpId}
                className={styles.sessionListeningTranscriptButton}
                aria-label="About kept recording audio"
                aria-describedby={`${keptHelpId}-about`}
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
              <span id={`${keptHelpId}-about`} hidden>
                {KEPT_AUDIO_HELP}
              </span>
              <UncontrolledTooltip target={keptHelpId} trigger="hover focus" autohide={false}>
                {KEPT_AUDIO_HELP}
              </UncontrolledTooltip>
            </span>
            <span className={styles.sessionRecordingOption}>
              <Button
                type="button"
                className={styles.sessionListeningGenerate}
                onClick={() => onSelectMode('recordGroup')}
              >
                Reopen recording
              </Button>
              <button
                type="button"
                className={styles.sessionListeningTranscriptButton}
                onClick={() => setKeptDismissed(true)}
              >
                Dismiss
              </button>
            </span>
          </aside>
        </div>
      ) : null}
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
