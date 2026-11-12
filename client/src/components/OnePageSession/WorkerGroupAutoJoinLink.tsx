import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildWorkerGroupAutoJoinPath, canAutoJoinWorkerGroup } from '../../domains/worker/workerGroupAutoJoin';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import styles from './OnePageSession.module.scss';

export default function WorkerGroupAutoJoinLink({
  group,
  sessionSlug,
  workerUrl,
}: {
  group: WorkerGroup;
  sessionSlug: string;
  workerUrl: string;
}) {
  const [status, setStatus] = useState('');
  const [showCode, setShowCode] = useState(false);
  if (!canAutoJoinWorkerGroup(group)) return null;
  // The copied link and the code are one link, so a scan joins the same group with the same Worker and mode.
  const link = () => {
    const currentPath = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
    return new URL(
      buildWorkerGroupAutoJoinPath(sessionSlug, group.groupId, workerUrl, currentPath),
      window.location.origin,
    ).toString();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setStatus('Auto-join link copied.');
    } catch {
      setStatus('Could not copy the auto-join link.');
    }
  };
  let codeLink = '';
  if (showCode) {
    try {
      codeLink = link();
    } catch {
      // Said in place of the code below.
    }
  }
  return (
    <span>
      <button
        type="button"
        className={styles.agentSecondaryButton}
        onClick={() => void copy()}
        aria-label={`Copy auto-join link for ${group.label}`}
      >
        Copy auto-join link
      </button>{' '}
      <button
        type="button"
        className={styles.agentSecondaryButton}
        aria-expanded={showCode}
        onClick={() => setShowCode(!showCode)}
        aria-label={`${showCode ? 'Hide' : 'Show'} auto-join QR code for ${group.label}`}
      >
        {showCode ? 'Hide QR code' : 'QR code'}
      </button>
      {status ? <span role="status">{status}</span> : null}
      {showCode && !codeLink ? <span role="status">Could not make the auto-join QR code.</span> : null}
      {codeLink ? (
        // Level M still scans from a projected screen with some glare or a shaky phone.
        <QRCodeSVG
          className={styles.autoJoinCode}
          value={codeLink}
          level="M"
          size={200}
          marginSize={4}
          title={`Join ${group.label}`}
        />
      ) : null}
    </span>
  );
}
