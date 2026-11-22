import React, { useState } from 'react';
import CEConfirmDialog from './CEConfirmDialog';
import { loadPastedAnswers, takeAnswersHandoffNote, type AnswersHandoffNote } from '../../utilities/ui/answersHandoff';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What a "Copy my answers" link brought to this browser, in plain words. */
export const describeLoadedAnswers = ({ typed, interview, kept }: { typed: number; interview: number; kept: number }) =>
  [
    typed ? `Loaded ${plural(typed, 'answer')}.` : '',
    interview ? `Loaded ${plural(interview, 'interview answer')}: open Interview to review them.` : '',
    kept
      ? `${plural(kept, 'copied answer')} ${kept === 1 ? 'was' : 'were'} not loaded, because this browser already holds answers of its own.`
      : '',
    typed || interview ? 'Check them, then sign in and submit.' : '',
  ]
    .filter(Boolean)
    .join(' ');

/**
 * Shown once after a "Copy my answers" link or message is opened here: what was loaded, or a box to paste the
 * copied message into when the link could not carry it whole.
 */
const AnswersHandoffArrival = () => {
  const [note, setNote] = useState<AnswersHandoffNote | null>(takeAnswersHandoffNote);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  if (!note) return null;
  const close = () => setNote(null);
  if (note.kind === 'loaded') {
    return (
      <CEConfirmDialog
        isOpen
        testId="ce-answers-handoff-loaded"
        title="Your answers are here"
        body={describeLoadedAnswers(note)}
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={close}
        onCancel={close}
      />
    );
  }
  return (
    <CEConfirmDialog
      isOpen
      testId="ce-answers-handoff-paste"
      title="Paste your copied answers"
      body={
        <>
          <textarea
            className="form-control"
            rows={5}
            aria-label="Copied answers"
            aria-describedby="ce-answers-handoff-paste-status"
            placeholder="Paste the whole message you copied"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            data-testid="ce-answers-handoff-paste-box"
          />
          <p id="ce-answers-handoff-paste-status" role="status">
            {error || note.error}
          </p>
        </>
      }
      confirmLabel="Load answers"
      cancelLabel="Cancel"
      onConfirm={() => {
        void loadPastedAnswers(pasted).then(setError);
      }}
      onCancel={close}
    />
  );
};

export default AnswersHandoffArrival;
