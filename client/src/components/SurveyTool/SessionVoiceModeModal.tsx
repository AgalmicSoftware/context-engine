import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import SessionInterviewPanel from './SessionInterviewPanel';
import SessionListeningPanel from './SessionListeningPanel';
import SessionVoiceModeChooser from './SessionVoiceModeChooser';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { sortInterviewQuestionPoolNewestFirst } from './sessionInterviewQuestionOrder';
import { normalizeInterviewQuestions, type InterviewPrefillPacket } from './sessionInterview';
import type { SessionVoiceModeModalProps } from './sessionVoiceModeTypes';
import styles from './SurveyTool.module.scss';

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
              {title}
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
