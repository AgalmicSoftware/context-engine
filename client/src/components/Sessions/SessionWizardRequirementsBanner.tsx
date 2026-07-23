import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SessionWizard.module.scss';
import { buildCloudflareTokenTemplateUrl } from './cloudflareTokenTemplate.js';
import { CLOUDFLARE_NATIVE_DEPLOY_URL } from '../../variables/publicDeploymentConfig.js';
import type { SessionWizardRequirementId } from './sessionWizardModeRequirements';

export const SESSION_WIZARD_REQUIREMENT_LINKS = Object.freeze({
  openaiApiKey: 'https://platform.openai.com/api-keys',
  litApiKeys: 'https://developer.litprotocol.com/management/api_keys',
  arweaveWallet: 'https://docs.arweave.org/developers/wallets/arweave-wallet',
  optimismSepoliaFaucet: 'https://console.optimism.io/faucet',
});

type SessionWizardRequirementsBannerProps = {
  cloudflareTokenSlug?: string;
  fundingRequirementHref?: string;
  fundingRequirementLabel: string;
  newSessionRequiresLitCredential?: boolean;
  onDismiss: () => void;
  requiredRequirementIds?: readonly SessionWizardRequirementId[];
};

const SessionWizardRequirementsBanner = ({
  cloudflareTokenSlug = '',
  fundingRequirementHref = '',
  fundingRequirementLabel,
  newSessionRequiresLitCredential = true,
  onDismiss,
  requiredRequirementIds,
}: SessionWizardRequirementsBannerProps): React.ReactElement => {
  const hasResolvedRequirements = Array.isArray(requiredRequirementIds);
  const requires = (requirementId: SessionWizardRequirementId): boolean =>
    !hasResolvedRequirements || requiredRequirementIds.includes(requirementId);
  const showLegacySponsorshipCopy =
    !hasResolvedRequirements ||
    !requiredRequirementIds.some(
      (requirementId) => requirementId === 'cloudflareAccount' || requirementId === 'cloudflareApiToken',
    );
  const walletRequirementLabel = fundingRequirementLabel.includes('SBT publishing')
    ? 'A connected wallet for on-chain SBT publishing'
    : 'A connected wallet for on-chain registration';
  const rpcRequirementLabel =
    requires('wallet') || requires('funding')
      ? 'RPC URL or provider key for on-chain reads and publishing'
      : 'RPC URL or provider key for read-only access checks or encryption; no on-chain publishing transaction is required';
  const cloudflareTokenTemplateHref = buildCloudflareTokenTemplateUrl({
    slug: cloudflareTokenSlug,
  });

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
          {hasResolvedRequirements && requires('cloudflareAccount') ? (
            <li>
              {CLOUDFLARE_NATIVE_DEPLOY_URL ? (
                <a
                  href={CLOUDFLARE_NATIVE_DEPLOY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.newSessionBannerLink}
                >
                  Cloudflare account
                </a>
              ) : (
                'Cloudflare account'
              )}{' '}
              — the Worker step deploys the full Session Worker through Cloudflare&apos;s native flow. It does not ask
              for a Cloudflare API token or use the Context Engine deploy helper.
            </li>
          ) : null}
          {requires('cloudflareApiToken') ? (
            <li>
              <a
                href={cloudflareTokenTemplateHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
                data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_ONBOARDING_LINK}
              >
                Cloudflare API token
              </a>{' '}
              — if you&apos;re already logged into Cloudflare, this link opens a token form with permissions prefilled.
              Under Account Resources, choose only the account that will own the session Worker; create the token, then
              copy it into the Worker step. Set the earliest expiration Cloudflare permits that still covers setup and
              an immediate retry; revoke it after deployment succeeds or you abandon the attempt.
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
          {requires('rpc') ? <li>{rpcRequirementLabel}</li> : null}
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
