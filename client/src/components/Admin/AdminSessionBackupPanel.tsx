import RecoveryKeyDialog from '../Shared/RecoveryKeyDialog';
import type { RecoveryKeyDisplay } from '../Shared/RecoveryKeyDialog';
import { useEffect, useRef, useState } from 'react';
import { Input, Label } from 'reactstrap';
import {
  readWorkerCapabilities,
  describeWorkerUnavailable,
  type WorkerCapabilities,
} from '../../utilities/worker/workerCapabilities';
import styles from './AdminSessionBackupPanel.module.scss';

type BackupPage = {
  ok: boolean;
  archiveId: string;
  pageNumber: number;
  nextCursor: string;
  manifest: { type: string; version: number; sessionSlug: string; sessionId: string; complete: boolean };
  [key: string]: unknown;
};
type RequestArgs = { action: string; path: string; body: Record<string, unknown> };
type Props = {
  workerUrl: string;
  sessionSlug: string;
  account?: string;
  canAdminWorker: boolean;
  postSignedRequest: (args: RequestArgs) => Promise<{ data?: unknown }>;
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const message = (error: unknown) => (error instanceof Error ? error.message : 'The backup operation failed.');
const isPage = (value: unknown, slug: string): value is BackupPage => {
  const page = record(value);
  const manifest = record(page.manifest);
  return (
    page.ok === true &&
    typeof page.archiveId === 'string' &&
    Number.isSafeInteger(page.pageNumber) &&
    typeof page.nextCursor === 'string' &&
    manifest.type === 'ce_session_backup' &&
    manifest.version === 1 &&
    manifest.sessionSlug === (slug || 'general') &&
    /^0x[0-9a-f]{32}$/.test(String(manifest.sessionId)) &&
    typeof manifest.complete === 'boolean' &&
    Array.isArray(page.entries)
  );
};
const saveFile = (pages: BackupPage[], slug: string, partial = false) => {
  const url = URL.createObjectURL(
    new Blob(
      pages.map((page) => `${JSON.stringify(page)}\n`),
      { type: 'application/x-ndjson' },
    ),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug || 'general'}-backup${partial ? '.partial' : ''}.jsonl`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// The archive can exceed the JS string limit; only one bounded page is decoded
// at a time. Reopening the immutable File lets an interrupted import resume.
async function* readBackupPages(file: File): AsyncGenerator<unknown> {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  const parse = (line: string): unknown => {
    if (line.length > 4 * 1024 * 1024) throw new Error('A backup page exceeds the 4 MiB limit.');
    try {
      return JSON.parse(line);
    } catch {
      throw new Error('This file is not valid backup JSONL.');
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += value || '';
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.trim()) yield parse(line);
      }
      if (pending.length > 4 * 1024 * 1024) throw new Error('A backup page exceeds the 4 MiB limit.');
      if (done) {
        if (pending.trim()) yield parse(pending);
        break;
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

const AdminSessionBackupPanel = ({ workerUrl, sessionSlug, account, canAdminWorker, postSignedRequest }: Props) => {
  const [capabilities, setCapabilities] = useState<WorkerCapabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [recoveryDisplay, setRecoveryDisplay] = useState<RecoveryKeyDisplay | null>(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [restoreCount, setRestoreCount] = useState(0);
  const [restorePosition, setRestorePosition] = useState(0);
  const [adoptSessionId, setAdoptSessionId] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [activeRestore, setActiveRestore] = useState<Record<string, unknown> | null>(null);
  const downloaded = useRef<BackupPage[]>([]);
  const restore = useRef<File | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void readWorkerCapabilities(workerUrl, sessionSlug).then((value) => {
      if (!controller.signal.aborted) setCapabilities(value);
    });
    return () => controller.abort();
  }, [workerUrl, sessionSlug]);
  const assertActive = () => {
    if (lifetime.current?.signal.aborted) throw new Error('Backup operation stopped.');
  };
  const request = async (action: string, body: Record<string, unknown>) => {
    for (let attempt = 0; ; attempt += 1) {
      assertActive();
      try {
        const result = await postSignedRequest({ action, path: `/admin/${action}`, body: { sessionSlug, ...body } });
        assertActive();
        return result.data;
      } catch (failure) {
        if (Number(record(failure).status) !== 429 || attempt >= 2) throw failure;
        setStatus('Worker rate limit reached. Resuming in one minute…');
        await new Promise<void>((resolve, reject) => {
          const signal = lifetime.current?.signal;
          const abort = () => {
            clearTimeout(timer);
            reject(new Error('Backup operation stopped.'));
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort);
            resolve();
          }, 61_000);
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
      }
    }
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setConflicts([]);
    try {
      await operation();
    } catch (failure) {
      if (!lifetime.current?.signal.aborted) setError(message(failure));
    } finally {
      if (!lifetime.current?.signal.aborted) setBusy(false);
    }
  };
  const showRecoveryKey = () => {
    if (
      !window.confirm(
        'The recovery key unlocks encrypted session data and saved service credentials. Keep it private. Export is limited to three times per UTC day. Show the recovery key?',
      )
    )
      return;
    void run(async () => {
      // Unlike backup pages, secret export is never automatically retried.
      const result = record(
        (
          await postSignedRequest({
            action: 'export-recovery-key',
            path: '/admin/export-recovery-key',
            body: { sessionSlug, confirm: 'export-recovery-key' },
          })
        ).data,
      );
      assertActive();
      if (typeof result.recoveryKey !== 'string' || !result.recoveryKey || typeof result.fingerprint !== 'string')
        throw new Error('The Worker did not return a recovery key.');
      setRecoveryDisplay({
        recoveryKey: result.recoveryKey,
        fingerprint: result.fingerprint,
        slug: sessionSlug,
        workerUrl,
        createdAt: new Date().toISOString(),
      });
    });
  };
  const download = () =>
    run(async () => {
      if (downloadComplete) {
        downloaded.current = [];
        setDownloadCount(0);
      }
      setDownloadComplete(false);
      for (;;) {
        setStatus(`Downloading page ${downloaded.current.length + 1}…`);
        const last = downloaded.current.at(-1);
        let cursor = last?.nextCursor || '';
        let value: unknown;
        for (;;) {
          value = await request('export-session-backup', { cursor });
          const preparation = record(value);
          if (preparation.preparing !== true) break;
          if (typeof preparation.nextCursor !== 'string' || preparation.nextCursor === cursor)
            throw new Error('The group snapshot did not advance. Restart the download.');
          cursor = preparation.nextCursor;
          setStatus('Preparing the group snapshot…');
        }
        if (record(value).reason === 'backup_session_changed') throw new Error(String(record(value).error));
        if (
          !isPage(value, sessionSlug) ||
          value.pageNumber !== downloaded.current.length ||
          (last && value.archiveId !== last.archiveId) ||
          (!value.manifest.complete && !value.nextCursor) ||
          (last && value.nextCursor && value.nextCursor === last.nextCursor)
        )
          throw new Error('The Worker returned an invalid backup page. Restart the download.');
        downloaded.current.push(value);
        setDownloadCount(downloaded.current.length);
        if (value.manifest.complete) break;
      }
      saveFile(downloaded.current, sessionSlug);
      setDownloadComplete(true);
      setStatus(`Downloaded ${downloaded.current.length} pages. Keep this backup with your recovery key.`);
    });
  const readFile = (file?: File) =>
    run(async () => {
      restore.current = null;
      setRestoreCount(0);
      setRestorePosition(0);
      if (!file) return;
      let count = 0;
      let archiveId = '';
      let complete = false;
      for await (const page of readBackupPages(file)) {
        assertActive();
        if (
          !isPage(page, sessionSlug) ||
          page.pageNumber !== count ||
          complete ||
          (count > 0 && page.archiveId !== archiveId)
        )
          throw new Error('Choose a complete backup in page order for this session slug.');
        archiveId = page.archiveId;
        complete = page.manifest.complete;
        count += 1;
      }
      if (!count || !complete) throw new Error('Choose a complete backup in page order for this session slug.');
      restore.current = file;
      setRestoreCount(count);
      setStatus(`Ready to restore ${count} pages from ${file.name}.`);
    });
  const checkRestore = () =>
    run(async () => {
      const result = record(await request('session-backup-status', {}));
      setActiveRestore(result.restore ? record(result.restore) : null);
      setStatus(result.restore ? 'An unfinished restore is in progress.' : 'No unfinished restore.');
    });
  const abandonRestore = () =>
    run(async () => {
      for (;;) {
        const result = record(await request('abandon-session-backup', { archiveId: activeRestore?.archiveId }));
        if (result.ok !== true) throw new Error('The Worker did not confirm abandonment. Check restore status.');
        if (result.complete === true) break;
        setStatus('Removing restore staging…');
      }
      setActiveRestore(null);
      setRestorePosition(0);
      setStatus('Restore abandoned. Existing records were kept. Choose a complete backup to start again.');
    });
  const importBackup = () =>
    run(async () => {
      let position = restorePosition;
      let result: Record<string, unknown> = {};
      if (!restore.current) return;
      for await (const page of readBackupPages(restore.current)) {
        assertActive();
        if (!isPage(page, sessionSlug)) throw new Error('The backup page is invalid.');
        if (page.pageNumber < position) continue;
        setStatus(`Restoring page ${position + 1} of ${restoreCount}…`);
        do {
          result = record(
            await request('import-session-backup', { page, adoptSessionId, sessionId: page.manifest.sessionId }),
          );
          if (result.ok !== true || !result.counts)
            throw new Error('The Worker did not confirm this restore page. Resume to retry it.');
          setActiveRestore(result.restore ? record(result.restore) : null);
        } while (result.pageComplete === false);
        position += 1;
        setRestorePosition(position);
      }
      const counts = record(result.counts);
      setStatus(`${Number(counts.written) || 0} written, ${Number(counts.skipped) || 0} already present.`);
      if (Number(counts.conflicts) > 0) {
        setConflicts(Array.isArray(result.conflicts) ? result.conflicts.map(String) : []);
        throw new Error(
          `Restore finished with ${Number(counts.conflicts)} conflict(s). Existing records were kept. Restore into a fresh target to resolve these conflicts.`,
        );
      }
      if (result.complete !== true) {
        setRestorePosition(Math.max(0, position - 1));
        throw new Error('The Worker reports an incomplete restore. Keep the archive and resume the same restore.');
      }
      setStatus(
        `Restore complete. ${Number(counts.written) || 0} written, ${Number(counts.skipped) || 0} already present.`,
      );
    });
  if (!capabilities?.features.includes('session_backup_v1')) return null;
  const unavailable = capabilities.session?.unavailable.find((entry) => entry.operation === 'backup');
  return (
    <section className={styles.panel} data-testid="ce-admin-session-backup">
      <h3 className={styles.panelTitle}>Backup &amp; restore</h3>
      {recoveryDisplay && <RecoveryKeyDialog value={recoveryDisplay} onContinue={() => setRecoveryDisplay(null)} />}
      {capabilities?.features.includes('recovery_key_export') && (
        <button
          type="button"
          className={styles.actionButton}
          disabled={busy || !canAdminWorker}
          onClick={showRecoveryKey}
          data-testid="ce-admin-recovery-key-show"
        >
          Show recovery key
        </button>
      )}

      <p className={styles.panelSubtitle}>
        Pause session writes while downloading. Restore to a deployment with the same session slug and recovery key.
      </p>
      {unavailable && <p className={styles.statusNote}>{describeWorkerUnavailable(unavailable.reason)}</p>}
      <div className={styles.formRow}>
        <button
          type="button"
          className={styles.actionButton}
          disabled={busy || !canAdminWorker || !!unavailable}
          onClick={() => void download()}
          data-testid="ce-admin-backup-download"
        >
          {downloadCount && !downloadComplete ? 'Resume download' : 'Download backup'}
        </button>
        {downloadCount > 0 && !downloadComplete && (
          <>
            <button
              type="button"
              className={styles.actionButton}
              disabled={busy}
              onClick={() => saveFile(downloaded.current, sessionSlug, true)}
            >
              Save partial backup
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={busy}
              onClick={() => {
                downloaded.current = [];
                setDownloadCount(0);
                setError('');
                setStatus('');
              }}
            >
              Restart download
            </button>
          </>
        )}
      </div>
      <p className={styles.statusNote}>
        For a fresh deployment, enter its Worker URL in admin settings and connect its bootstrap admin wallet. Each page
        needs an admin signature.
      </p>
      <div className={styles.formRow}>
        <button
          type="button"
          className={styles.actionButton}
          disabled={busy || !account}
          onClick={() => void checkRestore()}
          data-testid="ce-admin-backup-status"
        >
          Check restore status
        </button>
        {activeRestore?.canAbandon === true && (
          <button
            type="button"
            className={styles.actionButton}
            disabled={busy || !account}
            onClick={() => void abandonRestore()}
            data-testid="ce-admin-backup-abandon"
          >
            Abandon restore
          </button>
        )}
      </div>
      <Label for="admin-session-backup-file">Backup file</Label>
      <Input
        id="admin-session-backup-file"
        type="file"
        accept=".jsonl,application/x-ndjson"
        disabled={busy || !account}
        onChange={(event) => void readFile(event.target.files?.[0])}
        data-testid="ce-admin-backup-file"
      />
      <Label check className={styles.adoptLabel}>
        <Input
          type="checkbox"
          checked={adoptSessionId}
          disabled={busy || restorePosition > 0}
          onChange={(event) => setAdoptSessionId(event.target.checked)}
        />{' '}
        Adopt the backup session ID on a fresh deployment
      </Label>
      <button
        type="button"
        className={styles.actionButton}
        disabled={busy || !account || !restoreCount || restorePosition === restoreCount}
        onClick={() => void importBackup()}
        data-testid="ce-admin-backup-restore"
      >
        {restorePosition > 0 && restorePosition < restoreCount ? 'Resume restore' : 'Restore from backup'}
      </button>
      {!account && <p className={styles.statusNote}>Connect the deployment admin wallet to restore a backup.</p>}
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
      {conflicts.length > 0 && (
        <ul className={styles.statusNote}>
          {conflicts.slice(0, 10).map((key) => (
            <li key={key} style={{ overflowWrap: 'anywhere' }}>
              {key}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
export default AdminSessionBackupPanel;
