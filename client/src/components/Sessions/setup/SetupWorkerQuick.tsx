import React from 'react';
import { Input } from 'reactstrap';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { buildCloudflareTokenTemplateUrl } from '../cloudflareTokenTemplate';
import { SetupField, setupHelpId } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

type SetupWorkerQuickProps = {
  slug: string;
  token: string;
  onTokenChange: (token: string) => void;
  /** The Worker this session will use is deployed and verified. */
  verifiedWorkerUrl: string;
  deployStatus: string;
  deployStatusIsError: boolean;
  deployDisabled: boolean;
  /** Deploys before Create, to check the Worker first. Create deploys anyway. */
  onDeploy: () => void;
};

// The quick path's one hosting input. Create deploys with it through the
// deploy helper; the token-free Cloudflare dashboard path is under More.
const SetupWorkerQuick = ({
  slug,
  token,
  onTokenChange,
  verifiedWorkerUrl,
  deployStatus,
  deployStatusIsError,
  deployDisabled,
  onDeploy,
}: SetupWorkerQuickProps): React.ReactElement => (
  <>
    {verifiedWorkerUrl ? (
      <p className={styles.statusText} data-testid={E2E_TESTIDS.SETUP_WORKER_READY}>
        Session Worker ready: <span className={styles.readOnlyValue}>{verifiedWorkerUrl}</span>
      </p>
    ) : (
      <>
        <SetupField
          id="ce-setup-cloudflare-token"
          label="Cloudflare API token"
          help="Create deploys your Session Worker with it. It goes only to the deploy helper, once, and is never saved."
        >
          <Input
            id="ce-setup-cloudflare-token"
            type="password"
            autoComplete="off"
            value={token}
            aria-describedby={setupHelpId('ce-setup-cloudflare-token')}
            data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN}
            onChange={(event) => onTokenChange(event.target.value)}
          />
        </SetupField>
        <p className={styles.hint}>
          <a
            href={buildCloudflareTokenTemplateUrl({ slug })}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_CREATE_LINK}
          >
            Create a token in Cloudflare
          </a>{' '}
          (sign in to Cloudflare first). No token? Use the Cloudflare dashboard under More.
        </p>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.button}
            disabled={deployDisabled || !token.trim()}
            data-testid={E2E_TESTIDS.WIZARD_DEPLOY_WORKER}
            onClick={onDeploy}
          >
            Deploy the Worker now
          </button>
        </div>
      </>
    )}
    {deployStatus ? (
      <p
        className={deployStatusIsError ? styles.errorText : styles.hint}
        role="status"
        data-testid={E2E_TESTIDS.WIZARD_DEPLOY_STATUS}
      >
        {deployStatus}
      </p>
    ) : null}
  </>
);

export default SetupWorkerQuick;
