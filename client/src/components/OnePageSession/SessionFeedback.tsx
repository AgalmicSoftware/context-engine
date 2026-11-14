/** @file SessionFeedback.tsx: the footer's Feedback button and its dialog, for feedback about the app itself. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faMicrophone } from '@fortawesome/free-solid-svg-icons';

import {
  FEEDBACK_TEXT_MAX,
  dictationOffered,
  feedbackOffered,
  feedbackWorkerRun,
  sessionEnded,
  feedbackView,
  sendFeedback,
  type FeedbackDraft,
  type FeedbackOptions,
} from '../../domains/worker/sessionFeedbackPorts';
import { RECORDING_STATUS, useWhisper } from '../../utilities/useWhisper';
import { getResolvedTheme } from '../../utilities/ui/themeRuntime';
import CETooltip from '../Shared/CETooltip';
import { FOOTER_SESSION_ACTIONS_IDS } from '../Footer/Footer';
import footer from '../Footer/Footer.module.scss';
import dialog from './SessionAgentModal.module.scss';
import styles from './SessionFeedback.module.scss';

const ABOUT = 'Tell this session’s admins what worked in the app and what didn’t. It never says who you are.';

/** The app's release, set when it is built; empty in tests and local runs without one. */
const appRelease = (): string => (typeof __CE_APP_RELEASE__ === 'string' ? __CE_APP_RELEASE__ : '');

const screenClass = (): FeedbackDraft['screen'] => {
  const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
  if (width < 640) return 'phone';
  return width < 1024 ? 'tablet' : 'desktop';
};

/**
 * The answer field's dictation: the same recorder, written down by the session's Worker on the session's AI
 * allowance. Mounted only while the form shows, so closing the dialog stops it and keeps no audio.
 */
