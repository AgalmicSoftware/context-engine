import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { SessionWizardRequirementId } from './sessionWizardModeRequirements';

export const SESSION_WIZARD_REQUIREMENT_LINKS = Object.freeze({
  cloudflareApiTokens: 'https://dash.cloudflare.com/profile/api-tokens',
  openaiApiKey: 'https://platform.openai.com/api-keys',
  litApiKeys: 'https://developer.litprotocol.com/management/api_keys',
  arweaveWallet: 'https://docs.arweave.org/developers/wallets/arweave-wallet',
  optimismSepoliaFaucet: 'https://console.optimism.io/faucet',
});

type SessionWizardRequirementsBannerProps = {
  fundingRequirementHref?: string;
  fundingRequirementLabel: string;
  newSessionRequiresLitCredential?: boolean;
  onDismiss: () => void;
  requiredRequirementIds?: readonly SessionWizardRequirementId[];
};

const SessionWizardRequirementsBanner = ({
  fundingRequirementHref = '',
  fundingRequirementLabel,
  newSessionRequiresLitCredential = true,
  onDismiss,
  requiredRequirementIds,
}: SessionWizardRequirementsBannerProps): React.ReactElement => {
  const hasResolvedRequirements = Array.isArray(requiredRequirementIds);
  const requires = (requirementId: SessionWizardRequirementId): boolean =>
    !hasResolvedRequirements || requiredRequirementIds.includes(requirementId);
  const showLegacySponsorshipCopy = !hasResolvedRequirements || !requiredRequirementIds.includes('cloudflareApiToken');
  const walletRequirementLabel = fundingRequirementLabel.includes('SBT publishing')
    ? 'A connected wallet for on-chain SBT publishing'
    : 'A connected wallet for on-chain registration';

  return (
    <section className={styles.newSessionBanner} aria-labelledby="new-session-requirements-title">
      <div className={styles.newSessionBannerHeader}>
        <h2 id="new-session-requirements-title" className={styles.newSessionBannerTitle}>
          To create a session you&apos;ll need:
        </h2>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.newSessionBannerDismissButton}`}
          aria-label="Dismiss session setup requirements"
          title="Dismiss session setup requirements"
          onClick={onDismiss}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <div className={styles.newSessionBannerBody}>
        <ul className={styles.newSessionBannerList}>
          {requires('cloudflareApiToken') ? (
            <li>
              <a
                href={SESSION_WIZARD_REQUIREMENT_LINKS.cloudflareApiTokens}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
              >
                Cloudflare API token
              </a>{' '}
              for deploying the session worker
            </li>
          ) : null}
          {requires('aiProviderKey') ? (
            <li>
              <a
                href={SESSION_WIZARD_REQUIREMENT_LINKS.openaiApiKey}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
              >
                {hasResolvedRequirements ? 'AI provider key' : 'OpenAI API key'}
              </a>{' '}
              for text and transcription
            </li>
          ) : null}
          {requires('lit') ? (
            <li>
              {hasResolvedRequirements || newSessionRequiresLitCredential ? (
                <>
                  <a
                    href={SESSION_WIZARD_REQUIREMENT_LINKS.litApiKeys}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.newSessionBannerLink}
                  >
                    Lit API key
                  </a>{' '}
                  for encrypted access automation
                </>
              ) : (
                'No Lit key is required for Cloudflare worker-enforced SBT access control'
              )}
            </li>
          ) : null}
          {requires('arweaveJwk') ? (
            <li>
              <a
                href={SESSION_WIZARD_REQUIREMENT_LINKS.arweaveWallet}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
              >
                Arweave wallet (JWK)
              </a>{' '}
              for permanent storage
            </li>
          ) : null}
          {requires('rpc') ? <li>RPC URL or provider key for on-chain reads and publishing</li> : null}
          {requires('wallet') ? <li>{walletRequirementLabel}</li> : null}
          {requires('funding') ? (
            <li>
              {fundingRequirementHref ? (
                <a
                  href={fundingRequirementHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.newSessionBannerLink}
                >
                  {fundingRequirementLabel}
                </a>
              ) : (
                fundingRequirementLabel
              )}
            </li>
          ) : null}
          {!hasResolvedRequirements ? <li>(Optional) A faucet private key for sponsoring user gas</li> : null}
        </ul>
        {showLegacySponsorshipCopy ? (
          <>
            <p className={styles.newSessionBannerCopy}>
              A turnkey tool for bundling these resources is in development.
            </p>
            <p className={styles.newSessionBannerCopy}>
              In the meantime, you can get a sponsored session URL by contacting{' '}
              <a href="mailto:contextengine@protonmail.com" className={styles.newSessionBannerLink}>
                contextengine@protonmail.com
              </a>
              .
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
};

export default SessionWizardRequirementsBanner;
