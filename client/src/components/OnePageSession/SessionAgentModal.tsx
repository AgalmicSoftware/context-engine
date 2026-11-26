/** @file SessionAgentModal.tsx: asks the Session Agent, and sets how it and its export may use what you gave. */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';

import { SESSION_AGENT_LIMITS } from '@ce-shared/sessionAgent.mjs';
import { dictationNeedsSignIn, dictationOffered, sessionEnded } from '../../domains/worker/sessionDictationPorts';
import SessionAgentHelp from './SessionAgentHelp';
import { SESSION_AGENT_README_URL } from './SessionAgentNotice';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import SessionDictation from './SessionDictation';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { useWaitSeconds } from '../SurveyTool/useWaitSeconds';
import { sessionAgentFullerAnswersNote } from './sessionAgentWording';
import {
  askSessionAgent,
  readSessionAgentStatus,
  type SessionAgentReply,
  type SessionAgentRequestOptions,
  type SessionAgentSource,
  type SessionAgentStatus,
} from './sessionAgentRequests';
import styles from './SessionAgentModal.module.scss';
import SessionAgentAnswer from './SessionAgentAnswer';

type Props = SessionAgentRequestOptions & {
  onClose: () => void;
  /** Opens the page's Results; left out where the page has none to open. */
  onOpenResults?: () => void;
};

const STYLE_HELP = {
  general:
    'General answers draw on the session’s context, the files everyone may see and the results you may see. ' +
    'They never use members’ answers or files locked to a group.',
  detailed:
    'Detailed answers draw on everything you may see in this session, and on members’ answers from people who ' +
    'haven’t turned that off. No answer names anyone.',
};

const STORE_HELP =
  'This question and its answer will be kept in this session’s records, available to its organisers, and may ' +
  'be exported. Untick it to keep this one out.';
// The box starts ticked, and a chat is stored without the asker's address unless they choose it.
const STORE_TO_START = true;
const ADDRESS_TO_START = false;

const CLOSED = {
  session_ended: 'This session has ended, so the Session Agent no longer answers.',
  ai_disabled: 'AI is turned off for this session, so the Session Agent isn’t answering.',
};

const errorText = (error: unknown) => (error instanceof Error && error.message) || 'Something went wrong. Try again.';

