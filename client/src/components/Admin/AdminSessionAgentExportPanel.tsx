import { useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { sessionAgentSettingOf } from '@ce-shared/sessionAgent.mjs';
import styles from './AdminSessionBackupPanel.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  // Only config admins are offered it; the Worker refuses everyone else, results admins included.
  canAdminWorker: boolean;
  postSignedRequest: (args: {
    action: string;
    path: string;
    body: Record<string, unknown>;
  }) => Promise<{ data?: unknown }>;
};

const HELP =
  'What the Session Agent may give a member, as one file: the questions, the context, the published results, counts, what members wrote, and any chats people chose to store, each marked for General or Detailed answers. Admins-only context is not in it. Each written answer and each added file carries its writer’s account address, unless that person chose to leave it off. Nothing carries a name but a stored chat whose asker typed one, and a chat answered to an admin is left out. It also lists the addresses in the groups the session’s rules and items name, people who opted out included: opting out keeps a person’s answers out, not their membership. It is a snapshot. A later export leaves out anyone who has opted out since, but copies already made keep their earlier answers and addresses, so keep them somewhere private.';

// What the Worker left out, in the order an admin would ask about it.
const LEFT_OUT: Array<[string, (count: number) => string]> = [
  [
    'answersNotRead',
    () => 'every question and answer: this session stores more versions than the Session Agent can read at once',
  ],
  ['optedOut', (count) => `${count} from people who opted out`],
  ['patternMatches', (count) => `${count} written ${count === 1 ? 'answer' : 'answers'} that may name someone`],
  ['belowMinAnswers', (count) => `answers to ${count} ${count === 1 ? 'question' : 'questions'} with too few answers`],
  ['answersWithoutAddress', (count) => `${count} ${count === 1 ? 'answer' : 'answers'} from people with no address`],
  ['adminsOnlyContext', (count) => `${count} admins-only context ${count === 1 ? 'item' : 'items'}`],
  ['otherRulesContext', (count) => `${count} context ${count === 1 ? 'item' : 'items'} under another access rule`],
  ['contextNotRead', (count) => `${count} context ${count === 1 ? 'item' : 'items'} past the reading limit`],
  ['unreadableContext', (count) => `${count} context ${count === 1 ? 'item' : 'items'} that can’t be read`],
  ['resultsNotForEveryone', () => 'the results, which not everyone may see'],
  ['adminChats', (count) => `${count} stored ${count === 1 ? 'chat' : 'chats'} answered to an admin`],
  ['membersWithoutAddress', (count) => `${count} group ${count === 1 ? 'member' : 'members'} with no address`],
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const saveFile = (content: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const summary = (filename: string, manifest: Record<string, unknown>) => {
  const leftOut = asRecord(manifest.leftOut);
  const items = Number(manifest.itemCount) || 0;
  const notes = LEFT_OUT.filter(([key]) => Number(leftOut[key]) > 0).map(([key, say]) => say(Number(leftOut[key])));
  return `Saved ${filename}: ${items.toLocaleString('en-US')} ${items === 1 ? 'item' : 'items'}.${notes.length ? ` Left out: ${notes.join('; ')}.` : ''}`;
};

/** Downloads the Session Agent's material as one file, on sessions that have a Session Agent. */
const AdminSessionAgentExportPanel = ({ sessionSlug, sessionConfig, canAdminWorker, postSignedRequest }: Props) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  if (!canAdminWorker || !sessionAgentSettingOf(sessionConfig?.sessionAgent)) return null;
  const download = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const { data } = await postSignedRequest({
        action: 'session-agent/export',
        path: '/admin/session-agent/export',
        body: { sessionSlug },
      });
      const { content, filename, manifest } = asRecord(data);
      if (typeof content !== 'string' || typeof filename !== 'string')
        throw new Error('The Session Worker sent no file.');
      // The Worker's own bytes, unchanged: the same session gives the same file.
      saveFile(content, filename);
      setStatus(summary(filename, asRecord(manifest)));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        /unknown admin action/i.test(message)
          ? 'This Session Worker can’t export the Session Agent yet. Update the Session Worker first.'
          : message || 'The export failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={styles.panel}
      aria-labelledby="admin-session-agent-export-title"
      data-testid="ce-admin-session-agent-export"
    >
      <h3 id="admin-session-agent-export-title" className={styles.panelTitle}>
        Session Agent export{' '}
        <button
          type="button"
          id="admin-session-agent-export-help"
          data-ce-control-appearance="frameless"
          aria-label="About the Session Agent export"
          aria-describedby="admin-session-agent-export-description"
          style={{ background: 'none', border: 0, color: 'inherit', padding: 0 }}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
      </h3>
      <span id="admin-session-agent-export-description" hidden>
        {HELP}
      </span>
      <UncontrolledTooltip target="admin-session-agent-export-help" placement="top" trigger="hover focus">
        {HELP}
      </UncontrolledTooltip>
      <p className={styles.statusNote}>
        A snapshot. It holds members’ account addresses, with what they wrote and added. Keep copies somewhere private.
      </p>
      <button
        type="button"
        className={styles.actionButton}
        disabled={busy}
        onClick={() => void download()}
        data-testid="ce-admin-session-agent-export-download"
      >
        {busy ? 'Exporting…' : 'Export Session Agent'}
      </button>
      {status && (
        <p className={styles.statusNote} role="status">
          {status}
        </p>
      )}
      {error && (
        <p className={styles.warningNote} role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
export default AdminSessionAgentExportPanel;
