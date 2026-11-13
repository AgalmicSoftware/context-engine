/** @file SessionFeedbackSection.tsx: the collapsed Feedback section below Results, for feedback about the app itself. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import {
  FEEDBACK_REACH_MAX,
  FEEDBACK_TEXT_MAX,
  feedbackOffered,
  sendFeedback,
  type FeedbackDraft,
} from '../../domains/worker/sessionFeedbackPorts';
import { getResolvedTheme } from '../../utilities/ui/themeRuntime';
import { PUBLIC_REPO_NEW_ISSUE_URL } from '../../variables/publicRepoMetadata';
import page from './OnePageSession.module.scss';
import styles from './SessionFeedbackSection.module.scss';

const ABOUT =
  'Say what worked in the app, what didn’t, and what you’d change. It goes to this session’s admins and isn’t ' +
  'part of anyone’s answers.';
const ABOUT_CONTACT =
  'Without this, nothing sent says who you are. With it, the admins also get what you write here and, if you’re ' +
  'signed in, your account’s address.';

/** The app's release, set when it is built; empty in tests and local runs without one. */
const appRelease = (): string => (typeof __CE_APP_RELEASE__ === 'string' ? __CE_APP_RELEASE__ : '');

const screenClass = (): FeedbackDraft['screen'] => {
  const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
  if (width < 640) return 'phone';
  return width < 1024 ? 'tablet' : 'desktop';
};

/** The open part of the page as a short name. Never an address: links carry group ids, invites and prefills. */
export const feedbackView = (view: string): string => view.replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 80) || 'session';

type HelpProps = { id: string; label: string; text: string };

// A "?" that says its text on hover and focus, and to screen readers from the hidden copy.
const Help = ({ id, label, text }: HelpProps) => (
  <>
    <button
      type="button"
      id={id}
      className={styles.help}
      aria-label={label}
      aria-describedby={`${id}-text`}
      data-ce-control-appearance="frameless"
    >
      <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
    </button>
    <span id={`${id}-text`} className={styles.hidden}>
      {text}
    </span>
    <CETooltip target={id} placement="bottom" trigger="hover focus" autohide={false}>
      {text}
    </CETooltip>
  </>
);

type Props = {
  sessionSlug: string;
  sessionConfig: unknown;
  /** The signed-in account, or '' for a visitor, who may send too. */
  account: string;
  /** The part of the page that is open, such as `results:debateAtlas`. */
  view: string;
  /** In an agent session's page, whose sections are plain panels. */
  agent?: boolean;
};

function FeedbackSection({ sessionSlug, sessionConfig, account, view, agent = false }: Props) {
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [contactMe, setContactMe] = useState(false);
  const [reachMe, setReachMe] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const thanks = useRef<HTMLParagraphElement>(null);
  // Read when a request is sent, so a config object rebuilt on each render asks nothing again.
  const options = useRef({ sessionSlug, sessionConfig, account });
  options.current = { sessionSlug, sessionConfig, account };
  const turnedOff = (sessionConfig as { feedbackEnabled?: unknown } | null)?.feedbackEnabled === false;

  useEffect(() => {
    let current = true;
    setOffered(false);
    if (turnedOff) return undefined;
    void feedbackOffered(options.current).then((value) => {
      if (current) setOffered(value);
    });
    return () => {
      current = false;
    };
  }, [sessionSlug, turnedOff]);

  // Send and Send more each remove the control that had focus: move it to what replaced them, which
  // also has a screen reader read the thanks.
  useEffect(() => {
    if (sent) thanks.current?.focus();
  }, [sent]);

  if (!offered) return null;

  const message = text.trim();
  const reach = reachMe.trim();
  const ready = !!message && (!contactMe || !!reach) && !sending;

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
          ...(contactMe ? { reachMe: reach } : {}),
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

  const sendMore = () => {
    setText('');
    setSent(false);
    // The box is back once this renders.
    setTimeout(() => box.current?.focus(), 0);
  };

  return (
    <section
      id="feedback"
      className={agent ? page.agentListPanel : `${page.sectionContainer} ${open ? page.sectionExpanded : ''}`}
      aria-labelledby="ce-session-feedback-title"
      data-testid="ce-session-feedback"
    >
      <div className={agent ? styles.agentHeaderRow : page.sectionHeaderRow}>
        {/* Named by its title alone: a heading's name is otherwise all the text in it, the "?"'s included. */}
        <h2 className={agent ? styles.agentHeader : page.sectionHeader} aria-labelledby="ce-session-feedback-title">
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={open ? 'ce-session-feedback-body' : undefined}
            data-ce-control-appearance="frameless"
            data-testid="ce-session-feedback-toggle"
            onClick={() => setOpen((value) => !value)}
          >
            <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} className={page.sectionToggleIcon} />
            <span className={page.sectionHeaderText}>
              <span id="ce-session-feedback-title" className={page.sectionHeaderTitle}>
                Feedback
              </span>
            </span>
          </button>
          <Help id="ce-session-feedback-help" label="About feedback" text={ABOUT} />
        </h2>
      </div>
      {open ? (
        <div id="ce-session-feedback-body" className={styles.body}>
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
                onChange={(event) => setText(event.target.value)}
              />
              <p id="ce-session-feedback-left" className={styles.hint}>
                {(FEEDBACK_TEXT_MAX - text.length).toLocaleString('en-US')} left
              </p>
              <div className={styles.contact}>
                <label htmlFor="ce-session-feedback-contact">
                  <input
                    id="ce-session-feedback-contact"
                    type="checkbox"
                    checked={contactMe}
                    data-testid="ce-session-feedback-contact"
                    onChange={(event) => setContactMe(event.target.checked)}
                  />
                  You may contact me
                </label>
                <Help id="ce-session-feedback-contact-help" label="About being contacted" text={ABOUT_CONTACT} />
              </div>
              {contactMe ? (
                <div className={styles.reach}>
                  <label htmlFor="ce-session-feedback-reach">How to reach you</label>
                  <input
                    id="ce-session-feedback-reach"
                    type="text"
                    className={`form-control ${styles.field}`}
                    placeholder="Email or handle"
                    maxLength={FEEDBACK_REACH_MAX}
                    value={reachMe}
                    autoComplete="email"
                    data-testid="ce-session-feedback-reach"
                    onChange={(event) => setReachMe(event.target.value)}
                  />
                </div>
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
          <p className={styles.hint}>
            Ideas for everyone?{' '}
            <a href={PUBLIC_REPO_NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              Suggest them on GitHub
            </a>
          </p>
        </div>
      ) : null}
    </section>
  );
}

// A draft belongs to the session it was typed on: another session's page starts empty.
export default function SessionFeedbackSection(props: Props) {
  return <FeedbackSection key={props.sessionSlug} {...props} />;
}
