/** @file AdminSessionAgentChatsPanel.tsx: an admin's reading and clearing of chats stored with the Session Agent. */
import { useState } from 'react';

import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { defaultStrictAllowDemoFallback } from '../../utilities/worker/workerSessionResolution.js';
import panel from './AdminSessionBackupPanel.module.scss';
import styles from './AdminSessionAgentChatsPanel.module.scss';

type Chat = { id: string; day: string; answers: string; question: string; answer: string; by: string; name: string };

type Props = {
  workerUrl: string;
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  // Only config admins are offered it; the Worker refuses everyone else, results admins included.
  canAdminWorker: boolean;
  postSignedRequest: (args: {
    action: string;
    path: string;
    body: Record<string, unknown>;
  }) => Promise<{ data?: unknown }>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const chatOf = (value: unknown): Chat => {
  const row = asRecord(value);
  return {
    id: text(row.id),
    day: text(row.day),
    answers: row.answers === 'detailed' ? 'Detailed' : 'General',
    question: text(row.question),
    answer: text(row.answer),
    by: text(row.by),
    name: text(row.name),
  };
};
// Who asked, only as far as they chose to say.
const asker = ({ by, name }: Chat) => [name, by].filter(Boolean).join(', ') || 'No address or name';

/**
 * The chats people chose to store, newest first, a page at a time. Read with the admin's sign-in, so paging
 * takes no signature; deleting takes one.
 */
const AdminSessionAgentChatsPanel = ({
  workerUrl,
  sessionSlug,
  sessionConfig,
  account,
  canAdminWorker,
  postSignedRequest,
}: Props) => {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [cursor, setCursor] = useState('');
  const [stored, setStored] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canAdminWorker || !workerUrl) return null;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (caught) {
      setError((caught instanceof Error && caught.message) || 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const readPage = async (from: string) => {
    const base = workerUrl.replace(/\/+$/, '');
    const query = new URLSearchParams({ slug: sessionSlug, ...(from ? { cursor: from } : {}) });
    const response = await fetchWorkerWithAuth(
      `${base}/admin/session-agent/chats?${query}`,
      { method: 'GET' },
      {
        sessionSlug,
        sessionConfig,
        context: { account },
        allowDemoFallback: defaultStrictAllowDemoFallback(),
        workerUrl: base,
      },
    );
    const result = asRecord(await response.json().catch(() => ({})));
    if (response.status === 404) {
      throw new Error('This Session Worker doesn’t store chats yet. Update the Session Worker first.');
    }
    if (!response.ok) {
      throw new Error(text(result.error) || `The Session Worker couldn’t list the chats (${response.status}).`);
    }
    const page = (Array.isArray(result.entries) ? result.entries : []).map(chatOf).filter((chat) => chat.id);
    setChats((shown) => (from && shown ? [...shown, ...page] : page));
    setCursor(text(result.cursor));
    setStored(Number(result.stored) || 0);
  };

  const remove = (what: { ids: string[] } | { through: string }) =>
    run(async () => {
      await postSignedRequest({
        action: 'session-agent/chats/delete',
        path: '/admin/session-agent/chats/delete',
        body: { sessionSlug, ...what },
      });
      await readPage('');
    });

  return (
    <section
      className={panel.panel}
      aria-labelledby="admin-session-agent-chats-title"
      data-testid="ce-admin-session-agent-chats"
    >
      <h3 id="admin-session-agent-chats-title" className={panel.panelTitle}>
        Session Agent chats
      </h3>
      <p className={panel.statusNote}>
        Chats people chose to store when asking the Session Agent, with their address or name only if they gave it.
      </p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={panel.actionButton}
          disabled={busy}
          onClick={() => void run(() => readPage(''))}
        >
          {chats ? 'Refresh' : 'Show stored chats'}
        </button>
        {chats?.length ? (
          <button
            type="button"
            className={panel.actionButton}
            disabled={busy}
            // Through the newest one shown: a chat stored since then stays, unread.
            onClick={() => void remove({ through: chats[0].id })}
          >
            Delete all
          </button>
        ) : null}
      </div>
      {chats ? (
        <p className={panel.statusNote} role="status">
          {stored === 0
            ? 'No chats are stored.'
            : `${stored.toLocaleString('en-US')} stored; showing ${chats.length.toLocaleString('en-US')}, newest first.`}
        </p>
      ) : null}
      {chats?.length ? (
        <ul className={styles.list}>
          {chats.map((chat) => (
            <li key={chat.id} className={styles.chat} data-testid="ce-admin-session-agent-chat">
              <p className={styles.meta}>
                {chat.day} · {chat.answers} answer · {asker(chat)}
              </p>
              <p>
                <strong>Asked:</strong> {chat.question}
              </p>
              <p>
                <strong>Answered:</strong> {chat.answer}
              </p>
              <button
                type="button"
                className={panel.actionButton}
                disabled={busy}
                aria-label={`Delete the chat asking “${chat.question.slice(0, 60)}”`}
                onClick={() => void remove({ ids: [chat.id] })}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {chats && cursor ? (
        <button
          type="button"
          className={panel.actionButton}
          disabled={busy}
          onClick={() => void run(() => readPage(cursor))}
        >
          Show more
        </button>
      ) : null}
      {error && (
        <p className={panel.warningNote} role="alert">
          {error}
        </p>
      )}
    </section>
  );
};

export default AdminSessionAgentChatsPanel;