const count = (value: number, one: string, many: string) =>
  `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

const SECONDS_PER_MINUTE = 60;
// How often a screen reader hears that an answer is still coming; the count on screen moves every second.
const SAY_WAIT_EVERY_SECONDS = 30;

// The wait in words, for a screen reader, which would read the button's "1:30" as a time of day.
const waitWords = (seconds: number) => {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;
  return [minutes ? count(minutes, 'minute', 'minutes') : '', rest ? count(rest, 'second', 'seconds') : '']
    .filter(Boolean)
    .join(' ');
};

// What the Worker read for the answer, so a reader can tell General from Detailed.
const drewOn = ({ context, results, answers }: SessionAgentReply['read']) => {
  const parts = [
    context ? count(context, 'item of context', 'items of context') : '',
    results ? 'the results' : '',
    answers ? `${count(answers, 'answer', 'answers')} from members` : '',
  ].filter(Boolean);
  if (!parts.length) return 'Nothing in this session could be read for this answer.';
  return `Drew on ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`;
};

const SOURCE_KIND = {
  'session-link': 'link in the session’s context',
  'session-note': 'the session’s context',
  link: 'link',
  file: 'file',
};

// One item the answer read: a link when it has a web address, and what kind of item it is.
const Source = ({ source }: { source: SessionAgentSource }) => (
  <li>
    {source.url ? (
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {source.title}
      </a>
    ) : (
      source.title
    )}{' '}
    <span className={styles.hint}>
      ({source.readByAi ? 'PDF, as the session’s AI read it' : SOURCE_KIND[source.kind]})
    </span>
  </li>
);

const Help = (props: { id: string; label: string; text: string }) => (
  <SessionAgentHelp {...props} className={styles.helpLink} />
);

// The dialog shows only the latest answer. A chat is kept only where the
// session stores chats and the asker leaves "Store this chat" ticked.
export default function SessionAgentModal({ sessionSlug, sessionConfig, account, onClose, onOpenResults }: Props) {
  const baseId = `ce-session-agent-${useId().replace(/:/g, '')}`;
  const options = { sessionSlug, sessionConfig, account };
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SessionAgentStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<SessionAgentReply | null>(null);
  const [askError, setAskError] = useState('');
  // How long the answer being asked for has taken; 0 when none is.
  const waited = useWaitSeconds(asking ? 'answer' : '');
  const said = waited - (waited % SAY_WAIT_EVERY_SECONDS);
  const [store, setStore] = useState(STORE_TO_START);
  const [withAddress, setWithAddress] = useState(ADDRESS_TO_START);
  // Whether the session writes this person's speech down, as for an answer: asked once they may ask.
  const [speech, setSpeech] = useState<boolean | null>(null);
  // A visitor the session writes no speech down for, though it would once they sign in.
  const [speechAfterSignIn, setSpeechAfterSignIn] = useState(false);
  const [listening, setListening] = useState(false);
  // Spoken words that didn't fit under the question's limit.
  const [cut, setCut] = useState(false);
  // What is in the box now: words are written down after a wait, during which more may be typed.
  const typed = useRef(question);
  typed.current = question;
  // Whose dialog is on screen. When someone else signs in it starts afresh, and
  // a word that lands for the person before is not shown as theirs.
  const person = `${sessionSlug}\n${account}`;
  const shownFor = useRef(person);

  // A recheck keeps what was shown until the answer comes, so the form stays put.
  useEffect(() => {
    let active = true;
    if (shownFor.current !== person) {
      shownFor.current = person;
      setStatus(null);
      setReply(null);
      // What the person before typed and chose is theirs: the next starts as anyone does.
      setQuestion('');
      setSpeech(null);
      setSpeechAfterSignIn(false);
      setCut(false);
      setStore(STORE_TO_START);
      setWithAddress(ADDRESS_TO_START);
    }
    setStatusError('');
    readSessionAgentStatus({ sessionSlug, sessionConfig, account })
      .then((next) => active && setStatus(next))
      .catch((error) => active && setStatusError(errorText(error)));
    return () => {
      active = false;
    };
  }, [sessionSlug, sessionConfig, account, attempt, person]);

  const mayAsk = !!status?.on && !status.closed && !!status.answers;
  useEffect(() => {
    if (!mayAsk || speech !== null) return undefined;
    let active = true;
    const asker = { sessionSlug, sessionConfig, account };
    void dictationOffered(asker).then(async (offered) => {
      // A Worker that couldn't be read gives null, so the next check asks again.
      if (offered === null) return;
      // Both answers before either is set: setting the first ends this check.
      const afterSignIn = !offered && (await dictationNeedsSignIn(asker));
      if (!active || shownFor.current !== person) return;
      setSpeech(offered);
      setSpeechAfterSignIn(afterSignIn);
    });
    return () => {
      active = false;
    };
  }, [mayAsk, speech, sessionSlug, sessionConfig, account, person]);

  // Spoken words join the end of what is there, as in an answer, up to the question's limit.
  const addWords = useCallback((words: string) => {
    const spoken = words.trim();
    if (!spoken) return;
    const base = typed.current.trimEnd();
    const joined = `${base}${base ? ' ' : ''}${spoken}`;
    setQuestion(joined.slice(0, SESSION_AGENT_LIMITS.questionChars));
    setCut(joined.length > SESSION_AGENT_LIMITS.questionChars);
  }, []);

  // Asked when the dialog opened; a session that has ended since writes no more speech down.
  const microphone = speech === true && !sessionEnded(sessionConfig);
  const hasAddress = status?.unattributed != null;
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || asking || listening) return;
    setAsking(true);
    setAskError('');
    try {
      // Only someone signed in with an address has one to store.
      const keep = store
        ? { attribution: withAddress && hasAddress ? ('address' as const) : ('anonymous' as const) }
        : null;
      setReply(
        status?.recording
          ? await askSessionAgent(question.trim(), options, keep)
          : await askSessionAgent(question.trim(), options),
      );
    } catch (error) {
      setReply(null);
      setAskError(errorText(error));
    } finally {
      setAsking(false);
    }
  };

  const style = status?.answers;
  let body: React.ReactNode;
  if (statusError) {
    body = (
      <>
        <p className={styles.error} role="alert">
          {statusError}
        </p>
        <div>
          <button type="button" className={styles.ask} onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      </>
    );
  } else if (!status) {
    body = <p className={styles.hint}>Checking…</p>;
  } else if (!status.on) {
    body = <p>An admin has turned the Session Agent off.</p>;
  } else if (status.closed) {
    body = (
      <>
        <p>{CLOSED[status.closed]}</p>
      </>
    );
  } else if (!style) {
    body = (
      <>
        <p>
          {status.signedOut
            ? 'Sign in to ask the Session Agent.'
            : 'The Session Agent isn’t open to you in this session.'}
        </p>
      </>
    );
  } else {
    body = (
      <>
        <p className={styles.styleRow}>
          {status.audience === 'admin'
            ? 'As an admin, you get Detailed answers.'
            : status.signedOut
              ? 'Not signed in, you get General answers.'
              : `You get ${style === 'detailed' ? 'Detailed' : 'General'} answers.`}
          <Help
            id={`${baseId}-style`}
            label={`What ${style === 'detailed' ? 'Detailed' : 'General'} answers draw on`}
            text={
              STYLE_HELP[style] +
              (style === 'general' ? ` ${sessionAgentFullerAnswersNote(sessionConfig, status.signedOut)}` : '')
            }
          />
        </p>
        <form className={styles.form} onSubmit={ask}>
          <label htmlFor={`${baseId}-question`} className={styles.label}>
            Your question
          </label>
          <div className={styles.questionRow}>
            <textarea
              id={`${baseId}-question`}
              className={`form-control ${styles.question}`}
              value={question}
              maxLength={SESSION_AGENT_LIMITS.questionChars}
              rows={3}
              aria-describedby={`${baseId}-limits`}
              data-testid="ce-session-agent-question"
              onChange={(event) => {
                setQuestion(event.target.value);
                setCut(false);
              }}
            />
            {microphone ? (
              <SessionDictation
                options={{ sessionSlug, sessionConfig, account }}
                onWords={addWords}
                onBusy={setListening}
                testId="ce-session-agent-mic"
              />
            ) : null}
          </div>
          {cut ? (
            <p className={styles.hint} role="status">
              The end of what you said didn’t fit in {SESSION_AGENT_LIMITS.questionChars} characters.
            </p>
          ) : null}
          {status.recording ? (
            <div className={styles.keep} data-testid="ce-session-agent-keep">
              <div className={styles.switchRow}>
                <label htmlFor={`${baseId}-store`}>
                  <input
                    id={`${baseId}-store`}
                    type="checkbox"
                    checked={store}
                    data-testid="ce-session-agent-store"
                    onChange={(event) => setStore(event.target.checked)}
                  />
                  Store this chat
                </label>
                <Help id={`${baseId}-store-help`} label="About storing this chat" text={STORE_HELP} />
              </div>
              {store ? (
                <>
                  {hasAddress ? (
                    <fieldset className={styles.choice}>
                      <legend>Store it with</legend>
                      <label>
                        <input
                          type="radio"
                          name={`${baseId}-identity`}
                          checked={!withAddress}
                          onChange={() => setWithAddress(false)}
                        />
                        No address
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`${baseId}-identity`}
                          checked={withAddress}
                          onChange={() => setWithAddress(true)}
                        />
                        My address
                      </label>
                    </fieldset>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className={styles.row}>
            <p id={`${baseId}-limits`} className={styles.hint}>
              Answers are at most {SESSION_AGENT_LIMITS.answerWords.toLocaleString('en-US')} words.{' '}
              {!status.recording ? 'Questions and answers aren’t kept.' : store ? '' : 'This chat won’t be kept.'}
              {speech === false && speechAfterSignIn ? ' Sign in to ask by voice.' : ''}
            </p>
            <button
              type="submit"
              className={styles.ask}
              disabled={asking || listening || !question.trim()}
              data-testid="ce-session-agent-ask"
            >
              {/* The count is seen, not heard: the button keeps its name, and the status below speaks now and then. */}
              {asking ? <ElapsedLoadingLabel label="Asking…" /> : 'Ask'}
            </button>
          </div>
        </form>
        <p className={styles.srOnly} role="status">
          {asking && said ? `Still waiting for the answer: ${waitWords(said)}.` : ''}
        </p>
        {askError ? (
          <p className={styles.error} role="alert">
            {askError}
          </p>
        ) : null}
        <div aria-live="polite">
          {reply ? (
            <div className={styles.answer} data-testid="ce-session-agent-answer">
              <SessionAgentAnswer text={reply.answer} />
              {reply.sources?.length ? (
                <details className={styles.sources} data-testid="ce-session-agent-sources">
                  <summary className={styles.hint}>{drewOn(reply.read)}</summary>
                  <p className={styles.hint}>The context it read, which you may read too:</p>
                  <ul>
                    {reply.sources.map((source, index) => (
                      // The same item can be added twice, so its place is its key.
                      <Source key={index} source={source} />
                    ))}
                  </ul>
                </details>
              ) : (
                <p className={styles.hint}>{drewOn(reply.read)}</p>
              )}
              {reply.questions.length ? (
                <div className={styles.sources} data-testid="ce-session-agent-questions">
                  <p className={styles.hint}>
                    Session questions related to what you asked:
                    <Help
                      id={`${baseId}-questions-help`}
                      label="Where these questions come from"
                      text={
                        reply.questionsFrom === 'results'
                          ? 'The session’s questions, among those the session’s results cite, most related to your question.'
                          : 'The session’s questions, among those whose answers the Session Agent read, most related to your question.'
                      }
                    />
                  </p>
                  <ul>
                    {reply.questions.map(({ id, question: prompt }) => (
                      <li key={id}>
                        <a
                          // The route helper names the session, and its Worker where a fresh browser needs it.
                          href={buildPublicRoute(buildQuestionRoutePath(id, { sessionSlug }))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.link}
                        >
                          {prompt}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {reply.read.results && onOpenResults ? (
                <p>
                  <button
                    type="button"
                    className={styles.link}
                    data-ce-control-appearance="frameless"
                    data-testid="ce-session-agent-open-results"
                    onClick={() => {
                      onClose();
                      onOpenResults();
                    }}
                  >
                    Open Results
                  </button>
                </p>
              ) : null}
              {reply.stored ? <p className={styles.hint}>This chat was stored.</p> : null}
              {reply.note ? <p className={styles.hint}>{reply.note}</p> : null}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <Modal isOpen toggle={onClose} centered contentClassName={styles.content} labelledBy={`${baseId}-title`}>
      <ModalHeader toggle={onClose} className={styles.header}>
        <span id={`${baseId}-title`}>Session Agent</span>
        <span className={styles.badge}>Preview</span>
        {/* For everyone, signed in or not, since the robot by the session's title opens this dialog. */}
        <a
          id={`${baseId}-how`}
          href={SESSION_AGENT_README_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.helpLink}
          aria-label="How the Session Agent works"
          data-ce-control-appearance="frameless"
          data-testid="ce-session-agent-how"
        >
          <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
        </a>
        <UncontrolledTooltip target={`${baseId}-how`} placement="bottom" trigger="hover focus" autohide={false}>
          How the Session Agent works, on GitHub.
        </UncontrolledTooltip>
      </ModalHeader>
      <ModalBody className={styles.body} data-testid="ce-session-agent">
        {body}
        {/* Their switches aren't here, and someone who came by the title's robot may not have seen them. */}
        {status?.on && !status.signedOut ? (
          <p className={styles.hint}>
            {status.unattributed === null
              ? 'Whether the Session Agent may use your answers and files is set in the Context section.'
              : 'Whether the Session Agent may use your answers and files, and your address on them, is set in the Context section.'}
          </p>
        ) : null}
      </ModalBody>
    </Modal>
  );
}
