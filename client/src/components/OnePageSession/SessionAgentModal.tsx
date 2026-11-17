/** @file SessionAgentModal.tsx: asks the Session Agent, and sets how it and its export may use what you gave. */
import React, { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import { SESSION_AGENT_LIMITS } from '@ce-shared/sessionAgent.mjs';
import CETooltip from '../Shared/CETooltip';
import SessionAgentNotice from './SessionAgentNotice';
import { sessionAgentAddressNotice, sessionAgentFullerAnswersNote } from './sessionAgentWording';
import {
  askSessionAgent,
  readSessionAgentStatus,
  setSessionAgentOptOut,
  setSessionAgentUnattributed,
  type SessionAgentReply,
  type SessionAgentRequestOptions,
  type SessionAgentStatus,
} from './sessionAgentRequests';
import styles from './SessionAgentModal.module.scss';

type Props = SessionAgentRequestOptions & { onClose: () => void };

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
const NAME_HELP = 'Kept as you type it, for example Sam or Sam’s agent. It isn’t checked.';
// The box starts ticked, and a chat is stored without the asker's address unless they choose it.
const STORE_TO_START = true;
const ADDRESS_TO_START = false;

// It answers no one, but each person's switches still count for what an admin exports.
const CLOSED = {
  session_ended: 'This session has ended, so the Session Agent no longer answers.',
  ai_disabled: 'AI is turned off for this session, so the Session Agent isn’t answering.',
};

const errorText = (error: unknown) => (error instanceof Error && error.message) || 'Something went wrong. Try again.';

const count = (value: number, one: string, many: string) =>
  `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

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

type HelpProps = { id: string; label: string; text: string };

// A "?" whose text a screen reader hears as its description and everyone else sees on hover or focus.
const Help = ({ id, label, text }: HelpProps) => (
  <>
    <button
      type="button"
      id={id}
      className={styles.helpLink}
      data-ce-control-appearance="frameless"
      aria-label={label}
      aria-describedby={`${id}-text`}
      onClick={(event) => event.currentTarget.focus()}
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

// The dialog shows only the latest answer. A chat is kept only where the
// session stores chats and the asker leaves "Store this chat" ticked.
export default function SessionAgentModal({ sessionSlug, sessionConfig, account, onClose }: Props) {
  const baseId = `ce-session-agent-${useId().replace(/:/g, '')}`;
  const options = { sessionSlug, sessionConfig, account };
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SessionAgentStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<SessionAgentReply | null>(null);
  const [askError, setAskError] = useState('');
  const [store, setStore] = useState(STORE_TO_START);
  const [withAddress, setWithAddress] = useState(ADDRESS_TO_START);
  const [name, setName] = useState('');
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const switchSaves = useRef(0);
  // Whose switches are on screen. When someone else signs in the dialog starts
  // afresh, and a save that lands for the person before is not shown as theirs.
  const person = `${sessionSlug}\n${account}`;
  const shownFor = useRef(person);

  // A recheck keeps what was shown until the answer comes, so the form stays put.
  // A switch saved after the check was sent is newer than its answer, so it stays.
  useEffect(() => {
    let active = true;
    if (shownFor.current !== person) {
      shownFor.current = person;
      switchSaves.current = 0;
      setStatus(null);
      setReply(null);
      // What the person before typed and chose is theirs: the next starts as anyone does.
      setQuestion('');
      setStore(STORE_TO_START);
      setWithAddress(ADDRESS_TO_START);
      setName('');
    }
    const savesBefore = switchSaves.current;
    setStatusError('');
    readSessionAgentStatus({ sessionSlug, sessionConfig, account })
      .then((next) => {
        if (!active) return;
        setStatus((current) =>
          current && switchSaves.current !== savesBefore
            ? { ...next, optedOut: current.optedOut, unattributed: current.unattributed }
            : next,
        );
      })
      .catch((error) => active && setStatusError(errorText(error)));
    return () => {
      active = false;
    };
  }, [sessionSlug, sessionConfig, account, attempt, person]);

  const hasAddress = status?.unattributed != null;
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAskError('');
    try {
      // Only someone signed in with an address has one to store.
      const keep = store
        ? { attribution: withAddress && hasAddress ? ('address' as const) : ('anonymous' as const), name: name.trim() }
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

  const saveSwitch = async (save: () => Promise<Partial<SessionAgentStatus>>) => {
    setSavingSwitch(true);
    setSwitchError('');
    try {
      const saved = await save();
      if (shownFor.current !== person) return;
      switchSaves.current += 1;
      setStatus((current) => (current ? { ...current, ...saved } : current));
    } catch (error) {
      setSwitchError(errorText(error));
    } finally {
      setSavingSwitch(false);
    }
  };

  // Someone not signed in has no answers or files of their own here, so no switches.
  const switches =
    status && !status.signedOut ? (
      <div className={styles.switches}>
        <div className={styles.switchRow}>
          <label htmlFor={`${baseId}-use`}>
            <input
              id={`${baseId}-use`}
              type="checkbox"
              role="switch"
              checked={!status.optedOut}
              disabled={savingSwitch}
              data-testid="ce-session-agent-use-mine"
              onChange={(event) => {
                const optOut = !event.target.checked;
                void saveSwitch(async () => ({ optedOut: await setSessionAgentOptOut(optOut, options) }));
              }}
            />
            Use my answers and files
          </label>
          <SessionAgentNotice id={`${baseId}-notice`} where="switch" className={styles.helpLink} />
        </div>
        {status.unattributed === null ? null : (
          <div className={styles.switchRow}>
            <label htmlFor={`${baseId}-address`}>
              <input
                id={`${baseId}-address`}
                type="checkbox"
                role="switch"
                // On is the default: the Worker stores only who turned it off.
                checked={!status.unattributed}
                disabled={savingSwitch}
                data-testid="ce-session-agent-include-address"
                onChange={(event) => {
                  const leaveOff = !event.target.checked;
                  void saveSwitch(async () => ({
                    unattributed: await setSessionAgentUnattributed(leaveOff, options),
                  }));
                }}
              />
              Include my address with my answers
            </label>
            <Help
              id={`${baseId}-address-help`}
              label="About your address on your answers"
              text={sessionAgentAddressNotice(sessionConfig)}
            />
          </div>
        )}
        {switchError ? (
          <p className={styles.error} role="alert">
            {switchError}
          </p>
        ) : null}
      </div>
    ) : null;

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
        {switches}
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
        {switches}
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
          <textarea
            id={`${baseId}-question`}
            className={`form-control ${styles.question}`}
            value={question}
            maxLength={SESSION_AGENT_LIMITS.questionChars}
            rows={3}
            aria-describedby={`${baseId}-limits`}
            data-testid="ce-session-agent-question"
            onChange={(event) => setQuestion(event.target.value)}
          />
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
                  <div className={styles.switchRow}>
                    <label htmlFor={`${baseId}-name`}>Name (optional)</label>
                    <Help id={`${baseId}-name-help`} label="About the name" text={NAME_HELP} />
                    <input
                      id={`${baseId}-name`}
                      type="text"
                      className={`form-control ${styles.name}`}
                      value={name}
                      maxLength={SESSION_AGENT_LIMITS.nameChars}
                      autoComplete="off"
                      data-testid="ce-session-agent-name"
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <div className={styles.row}>
            <p id={`${baseId}-limits`} className={styles.hint}>
              Answers are at most {SESSION_AGENT_LIMITS.answerWords} words.{' '}
              {!status.recording ? 'Questions and answers aren’t kept.' : store ? '' : 'This chat won’t be kept.'}
            </p>
            <button
              type="submit"
              className={styles.ask}
              disabled={asking || !question.trim()}
              data-testid="ce-session-agent-ask"
            >
              {asking ? 'Asking…' : 'Ask'}
            </button>
          </div>
        </form>
        {askError ? (
          <p className={styles.error} role="alert">
            {askError}
          </p>
        ) : null}
        <div aria-live="polite">
          {reply ? (
            <div className={styles.answer} data-testid="ce-session-agent-answer">
              <p className={styles.answerText}>{reply.answer}</p>
              <p className={styles.hint}>{drewOn(reply.read)}</p>
              {reply.stored ? <p className={styles.hint}>This chat was stored.</p> : null}
              {reply.note ? <p className={styles.hint}>{reply.note}</p> : null}
            </div>
          ) : null}
        </div>
        {switches}
      </>
    );
  }

  return (
    <Modal isOpen toggle={onClose} centered contentClassName={styles.content} labelledBy={`${baseId}-title`}>
      <ModalHeader toggle={onClose} className={styles.header}>
        <span id={`${baseId}-title`}>Session Agent</span>
        <span className={styles.badge}>Preview</span>
      </ModalHeader>
      <ModalBody className={styles.body} data-testid="ce-session-agent">
        {body}
      </ModalBody>
    </Modal>
  );
}
