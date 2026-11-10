/** @file GroupAgentModal.tsx: asks the session's Group Agent, and sets whether it may use your answers and files. */
import React, { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import { GROUP_AGENT_LIMITS } from '@ce-shared/groupAgent.mjs';
import CETooltip from '../Shared/CETooltip';
import GroupAgentNotice from './GroupAgentNotice';
import {
  askGroupAgent,
  readGroupAgentStatus,
  setGroupAgentOptOut,
  type GroupAgentReply,
  type GroupAgentRequestOptions,
  type GroupAgentStatus,
} from './groupAgentRequests';
import styles from './GroupAgentModal.module.scss';

type Props = GroupAgentRequestOptions & { onClose: () => void };

const STYLE_HELP = {
  general:
    'General answers draw on the session’s context, the files everyone may see and the results you may see. ' +
    'They never use members’ answers or files locked to a group.',
  detailed:
    'Detailed answers draw on everything you may see in this session, and on members’ answers from people who ' +
    'haven’t turned that off. No answer names anyone.',
};

const errorText = (error: unknown) => (error instanceof Error && error.message) || 'Something went wrong. Try again.';

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

// What the Worker read for the answer, so a reader can tell General from Detailed.
const drewOn = ({ context, results, answers }: GroupAgentReply['read']) => {
  const parts = [
    context ? count(context, 'item of context', 'items of context') : '',
    results ? 'the results' : '',
    answers ? `${count(answers, 'answer', 'answers')} from members` : '',
  ].filter(Boolean);
  if (!parts.length) return 'Nothing in this session could be read for this answer.';
  return `Drew on ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`;
};

// The session keeps no questions or answers, so the dialog shows only the latest.
export default function GroupAgentModal({ sessionSlug, sessionConfig, account, onClose }: Props) {
  const baseId = `ce-group-agent-${useId().replace(/:/g, '')}`;
  const options = { sessionSlug, sessionConfig, account };
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<GroupAgentStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<GroupAgentReply | null>(null);
  const [askError, setAskError] = useState('');
  const [savingOptOut, setSavingOptOut] = useState(false);
  const [optOutError, setOptOutError] = useState('');
  const switchSaves = useRef(0);

  // A recheck keeps what was shown until the answer comes, so the form stays put.
  // A switch saved after the check was sent is newer than its answer, so it stays.
  useEffect(() => {
    let active = true;
    const savesBefore = switchSaves.current;
    setStatusError('');
    readGroupAgentStatus({ sessionSlug, sessionConfig, account })
      .then((next) => {
        if (!active) return;
        setStatus((current) =>
          current && switchSaves.current !== savesBefore ? { ...next, optedOut: current.optedOut } : next,
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
      setReply(await askGroupAgent(question.trim(), options));
    } catch (error) {
      setReply(null);
      setAskError(errorText(error));
    } finally {
      setAsking(false);
    }
  };

  const setUse = async (use: boolean) => {
    setSavingOptOut(true);
    setOptOutError('');
    try {
      const optedOut = await setGroupAgentOptOut(!use, options);
      switchSaves.current += 1;
      setStatus((current) => (current ? { ...current, optedOut } : current));
    } catch (error) {
      setOptOutError(errorText(error));
    } finally {
      setSavingOptOut(false);
    }
  };

  const optOutSwitch = status ? (
    <div className={styles.switchRow}>
      <label htmlFor={`${baseId}-use`}>
        <input
          id={`${baseId}-use`}
          type="checkbox"
          role="switch"
          checked={!status.optedOut}
          disabled={savingOptOut}
          data-testid="ce-group-agent-use-mine"
          onChange={(event) => setUse(event.target.checked)}
        />
        Use my answers and files
      </label>
      <GroupAgentNotice id={`${baseId}-notice`} where="switch" className={styles.helpLink} />
      {optOutError ? (
        <p className={styles.error} role="alert">
          {optOutError}
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
    body = <p>An admin has turned the Group Agent off.</p>;
  } else if (!style) {
    body = (
      <>
        <p>The Group Agent isn’t open to you in this session.</p>
        {optOutSwitch}
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
            maxLength={GROUP_AGENT_LIMITS.questionChars}
            rows={3}
            aria-describedby={`${baseId}-limits`}
            data-testid="ce-group-agent-question"
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className={styles.row}>
            <p id={`${baseId}-limits`} className={styles.hint}>
              Answers are at most {GROUP_AGENT_LIMITS.answerWords} words. Questions and answers aren’t kept.
            </p>
            <button
              type="submit"
              className={styles.ask}
              disabled={asking || !question.trim()}
              data-testid="ce-group-agent-ask"
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
            <div className={styles.answer} data-testid="ce-group-agent-answer">
              <p className={styles.answerText}>{reply.answer}</p>
              <p className={styles.hint}>{drewOn(reply.read)}</p>
              {reply.note ? <p className={styles.hint}>{reply.note}</p> : null}
            </div>
          ) : null}
        </div>
        {optOutSwitch}
      </>
    );
  }

  return (
    <Modal isOpen toggle={onClose} centered contentClassName={styles.content} labelledBy={`${baseId}-title`}>
      <ModalHeader toggle={onClose} className={styles.header}>
        <span id={`${baseId}-title`}>Group Agent</span>
        <span className={styles.badge}>Preview</span>
      </ModalHeader>
      <ModalBody className={styles.body} data-testid="ce-group-agent">
        {body}
      </ModalBody>
    </Modal>
  );
}
