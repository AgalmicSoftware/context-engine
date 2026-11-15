/** @file SessionAgentModal.tsx: asks the Session Agent, and sets how it and its export may use what you gave. */
import React, { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import { SESSION_AGENT_LIMITS } from '@ce-shared/sessionAgent.mjs';
import CETooltip from '../Shared/CETooltip';
import SessionAgentNotice from './SessionAgentNotice';
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

const ADDRESS_HELP =
  'An admin can export what the Session Agent may draw on, as a file to keep. Each answer you wrote and each ' +
  'file you added carries your account address in that file unless you turn this on. Your answers and files ' +
  'stay in either way; copies already exported keep what they had.';

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

// The session keeps no questions or answers, so the dialog shows only the latest.
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
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const switchSaves = useRef(0);

  // A recheck keeps what was shown until the answer comes, so the form stays put.
  // A switch saved after the check was sent is newer than its answer, so it stays.
  useEffect(() => {
    let active = true;
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
  }, [sessionSlug, sessionConfig, account, attempt]);

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAskError('');
    try {
      setReply(await askSessionAgent(question.trim(), options));
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
      switchSaves.current += 1;
      setStatus((current) => (current ? { ...current, ...saved } : current));
    } catch (error) {
      setSwitchError(errorText(error));
    } finally {
      setSavingSwitch(false);
    }
  };

  const switches = status ? (
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
              checked={status.unattributed}
              disabled={savingSwitch}
              data-testid="ce-session-agent-leave-address-off"
              onChange={(event) => {
                const leaveOff = event.target.checked;
                void saveSwitch(async () => ({
                  unattributed: await setSessionAgentUnattributed(leaveOff, options),
                }));
              }}
            />
            Leave my address off exported items
          </label>
          <button
            type="button"
            id={`${baseId}-address-help`}
            className={styles.helpLink}
            data-ce-control-appearance="frameless"
            aria-label="About your address on exported items"
            aria-describedby={`${baseId}-address-text`}
            onClick={(event) => event.currentTarget.focus()}
          >
            <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
          </button>
          <span id={`${baseId}-address-text`} className={styles.hidden}>
            {ADDRESS_HELP}
          </span>
          <CETooltip target={`${baseId}-address-help`} placement="bottom" trigger="hover focus" autohide={false}>
            {ADDRESS_HELP}
          </CETooltip>
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
  } else if (!style) {
    body = (
      <>
        <p>The Session Agent isn’t open to you in this session.</p>
        {switches}
      </>
    );
  } else {
    body = (
      <>
        <p className={styles.styleRow}>
          {status.audience === 'admin'
            ? 'As an admin, you get Detailed answers.'
            : `You get ${style === 'detailed' ? 'Detailed' : 'General'} answers.`}
          <button
            type="button"
            id={`${baseId}-style`}
            className={styles.helpLink}
            data-ce-control-appearance="frameless"
            aria-label={`What ${style === 'detailed' ? 'Detailed' : 'General'} answers draw on`}
            onClick={(event) => event.currentTarget.focus()}
          >
            <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
          </button>
          <CETooltip target={`${baseId}-style`} placement="bottom" trigger="hover focus" autohide={false}>
            {STYLE_HELP[style]}
          </CETooltip>
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
          <div className={styles.row}>
            <p id={`${baseId}-limits`} className={styles.hint}>
              Answers are at most {SESSION_AGENT_LIMITS.answerWords} words. Questions and answers aren’t kept.
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
