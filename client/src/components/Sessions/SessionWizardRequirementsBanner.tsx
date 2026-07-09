import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';

export const SESSION_WIZARD_REQUIREMENT_LINKS = Object.freeze({
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
};

const SessionWizardRequirementsBanner = ({
  fundingRequirementHref = '',
  fundingRequirementLabel,
  newSessionRequiresLitCredential = true,
  onDismiss,
}: SessionWizardRequirementsBannerProps): React.ReactElement => (
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
        <li>
          <a
            href={SESSION_WIZARD_REQUIREMENT_LINKS.openaiApiKey}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.newSessionBannerLink}
          >
            OpenAI API key
          </a>{' '}
          for text and transcription
        </li>
        <li>
          {newSessionRequiresLitCredential ? (
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
        <li>(Optional) A faucet private key for sponsoring user gas</li>
      </ul>
      <p className={styles.newSessionBannerCopy}>A turnkey tool for bundling these resources is in development.</p>
      <p className={styles.newSessionBannerCopy}>
        In the meantime, you can get a sponsored session URL by contacting{' '}
        <a href="mailto:[redacted-email]" className={styles.newSessionBannerLink}>
          [redacted-email]
        </a>
        .
      </p>
    </div>
  </section>
);

export default SessionWizardRequirementsBanner;
