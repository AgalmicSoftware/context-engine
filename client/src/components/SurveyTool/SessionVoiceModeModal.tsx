import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import SessionInterviewPanel from './SessionInterviewPanel';
import SessionListeningPanel from './SessionListeningPanel';
import SessionRecordingHelp from './SessionRecordingHelp';
import SessionTranscriptClaimScanner from './SessionTranscriptClaimScanner';
import SessionVoiceModeBackButton, { VoiceModeBackContext } from './SessionVoiceModeBack';
import SessionVoiceModeChooser from './SessionVoiceModeChooser';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { VOICE_DIALOG_NOTICE_SLOT_ID } from '../../utilities/ui/voiceDialogNoticeSlot';
import { useKeptRecording } from '../../utilities/audio/useRecordingChunkQueue';
import { sortInterviewQuestionPoolNewestFirst } from './sessionInterviewQuestionOrder';
import { normalizeInterviewQuestions, type InterviewPrefillPacket, type SessionVoiceMode } from './sessionInterview';
import type { TranscriptClaim } from './sessionTranscriptClaim';
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
const UNSAVED_NOTICE = "This recording can't be recovered after a reload.";
const UNSAVED_HELP =
  'Device storage failed, so only this page holds it. Reopen the recording before leaving to finish it or copy its transcript.';

