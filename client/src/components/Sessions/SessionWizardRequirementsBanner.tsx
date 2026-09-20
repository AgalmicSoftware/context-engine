import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import CETooltip from '../Shared/CETooltip';
import styles from './SessionWizard.module.scss';
import { buildCloudflareTokenTemplateUrl, CLOUDFLARE_TOKEN_SETUP_GUIDE_URL } from './cloudflareTokenTemplate.js';
import type { SessionWizardRequirementId } from './sessionWizardModeRequirements';

export const SESSION_WIZARD_REQUIREMENT_LINKS = Object.freeze({
  cloudflareAccount: 'https://dash.cloudflare.com/',
  openaiApiKey: 'https://platform.openai.com/api-keys',
  litApiKeys: 'https://developer.litprotocol.com/management/api_keys',
  arweaveWallet: 'https://docs.arweave.org/developers/wallets/arweave-wallet',
  optimismSepoliaFaucet: 'https://console.optimism.io/faucet',
});

const CLOUDFLARE_ACCOUNT_TOOLTIP =
  'Log in to your Cloudflare account in this browser before continuing, so the setup links in later steps open correctly.';

const isOpenAiProviderLabel = (label: string): boolean => /\bopenai\b/i.test(label);

const renderResolvedAiProviderKeyLabels = (labels: readonly string[]): React.ReactNode => {
  const resolvedLabels = labels.length ? labels : ['OpenAI API Key'];

  return resolvedLabels.map((label, index) => (
    <React.Fragment key={`${label}-${index}`}>
      {index > 0 ? ', ' : null}
      {isOpenAiProviderLabel(label) ? (
        <a
          href={SESSION_WIZARD_REQUIREMENT_LINKS.openaiApiKey}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.newSessionBannerLink}
        >
          {label}
        </a>
      ) : (
        label
      )}
    </React.Fragment>
  ));
};

type SessionWizardRequirementsBannerProps = {
  cloudflareTokenSlug?: string;
  fundingRequirementHref?: string;
  fundingRequirementLabel: string;
  newSessionRequiresLitCredential?: boolean;
  onDismiss: () => void;
  requiredAiProviderKeyLabels?: readonly string[];
  requiredRequirementIds?: readonly SessionWizardRequirementId[];
};

const SessionWizardRequirementsBanner = ({
  cloudflareTokenSlug = '',
  fundingRequirementHref = '',
  fundingRequirementLabel,
  newSessionRequiresLitCredential = true,
  onDismiss,
  requiredAiProviderKeyLabels = [],
  requiredRequirementIds,
}: SessionWizardRequirementsBannerProps): React.ReactElement => {
  const cloudflareAccountTooltipId = `cloudflare-account-requirement-${React.useId().replace(/:/g, '')}`;
  const cloudflareAccountTooltipContentId = `${cloudflareAccountTooltipId}-content`;
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
              <a
                href={SESSION_WIZARD_REQUIREMENT_LINKS.cloudflareAccount}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
              >
                Cloudflare account
              </a>
              <button
                id={cloudflareAccountTooltipId}
                type="button"
                className={`${styles.tooltipTrigger} ${styles.newSessionBannerTooltipTrigger}`}
                data-ce-control-appearance="frameless"
                aria-label="Why log in to Cloudflare before continuing?"
                aria-describedby={cloudflareAccountTooltipContentId}
              >
                <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} aria-hidden="true" />
              </button>
              <CETooltip
                id={cloudflareAccountTooltipContentId}
                placement="top"
                trigger="hover focus"
                target={cloudflareAccountTooltipId}
                className={styles.tooltipBubble}
                delay={0}
                container="body"
              >
                {CLOUDFLARE_ACCOUNT_TOOLTIP}
              </CETooltip>
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
              Create the token, then copy it into the Worker step.{' '}
              <a
                href={CLOUDFLARE_TOKEN_SETUP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newSessionBannerLink}
              >
                Token setup and security guide
              </a>
              .
            </li>
          ) : null}
          {hasResolvedRequirements && requires('sessionWorker') ? (
            <li>
              A compatible Session Worker provides the web runtime; the Ethereum registry and Arweave remain canonical.
            </li>
          ) : null}
          {requires('aiProviderKey') ? (
            <li>
              {hasResolvedRequirements ? (
                renderResolvedAiProviderKeyLabels(requiredAiProviderKeyLabels)
              ) : (
                <>
                  <a
                    href={SESSION_WIZARD_REQUIREMENT_LINKS.openaiApiKey}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.newSessionBannerLink}
                  >
                    OpenAI API Key
                  </a>
                </>
              )}{' '}
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
