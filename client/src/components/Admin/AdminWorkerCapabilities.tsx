import { useEffect, useState } from 'react';
import {
  KNOWN_WORKER_FEATURES,
  readWorkerCapabilities,
  type WorkerCapabilities,
} from '../../utilities/worker/workerCapabilities';
import styles from './AdminPage.module.scss';

const AdminWorkerCapabilities = ({ workerUrl, sessionSlug }: { workerUrl: string; sessionSlug: string }) => {
  const [result, setResult] = useState<{ target: string; capabilities: WorkerCapabilities } | null>(null);
  const target = JSON.stringify([workerUrl, sessionSlug]);
  useEffect(() => {
    let active = true;
    if (workerUrl)
      void readWorkerCapabilities(workerUrl, sessionSlug).then((capabilities) => {
        if (active) setResult({ target, capabilities });
      });
    return () => {
      active = false;
    };
  }, [workerUrl, sessionSlug, target]);
  if (!workerUrl) return null;
  const capabilities = result?.target === target ? result.capabilities : null;
  return (
    <div className={styles.inlineResourceCard} data-testid="ce-admin-worker-capabilities">
      <div className={styles.inlineResourceBalance}>Worker version</div>
      {!capabilities ? (
        <p className={styles.inlineResourceStatus}>Checking Worker capabilities…</p>
      ) : (
        <>
          <p className={styles.inlineResourceStatus}>API version: {capabilities.apiVersion ?? 'Unknown'}</p>
          <p className={styles.inlineResourceStatus} style={{ overflowWrap: 'anywhere' }}>
            Bundle: {capabilities.bundle || 'Not reported'}
          </p>
          {(capabilities.legacy ||
            KNOWN_WORKER_FEATURES.some((feature) => !capabilities.features.includes(feature))) && (
            <p className={styles.inlineResourceStatus}>
              Upgrade recommended. This Worker does not advertise all features used by this client. Update the session
              Worker to enable safe admin corrections and the latest recovery tools.
            </p>
          )}
        </>
      )}
    </div>
  );
};
export default AdminWorkerCapabilities;
