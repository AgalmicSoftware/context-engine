import { useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';
import styles from './AdminPage.module.scss';

type Diagnostics = {
  type: 'ce_session_diagnostics';
  version: 1;
  observedAtMs: number;
  uploadReceipts: {
    pendingLeases: number;
    oldestPendingAgeMs: number | null;
    settledCount: number;
    complete: boolean;
    cursor: string | null;
  };
  analysis: {
    lastSuccessAtMs: number | null;
    retryAttempt: number;
    nextAttemptAtMs: number | null;
    retriesExhausted: boolean;
  };
  configProjection: { pending: boolean; sinceMs: number | null };
};
type Props = {
  workerUrl: string;
  sessionSlug: string;
  sessionId?: string;
  account?: string;
  canAdminWorker: boolean;
  workerAuthContext?: Record<string, unknown>;
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nullableNumber = (value: unknown) => value === null || nonnegative(value);
const isDiagnostics = (value: unknown): value is Diagnostics => {
  const body = record(value);
  const receipts = record(body.uploadReceipts);
  const analysis = record(body.analysis);
  const projection = record(body.configProjection);
  return (
    body.type === 'ce_session_diagnostics' &&
    body.version === 1 &&
    nonnegative(body.observedAtMs) &&
    nonnegative(receipts.pendingLeases) &&
    nonnegative(receipts.settledCount) &&
    nullableNumber(receipts.oldestPendingAgeMs) &&
    (receipts.complete === true
      ? receipts.cursor === null
      : receipts.complete === false && typeof receipts.cursor === 'string' && /^[a-f0-9]{64}$/.test(receipts.cursor)) &&
    nullableNumber(analysis.lastSuccessAtMs) &&
    nonnegative(analysis.retryAttempt) &&
    nullableNumber(analysis.nextAttemptAtMs) &&
    typeof analysis.retriesExhausted === 'boolean' &&
    typeof projection.pending === 'boolean' &&
    nullableNumber(projection.sinceMs)
  );
};
const timestamp = (value: number | null, empty: string) => (value === null ? empty : new Date(value).toLocaleString());

const AdminSessionDiagnostics = ({
  workerUrl,
  sessionSlug,
  sessionId,
  account,
  canAdminWorker,
  workerAuthContext,
}: Props) => {
  const target = JSON.stringify([workerUrl, sessionSlug, sessionId, account, canAdminWorker]);
  const [result, setResult] = useState<{ target: string; data: Diagnostics } | null>(null);
  const snapshot = result?.target === target ? result.data : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setResult(null);
    setError('');
    setBusy(false);
    return () => request.current?.abort();
  }, [workerUrl, sessionSlug, sessionId, account, canAdminWorker]);

  const refresh = async (append = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    const previous = append ? snapshot : null;
    try {
      const query = new URLSearchParams({ sessionSlug });
      if (previous?.uploadReceipts.cursor) query.set('cursor', previous.uploadReceipts.cursor);
      const response = await adminWorkerPorts.adminAuth.fetchWorkerWithAuth(
        `${workerUrl.replace(/\/+$/, '')}/admin/diagnostics?${query}`,
        { method: 'GET', cache: 'no-store', signal: controller.signal },
        { sessionSlug, workerUrl, context: workerAuthContext },
      );
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? 'This Worker does not provide session diagnostics. Update the Worker to enable them.'
            : 'Session diagnostics are unavailable. Check your admin access and try again.',
        );
      if (!isDiagnostics(body)) throw new Error('The Worker returned an invalid diagnostics response.');
      const counts = body.uploadReceipts;
      const prior = previous?.uploadReceipts;
      const data = prior
        ? {
            ...body,
            uploadReceipts: {
              ...counts,
              pendingLeases: prior.pendingLeases + counts.pendingLeases,
              settledCount: prior.settledCount + counts.settledCount,
              oldestPendingAgeMs:
                prior.oldestPendingAgeMs === null
                  ? counts.oldestPendingAgeMs
                  : Math.max(
                      prior.oldestPendingAgeMs + body.observedAtMs - previous.observedAtMs,
                      counts.oldestPendingAgeMs ?? 0,
                    ),
            },
          }
        : body;
      setResult({ target, data });
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Session diagnostics are unavailable.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  if (!workerUrl || !canAdminWorker) return null;
  return (
    <section
      className={`${styles.inlineResourceCard} ${styles.diagnosticsCard}`}
      aria-label="Session diagnostics"
      data-testid="ce-admin-session-diagnostics"
    >
      <div className={styles.inlineResourceBalance}>Session diagnostics</div>
      <Button
        color="primary"
        className={styles.actionButton}
        disabled={busy}
        onClick={() => void refresh()}
        data-testid="ce-admin-diagnostics-refresh"
      >
        {busy ? 'Reading diagnostics…' : 'Refresh diagnostics'}
      </Button>
      {error && <p role="alert">{error}</p>}
      {!snapshot && !error && <p className={styles.inlineResourceStatus}>Refresh to read current session activity.</p>}
      {snapshot && (
        <>
          <dl>
            <dt>Pending upload leases</dt>
            <dd>{snapshot.uploadReceipts.pendingLeases}</dd>
            <dt>Oldest pending lease</dt>
            <dd>
              {snapshot.uploadReceipts.oldestPendingAgeMs === null
                ? 'None'
                : `${Math.floor(snapshot.uploadReceipts.oldestPendingAgeMs / 1000)} seconds`}
            </dd>
            <dt>Settled upload receipts</dt>
            <dd>{snapshot.uploadReceipts.settledCount}</dd>
            <dt>Last automatic analysis success</dt>
            <dd>{timestamp(snapshot.analysis.lastSuccessAtMs, 'None recorded')}</dd>
            <dt>Automatic retry attempt</dt>
            <dd>{snapshot.analysis.retryAttempt} of 3</dd>
            <dt>Next automatic attempt</dt>
            <dd>{timestamp(snapshot.analysis.nextAttemptAtMs, 'Not scheduled')}</dd>
            <dt>Automatic retries exhausted</dt>
            <dd>{snapshot.analysis.retriesExhausted ? 'Yes — automatic retries have stopped' : 'No'}</dd>
            <dt>Config projection repair</dt>
            <dd>
              {snapshot.configProjection.pending
                ? `Pending since ${timestamp(snapshot.configProjection.sinceMs, 'an unknown time')}`
                : 'Not pending'}
            </dd>
          </dl>
          {!snapshot.uploadReceipts.complete && (
            <>
              <p className={styles.inlineResourceStatus}>
                Receipt totals are partial. Load the next page to include more uploads.
              </p>
              <Button
                color="primary"
                className={styles.actionButton}
                disabled={busy}
                onClick={() => void refresh(true)}
              >
                Load more receipt totals
              </Button>
            </>
          )}
          <p className={styles.inlineResourceStatus}>
            Read {timestamp(snapshot.observedAtMs, '')}. Receipt totals reflect the retained seven-day window and may
            change while pages load.
          </p>
        </>
      )}
    </section>
  );
};
export default AdminSessionDiagnostics;
