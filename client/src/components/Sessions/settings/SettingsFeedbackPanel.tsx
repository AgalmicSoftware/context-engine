/** @file SettingsFeedbackPanel.tsx: where a session's full admins read, download and delete feedback about the app. */
import React, { useState } from 'react';

import {
  deleteFeedback,
  feedbackCsv,
  listFeedback,
  type FeedbackAdmin,
  type FeedbackMessage,
} from '../../../domains/worker/sessionFeedbackPorts';
import styles from '../setup/SessionSetup.module.scss';
import panel from './SettingsFeedbackPanel.module.scss';

type Props = {
  admin: FeedbackAdmin;
  /** The Feedback box setting, shown above the messages. */
  children?: React.ReactNode;
};

const download = (content: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const sentAt = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString();
};

// What came with a message: where they were and on what, never who, unless they asked to be contacted.
const details = (message: FeedbackMessage): string =>
  [
    sentAt(message.createdAt),
    message.view,
    message.theme,
    message.screen,
    message.appRelease && `app ${message.appRelease}`,
    message.workerRelease && `Worker ${message.workerRelease}`,
    message.signedIn ? 'signed in' : 'not signed in',
  ]
    .filter(Boolean)
    .join(' · ');

const failed = (failure: unknown, fallback: string): string =>
  failure instanceof Error && failure.message ? failure.message : fallback;

export default function SettingsFeedbackPanel({ admin, children = null }: Props) {
  // Not read until asked: reading takes the admin's signature.
  const [messages, setMessages] = useState<FeedbackMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingAll, setConfirmingAll] = useState(false);

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (failure) {
      setError(failed(failure, fallback));
    } finally {
      setBusy(false);
    }
  };

  const load = () => run(async () => setMessages(await listFeedback(admin)), 'Couldn’t read the feedback. Try again.');
  const remove = (ids: string[]) =>
    run(async () => {
      await deleteFeedback(admin, ids);
      setConfirmingAll(false);
      setMessages((current) => (current || []).filter((message) => !ids.includes(message.id)));
    }, 'Not deleted. Try again.');

  return (
    <section className={styles.section} aria-labelledby="ce-settings-feedback-title" data-testid="ce-settings-feedback">
      <h2 id="ce-settings-feedback-title" className={styles.sectionTitle}>
        Feedback
      </h2>
      {children}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={busy}
          data-testid="ce-settings-feedback-load"
          onClick={() => void load()}
        >
          {messages ? 'Refresh' : 'Show messages'}
        </button>
        {messages?.length ? (
          <>
            <button
              type="button"
              className={styles.button}
              disabled={busy}
              data-testid="ce-settings-feedback-csv"
              onClick={() => download(feedbackCsv(messages), `${admin.sessionSlug}_feedback.csv`)}
            >
              Download CSV
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={busy || confirmingAll}
              data-testid="ce-settings-feedback-delete-all"
              onClick={() => setConfirmingAll(true)}
            >
              Delete all
            </button>
          </>
        ) : null}
      </div>
      {confirmingAll && messages ? (
        <p className={styles.conflict} role="alert">
          {messages.length === 1
            ? 'Delete the message listed?'
            : `Delete the ${messages.length.toLocaleString('en-US')} messages listed?`}{' '}
          This can’t be undone.{' '}
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            data-testid="ce-settings-feedback-delete-all-confirm"
            onClick={() => void remove(messages.map((message) => message.id))}
          >
            Delete all
          </button>{' '}
          <button type="button" className={styles.button} disabled={busy} onClick={() => setConfirmingAll(false)}>
            Keep them
          </button>
        </p>
      ) : null}
      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
      {messages && !messages.length ? <p className={styles.hint}>No feedback yet.</p> : null}
      {messages?.length ? (
        <ul className={panel.list} data-testid="ce-settings-feedback-list">
          {messages.map((message) => (
            <li key={message.id} className={panel.message}>
              <p className={panel.text}>{message.text}</p>
              <p className={styles.hint}>{details(message)}</p>
              {message.contact ? (
                <p className={styles.hint}>
                  May be contacted:{' '}
                  {[message.contact.reachMe, message.contact.displayName, message.contact.address]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              <button
                type="button"
                className={styles.button}
                disabled={busy}
                aria-label={`Delete the message sent ${sentAt(message.createdAt)}`}
                onClick={() => void remove([message.id])}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