function Dictation({
  options,
  onWords,
  onBusy,
}: {
  options: FeedbackOptions;
  onWords: (words: string) => void;
  /** Recording or writing down, during which Send would lose the words. */
  onBusy: (busy: boolean) => void;
}) {
  const mic = useRef<HTMLButtonElement>(null);
  const { status, isRecording, isProcessing, errorMessage, startRecording, stopRecording } = useWhisper({
    apiKey: '',
    silenceDetection: false,
    timeSlice: 0,
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    context: { account: options.account },
    // Like Send, speaking never asks for a signature or passkey.
    signInPrompt: false,
    onTranscriptionComplete: onWords,
  });
  const writing = isProcessing || status === RECORDING_STATUS.PROCESSING;
  const busy = isRecording || writing;
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);
  return (
    <>
      <span className={styles.dictation}>
        {isRecording || writing ? (
          <span className={styles.hint} role="status">
            {isRecording ? 'Recording…' : 'Processing audio…'}
          </span>
        ) : null}
        <button
          ref={mic}
          type="button"
          className={`${styles.mic} ${isRecording ? styles.recording : ''}`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          aria-pressed={isRecording}
          // Not disabled, which would drop keyboard focus out of the dialog: a press while writing does nothing.
          aria-disabled={writing}
          data-ce-control-appearance="frameless"
          data-testid="ce-session-feedback-mic"
          onClick={() => {
            if (!writing) void (isRecording ? stopRecording() : startRecording());
          }}
        >
          <FontAwesomeIcon icon={isRecording ? faCircle : faMicrophone} />
        </button>
        <CETooltip target={mic} placement="top" trigger="hover focus">
          {isRecording
            ? 'Stop recording and add the transcript to this text.'
            : 'Record speech and add its transcript to this text.'}
        </CETooltip>
      </span>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}

type Props = {
  sessionSlug: string;
  sessionConfig: unknown;
  /** The signed-in account, or '' for a visitor, who may send too. */
  account: string;
  /** The part of the page that is open, such as `results:debateAtlas`. */
  view: string;
};

function Feedback({ sessionSlug, sessionConfig, account, view }: Props) {
  const [offered, setOffered] = useState(false);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  // Whether the session pays for AI, so speech can be written down: asked when the form first opens.
  const [speech, setSpeech] = useState<boolean | null>(null);
  // Spoken words that didn't fit under the limit.
  const [cut, setCut] = useState(false);
  const [listening, setListening] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // Focus goes back here on close: some browsers don't focus a button that is clicked.
  const opener = useRef<HTMLButtonElement | null>(null);
  const thanks = useRef<HTMLParagraphElement>(null);
  // Read when a request is sent, so a config object rebuilt on each render asks nothing again.
  const options = useRef({ sessionSlug, sessionConfig, account });
  options.current = { sessionSlug, sessionConfig, account };
  // What is in the box now: words are written down after a wait, during which more may be typed.
  const typed = useRef(text);
  typed.current = text;
  const turnedOff = (sessionConfig as { feedbackEnabled?: unknown } | null)?.feedbackEnabled === false;
  // The page may get the session's config after this mounts: ask again once it says a Worker runs it.
  const workerRun = feedbackWorkerRun(sessionConfig);

  // The button sits in the site's footer, which the app renders beside the session page: in each of its places,
  // of which the footer shows the one its theme uses.
  useEffect(() => {
    setSlots(FOOTER_SESSION_ACTIONS_IDS.flatMap((id) => document.getElementById(id) || []));
  }, []);

  useEffect(() => {
    let current = true;
    setOffered(false);
    // Turned off while open, it stays closed when turned on again.
    setOpen(false);
    if (turnedOff) return undefined;
    void feedbackOffered(options.current).then((value) => {
      if (current) setOffered(value);
    });
    return () => {
      current = false;
    };
  }, [sessionSlug, turnedOff, workerRun]);

  // Signing in or out changes whether speech can be written down.
  useEffect(() => {
    setSpeech(null);
  }, [account]);

  // Asked again for a new sign-in, which also drops an answer still on its way for the old one.
  useEffect(() => {
    if (!open || speech !== null) return undefined;
    let current = true;
    // A Worker that couldn't be read gives null, so the next open asks again.
    void dictationOffered(options.current).then((value) => {
      if (current && value !== null) setSpeech(value);
    });
    return () => {
      current = false;
    };
  }, [open, speech, account]);

  // Send and Send more each remove the control that had focus: move it to what replaced them, which
  // also has a screen reader read the thanks.
  useEffect(() => {
    if (sent) thanks.current?.focus();
  }, [sent]);

  if (!offered || !slots.length) return null;

  const message = text.trim();
  const ready = !!message && !sending && !listening;
  const close = () => setOpen(false);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setSending(true);
    setError('');
    try {
      await sendFeedback(
        {
          text: message,
          view: feedbackView(view),
          theme: getResolvedTheme().id,
          screen: screenClass(),
          ...(appRelease() ? { appRelease: appRelease() } : {}),
        },
        options.current,
      );
      setSent(true);
    } catch (failure) {
      // The message is the Worker's own refusal or a plain sentence; see sendFeedback.
      setError(failure instanceof Error && failure.message ? failure.message : 'Not sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  // Spoken words join the end of what is there when they are written down, as in an answer, up to the limit.
  const addWords = (words: string) => {
    const spoken = words.trim();
    if (!spoken) return;
    const base = typed.current.trimEnd();
    const joined = `${base}${base ? ' ' : ''}${spoken}`;
    setText(joined.slice(0, FEEDBACK_TEXT_MAX));
    setCut(joined.length > FEEDBACK_TEXT_MAX);
  };

  const sendMore = () => {
    setText('');
    setCut(false);
    setSent(false);
    // The box is back once this renders.
    setTimeout(() => box.current?.focus(), 0);
  };

  return (
    <>
      {slots.map((slot) =>
        createPortal(
          <button
            type="button"
            className={`${footer.footerLink} nav-link ${styles.footerButton}`}
            aria-haspopup="dialog"
            data-ce-control-appearance="frameless"
            data-testid="ce-session-feedback-button"
            onClick={(event) => {
              opener.current = event.currentTarget;
              setOpen(true);
            }}
          >
            Feedback
          </button>,
          slot,
          slot.id,
        ),
      )}
      {/* Closing keeps what was typed: this stays mounted while the page is open. Focus returns to the button. */}
      <Modal
        isOpen={open}
        toggle={close}
        centered
        contentClassName={dialog.content}
        labelledBy="ce-session-feedback-title"
        // Once it has faded in, focus goes into the box, or to the thanks if this was sent.
        onOpened={() => (sent ? thanks.current : box.current)?.focus()}
        returnFocusAfterClose={false}
        onClosed={() => opener.current?.focus()}
      >
        <ModalHeader toggle={close} className={dialog.header}>
          <span id="ce-session-feedback-title">Feedback</span>
        </ModalHeader>
        <ModalBody className={dialog.body} data-testid="ce-session-feedback">
          <p>{ABOUT}</p>
          {sent ? (
            <p
              ref={thanks}
              tabIndex={-1}
              role="status"
              className={styles.thanks}
              data-testid="ce-session-feedback-sent"
            >
              Thanks, it’s sent.{' '}
              <button type="button" className={styles.link} data-ce-control-appearance="frameless" onClick={sendMore}>
                Send more
              </button>
            </p>
          ) : (
            <form className={styles.form} onSubmit={send}>
              <label htmlFor="ce-session-feedback-text" className={styles.hidden}>
                Your feedback
              </label>
              <textarea
                ref={box}
                id="ce-session-feedback-text"
                className={`form-control ${styles.field} ${styles.text}`}
                placeholder="What worked, what didn’t, what would you change?"
                maxLength={FEEDBACK_TEXT_MAX}
                value={text}
                aria-describedby="ce-session-feedback-left"
                data-testid="ce-session-feedback-text"
                onChange={(event) => {
                  setText(event.target.value);
                  setCut(false);
                }}
              />
              <div className={styles.below}>
                <p id="ce-session-feedback-left" className={styles.hint}>
                  {(FEEDBACK_TEXT_MAX - text.length).toLocaleString('en-US')} left
                </p>
                {/* Gone once the session ends while the page is open. */}
                {speech && !sessionEnded(sessionConfig) ? (
                  <Dictation options={options.current} onWords={addWords} onBusy={setListening} />
                ) : null}
              </div>
              {cut ? (
                <p className={styles.hint} role="status">
                  The end of what you said didn’t fit in 2,000 characters.
                </p>
              ) : null}
              <div className={styles.actions}>
                <button type="submit" className={styles.send} disabled={!ready} data-testid="ce-session-feedback-send">
                  {sending ? 'Sending…' : 'Send'}
                </button>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </form>
          )}
        </ModalBody>
      </Modal>
    </>
  );
}

// A draft belongs to the session it was typed on: another session's page starts empty.
export default function SessionFeedback(props: Props) {
  return <Feedback key={props.sessionSlug} {...props} />;
}
