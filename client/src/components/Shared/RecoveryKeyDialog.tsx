import { useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import styles from './RecoveryKeyDialog.module.scss';

export type RecoveryKeyDisplay = {
  recoveryKey?: string;
  fingerprint: string;
  slug: string;
  workerUrl: string;
  createdAt: string;
  supplied?: boolean;
};

const RecoveryKeyDialog = ({ value, onContinue }: { value: RecoveryKeyDisplay; onContinue: () => void }) => {
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const download = () => {
    try {
      const text =
        [
          `Session: ${value.slug || 'general'}`,
          `Worker URL: ${value.workerUrl}`,
          `Saved: ${value.createdAt}`,
          `Recovery key: ${value.recoveryKey}`,
          `Fingerprint: ${value.fingerprint}`,
          '',
          '1. Keep this key private and save a complete session backup from admin settings.',
          '2. On a replacement Worker, bind this value as CE_STORAGE_ENVELOPE_KEK (or CE_STORAGE_ENVELOPE_PREVIOUS_KEK for break-glass recovery).',
          '3. Use the same session slug, connect the bootstrap admin wallet, and import the backup from Backup & restore.',
        ].join('\n') + '\n';
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(value.slug || 'general').replace(/[^a-z0-9_-]/gi, '-')}-recovery-key.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Could not download the key. Reveal it and save a private copy before continuing.');
    }
  };
  return (
    <Modal
      isOpen
      backdrop="static"
      keyboard={false}
      labelledBy="ce-recovery-key-title"
      contentClassName={styles.dialog}
    >
      <ModalBody>
        <h2 id="ce-recovery-key-title">Save your recovery key</h2>
        <p>
          This key unlocks encrypted session data and saved service credentials. Keep it private with your session
          backup.
        </p>
        {value.recoveryKey && value.supplied !== undefined && (
          <p role="status">
            {value.supplied
              ? 'The Worker uses your supplied recovery key.'
              : 'The Worker uses a generated recovery key.'}
          </p>
        )}
        {value.recoveryKey ? (
          <>
            <label htmlFor="ce-recovery-key-value">Recovery key</label>
            <input
              id="ce-recovery-key-value"
              type={revealed ? 'text' : 'password'}
              value={value.recoveryKey}
              readOnly
              autoComplete="off"
            />
            <button type="button" onClick={() => setRevealed(!revealed)}>
              {revealed ? 'Hide key' : 'Reveal key'}
            </button>
            <button type="button" onClick={download} data-testid="ce-recovery-key-download">
              Download recovery key
            </button>
            <p>This display is kept only in this tab. A replayed deployment reply cannot show the key again.</p>
          </>
        ) : (
          <p role="status">
            {value.supplied
              ? 'Your supplied recovery key is installed. Keep the original private copy.'
              : 'This reply did not include the key. A replay or recovered deployment cannot show it again. The session admin can use Show recovery key in Backup & restore.'}
          </p>
        )}
        {value.fingerprint && <p className={styles.fingerprint}>Fingerprint: {value.fingerprint}</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className={styles.primary} onClick={onContinue} data-testid="ce-recovery-key-saved">
          I&apos;ve saved it
        </button>
        <p>Skipping without a private copy risks losing encrypted data if the deployment is lost.</p>
        <button type="button" onClick={onContinue} data-testid="ce-recovery-key-skip">
          Skip, I understand the risk
        </button>
      </ModalBody>
    </Modal>
  );
};
export default RecoveryKeyDialog;