export default function SessionVoiceModeModal(props: SessionVoiceModeModalProps) {
  const { isOpen, mode, onSelectMode, onClose, questionPool = [], context } = props;
  const keptHelpId = `ce-kept-audio-help-${useId().replace(/:/g, '')}`;
  // Dismissed until the dialog next closes, so it never covers the page for good.
  const [keptDismissed, setKeptDismissed] = useState(false);
  // The choice Back left, which takes focus when the two choices return, so focus doesn't drop to the page.
  const [backFrom, setBackFrom] = useState<SessionVoiceMode | null>(null);
  useEffect(() => {
    if (isOpen) setKeptDismissed(false);
    else setBackFrom(null);
  }, [isOpen]);
  // While closed, audio a Group Conversation kept on this device still has to be uploaded, and what only this
  // page holds (device storage failed) is lost by a reload.
  const kept = useKeptRecording(
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
  // What confirming the discard does next: close the dialog, or go back to its two choices.
  const [confirmDiscard, setConfirmDiscard] = useState<'close' | 'back' | null>(null);
  const [interviewVersion, setInterviewVersion] = useState(0);
  const [discardedPrefill, setDiscardedPrefill] = useState<InterviewPrefillPacket | null>(null);
  const prefillPacket = props.prefillPacket === discardedPrefill ? null : props.prefillPacket;
  const [discardedClaim, setDiscardedClaim] = useState<TranscriptClaim | null>(null);
  const claim = props.claim === discardedClaim ? null : props.claim;
  const [scanRequested, setScanRequested] = useState(false);
  // Closing retains this review, but importing different evidence starts a new
  // review. Equivalent packet objects must not erase the participant's edits.
  const prefillIdentity = useMemo(() => JSON.stringify(prefillPacket || null), [prefillPacket]);
  const onInterviewProgressChange = props.onInterviewProgressChange;
  useEffect(() => {
    onInterviewProgressChange?.(hasUnsavedReview);
  }, [hasUnsavedReview, onInterviewProgressChange]);
  const groupCloseRef = useRef<(() => Promise<void>) | null>(null);
  // Capturing, or finishing a close: a tap outside or Escape must not end a recording (the header close button
  // still stops and saves it), and Back waits.
  const [groupBusy, setGroupBusy] = useState(false);
  // The header spot Group Conversation puts its + in, once the header has rendered.
  const [headerActions, setHeaderActions] = useState<HTMLSpanElement | null>(null);
  // A code opened in a tab that's recording waits until the recording has stopped and finished.
  const scanning = (scanRequested || !!props.claimFrame) && !groupBusy;
  const stopScanning = () => {
    setScanRequested(false);
    props.onClaimFrameDone?.();
  };
  const requestClose = () => {
    if (mode === 'recordGroup' && groupCloseRef.current) void groupCloseRef.current();
    else onClose();
  };
  // Leaving the interview drops what fed it, so choosing Interview again starts afresh.
  const leaveInterview = () => {
    setHasUnsavedReview(false);
    setDiscardedPrefill(props.prefillPacket || null);
    setDiscardedClaim(props.claim || null);
    setInterviewVersion((version) => version + 1);
  };
  // Back to the two choices. Group Conversation first finishes its recording and uploads, as closing does,
  // and an interview with unsaved work asks first, as Discard does.
  const backAfterGroupClose = useRef(false);
  const backToChoices = () => {
    setBackFrom(mode);
    onSelectMode(null);
  };
  const goBack = () => {
    if (mode === 'recordGroup' && groupCloseRef.current) {
      // A second Back while the first finishes would otherwise turn it into a close.
      if (backAfterGroupClose.current) return;
      backAfterGroupClose.current = true;
      void groupCloseRef.current().finally(() => {
        backAfterGroupClose.current = false;
      });
    } else if (mode === 'interview' && hasUnsavedReview) setConfirmDiscard('back');
    else {
      if (mode === 'interview') leaveInterview();
      backToChoices();
    }
  };
  // The prompt to have your own AI draft your answers, on the choices and on Interview.
  const prefillCard = (
    <SessionVoicePrefillCard
      questionPool={questionPool}
      existingResponseSlice={props.existingResponseSlice}
      sessionSlug={props.sessionSlug}
      sessionConfig={props.sessionConfig}
      context={props.context}
      workerUrl={props.workerUrl}
    />
  );
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
        backdrop={groupBusy ? 'static' : true}
        keyboard={!groupBusy}
        size="lg"
        centered
        labelledBy="ce-session-voice-mode-title"
        returnFocusAfterClose
        contentClassName={styles.sessionVoiceModeModal}
        data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_MODAL}
      >
        {isOpen ? <div id={VOICE_DIALOG_NOTICE_SLOT_ID} /> : null}
        {mode === 'interview' ? (
          <VoiceModeBackContext.Provider value={goBack}>
            <SessionInterviewPanel
              key={`${interviewVersion}:${prefillIdentity}`}
              {...props}
              prefillPacket={prefillPacket}
              claim={claim}
              onClose={requestClose}
              questions={questions}
              onReviewStateChange={setHasUnsavedReview}
              onRequestDiscard={() => setConfirmDiscard('close')}
            />
            {/* Until the interview has something to review. */}
            {!hasUnsavedReview && !prefillPacket && !claim ? (
              <ModalBody className={styles.sessionInterviewPrefill}>{prefillCard}</ModalBody>
            ) : null}
          </VoiceModeBackContext.Provider>
        ) : (
          <>
            <ModalHeader toggle={requestClose}>
              <span className={styles.sessionVoiceModeTitle}>
                <span className={styles.sessionRecordingHeading}>
                  {mode === 'recordGroup' ? (
                    <SessionVoiceModeBackButton id="ce-group-back" onBack={goBack} disabled={groupBusy} />
                  ) : null}
                  {/* The dialog takes its name from the title alone, not the icons beside it. */}
                  <span id="ce-session-voice-mode-title">{title}</span>
                  {mode === 'recordGroup' ? <SessionRecordingHelp /> : null}
                </span>
                <span className={styles.sessionVoiceModeActions}>
                  {/* Group Conversation's + for audio and transcripts goes here. */}
                  {mode === 'recordGroup' ? (
                    <span ref={setHeaderActions} className={styles.sessionVoiceModeSlot} />
                  ) : null}
                  {props.onClaim ? (
                    <>
                      <button
                        type="button"
                        id="ce-session-claim-scan"
                        className={styles.sessionInterviewHeaderButton}
                        data-ce-control-appearance="frameless"
                        aria-label="Scan code"
                        disabled={groupBusy}
                        data-testid={E2E_TESTIDS.SESSION_CLAIM_SCAN}
                        onClick={() => setScanRequested(true)}
                      >
                        <FontAwesomeIcon icon={faQrcode} />
                      </button>
                      <UncontrolledTooltip target="ce-session-claim-scan" trigger="hover focus">
                        Scan code
                      </UncontrolledTooltip>
                    </>
                  ) : null}
                </span>
              </span>
            </ModalHeader>
            <ModalBody>
              {!mode ? (
                <SessionVoiceModeChooser onSelectMode={onSelectMode} focusMode={backFrom}>
                  {prefillCard}
                </SessionVoiceModeChooser>
              ) : (
                <SessionListeningPanel
                  {...props}
                  panelMode="recordGroup"
                  embeddedInModal
                  onClose={() => (backAfterGroupClose.current ? backToChoices() : onClose())}
                  closeActionRef={groupCloseRef}
                  onBusyChange={setGroupBusy}
                  headerActionsSlot={headerActions}
                />
              )}
            </ModalBody>
          </>
        )}
      </Modal>
      {isOpen && scanning ? (
        <Modal isOpen toggle={stopScanning} centered contentClassName={styles.sessionVoiceModeModal}>
          <ModalHeader toggle={stopScanning}>Scan your code</ModalHeader>
          <ModalBody>
            <SessionTranscriptClaimScanner
              sessionSlug={props.sessionSlug || ''}
              firstFrame={props.claimFrame}
              onCancel={stopScanning}
              onClaim={(scanned) => {
                stopScanning();
                // A recording left in this dialog finishes as closing it would, before the interview takes over.
                void Promise.resolve(groupCloseRef.current?.()).finally(() => props.onClaim?.(scanned));
              }}
            />
          </ModalBody>
        </Modal>
      ) : null}
      {(kept.waiting > 0 || kept.unsaved) && !keptDismissed ? (
        <div style={KEPT_AUDIO_NOTICE_POSITION}>
          <aside className={styles.sessionListeningPanel} aria-label="Kept recording audio">
            <span className={styles.sessionRecordingOption}>
              <span role="status">{kept.unsaved ? UNSAVED_NOTICE : 'Saved audio is waiting to upload.'}</span>
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
                {kept.unsaved ? UNSAVED_HELP : KEPT_AUDIO_HELP}
              </span>
              <UncontrolledTooltip target={keptHelpId} trigger="hover focus" autohide={false}>
                {kept.unsaved ? UNSAVED_HELP : KEPT_AUDIO_HELP}
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
        isOpen={isOpen && confirmDiscard !== null}
        title="Discard this interview?"
        body="Your transcript, imported prefill, and unsaved review edits will be lost. Responses you’ve already submitted are kept."
        confirmLabel="Discard interview"
        cancelLabel="Keep reviewing"
        danger
        onCancel={() => setConfirmDiscard(null)}
        onConfirm={() => {
          const next = confirmDiscard;
          setConfirmDiscard(null);
          leaveInterview();
          if (next === 'back') backToChoices();
          else onClose();
        }}
        testId="ce-interview-discard"
      />
    </>
  );
}
