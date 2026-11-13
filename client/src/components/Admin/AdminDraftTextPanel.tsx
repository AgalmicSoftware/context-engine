import { useEffect, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { readWorkerKeepsDraftText } from '../../domains/worker/workerRelease';
import { exportDraftText } from '../SurveyTool/sessionInterviewDraftText';
import styles from './AdminSessionBackupPanel.module.scss';

type Props = {
  workerUrl: string;
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  // Only config admins are offered it; the Worker refuses everyone else, results admins included.
  canAdminWorker: boolean;
};

const HELP =
  'The AI’s drafted answers and comments that participants agreed to keep for this session’s admins. Only config admins can download it. Session backups leave it out, so download it before deleting this session or restoring it from a backup. It names participants by address: the fidelity report’s --clio option turns it into pseudonymous input for clustering tools.';

const saveFile = (value: unknown, slug: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug || 'general'}-ai-draft-text.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Downloads the AI draft text kept for admins, on Session Workers that keep it. */
const AdminDraftTextPanel = ({ workerUrl, sessionSlug, sessionConfig, canAdminWorker }: Props) => {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let stale = false;
    setSupported(false);
    if (canAdminWorker) {
      void readWorkerKeepsDraftText(workerUrl, sessionSlug).then((keeps) => {
        if (!stale) setSupported(keeps === true);
      });
    }
    return () => {
      stale = true;
    };
  }, [canAdminWorker, workerUrl, sessionSlug]);
  if (!canAdminWorker || !supported) return null;
  const download = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const file = await exportDraftText({ sessionConfig, sessionSlug });
      saveFile(file, sessionSlug);
      const count = Array.isArray(file.rows) ? file.rows.length : 0;
      setStatus(`Saved ${count} ${count === 1 ? 'draft' : 'drafts'}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The download failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.panel} aria-labelledby="admin-draft-text-title">
      <h3 id="admin-draft-text-title" className={styles.panelTitle}>
        AI draft text{' '}
        <button
          type="button"
          id="admin-draft-text-help"
          data-ce-control-appearance="frameless"
          aria-label="About AI draft text"
          aria-describedby="admin-draft-text-description"
          style={{ background: 'none', border: 0, color: 'inherit', padding: 0 }}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
      </h3>
      <span id="admin-draft-text-description" hidden>
        {HELP}
      </span>
      <UncontrolledTooltip target="admin-draft-text-help" placement="top" trigger="hover focus">
        {HELP}
      </UncontrolledTooltip>
      <p className={styles.statusNote}>Download it before deleting or restoring this session.</p>
      <button
        type="button"
        className={styles.actionButton}
        disabled={busy}
        onClick={() => void download()}
        data-testid="ce-admin-draft-text-download"
      >
        Download AI draft text
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
export default AdminDraftTextPanel;
