import { useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { isWorkerAuthorizedLitConfig } from '../../../../shared/litChipotleAction.mjs';
import type { AdminSignedWorkerRequestArgs } from './adminPageSignedWorkerRequest';
import styles from './AdminPage.module.scss';

type AdminLitAuthorityControlsProps = {
  canAdminWorker: boolean;
  hasUnsavedChanges: boolean;
  workerSupportsFreshAuthority?: boolean;
  sessionSlug: string;
  workerUrl: string;
  postSignedRequest: (args: AdminSignedWorkerRequestArgs) => Promise<{ data?: unknown }>;
  onProvisioned: () => Promise<void> | void;
};

const AdminLitAuthorityControls = ({
  canAdminWorker,
  hasUnsavedChanges,
  workerSupportsFreshAuthority,
  sessionSlug,
  workerUrl,
  postSignedRequest,
  onProvisioned,
}: AdminLitAuthorityControlsProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setConfirmed(false);
  }, [canAdminWorker, hasUnsavedChanges, workerSupportsFreshAuthority]);
  const disabled = !canAdminWorker || !workerUrl || hasUnsavedChanges || busy || workerSupportsFreshAuthority !== true;

  const provision = async () => {
    if (disabled || !confirmed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setStatus('Creating fresh Lit authority…');
    try {
      const { data } = await postSignedRequest({
        action: 'lit-chipotle-provision',
        path: '/admin/lit-chipotle-provision',
        workerUrl,
        body: { sessionSlug, freshAuthority: true },
      });
      const result = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      if (
        result.ok !== true ||
        !isWorkerAuthorizedLitConfig(result) ||
        !['litGroupId', 'litPkpId', 'litActionCid'].every(
          (key) => typeof result[key] === 'string' && result[key].trim(),
        )
      ) {
        throw new Error(
          'The Worker did not confirm a complete Worker-signed Lit authority. Update the session Worker before proceeding.',
        );
      }
      if (!mounted.current) return;
      setStatus(
        'Fresh Lit authority created. Refresh Lit status, then verify new encryption and decryption with eligible and ineligible wallets.',
      );
      // A status-read failure must not invite another destructive cutover.
      try {
        await onProvisioned();
      } catch {
        /* The status control can be refreshed separately. */
      }
    } catch (failure: unknown) {
      if (!mounted.current) return;
      const message = failure instanceof Error ? failure.message : String(failure || 'Lit provisioning failed.');
      setStatus('');
      setError(
        /Lit account API key not configured/i.test(message)
          ? 'Save a Lit account API key in Worker secrets before creating a fresh authority.'
          : `${message} Refresh Lit status before trying again; an interrupted attempt may have created Lit resources.`,
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        // Every replacement, including a manual retry, needs a new acknowledgement.
        setConfirmed(false);
      }
    }
  };

  return (
    <div className={styles.inlineResourceCard} data-testid="ce-admin-lit-authority">
      <div className={styles.inlineResourceBalance}>Fresh Lit authority</div>
      <p className={styles.inlineResourceStatus}>
        For legacy unsigned Lit content, export or otherwise preserve what you need before updating the Worker. The
        updated Worker cannot decrypt that legacy content. Replacing any Lit authority also cuts off its existing
        ciphertext; this action does not migrate content or revoke old permissions.
      </p>
      <p className={styles.inlineResourceStatus}>
        This uses the account key saved on the Worker to create a new PKP, group, Action, and usage key. Lit may charge
        for these resources. Save any secret changes first.
      </p>
      {!canAdminWorker && <p className={styles.statusNote}>Connect the configured Worker admin wallet to continue.</p>}
      {hasUnsavedChanges && <p className={styles.statusNote}>Save worker secret changes before provisioning.</p>}
      {workerSupportsFreshAuthority !== true && (
        <p className={styles.statusNote}>
          {workerSupportsFreshAuthority === false
            ? 'Update the session Worker before creating a fresh authority. Preserve required legacy content first.'
            : 'Refresh Lit status to verify that this Worker supports fresh authorities.'}
        </p>
      )}
      <label className={styles.inlineResourceStatus}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(event) => setConfirmed(event.target.checked)}
          data-testid="ce-admin-lit-authority-confirm"
        />{' '}
        I preserved any required content before the Worker update and understand that the fresh authority cannot decrypt
        old ciphertext.
      </label>
      <Button
        type="button"
        color="danger"
        className={styles.actionButton}
        disabled={disabled || !confirmed}
        onClick={() => void provision()}
        data-testid="ce-admin-lit-authority-create"
      >
        {busy ? 'Creating fresh Lit authority…' : 'Create fresh Lit authority'}
      </Button>
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
    </div>
  );
};

export default AdminLitAuthorityControls;
