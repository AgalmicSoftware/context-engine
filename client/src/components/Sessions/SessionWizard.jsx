/** @file SessionWizard.jsx */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { Button, Input, Label, FormGroup, Modal, ModalBody, ModalHeader } from 'reactstrap';
import { ReactReduxContext } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faCog, faCopy, faExclamationCircle, faExternalLinkAlt, faImage, faQuestionCircle, faRedoAlt, faSpinner, faTimes, faUpload } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import LockableFieldFrame from './LockableFieldFrame';
import BlockLimitsField from './BlockLimitsField';
import SessionHeaderField from './SessionHeaderField';
import FeaturedSbtField from './FeaturedSbtField';
import ContractsSection from './ContractsSection';
import EncryptionPanel from './EncryptionPanel';
import WorkerPanel from './WorkerPanel';
import CreateSBTGroup, { finalizeDeferredCreateSbtDraftUpload } from '../SBTs/CreateSBTGroup';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import { JsonToggleButton, JsonPanel, JsonButtonRow } from '../Shared/Json/JsonControls';
import { readCompactImageClipboard } from '../Shared/compactImageClipboard.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildSbtAccessControlConditions,
  createLitHooks,
  resolveLitChain,
  getGlobalLitHooks,
  setGlobalLitHooks,
} from '../../utilities/crypto/litProtocol.js';
import {
  createLitPayerWallet,
  deriveLitPayerAddress,
  getLitPayerWalletStatus,
} from '../../utilities/crypto/litPayerWallet.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import { resolvePublishArweaveUploadOptions } from '../../utilities/arweave/publishUploadAuth.js';
import {
  hasSponsoredBundleFields,
  isSponsoredBundleExpired,
  normalizeSparseSponsoredBundlePayload,
  readSponsoredBundleFromArweave,
  SPONSORED_BUNDLE_SUPPORTED_FIELDS,
} from '../../utilities/arweave/sponsoredBundles.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { sessionRegistryUtils, registerSessionOnChain } from '../../utilities/web3/sessionRegistry.js';
import contractScripts, {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../../utilities/web3/contractScripts.js';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import {
  DEFAULT_SESSION_SLUG,
  CLOUDFLARE_CORS_WORKER_URL,
  CLOUDFLARE_DEPLOY_HELPER_URL,
  CLOUDFLARE_WORKER_BUNDLE_URL,
  CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_CHAIN_ID,
  ENABLE_LIT_SESSION_PAYER_WALLET_INPUT,
} from '../../variables/appConfig.js';
import {
  getChainById,
  getChainBlockTimeMs,
  getDefaultHttpRpc,
  isChainWithFaucetRpcFallback,
  getSessionRegistryAddress,
  getSessionRegistryChains,
} from '../../variables/chains.js';
import {
  buildSignedAdminActionAuth,
  buildSignedBootstrapAdminAuth,
  normalizeWorkerUrl as normalizeWorkerAuthUrl,
} from '../../utilities/worker/workerAuth.js';
import { resolveSbtAddressFromFactoryReceipt } from '../../utilities/web3/sbtFactoryReceipt.js';
import {
  normalizeLitMetadataNetwork,
  normalizeSessionNaming,
} from '../../utilities/session/sessionMetadata.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import { normalizeBaseUrl, normalizeOriginList } from '../../utilities/urlUtils.js';
import {
  buildWorkerAllowOrigins,
  DEFAULT_WORKER_ALLOWED_ORIGINS,
} from '../../utilities/worker/workerCorsOrigins.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  buildSponsoredFlagFields as buildSponsoredSessionFlagFields,
  normalizeSponsoredFieldSnapshot,
  SPONSORED_FIELD_KEYS,
} from '../../utilities/session/sponsoredFlags.js';
import rpcDefaults from '../../variables/rpcDefaults.js';
import { createLogger } from '../../utilities/logging';
import { wrapEthersJsonRpcSend } from '../../utilities/web3/rpcReadCache.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  resolveSessionWizardRegistryAddress,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';
import {
  buildWorkerSecretsPayload,
  resolveWorkerSecretsSnapshot,
  syncWorkerConfigAfterPartialDeploy,
  syncWorkerSecretsAfterDeploy,
  withSecretsSyncStatus,
  withWorkerConfigSyncWarning,
} from './sessionWizardSecrets.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { upsertSbtPasswordRecoveryCodes } from '../../utilities/sbt/sbtPasswordRecoveryStore.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';
import { DEFAULT_REASONING_EFFORT } from '../../utilities/ai/aiSettings.js';
import CETooltip from '../Shared/CETooltip';
import {
  SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS,
  buildSessionWizardRegistrySessionFields,
  buildSessionWizardWorkerConfigPayload,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization.js';
import { upsertCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import {
  getDemoTemplateSeed,
  getReservedLegacySessionSlugs,
} from '../../utilities/session/sessionDemoCompat.js';
import {
  clearSponsoredBootstrapFundingContext,
  normalizeSponsoredBootstrapFundingContext,
  writeSponsoredBootstrapFundingContext,
} from '../../utilities/session/sponsoredBootstrapFunding.js';
import ContractViewer from '../ContractPage/ContractViewer';
import {
  buildContractsPageHref,
  getContractExplainer,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractRowTestId,
  getSessionWizardContractTooltipTestId,
  WIZARD_CONTRACT_MODAL_TESTID,
} from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import { normalizeRoutePath as normalizeMainSiteRoutePath } from '../MainSite/routePathHelpers.js';
import usePendingSbtDrafts, {
  clearSessionWizardPendingSbtDraftsCache,
  normalizePendingSbtDrafts,
} from './hooks/usePendingSbtDrafts.js';
import useSessionSlugState from './hooks/useSessionSlugState.js';
import {
  clearSessionWizardDraftCache,
  readSessionWizardDraftCache,
  writeSessionWizardDraftCache,
} from './sessionWizardDraftCache.js';

const { getPathRpcUrl } = rpcDefaults;
const log = createLogger('general');
export const RESERVED_SESSION_SLUGS = getReservedLegacySessionSlugs();
export const REQUIRED_SESSION_SLUG_ERROR = 'A session slug is required.';
const RESERVED_SESSION_SLUG_LIST = Array.from(RESERVED_SESSION_SLUGS)
  .map((slug) => `"${slug}"`)
  .join(', ');

const readSessionWizardTooltipsEnabled = (reduxStore) => (
  reduxStore?.getState?.()?.sessionState?.tooltipsEnabled !== false
);
export const RESERVED_SESSION_SLUG_ERROR =
  `This slug is reserved for the default session or legacy compatibility aliases (${RESERVED_SESSION_SLUG_LIST}). Please choose a different slug.`;
const SESSION_HEADER_IMAGE_MIME_TO_EXT = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
});
const LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH = '/dist/sessionCorsWorker.bundle.js';
const LOCAL_WORKER_BUNDLE_BUILD_COMMAND = 'nvm use 20 && npm run worker:bundle';
const LOCAL_WORKER_BUNDLE_GENERATE_HELP =
  `Run ${LOCAL_WORKER_BUNDLE_BUILD_COMMAND} from the repo root, then choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH}.`;
const LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP =
  `Optional fallback: ${LOCAL_WORKER_BUNDLE_GENERATE_HELP}`;
const MANUAL_BUNDLE_URL_OVERRIDE_HELP =
  'Paste a direct worker bundle URL here if the GitHub-hosted asset is temporarily unavailable.';
const LOCAL_WORKER_BUNDLE_FALLBACK_PICKER_HELP =
  `Automatic hosted bundle fetch failed. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`;
const NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE = (
  `No default hosted worker bundle URL is configured for normal mode. Provide a manual bundle URL or upload a bundle file below. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`
);
const NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE = (
  `Normal mode still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`
);
export const isMissingSessionSlug = (slug) => toStr(slug).trim() === '';
export const INVALID_SESSION_SLUG_FORMAT_ERROR =
  'Session slugs must use lowercase letters, numbers, "_" or "-".';
const VALID_SESSION_SLUG_REGEX = /^[a-z0-9_-]+$/;
export const isReservedSessionSlug = (slug) => {
  const normalized = toStr(slug).trim().toLowerCase();
  return RESERVED_SESSION_SLUGS.has(normalized);
};
export const hasInvalidSessionSlugFormat = (slug) => {
  const raw = toStr(slug).trim();
  if (!raw) return false;
  return !VALID_SESSION_SLUG_REGEX.test(raw);
};
export const getSessionSlugValidationError = (slug) => {
  if (isMissingSessionSlug(slug)) return REQUIRED_SESSION_SLUG_ERROR;
  if (hasInvalidSessionSlugFormat(slug)) return INVALID_SESSION_SLUG_FORMAT_ERROR;
  if (isReservedSessionSlug(slug)) return RESERVED_SESSION_SLUG_ERROR;
  return '';
};
const resolveSessionHeaderImageFormat = (fileLike) => {
  const fileName = toStr(fileLike?.name).trim().toLowerCase();
  const fromName = fileName.split('.').pop()?.trim() || '';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(fromName)) return fromName;
  const mime = toStr(fileLike?.type).trim().toLowerCase();
  return SESSION_HEADER_IMAGE_MIME_TO_EXT[mime] || '';
};
export const getSessionWizardSecretFieldTestId = (fieldKey) => {
  if (fieldKey === 'openaiKey') return E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY;
  if (fieldKey === 'anthropicKey') return E2E_TESTIDS.WIZARD_SECRET_ANTHROPIC_KEY;
  if (fieldKey === 'openrouterKey') return E2E_TESTIDS.WIZARD_SECRET_OPENROUTER_KEY;
  if (fieldKey === 'arweaveJwk') return E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK;
  if (fieldKey === 'faucetPrivateKey') return E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY;
  if (fieldKey === 'litPayerPrivateKey') return E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY;
  if (fieldKey === 'litPayerAddress') return E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_ADDRESS;
  return undefined;
};
export const resolveDeployWorkerState = ({
  responseWorkerUrl,
  configuredWorkerUrl,
} = {}) => {
  const resolvedDeployWorkerUrl = normalizeWorkerAuthUrl(toStr(responseWorkerUrl).trim());
  const displayWorkerUrl = resolvedDeployWorkerUrl || normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  return {
    resolvedDeployWorkerUrl,
    displayWorkerUrl,
    deployComplete: !!resolvedDeployWorkerUrl,
  };
};
const resolveSponsoredBundleBootstrapWorkerUrl = (bundle = {}) => normalizeWorkerAuthUrl(toStr(
  bundle?.bootstrapWorkerUrl ||
  bundle?.meta?.sourceWorkerUrl ||
  ''
).trim());
export const getSessionWizardNormalModeBundleUrlOverrideValidationError = (value = '') => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      return 'Manual bundle URL override must use an https:// URL.';
    }
  } catch (_) {
    return 'Manual bundle URL override must use an https:// URL.';
  }
  return '';
};
const getValidSessionWizardNormalModeBundleUrlOverride = (value = '') => (
  getSessionWizardNormalModeBundleUrlOverrideValidationError(value)
    ? ''
    : toStr(value).trim()
);
export const resolveSessionWizardBundleUrlForMode = ({
  wizardMode = 'advanced',
  bundleUrl = '',
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
} = {}) => {
  const normalizedBundleUrl = toStr(bundleUrl).trim();
  if (wizardMode !== 'normal') return normalizedBundleUrl;
  const normalizedNormalModeBundleUrlOverride = getValidSessionWizardNormalModeBundleUrlOverride(
    normalModeBundleUrlOverride
  );
  // Regression guard: normal mode promises the configured release asset, so a
  // stale advanced-mode URL must not leak into its read-only deploy path.
  return normalizedNormalModeBundleUrlOverride ||
    toStr(normalModeDefaultBundleUrl).trim();
};
export const resolveSponsoredBundleDeployReadiness = ({
  wizardMode = 'advanced',
  sponsoredBundle = {},
  deployForm = {},
  workerSecretsEnabled = true,
  missingWorkerSecrets = [],
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
} = {}) => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle);
  const hasAppliedSponsoredBundle = hasSponsoredBundleFields(normalizedBundle);
  const workerName = toStr(deployForm?.workerName || '').trim();
  const bundleUrl = resolveSessionWizardBundleUrlForMode({
    wizardMode,
    bundleUrl: deployForm?.bundleUrl,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
  const hasWorkerBundleSource = !!bundleUrl || !!hasBundleFile;
  const bootstrapWorkerUrl = resolveSponsoredBundleBootstrapWorkerUrl(normalizedBundle);
  const deployGrantToken = toStr(normalizedBundle?.deployGrantToken || '').trim();
  const normalizedMissingWorkerSecrets = Array.isArray(missingWorkerSecrets)
    ? missingWorkerSecrets.map((value) => toStr(value).trim()).filter(Boolean)
    : [];
  const missing = [];
  if (!hasAppliedSponsoredBundle) missing.push('Sponsored bundle');
  if (!workerSecretsEnabled) missing.push('Worker secrets mode');
  if (!workerName) missing.push('Worker name');
  if (!hasWorkerBundleSource) missing.push('Worker bundle URL');
  if (!deployGrantToken) missing.push('Deploy grant token');
  if (!bootstrapWorkerUrl) missing.push('Bootstrap worker URL');
  missing.push(...normalizedMissingWorkerSecrets);
  return {
    active: hasAppliedSponsoredBundle,
    ready: hasAppliedSponsoredBundle && missing.length === 0,
    missing,
  };
};
const buildSponsoredBundleAppliedStatusMessage = (sponsoredBundle = {}) => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle);
  const appliedLabels = [];
  if (toStr(normalizedBundle?.openaiKey).trim()) appliedLabels.push('OpenAI key');
  if (toStr(normalizedBundle?.anthropicKey).trim()) appliedLabels.push('Anthropic key');
  if (toStr(normalizedBundle?.openrouterKey).trim()) appliedLabels.push('OpenRouter key');
  if (toStr(normalizedBundle?.arweaveJwk).trim()) appliedLabels.push('Arweave wallet');
  if (
    toStr(normalizedBundle?.faucetPrivateKey).trim() ||
    toStr(normalizedBundle?.faucetGrantToken).trim()
  ) {
    appliedLabels.push('faucet funding');
  }
  if (toStr(normalizedBundle?.customRpcUrl).trim()) appliedLabels.push('RPC URL');
  if (
    toStr(normalizedBundle?.litPayerPrivateKey).trim() ||
    toStr(normalizedBundle?.litPayerAddress).trim()
  ) {
    appliedLabels.push('Lit payer wallet');
  }
  if (toStr(normalizedBundle?.deployGrantToken).trim()) appliedLabels.push('deploy access');
  return appliedLabels.length
    ? `Sponsored resources applied: ${appliedLabels.join(', ')}.`
    : 'Sponsored resources applied.';
};
const resolveSponsoredBundleAdvancedFieldNotices = ({
  sponsoredBundle = {},
  workerSecrets = {},
  deployForm = {},
} = {}) => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle);
  const sponsoredFaucetPrivateKey = toStr(normalizedBundle?.faucetPrivateKey || '').trim();
  const sponsoredFaucetGrantToken = toStr(normalizedBundle?.faucetGrantToken || '').trim();
  const currentFaucetPrivateKey = toStr(workerSecrets?.faucetPrivateKey || '').trim();
  return {
    showSponsoredFaucetNotice: (
      !!(sponsoredFaucetPrivateKey || sponsoredFaucetGrantToken) &&
      (sponsoredFaucetPrivateKey
        ? currentFaucetPrivateKey === sponsoredFaucetPrivateKey
        : !currentFaucetPrivateKey)
    ),
    showSponsoredDeployAccessNotice: (
      !!toStr(normalizedBundle?.deployGrantToken || '').trim() &&
      !toStr(deployForm?.apiToken || '').trim()
    ),
  };
};
// Normal-mode `/new` should stay bring-your-own-worker until the dedicated
// shared hosted worker product is implemented.
const NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED = false;
const looksLikeHtmlDocument = (value = '') => {
  const preview = toStr(value).trim().slice(0, 256).toLowerCase();
  return (
    preview.startsWith('<!doctype html') ||
    preview.startsWith('<html') ||
    preview.includes('<head') ||
    preview.includes('<body')
  );
};
const looksLikeWorkerBundleText = (value = '') => {
  const normalized = toStr(value).trim();
  if (!normalized) return false;
  return (
    normalized.includes('fetch(') && (
      normalized.includes('export default') ||
      normalized.includes('export {') ||
      normalized.includes(' as default')
    )
  );
};
const looksLikeWrappedWorkerBundleStringModule = (value = '') => {
  const normalized = toStr(value).trim();
  if (!normalized) return false;
  return (
    /^export\s+default\s+["'`]/.test(normalized) ||
    /^module\.exports\s*=\s*["'`]/.test(normalized)
  );
};
const readSessionWizardBundleFileText = async (
  bundleFile,
  emptyError = `Selected worker bundle file was empty. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
) => {
  const rawBundleText = toStr(bundleFile ? await bundleFile.text() : '');
  const normalizedBundleText = rawBundleText.trim();
  if (!normalizedBundleText) {
    throw new Error(emptyError);
  }
  if (looksLikeHtmlDocument(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file resolved to HTML instead of a worker script. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );
  }
  if (looksLikeWrappedWorkerBundleStringModule(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file resolved to a JavaScript string wrapper instead of raw worker bytes. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );
  }
  if (!looksLikeWorkerBundleText(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file is missing the expected worker module export. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );
  }
  return rawBundleText;
};
export const resolveSessionWizardDeployBundleMode = ({
  wizardMode = 'normal',
  bundleMode = 'upload',
  bundleUrl = '',
  sponsoredAutoDeployReady = false,
  forceSponsoredAutoDeploy = false,
  forceManualBundleFile = false,
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
} = {}) => {
  const hasHostedNormalModeBundleUrl = !!toStr(normalModeDefaultBundleUrl).trim();
  const hasResolvedNormalModeBundleUrl = !!resolveSessionWizardBundleUrlForMode({
    wizardMode: 'normal',
    bundleUrl,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
  return (
    (wizardMode === 'normal' && hasBundleFile && (forceManualBundleFile || !hasHostedNormalModeBundleUrl))
      ? 'upload'
    : (wizardMode === 'normal' && forceSponsoredAutoDeploy)
      ? 'url'
      : (wizardMode === 'normal' && sponsoredAutoDeployReady)
      ? 'url'
      : (wizardMode === 'normal')
        ? (hasResolvedNormalModeBundleUrl ? 'url' : 'upload')
        : bundleMode
  );
};
export const resolveSessionWizardShouldAutoDeployWorker = ({
  workerMode = 'default',
  sponsoredAutoDeployReady = false,
  deployComplete = false,
} = {}) => (
  toStr(workerMode).trim() !== 'default' &&
  sponsoredAutoDeployReady &&
  !deployComplete
);
export const resolveSessionWizardDeployBundlePayload = async ({
  effectiveBundleMode = 'upload',
  bundleFile = null,
  bundleUrl = '',
} = {}) => {
  if (effectiveBundleMode === 'upload') {
    const bundleText = bundleFile
      ? await readSessionWizardBundleFileText(bundleFile, 'Selected worker bundle file was empty.')
      : '';
    return {
      bundleText,
      bundleUrl: undefined,
      bundleSource: bundleText ? 'upload' : 'upload-missing',
    };
  }

  const normalizedBundleUrl = toStr(bundleUrl).trim() || undefined;
  return {
    bundleText: '',
    bundleUrl: normalizedBundleUrl,
    bundleSource: normalizedBundleUrl ? 'url' : 'url-missing',
  };
};
export const buildSessionWizardPublishPlan = ({
  shouldAutoDeployWorker = false,
  hasPendingDrafts = false,
  hasManualMetadata = false,
} = {}) => {
  const steps = [];
  if (shouldAutoDeployWorker) steps.push('deploy-worker');
  if (hasPendingDrafts) steps.push('deploy-sbts');
  if (!hasManualMetadata) steps.push('upload-metadata');
  steps.push('register-session');
  steps.push('done');
  return steps;
};
export const buildSessionWizardPublishStepNumbers = (options = {}) => (
  buildSessionWizardPublishPlan(options).reduce((acc, stepKey, index) => {
    acc[stepKey] = index + 1;
    return acc;
  }, {})
);
export const getSessionWizardPublishProgressPercent = ({
  publishStep = 0,
  publishBusy = false,
  totalSteps = 0,
  elapsedMs = 0,
} = {}) => {
  const steps = Math.max(0, Number(totalSteps || 0));
  const currentStep = Math.max(0, Number(publishStep || 0));
  if (!steps || currentStep <= 0) return 0;
  const clampedStep = Math.min(currentStep, steps);
  const stepSize = 100 / steps;
  if (!publishBusy) {
    return Math.min(100, Math.max(0, clampedStep * stepSize));
  }
  const base = Math.max(0, (clampedStep - 1) * stepSize);
  const cap = clampedStep >= steps ? 100 : base + (stepSize * 0.82);
  const durationMs = 2600;
  const ratio = Math.max(0, Math.min(1, Number(elapsedMs || 0) / durationMs));
  const eased = 1 - Math.pow(1 - ratio, 2);
  return Math.min(99, Math.max(base + (stepSize * 0.18), base + ((cap - base) * eased)));
};
export const resolveSessionWizardWorkerBaseUrl = ({
  configuredWorkerUrl = '',
  deployWorkerUrl = '',
  fallbackWorkerUrl = '',
  workerMode = 'default',
} = {}) => {
  const configured = normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  if (configured) return configured;
  const deployed = normalizeWorkerAuthUrl(toStr(deployWorkerUrl).trim());
  if (deployed) return deployed;
  return toStr(workerMode).trim().toLowerCase() === 'default'
    ? normalizeWorkerAuthUrl(toStr(fallbackWorkerUrl).trim())
    : '';
};
export const resolveSessionWizardWorkerVerificationUiState = ({
  configuredWorkerUrl = '',
  deployWorkerUrl = '',
  defaultWorkerUrl = '',
  deployComplete = false,
  normalModeRequiresCustomWorker = false,
} = {}) => {
  const configured = normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  const deployed = normalizeWorkerAuthUrl(toStr(deployWorkerUrl).trim());
  const fallback = normalizeWorkerAuthUrl(toStr(defaultWorkerUrl).trim());
  const deployVerifiedInUi = !!deployComplete;
  const effectiveConfiguredWorkerUrl = (
    deployVerifiedInUi &&
    !!normalModeRequiresCustomWorker &&
    !!deployed &&
    (!configured || (configured && fallback && configured === fallback))
  ) ? deployed : configured;
  return {
    deployVerifiedInUi,
    effectiveConfiguredWorkerUrl,
  };
};
export const shouldCacheSessionWorkerConfigAfterDeploy = ({
  deployStatusCode,
  configSyncStatus,
  workerUrl,
} = {}) => (
  !!normalizeWorkerAuthUrl(toStr(workerUrl).trim()) && (
    Number(deployStatusCode || 0) === 200 ||
    configSyncStatus?.synced === true
  )
);
export const cacheSessionWorkerConfigAfterDeploy = ({
  deployStatusCode,
  configSyncStatus,
  workerUrl,
  slug,
  sessionIdHex,
  registryChainId,
  config,
} = {}) => {
  if (!shouldCacheSessionWorkerConfigAfterDeploy({
    deployStatusCode,
    configSyncStatus,
    workerUrl,
  })) {
    return false;
  }
  upsertCachedSessionWorkerConfig({
    slug,
    sessionIdHex,
    registryChainId,
    config,
  });
  return true;
};
const getDefaultWorkerUrl = () => (
  toStr(CLOUDFLARE_CORS_WORKER_URL).trim()
);
const isDefaultWorkerPlaceholderUrl = (workerUrl, fallbackWorkerUrl = getDefaultWorkerUrl()) => {
  const normalizedWorkerUrl = normalizeWorkerAuthUrl(toStr(workerUrl).trim());
  const normalizedFallbackUrl = normalizeWorkerAuthUrl(toStr(fallbackWorkerUrl).trim());
  return !!normalizedWorkerUrl && !!normalizedFallbackUrl && normalizedWorkerUrl === normalizedFallbackUrl;
};
const getCurrentOrigin = () => (
  typeof window !== 'undefined' && window.location
    ? toStr(window.location.origin).trim()
    : ''
);
export const buildSessionWizardDefaultAllowedOrigins = (currentOrigin = getCurrentOrigin()) => (
  buildWorkerAllowOrigins({
    currentOrigin,
    extraOrigins: DEFAULT_WORKER_ALLOWED_ORIGINS,
  })
);
const buildDeployHelperCorsMessage = (helperBase, detail = '') => {
  const origin = getCurrentOrigin() || '<current-origin>';
  const helper = toStr(helperBase).trim() || 'deploy-helper';
  const suffix = detail ? ` (${detail})` : '';
  return `Deploy-helper rejected browser origin ${origin}${suffix}. Add this origin to the deploy-helper allowlist at ${helper} and retry.`;
};
const buildDeployHelperWorkersDevStatusMessage = (deployResponse = {}) => {
  const response = deployResponse && typeof deployResponse === 'object' ? deployResponse : {};
  const subdomain = toStr(response?.subdomain).trim();
  const subdomainStatus = toStr(response?.subdomainStatus).trim();
  const subdomainError = toStr(response?.subdomainError).trim();
  const scriptSubdomainError = toStr(response?.scriptSubdomainError).trim();
  const hasAccountSignal = (
    subdomain ||
    subdomainStatus ||
    subdomainError ||
    Object.prototype.hasOwnProperty.call(response, 'subdomainEnabled')
  );
  const hasScriptSignal = (
    scriptSubdomainError ||
    Object.prototype.hasOwnProperty.call(response, 'scriptSubdomainEnabled')
  );
  if (!hasAccountSignal && !hasScriptSignal) return '';

  let accountSummary = '';
  if (subdomainError) {
    accountSummary = subdomain
      ? `account issue (${subdomain}): ${subdomainError}`
      : `account issue: ${subdomainError}`;
  } else if (subdomainStatus) {
    accountSummary = subdomain
      ? `account ${subdomainStatus} (${subdomain})`
      : `account ${subdomainStatus}`;
  } else if (subdomain) {
    accountSummary = `account ready (${subdomain})`;
  }

  let scriptSummary = '';
  if (scriptSubdomainError) {
    scriptSummary = `script issue: ${scriptSubdomainError}`;
  } else if (response?.scriptSubdomainEnabled === true) {
    scriptSummary = 'script enabled';
  } else if (
    Object.prototype.hasOwnProperty.call(response, 'scriptSubdomainEnabled') &&
    (subdomain || toStr(response?.workerUrl).trim())
  ) {
    scriptSummary = 'script not confirmed';
  }

  const summary = [accountSummary, scriptSummary].filter(Boolean).join('; ');
  return summary ? `workers.dev status: ${summary}.` : '';
};
const withDeployHelperWorkersDevStatus = (message = '', deployResponse = {}) => {
  const base = toStr(message).trim();
  const workersDevStatus = buildDeployHelperWorkersDevStatusMessage(deployResponse);
  if (!workersDevStatus) return base;
  return base ? `${base} ${workersDevStatus}` : workersDevStatus;
};
const formatDeployBundleDiagnostics = (bundleDiagnostics = {}) => {
  const sha256 = toStr(bundleDiagnostics?.sha256).trim();
  const parts = [
    `source=${toStr(bundleDiagnostics?.source).trim() || 'unknown'}`,
    `len=${Number(bundleDiagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : 'n/a'}`,
    `export=${bundleDiagnostics?.hasAnyExport === true ? '1' : '0'}`,
    `default=${bundleDiagnostics?.hasExportDefault === true ? '1' : '0'}`,
    `namedDefault=${bundleDiagnostics?.hasNamedDefaultExport === true ? '1' : '0'}`,
    `fetch=${bundleDiagnostics?.hasFetchHandler === true ? '1' : '0'}`,
    `swFetch=${bundleDiagnostics?.hasServiceWorkerFetch === true ? '1' : '0'}`,
  ];
  return parts.join(' ');
};
const CLOUDFLARE_MISSING_HANDLER_ERROR = 'no registered event handlers';
const DEPLOY_HELPER_BUNDLE_FETCH_ERROR = 'failed to fetch bundle';
const SPONSORED_MANUAL_BUNDLE_RETRY_MESSAGE = (
  `Sponsored publish still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`
);
const hasSessionWizardBundleDiagnostics = (bundleDiagnostics = null) => (
  !!bundleDiagnostics &&
  typeof bundleDiagnostics === 'object' &&
  Object.keys(bundleDiagnostics).length > 0
);
const isSessionWizardRemoteBundleUrlFetchFailure = ({
  err,
  effectiveBundleMode = 'upload',
} = {}) => {
  if (effectiveBundleMode !== 'url') {
    return false;
  }
  const combined = `${toStr(err?.message).trim()} ${toStr(err?.responseError).trim()}`.toLowerCase();
  return combined.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR);
};
const isSessionWizardRemoteBundleUrlMissingHandlerFailure = ({
  err,
  effectiveBundleMode = 'upload',
} = {}) => {
  if (effectiveBundleMode !== 'url') {
    return false;
  }
  const combined = `${toStr(err?.message).trim()} ${toStr(err?.responseError).trim()}`.toLowerCase();
  return combined.includes(CLOUDFLARE_MISSING_HANDLER_ERROR) &&
    hasSessionWizardBundleDiagnostics(err?.responseBundleDiagnostics);
};
export const shouldForceSessionWizardNormalModeManualBundleRetry = ({
  err,
  wizardMode = 'normal',
  effectiveBundleMode = 'upload',
  hasBundleFile = false,
} = {}) => (
  wizardMode === 'normal' &&
  !hasBundleFile &&
  (
    isSessionWizardRemoteBundleUrlFetchFailure({
      err,
      effectiveBundleMode,
    }) ||
    isSessionWizardRemoteBundleUrlMissingHandlerFailure({
      err,
      effectiveBundleMode,
    })
  )
);
export const resolveSessionWizardSponsoredAutoDeployReadiness = ({
  wizardMode = 'advanced',
  sponsoredBundle = {},
  deployForm = {},
  workerSecretsEnabled = true,
  currentWorkerSecrets = {},
  getMissingWorkerSecretsForDeploy = () => [],
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
} = {}) => {
  const resolveMissingWorkerSecrets = (
    typeof getMissingWorkerSecretsForDeploy === 'function'
      ? getMissingWorkerSecretsForDeploy
      : () => []
  );
  return resolveSponsoredBundleDeployReadiness({
    wizardMode,
    sponsoredBundle,
    deployForm,
    workerSecretsEnabled,
    missingWorkerSecrets: workerSecretsEnabled
      ? resolveMissingWorkerSecrets(currentWorkerSecrets)
      : [],
    hasBundleFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
};
const normalizeDeployErrorMessage = ({ err, helperBase } = {}) => {
  const raw = toStr(err?.message).trim();
  const lowered = raw.toLowerCase();
  const statusCode = Number(err?.statusCode || 0);
  const responseError = toStr(err?.responseError).trim();
  const responseLower = responseError.toLowerCase();
  const bundleDiagnostics = err?.responseBundleDiagnostics;
  const diagnosticsSummary = bundleDiagnostics ? formatDeployBundleDiagnostics(bundleDiagnostics) : '';

  if ((statusCode === 403 && responseLower.includes('origin')) || responseLower.includes('origin not allowed')) {
    return buildDeployHelperCorsMessage(helperBase, responseError || 'Origin not allowed');
  }
  if (lowered.includes('origin not allowed')) {
    return buildDeployHelperCorsMessage(helperBase, raw);
  }
  if (lowered.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR) || responseLower.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR)) {
    return raw || responseError;
  }
  if (lowered.includes('failed to fetch') || lowered.includes('networkerror')) {
    const helper = toStr(helperBase).trim() || 'deploy-helper';
    const origin = getCurrentOrigin() || '<current-origin>';
    return `Deploy request could not reach ${helper}. This is usually CORS or helper availability; ensure ${origin} is allowed and retry.`;
  }
  if ((lowered.includes(CLOUDFLARE_MISSING_HANDLER_ERROR) || responseLower.includes(CLOUDFLARE_MISSING_HANDLER_ERROR)) && diagnosticsSummary) {
    const base = raw || responseError || 'Worker deploy failed.';
    return `${base} Bundle diagnostics: ${diagnosticsSummary}`;
  }
  if (raw) return raw;
  if (statusCode > 0) return `Worker deploy failed (${statusCode}).`;
  return 'Worker deploy failed.';
};
const DEV_PERSIST_WORKER_SECRETS = process.env.NODE_ENV !== 'production';
const DEFAULT_RPC_FALLBACKS = {
  [DEFAULT_CHAIN_ID]: getDefaultHttpRpc(DEFAULT_CHAIN_ID, { allowPath: false }) || '',
};
export const resolveFallbackRpcUrl = (chainId) => {
  const resolvedChainId = Number(chainId || 0) || 0;
  if (!resolvedChainId) {
    return DEFAULT_RPC_FALLBACKS[DEFAULT_CHAIN_ID] || '';
  }
  return (
    DEFAULT_RPC_FALLBACKS[resolvedChainId] ||
    getDefaultHttpRpc(resolvedChainId, { allowPath: false }) ||
    getPathRpcUrl(resolvedChainId) ||
    ''
  );
};
const normalizeRpcUrlList = (value) => {
  if (Array.isArray(value)) {
    return value.map((url) => toStr(url).trim()).filter(Boolean);
  }
  const str = toStr(value).trim();
  return str ? [str] : [];
};
const mergeRpcUrlLists = (...lists) => {
  const seen = new Set();
  const merged = [];
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((url) => {
      const trimmed = toStr(url).trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      merged.push(trimmed);
    });
  });
  return merged;
};
const getDefaultWorkerRpcUrlsForChain = (chainId) => {
  if (!chainId) return [];
  const pathDefault = normalizeRpcUrlList(getPathRpcUrl(chainId));
  const fallbackDefault = normalizeRpcUrlList(resolveFallbackRpcUrl(chainId));
  return isChainWithFaucetRpcFallback(chainId)
    ? mergeRpcUrlLists(fallbackDefault, pathDefault)
    : mergeRpcUrlLists(pathDefault, fallbackDefault);
};
export const buildSessionWizardWorkerRpcUrlMap = ({ chainId, pathProvider } = {}) => {
  const provider = pathProvider && typeof pathProvider === 'object' ? pathProvider : {};
  const rawMap = provider.rpcUrlsByChainId;
  const normalized = {};
  if (rawMap && typeof rawMap === 'object') {
    Object.entries(rawMap).forEach(([key, value]) => {
      const list = normalizeRpcUrlList(value);
      if (list.length) normalized[key] = list;
    });
  }
  const resolvedChainId = Number(chainId || 0) || null;
  if (!resolvedChainId) return normalized;
  const configured = mergeRpcUrlLists(
    normalizeRpcUrlList(normalized[resolvedChainId] || normalized[String(resolvedChainId)]),
    normalizeRpcUrlList(provider.rpcUrl),
  );
  const defaults = getDefaultWorkerRpcUrlsForChain(resolvedChainId);
  const merged = configured.length
    ? mergeRpcUrlLists(configured, defaults)
    : defaults;
  if (merged.length) {
    normalized[String(resolvedChainId)] = merged;
  }
  return normalized;
};
export const resolveSessionWizardWorkerRpcUrl = ({ chainId, pathProvider, faucetRpcUrl } = {}) => {
  const resolvedChainId = Number(chainId || 0) || null;
  const map = buildSessionWizardWorkerRpcUrlMap({ chainId: resolvedChainId, pathProvider });
  const byChain = resolvedChainId ? (map[resolvedChainId] || map[String(resolvedChainId)]) : '';
  const ordered = mergeRpcUrlLists(
    normalizeRpcUrlList(byChain),
    normalizeRpcUrlList(pathProvider?.rpcUrl),
    normalizeRpcUrlList(faucetRpcUrl),
  );
  return ordered[0] || '';
};
export const getSessionWizardWorkerDeployValidationError = ({
  registryAddress,
  registryChainId,
  networkChainId,
  pathProvider,
  faucetRpcUrl,
} = {}) => {
  const chainId = Number(registryChainId || networkChainId || 0) || 0;
  if (!toStr(registryAddress).trim()) {
    return 'Registry address is required before deploying a worker.';
  }
  const rpcUrl = resolveSessionWizardWorkerRpcUrl({
    chainId,
    pathProvider,
    faucetRpcUrl,
  });
  if (!rpcUrl) {
    return chainId
      ? `RPC URL is required for chain ${chainId} before deploying a worker.`
      : 'RPC URL is required before deploying a worker.';
  }
  return '';
};
const normalizeAiProvider = (value, fallback = 'openai') => {
  const lowered = toStr(value).trim().toLowerCase();
  return lowered || fallback;
};
const normalizeAiModelEntry = (entry, fallbackModel, fallbackProvider) => {
  if (entry && typeof entry === 'object') {
    const model = toStr(entry.model || entry.name || entry.value || fallbackModel).trim();
    const provider = normalizeAiProvider(entry.provider, fallbackProvider);
    return { model: model || fallbackModel || '', provider };
  }
  const model = toStr(entry || fallbackModel).trim();
  return { model: model || fallbackModel || '', provider: normalizeAiProvider(fallbackProvider) };
};
const normalizeAiTranscriptionEntry = (entry) => {
  const obj = entry && typeof entry === 'object' ? entry : {};
  return {
    provider: normalizeAiProvider(obj.provider || 'openai'),
    model: toStr(obj.model || 'whisper-1').trim(),
    rpcUrl: toStr(obj.rpcUrl || '').trim(),
  };
};
const normalizeAiModels = (raw, fallbackProvider, transcriptionRaw) => {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const transcriptionSource = transcriptionRaw && typeof transcriptionRaw === 'object'
    ? transcriptionRaw
    : obj.transcription;
  return {
    fast: normalizeAiModelEntry(obj.fast || obj.default, DEFAULT_AI_MODELS.fast, fallbackProvider),
    thinking: normalizeAiModelEntry(obj.thinking || obj.reasoning, DEFAULT_AI_MODELS.thinking, fallbackProvider),
    transcription: normalizeAiTranscriptionEntry(transcriptionSource),
  };
};
const DEFAULT_AI_MODELS = Object.freeze({
  fast: 'gpt-5',
  thinking: 'gpt-5',
});
const DEFAULT_NEW_SESSION_SBT_TAGS = 'group, event, idea, demographic, location';
const resolveAutoFeatureBySessionSlug = (metadata) => (
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags
);
const METADATA_FIELD_ORDER = [
  'networkChainId',
  'sessionId',
  'sessionIdHex',
  'slug',
  'sessionName',
  'sessionInfo',
  'sessionHeaderImg',
  'corsWorkerUrl',
  'defaultTags',
  'questionsGenPrompt',
  'defaultSbtTags',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'ignored_SBTs_LIST',
  'featured_SBTs_LIST',
  'contracts',
  'blockLimits',
  'faucet',
  'ai',
  'sponsored',
  'lit',
  'litCredentials',
  'perMemberSpendLimits',
  'encryption',
  'encryptedFields',
  'encryptedFieldGates',
  'sessionInfoEncrypted',
  'fieldEditors',
];
const MORE_OPTIONS_FIELDS = new Set([
  'defaultTags',
  'defaultSbtTags',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'questionsGenPrompt',
  'defaultFilterState',
  'sponsoredSbtAddress',
]);
const WORKER_ONLY_DRAFT_FIELDS = new Set([
  'embeddedDeployHelperEnabled',
]);
const CONTRACT_LABELS = {
  surveys: 'Surveys',
  sbtFactory: `${t('sbt')} Factory`,
  sessionRegistry: 'Session Registry',
};

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  let bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    try {
      bytes = ethers.utils.randomBytes(16);
    } catch (_) {
      log.warn('[SessionWizard] crypto.getRandomValues unavailable; using Math.random fallback for session ID');
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  }
  // RFC 4122 version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return sessionRegistryUtils.formatSessionId(`0x${hex}`) || '';
};

const getChainName = (value) => {
  const id = Number(value || 0);
  if (!id) return '';
  const chain = getChainById(id);
  return chain?.name || '';
};

const formatContractLabel = (key) => {
  if (CONTRACT_LABELS[key]) return CONTRACT_LABELS[key];
  if (!key) return '';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const normalizeSbtSelection = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          const address = entry.trim();
          if (!address) return null;
          return { address, name: address };
        }
        if (typeof entry === 'object') {
          const address = toStr(entry.address || entry.sbtAddress || entry.value).trim();
          if (!address) return null;
          return { ...entry, address, name: entry.name || entry.label || address };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[\n,]+/)
      .map((addr) => addr.trim())
      .filter(Boolean)
      .map((addr) => ({ address: addr, name: addr }));
  }
  return [];
};

const serializeDefaultFeaturedSbtSelections = (value = []) => {
  const seen = new Set();
  // Keep pending featured selections marked in the cached draft so a refresh can
  // safely re-bind or prune undeployed placeholder addresses without persisting
  // the full pending draft secrets to localStorage.
  return normalizeSbtSelection(value)
    .map((entry) => {
      const address = toStr(entry?.address).trim();
      if (!address) return null;
      const lower = address.toLowerCase();
      if (seen.has(lower)) return null;
      seen.add(lower);
      if (entry?.pending === true) {
        return {
          address,
          name: toStr(entry?.name || entry?.label || address).trim() || address,
          pending: true,
        };
      }
      return address;
    })
    .filter(Boolean);
};

const dedupeSbtSelection = (value = []) => {
  const seen = new Set();
  return normalizeSbtSelection(value).filter((entry) => {
    const address = toStr(entry?.address).trim();
    if (!address) return false;
    const lower = address.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
};

const buildPendingSbtSelection = (draftEntry = {}) => {
  const address = toStr(draftEntry?.predictedAddress || draftEntry?.address).trim();
  if (!address) return null;
  const displayName = toStr(draftEntry?.displayName || draftEntry?.name || address).trim() || address;
  return {
    address,
    name: `${displayName} (Pending)`,
    pending: true,
    metadataPreview: draftEntry?.metadataPreview || null,
  };
};

const buildDeployedSbtSelection = (draftEntry = {}) => {
  const address = toStr(draftEntry?.deployedAddress || draftEntry?.predictedAddress || draftEntry?.address).trim();
  if (!address) return null;
  const displayName = toStr(draftEntry?.displayName || draftEntry?.name || address).trim() || address;
  return {
    address,
    name: displayName,
    metadataPreview: draftEntry?.metadataPreview || null,
  };
};

export const promotePendingSbtSelectionsAfterDeploy = ({ selections = [], deployedDrafts = [] } = {}) => {
  const promotedByAddress = new Map();
  normalizePendingSbtDrafts(deployedDrafts).forEach((draftEntry) => {
    const selection = buildDeployedSbtSelection(draftEntry);
    const addressLower = toStr(selection?.address).trim().toLowerCase();
    if (!addressLower || !selection) return;
    promotedByAddress.set(addressLower, selection);
  });
  if (!promotedByAddress.size) {
    return dedupeSbtSelection(normalizeSbtSelection(selections));
  }
  return dedupeSbtSelection(normalizeSbtSelection(selections).map((entry) => {
    const addressLower = toStr(entry?.address).trim().toLowerCase();
    if (!addressLower || entry?.pending !== true) return entry;
    return promotedByAddress.get(addressLower) || entry;
  }));
};

const FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID = 'gate-1';
const FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE = 'defaultFeaturedSBTs';

const normalizeFeaturedDraftGateAutoLink = (value = null) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const address = toStr(value?.address).trim();
  if (!address || !ethers.utils.isAddress(address)) return null;
  return {
    gateId: toStr(value?.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
    address,
    dismissed: value?.dismissed === true,
    source: toStr(value?.source).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
  };
};

const buildPendingSbtDeployContextSignature = (sessionLike = {}, fallbackChainId = null) => {
  // PRD 422 tracks stronger invalidation and slug-finalization rules for linked pending SBT drafts.
  const chainId = Number(
    sessionLike?.networkChainId ||
    sessionLike?.contracts?.sbtFactory?.chainId ||
    fallbackChainId ||
    0
  ) || 0;
  const sbtFactoryAddress = toStr(
    sessionLike?.contracts?.sbtFactory?.address ||
    sessionLike?.sbtFactoryAddress ||
    ''
  ).trim().toLowerCase();
  return `${chainId}|${sbtFactoryAddress}`;
};

const buildSponsoredSbtLookupContextKey = ({
  address = '',
  slug = '',
  sessionName = '',
  networkChainId = null,
  contracts = {},
  registry = {},
} = {}) => {
  const payload = {
    address: toStr(address).trim().toLowerCase(),
    slug: toStr(slug).trim(),
    sessionName: toStr(sessionName).trim(),
    networkChainId: Number(networkChainId || 0) || 0,
    contracts: contracts && typeof contracts === 'object' ? contracts : {},
    registry: registry && typeof registry === 'object' ? registry : {},
  };
  try {
    return JSON.stringify(payload);
  } catch (_) {
    return [
      payload.address,
      payload.slug,
      payload.sessionName,
      payload.networkChainId,
    ].join('|');
  }
};

const normalizeStableObjectValue = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const getStableObjectSignature = (value = {}) => {
  try {
    return JSON.stringify(normalizeStableObjectValue(value));
  } catch (_) {
    return '';
  }
};

const useStableSerializedObject = (value) => {
  const normalizedValue = normalizeStableObjectValue(value);
  const signature = getStableObjectSignature(normalizedValue);
  const stableRef = useRef({ signature, value: normalizedValue });
  if (stableRef.current.signature !== signature) {
    stableRef.current = { signature, value: normalizedValue };
  }
  return stableRef.current.value;
};

export const finalizeSessionWizardPendingSbtDraft = async ({
  draftEntry = {},
  workerUrlOverride = '',
  createSbtComponentProps = {},
  finalizeDeferredDraftUpload = finalizeDeferredCreateSbtDraftUpload,
} = {}) => {
  const existingTokenUri = toStr(draftEntry?.tokenURI).trim();
  if (existingTokenUri) {
    return {
      ...draftEntry,
      tokenURI: existingTokenUri,
      metadataUploadStatus: 'ready',
    };
  }

  const displayName = toStr(draftEntry?.displayName || draftEntry?.predictedAddress || 'pending SBT').trim();
  const authoringPayload = draftEntry?.authoringPayload;
  if (!authoringPayload || typeof authoringPayload !== 'object') {
    throw new Error(`Pending SBT draft ${displayName} is missing authoring data required for publish-time upload.`);
  }

  const existingSessionConfig = (
    createSbtComponentProps?.sessionConfigOverride &&
    typeof createSbtComponentProps.sessionConfigOverride === 'object'
  ) ? createSbtComponentProps.sessionConfigOverride : {};
  const effectiveWorkerUrl = normalizeWorkerAuthUrl(
    toStr(workerUrlOverride || existingSessionConfig?.corsWorkerUrl).trim()
  );
  const finalizedUpload = await finalizeDeferredDraftUpload({
    authoringPayload,
    componentProps: {
      ...createSbtComponentProps,
      sessionConfigOverride: {
        ...existingSessionConfig,
        ...(effectiveWorkerUrl ? { corsWorkerUrl: effectiveWorkerUrl } : {}),
      },
    },
  });
  const finalizedTokenUri = toStr(finalizedUpload?.tokenURI).trim();
  if (!finalizedTokenUri) {
    throw new Error(`Pending SBT draft ${displayName} could not finalize its metadata upload.`);
  }

  return {
    ...draftEntry,
    tokenURI: finalizedTokenUri,
    metadataUploadStatus: 'ready',
    metadataPreview: finalizedUpload?.metadataPreview || draftEntry?.metadataPreview || null,
    authoringPayload: finalizedUpload?.authoringPayload || draftEntry?.authoringPayload,
  };
};

export const deploySessionWizardPendingSbtDraft = async ({
  sbtDraft = {},
  providerLike,
  sessionConfigForDeploy = {},
  workerUrlOverride = '',
  createSbtComponentProps = {},
  finalizePendingDraft = finalizeSessionWizardPendingSbtDraft,
  createSBT = contractScripts.createSBT,
} = {}) => {
  const finalizedDraft = await finalizePendingDraft({
    draftEntry: sbtDraft,
    workerUrlOverride,
    createSbtComponentProps,
  });
  const receipt = await createSBT(
    providerLike,
    finalizedDraft.contractName,
    finalizedDraft.symbol,
    Number(finalizedDraft.limitedNumber || 0) || 0,
    finalizedDraft.adminAddress,
    Number(finalizedDraft.mintingEndTimeUnix || 0) || 0,
    finalizedDraft.hasPasswordMintOnChain === true,
    Number(finalizedDraft.burnAuthEnum || 0),
    Array.isArray(finalizedDraft.hashedPasswords) ? finalizedDraft.hashedPasswords : [],
    toStr(finalizedDraft.tokenURI).trim(),
    toStr(finalizedDraft.finalGroupPasswordHash).trim() || ethers.constants.HashZero,
    sessionConfigForDeploy,
    toStr(finalizedDraft.create2Salt).trim(),
    finalizedDraft.createOptions || {}
  );

  return {
    finalizedDraft,
    receipt,
  };
};

export const persistSessionWizardSbtRecoveryCodes = ({
  finalizedDraft = {},
  sbtAddress = '',
  sessionConfigForDeploy = {},
  writeRecoveryCodes = upsertSbtPasswordRecoveryCodes,
} = {}) => {
  const codesToStore = finalizedDraft.usesInviteCodes
    ? [toStr(finalizedDraft.groupPassword).trim()].filter(Boolean)
    : (Array.isArray(finalizedDraft.passwordList) ? finalizedDraft.passwordList : [])
      .filter((value) => toStr(value).trim());

  if (finalizedDraft.hasPasswordMintOnChain !== true || codesToStore.length === 0) {
    return {
      ok: false,
      status: 'empty-recovery-payload',
      passwords: codesToStore,
    };
  }

  const chainId = Number(
    finalizedDraft.networkChainId ||
    sessionConfigForDeploy?.networkChainId ||
    sessionConfigForDeploy?.contracts?.sbtFactory?.chainId ||
    0
  ) || null;

  return writeRecoveryCodes({
    chainId,
    sbtAddress,
    passwords: codesToStore,
    mode: 'replace',
  });
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj || {}));

const mergeDeep = (target, source) => {
  const out = { ...(target || {}) };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  });
  return out;
};

const SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY = 'ce:sessionWizardSponsoredBundle:v1';
const SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY = 'ce:sessionWizardSponsoredBundle:tabId:v1';
const SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY = 'ce_new_session_banner_dismissed';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_NAME = 'ce-sponsored-bundle-keys';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_VERSION = 1;
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE = 'keys';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX = 'sessionWizardSponsoredBundle';
let sessionWizardSponsoredBundleCacheKeyPromise = null;
let sessionWizardSponsoredBundleKeyDbPromise = null;
let sessionWizardSponsoredBundleKeyDbUnavailable = false;
const SESSION_WIZARD_NEW_SESSION_PATHNAMES = new Set(['/new', '/session/new']);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64 = (bytes = new Uint8Array()) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
};

const base64ToBytes = (value = '') => {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const generateSessionWizardSponsoredBundleTabId = () => {
  const cryptoApi = (
    (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues ? globalThis.crypto : null) ||
    (typeof window !== 'undefined' && window.crypto?.getRandomValues ? window.crypto : null)
  );
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeSessionWizardPathname = (pathname = '') => {
  const normalized = normalizeMainSiteRoutePath(toStr(pathname).trim());
  return normalized || '/';
};

const isNewSessionWizardPathname = (pathname = '') => (
  SESSION_WIZARD_NEW_SESSION_PATHNAMES.has(normalizeSessionWizardPathname(pathname))
);

const readSessionWizardNewSessionBannerDismissed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return toStr(localStorage.getItem(SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY)).trim().toLowerCase() === 'true';
  } catch (_) {
    return false;
  }
};

const writeSessionWizardNewSessionBannerDismissed = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY, 'true');
  } catch (_) {}
};
const buildSessionWizardNewSessionBannerDismissalContextKey = ({
  pathname = '',
  sponsoredBundleId = '',
  sponsoredBundleKey = '',
} = {}) => {
  const normalizedPathname = normalizeSessionWizardPathname(pathname);
  if (!isNewSessionWizardPathname(normalizedPathname)) return '';
  const bundleId = toStr(sponsoredBundleId).trim();
  const bundleKey = toStr(sponsoredBundleKey).trim();
  if (bundleId || bundleKey) {
    return `${normalizedPathname}::sponsored::${bundleId || '__missing_bundle__'}::${bundleKey ? 'with-key' : 'without-key'}`;
  }
  return `${normalizedPathname}::plain`;
};

const getSessionWizardSponsoredBundleTabId = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return '';
  try {
    const existing = toStr(sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY)).trim();
    if (existing) return existing;
    const next = generateSessionWizardSponsoredBundleTabId();
    sessionStorage.setItem(SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY, next);
    return next;
  } catch (_) {
    return '';
  }
};

const getSessionWizardSponsoredBundleCacheKeyDbEntry = () => {
  const tabId = getSessionWizardSponsoredBundleTabId();
  return tabId
    ? `${SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX}:${tabId}`
    : SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX;
};

const getSessionWizardSponsoredBundleCacheCrypto = () => (
  globalThis.crypto?.subtle && typeof globalThis.crypto?.getRandomValues === 'function'
    ? globalThis.crypto
    : null
);

const openSessionWizardSponsoredBundleKeyDb = () => {
  if (sessionWizardSponsoredBundleKeyDbUnavailable) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (sessionWizardSponsoredBundleKeyDbPromise) return sessionWizardSponsoredBundleKeyDbPromise;

  sessionWizardSponsoredBundleKeyDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      sessionWizardSponsoredBundleKeyDbUnavailable = true;
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(
      SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_NAME,
      SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_VERSION
    );

    request.onerror = () => {
      sessionWizardSponsoredBundleKeyDbUnavailable = true;
      sessionWizardSponsoredBundleKeyDbPromise = null;
      reject(request.error || new Error('Failed to open sponsored bundle key store'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE)) {
        db.createObjectStore(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      try {
        db.onversionchange = () => {
          try {
            db.close();
          } catch (_) {}
          sessionWizardSponsoredBundleKeyDbPromise = null;
        };
      } catch (_) {}
      resolve(db);
    };
  });

  return sessionWizardSponsoredBundleKeyDbPromise;
};

const runSessionWizardSponsoredBundleKeyDbTx = async (mode, action) => {
  const db = await openSessionWizardSponsoredBundleKeyDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler) => {
      if (settled) return;
      settled = true;
      handler();
    };

    try {
      const tx = db.transaction(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE, mode);
      const store = tx.objectStore(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE);
      const request = action(store);

      if (request && typeof request.onsuccess !== 'undefined') {
        request.onsuccess = () => finish(() => resolve(request.result));
        request.onerror = () => finish(() => reject(request.error || tx.error || new Error('IndexedDB request failed')));
      }

      tx.oncomplete = () => finish(() => resolve(request ? request.result : undefined));
      tx.onerror = () => finish(() => reject(tx.error || request?.error || new Error('IndexedDB transaction failed')));
      tx.onabort = () => finish(() => reject(tx.error || request?.error || new Error('IndexedDB transaction aborted')));
    } catch (error) {
      finish(() => reject(error));
    }
  });
};

const readSessionWizardSponsoredBundleCacheKeyFromIndexedDb = async () => {
  try {
    return await runSessionWizardSponsoredBundleKeyDbTx(
      'readonly',
      (store) => store.get(getSessionWizardSponsoredBundleCacheKeyDbEntry())
    );
  } catch (_) {
    return null;
  }
};

const writeSessionWizardSponsoredBundleCacheKeyToIndexedDb = async (key = null) => {
  if (!key) return false;
  try {
    await runSessionWizardSponsoredBundleKeyDbTx(
      'readwrite',
      (store) => store.put(key, getSessionWizardSponsoredBundleCacheKeyDbEntry())
    );
    return true;
  } catch (_) {
    return false;
  }
};

const deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb = async () => {
  try {
    await runSessionWizardSponsoredBundleKeyDbTx(
      'readwrite',
      (store) => store.delete(getSessionWizardSponsoredBundleCacheKeyDbEntry())
    );
  } catch (_) {}
};

const getSessionWizardSponsoredBundleCacheKey = async () => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  if (!cryptoApi) return null;
  if (!sessionWizardSponsoredBundleCacheKeyPromise) {
    sessionWizardSponsoredBundleCacheKeyPromise = (async () => {
      const storedKey = await readSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
      if (storedKey && storedKey.type === 'secret') {
        return storedKey;
      }
      if (storedKey != null) {
        await deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
      }

      const key = await cryptoApi.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      await writeSessionWizardSponsoredBundleCacheKeyToIndexedDb(key);
      return key;
    })().catch((error) => {
      sessionWizardSponsoredBundleCacheKeyPromise = null;
      throw error;
    });
  }
  return sessionWizardSponsoredBundleCacheKeyPromise;
};

export const __test__resetSessionWizardSponsoredBundleCacheKey = () => {
  sessionWizardSponsoredBundleCacheKeyPromise = null;
  sessionWizardSponsoredBundleKeyDbPromise = null;
  sessionWizardSponsoredBundleKeyDbUnavailable = false;
};

const encryptSessionWizardSponsoredBundleCachePayload = async (payload = {}) => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  const key = await getSessionWizardSponsoredBundleCacheKey();
  if (!cryptoApi || !key) return null;
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
};

const decryptSessionWizardSponsoredBundleCachePayload = async (raw = '') => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  const key = await getSessionWizardSponsoredBundleCacheKey();
  if (!cryptoApi || !key) return null;

  const parsed = raw ? JSON.parse(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!parsed.iv || !parsed.ciphertext) return null;

  const plaintext = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(parsed.iv),
    },
    key,
    base64ToBytes(parsed.ciphertext)
  );

  return JSON.parse(textDecoder.decode(plaintext));
};

const clearSessionWizardSponsoredBundleCacheStorage = async () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.removeItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    } catch (_) {}
  }
  await deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
  sessionWizardSponsoredBundleCacheKeyPromise = null;
};

const readSessionWizardCache = () => {
  return readSessionWizardDraftCache();
};

const writeSessionWizardCache = (payload) => {
  const result = writeSessionWizardDraftCache(payload);
  if (!result.ok) log.warn('SessionWizard: fallback', result.error || result.status);
};

const readSessionWizardSponsoredBundleCache = async (txId = '') => {
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId || typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = await decryptSessionWizardSponsoredBundleCachePayload(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const normalizedBundle = normalizeSparseSponsoredBundlePayload(parsed[normalizedTxId]);
    return hasSponsoredBundleFields(normalizedBundle) ? normalizedBundle : null;
  } catch (_) {
    return null;
  }
};

const writeSessionWizardSponsoredBundleCache = async (txId = '', bundle = null) => {
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId || typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    const parsed = raw ? await decryptSessionWizardSponsoredBundleCachePayload(raw) : {};
    const next = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? { ...parsed } : {};
    const normalizedBundle = normalizeSparseSponsoredBundlePayload(bundle);
    if (hasSponsoredBundleFields(normalizedBundle)) {
      next[normalizedTxId] = normalizedBundle;
    } else {
      delete next[normalizedTxId];
    }
    if (Object.keys(next).length) {
      const encryptedPayload = await encryptSessionWizardSponsoredBundleCachePayload(next);
      if (encryptedPayload) {
        sessionStorage.setItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY, encryptedPayload);
        return;
      }
      await clearSessionWizardSponsoredBundleCacheStorage();
    } else {
      await clearSessionWizardSponsoredBundleCacheStorage();
    }
  } catch (e) { log.warn('SessionWizard: fallback', e); }
};

const clearSessionWizardCache = () => {
  const result = clearSessionWizardDraftCache({
    clearPendingSbtDrafts: clearSessionWizardPendingSbtDraftsCache,
  });
  if (!result.ok && result.status !== 'missing-storage') {
    log.warn('SessionWizard: fallback', result.status);
  }
};

const normalizeDraftShape = (draftIn = {}) => {
  const draft = normalizeSessionNaming(draftIn && typeof draftIn === 'object' ? draftIn : {});
  const chainId = Number(draft.networkChainId || DEFAULT_CHAIN_ID || 0) || DEFAULT_CHAIN_ID;
  draft.sessionName = toStr(draft.sessionName || '').trim();
  draft.sessionInfo = toStr(draft.sessionInfo || '').trim();
  if (!draft.sessionInfoEncrypted) {
    delete draft.sessionInfoEncrypted;
  }

  const headerCandidate = toStr(draft.sessionHeader || draft.sessionHeaderImg).trim();
  if (headerCandidate) {
    draft.sessionHeader = headerCandidate;
  }
  delete draft.sessionHeaderImg;
  delete draft.orgHeader;
  delete draft.orgHeaderImg;
  delete draft.orderHeaderImg;

  const ai = (draft.ai && typeof draft.ai === 'object') ? draft.ai : {};
  const fallbackProvider = normalizeAiProvider(ai.mode || ai.provider || 'openai');
  ai.models = normalizeAiModels(ai.models, fallbackProvider, ai.transcription);
  delete ai.mode;
  delete ai.provider;
  delete ai.providers;
  delete ai.transcription;
  draft.ai = ai;

  if (!draft.rpc || typeof draft.rpc !== 'object') {
    draft.rpc = {
      provider: 'default',
      providers: {
        path: {
          rpcUrl: '',
          rpcUrlsByChainId: {},
          apiKey: '',
          encryptedApiKey: '',
        },
      },
    };
  }
  const pathProvider = draft.rpc?.providers?.path || draft.rpc?.path || {};
  if (!toStr(pathProvider.rpcUrl).trim()) {
    pathProvider.rpcUrl = getPathRpcUrl(chainId);
  }
  if (!draft.rpc.providers) draft.rpc.providers = {};
  draft.rpc.providers.path = pathProvider;

  if (!draft.faucet || typeof draft.faucet !== 'object') {
    draft.faucet = {
      rpcUrl: '',
      amountEth: '0.0002',
      balanceThresholdEth: '0.001',
      privateKey: '',
      encryptedPrivateKey: '',
    };
  }
  if (!toStr(draft.faucet.rpcUrl).trim()) {
    draft.faucet.rpcUrl = getDefaultHttpRpc(chainId) || draft.faucet.rpcUrl;
  }
  const resolvedAutoFeature = resolveAutoFeatureBySessionSlug(draft);
  delete draft.autoFeatureSBTsWithFeaturedSbtTags;
  if (typeof resolvedAutoFeature !== 'boolean') {
    draft.autoFeatureSBTsBySessionSlug = true;
  } else {
    draft.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
  }
  if (typeof draft.embeddedDeployHelperEnabled !== 'boolean') {
    draft.embeddedDeployHelperEnabled = CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false;
  }

  return normalizeLitMetadataNetwork(draft);
};

const DEFAULT_TEMPLATE = (() => {
  const base = getDemoTemplateSeed('wizardBase');
  const draft = deepClone(base);
  draft.slug = DEFAULT_SESSION_SLUG;
  draft.sessionName = '';
  draft.sessionInfo = '';
  draft.sessionHeader = '';
  delete draft.sessionHeaderImg;
  delete draft.sessionInfoEncrypted;
  draft.corsWorkerUrl = '';
  draft.defaultTags = '';
  draft.defaultSbtTags = DEFAULT_NEW_SESSION_SBT_TAGS;
  draft.questionsGenPrompt = '';
  draft.defaultFilterState = draft.defaultFilterState ?? null;
  // The wizard seed reuses the default-session demo config, but fresh `/new`
  // drafts should start with session-group auto-feature enabled.
  delete draft.autoFeatureSBTsWithFeaturedSbtTags;
  draft.autoFeatureSBTsBySessionSlug = true;
  draft.embeddedDeployHelperEnabled = CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false;
  draft.litCredentials = {};
  draft.perMemberSpendLimits = draft.perMemberSpendLimits || { ai: '', arweave: '', txGas: '' };
  draft.arweave = draft.arweave || { jwk: '', encryptedJwk: '' };
  draft.faucet = draft.faucet || {
    rpcUrl: '',
    amountEth: '0.0002',
    balanceThresholdEth: '0.001',
    privateKey: '',
    encryptedPrivateKey: '',
  };
  delete draft.sponsoredSbtAddress;
  draft.sponsored = {
    ...(draft.sponsored && typeof draft.sponsored === 'object' ? draft.sponsored : {}),
    defaultGateId: 'gate-1',
    gates: {},
    resources: {},
  };
  const aiModels = (draft.ai?.models && typeof draft.ai.models === 'object') ? draft.ai.models : {};
  draft.ai = {
    ...(draft.ai && typeof draft.ai === 'object' ? draft.ai : {}),
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    models: {
      ...aiModels,
      fast: {
        ...(aiModels.fast && typeof aiModels.fast === 'object' ? aiModels.fast : {}),
        provider: 'openai',
        model: DEFAULT_AI_MODELS.fast,
      },
      thinking: {
        ...(aiModels.thinking && typeof aiModels.thinking === 'object' ? aiModels.thinking : {}),
        provider: 'openai',
        model: DEFAULT_AI_MODELS.thinking,
      },
    },
  };
  if (draft.lit && typeof draft.lit === 'object') {
    draft.lit.defaultGateId = 'gate-1';
  }
  return normalizeDraftShape(draft);
})();

export const __test__getSessionWizardDefaultAiSettings = () => deepClone(DEFAULT_TEMPLATE.ai || {});

const DEFAULT_GATE_KEYS = ['default', 'questionResponses', 'surveyResponses', 'docUploads', 'docUrls', 'ai', 'arweave', 'rpc', 'txGas', 'lit'];
const ENCRYPTION_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];
const RESOURCE_LABELS = {
  default: 'DEFAULT',
  questionResponses: 'QUESTION RESPONSES',
  surveyResponses: 'SURVEY RESPONSES',
  docUploads: 'DOC UPLOADS',
  docUrls: 'DOC URLS',
  ai: 'AI',
  arweave: 'ARWEAVE',
  rpc: 'RPC',
  txGas: 'TXGAS',
  lit: 'LIT',
};
const RESOURCE_SECTION_TOOLTIPS = Object.freeze({
  ai: 'Session-funded API keys used for AI inference and transcription.',
  rpc: 'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
  arweave: `${t('wallet')} used to pay for Arweave uploads and storage.`,
  txGas: 'Faucet signer used to send small testnet funding grants.',
  lit: `Payer ${t('walletLower')} used to sponsor Lit operations for this session.`,
});
const RESOURCE_SECRET_FIELDS = {
  ai: [
    { key: 'openaiKey', label: 'OpenAI key', type: 'password', required: true },
  ],
  rpc: [
    { key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text', placeholder: 'https://...' },
    // Intentionally hidden until PATH gateway auth is supported (tracked in PRD 198 / 354).
    // { key: 'customRpcKey', label: 'Custom RPC key', type: 'password' },
  ],
  arweave: [
    { key: 'arweaveJwk', label: 'Arweave JWK', type: 'textarea', rows: 3, required: true },
  ],
  txGas: [
    { key: 'faucetPrivateKey', label: 'Faucet private key', type: 'password' },
  ],
  default: [],
  lit: [
    { key: 'litPayerPrivateKey', label: 'Lit payer private key', type: 'password' },
  ],
};
const ANTHROPIC_AI_SECRET_FIELD = { key: 'anthropicKey', label: 'Anthropic key', type: 'password', required: true };
const OPENROUTER_AI_SECRET_FIELD = { key: 'openrouterKey', label: 'OpenRouter key', type: 'password' };
const DEFAULT_WORKER_SECRETS = {
  openaiKey: '',
  anthropicKey: '',
  openrouterKey: '',
  customRpcUrl: '',
  customRpcKey: '',
  arweaveJwk: '',
  faucetPrivateKey: '',
  litPayerPrivateKey: '',
  litPayerAddress: '',
};

export const mergeSponsoredBundleWorkerSecrets = (currentSecrets = {}, bundle = {}) => {
  const next = normalizeWorkerSecrets(currentSecrets);
  SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return;
    const value = toStr(bundle?.[key] || '').trim();
    if (!value) return;
    next[key] = value;
  });
  if (toStr(bundle?.customRpcUrl || '').trim()) {
    // Sponsored bundles never ship `customRpcKey`; clear any cached key so we
    // do not send a stale Authorization header to the sponsored endpoint.
    next.customRpcKey = '';
  }
  return normalizeWorkerSecrets(next);
};

export const mergeSponsoredBundleDeployForm = (currentDeployForm = {}, bundle = {}) => {
  void bundle;
  return currentDeployForm && typeof currentDeployForm === 'object'
    ? { ...currentDeployForm }
    : {};
};

const removeHashQueryParam = (hashValue = '', key = '') => {
  const normalizedKey = toStr(key).trim();
  const rawHash = toStr(hashValue).replace(/^#/, '').trim();
  if (!normalizedKey || !rawHash) return toStr(hashValue).trim();
  if (!/[=&]/.test(rawHash)) return toStr(hashValue).trim();
  const params = new URLSearchParams(rawHash);
  params.delete(normalizedKey);
  const nextHash = params.toString();
  return nextHash ? `#${nextHash}` : '';
};

const scrubSponsoredBundleHashSecret = () => {
  if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
  const nextHash = removeHashQueryParam(window.location.hash || '', 'k');
  const nextUrl = `${window.location.pathname || ''}${window.location.search || ''}${nextHash}`;
  const currentUrl = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
  if (nextUrl === currentUrl) return;
  window.history.replaceState({}, '', nextUrl);
};

const normalizeWorkerSecrets = (value) => {
  const next = { ...DEFAULT_WORKER_SECRETS };
  if (!value || typeof value !== 'object') return next;
  Object.keys(next).forEach((key) => {
    const v = toStr(value[key]).trim();
    next[key] = v === '[redacted]' ? '' : v;
  });
  if (next.litPayerPrivateKey) {
    next.litPayerAddress = deriveLitPayerAddress(next.litPayerPrivateKey);
  }
  return next;
};
function sanitizeSessionWizardWorkerSecretsForLitMode(value = {}, { litPayerWalletInputEnabled = true } = {}) {
  const next = normalizeWorkerSecrets(value);
  if (litPayerWalletInputEnabled) return next;
  return {
    ...next,
    litPayerPrivateKey: '',
    litPayerAddress: '',
  };
}
function sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(value = {}, { litPayerWalletInputEnabled = true } = {}) {
  const next = normalizeSponsoredFieldSnapshot(value);
  if (!litPayerWalletInputEnabled) {
    next[SPONSORED_FIELD_KEYS.lit] = '0';
  }
  return next;
}
const getSessionWizardWorkerResourceKeys = ({ litPayerWalletInputEnabled = true } = {}) => (
  litPayerWalletInputEnabled
    ? DEFAULT_GATE_KEYS
    : DEFAULT_GATE_KEYS.filter((key) => key !== 'lit')
);
export const resolveSessionWizardLitPaymentDelegation = ({
  workerSecretsEnabled = true,
  resolvedWorkerUrl = '',
  litPayerPrivateKey = '',
  draft = null,
  chainId = null,
} = {}) => {
  const litPayerStatus = getLitPayerWalletStatus(litPayerPrivateKey);
  // Regression guard: user-paid mode can leave a valid payer key in memory.
  // Keep delegation aligned with workerSecretsEnabled so the toggle fully disables sponsorship.
  if (!(workerSecretsEnabled && resolvedWorkerUrl && litPayerStatus.valid)) {
    return undefined;
  }
  return {
    enabled: true,
    bootstrapLitPayerPrivateKey: litPayerStatus.privateKey,
    sessionSlug: toStr(draft?.slug || '').trim(),
    sessionConfig: {
      ...(draft && typeof draft === 'object' ? draft : {}),
      networkChainId: chainId,
      corsWorkerUrl: resolvedWorkerUrl,
      sponsoredKeys: {
        ...((draft?.sponsoredKeys && typeof draft.sponsoredKeys === 'object') ? draft.sponsoredKeys : {}),
        lit: true,
      },
    },
    workerUrl: resolvedWorkerUrl,
  };
};
const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter', disabled: true },
  { value: 'custom', label: 'Custom', disabled: true },
];
const AI_MODEL_OPTIONS = Object.freeze({
  anthropic: {
    fast: ['claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20240620'],
    thinking: ['claude-3-5-sonnet-20240620', 'claude-sonnet-4-5-20250929'],
  },
  openai: {
    fast: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    thinking: ['gpt-5', 'o3-mini', 'gpt-4o', 'gpt-4o-mini'],
  },
  openrouter: {
    fast: [],
    thinking: [],
  },
  custom: {
    fast: [],
    thinking: [],
  },
  transcription: ['whisper-1'],
});
const getAiModelOptions = (modelType, providerValue) => {
  if (modelType === 'transcription') return AI_MODEL_OPTIONS.transcription;
  const provider = normalizeAiProvider(providerValue, 'openai');
  return AI_MODEL_OPTIONS[provider]?.[modelType] || AI_MODEL_OPTIONS.openai[modelType] || [];
};
const normalizeAiModelForProvider = (modelType, providerValue, modelValue) => {
  const options = getAiModelOptions(modelType, providerValue);
  const model = toStr(modelValue).trim();
  if (!options.length) return model;
  return options.includes(model) ? model : options[0];
};
const ONCHAIN_FIELD_PATHS = SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS;
const ONCHAIN_FIELD_KEYS = new Set(Object.keys(ONCHAIN_FIELD_PATHS));
// Admin-only lists should move to a post-create admin UI (keep hidden in /new).
const ADMIN_ONLY_FIELDS = new Set([
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'ignored_SBTs_LIST',
  'featured_SBTs_LIST',
]);
// Future feature: per-member spend limits should stay hidden until enforced per provider.
const HIDDEN_FIELDS = new Set([
  'perMemberSpendLimits',
  'corsWorkerUrl',
  'fieldEditors',
  'sessionInfoEncrypted',
  'networkChainId',
  'rpc',
  'sponsored',
  'arweave',
  'litCredentials',
]);
const ENCRYPTED_FIELD_KEYS = new Set(['encryptedApiKey', 'encryptedJwk', 'encryptedPrivateKey']);

const FIELD_TOOLTIPS = {
  slug: 'This becomes the session URL. Leave it unlocked if you want to choose the URL yourself, or lock it to use the generated session ID as a more private link.',
  sessionName: 'The main name people will see for this session across the app.',
  sessionInfo: 'A short description people will see on the session page, cards, and headers.',
  corsWorkerUrl: 'Base URL for the worker (AI, transcription, Arweave uploads, faucet).',
  sessionHeader: 'The banner image for this session. Paste an image URL or upload a file.',
  defaultTags: 'Suggested tags for AI-assisted question tagging. They guide the model, but they do not limit which questions or surveys appear.',
  defaultSbtTags: `Suggested tags for ${t('sbts')} created from this session. Matching tags are prefilled in the Create ${t('sbt')} flow, and you can still change them.`,
  questionsGenPrompt: 'Extra instructions for the AI when it generates questions for this session.',
  defaultFilterState: 'Advanced: a saved starting state for the question filter UI. Most sessions can leave this alone unless you want the page to open with a specific preset.',
  defaultFeaturedSBTs: `Manually feature specific ${t('sbtsLower')} for this session. These are surfaced first in ${t('sbt')} selectors and featured session views.`,
  autoFeatureSBTsBySessionSlug: `Automatically show ${t('sbtsLower')} created for this session in featured Groups areas when their metadata points to this session slug. In list scope, this session can also contribute those ${t('sbtsLower')} to the shared featured strip.`,
  sponsoredSbtAddress: `Legacy default ${t('sbt')} gate address. Most sessions should configure Privacy & Access instead.`,
  networkChainId: 'Primary chain id for the session.',
  contracts: 'Contract addresses + chain ids for this session.',
  blockLimits: 'Optional start and end limits for indexing this session. Use this when the session should only read activity from a certain block range or time window.',
  perMemberSpendLimits: 'Reserved for per-member budgeting by resource.',
  arweave: 'Arweave upload credentials (can be locked).',
  rpc: 'RPC provider settings for reads.',
  faucet: 'Testnet faucet signer config (can be locked).',
  'faucet.rpcUrl': 'RPC endpoint for faucet balance checks + transfers.',
  'faucet.amountEth': 'ETH amount to send for faucet requests.',
  'faucet.balanceThresholdEth': 'Max balance eligible for faucet transfers (ETH string).',
  'faucet.privateKey': 'Private key for the faucet signer. Lock to store as Lit-encrypted.',
  'faucet.encryptedPrivateKey': 'Lit-encrypted faucet private key (written when the field is locked).',
  ai: 'AI provider settings and API keys.',
  litCredentials: 'Lit integration credentials (optional).',
};

const FIELD_LABELS = {
  slug: 'URL',
  sessionName: 'Session Name',
  sessionInfo: 'Session Description',
  corsWorkerUrl: 'Worker URL',
  sessionHeader: 'Header Image',
  defaultTags: 'Default Tag Suggestions',
  defaultFeaturedSBTs: `Default ${t('sbts')}`,
  autoFeatureSBTsBySessionSlug: `Auto-feature Session ${t('sbts')}`,
  sponsoredSbtAddress: `Sponsored ${t('sbt')} Address`,
  contracts: 'Smart Contracts',
  blockLimits: 'Time Limits',
};

const TOP_LEVEL_FIELD_ORDER = [
  'networkChainId',
  'slug',
  'sessionName',
  'sessionInfo',
  'sessionHeader',
  'contracts',
  'blockLimits',
  'sponsored',
  'faucet',
  'arweave',
  'ai',
  'litCredentials',
  'defaultTags',
  'defaultSbtTags',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'questionsGenPrompt',
  'defaultFilterState',
];

const buildDefaultGateState = (chainId) => {
  const gates = {};
  DEFAULT_GATE_KEYS.forEach((key) => {
    gates[key] = {
      sbts: [],
      mode: 'all',
      chainId: chainId || null,
      perMemberLimit: '',
    };
  });
  return gates;
};

const buildResourceGateMap = (gates = [], fallbackId = '') => {
  const firstId = fallbackId || gates[0]?.id || '';
  return DEFAULT_GATE_KEYS.reduce((acc, key) => {
    acc[key] = firstId;
    return acc;
  }, {});
};

const areSbtSelectionsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const normalize = (arr) =>
    normalizeSbtSelection(arr)
      .map((sbt) => toStr(sbt?.address).toLowerCase())
      .filter(Boolean)
      .sort();
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA.length !== normB.length) return false;
  for (let i = 0; i < normA.length; i += 1) {
    if (normA[i] !== normB[i]) return false;
  }
  return true;
};

const getValueAtPath = (obj, path) => {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
};

const setValueAtPath = (obj, path, value) => {
  let cur = obj;
  path.forEach((key, idx) => {
    if (idx === path.length - 1) {
      cur[key] = value;
    } else {
      if (!cur[key] || typeof cur[key] !== 'object') {
        cur[key] = {};
      }
      cur = cur[key];
    }
  });
};

const pathKey = (path) => path.join('.');

const getOnChainFieldKeyForPath = (pathArr) => {
  if (!Array.isArray(pathArr) || !pathArr.length) return '';
  const candidate = pathKey(pathArr);
  for (const [fieldKey, fieldPath] of Object.entries(ONCHAIN_FIELD_PATHS)) {
    if (pathKey(fieldPath) === candidate) return fieldKey;
  }
  return '';
};

const isSecretFieldPath = (pathArr) => {
  if (!Array.isArray(pathArr) || !pathArr.length) return false;
  if (pathArr.length >= 4 && pathArr[0] === 'ai' && pathArr[1] === 'providers') {
    const last = pathArr[pathArr.length - 1];
    return last === 'apiKey' || last === 'encryptedApiKey';
  }
  if (pathArr.length >= 4 && pathArr[0] === 'rpc' && pathArr[1] === 'providers') {
    const last = pathArr[pathArr.length - 1];
    return last === 'apiKey' || last === 'encryptedApiKey';
  }
  if (pathArr.length === 2 && pathArr[0] === 'arweave') {
    return pathArr[1] === 'jwk' || pathArr[1] === 'encryptedJwk';
  }
  if (pathArr.length === 2 && pathArr[0] === 'faucet') {
    return pathArr[1] === 'privateKey' || pathArr[1] === 'encryptedPrivateKey';
  }
  return false;
};

const isPrimitive = (val) => (
  val === null ||
  typeof val === 'string' ||
  typeof val === 'number' ||
  typeof val === 'boolean'
);

const isStringArray = (arr) => Array.isArray(arr) && arr.every((v) => isPrimitive(v));

const shouldLockable = (val) => isPrimitive(val);

const parseListInput = (raw) =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const buildEmptyProvisionedSponsoredContext = () => ({
  sessionSlug: '',
  workerUrl: '',
  fields: normalizeSponsoredFieldSnapshot({}),
});

const getNextGateIndex = (gates = []) => {
  const used = new Set();
  let sawNumeric = false;
  (Array.isArray(gates) ? gates : []).forEach((gate) => {
    const match = /^gate-(\d+)$/.exec(toStr(gate?.id).trim());
    if (!match) return;
    const numericId = Number.parseInt(match[1], 10);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    sawNumeric = true;
    used.add(numericId - 1);
  });
  if (!sawNumeric) return Array.isArray(gates) ? gates.length : 0;
  let idx = 0;
  while (used.has(idx)) idx += 1;
  return idx;
};

const buildEncryptionGate = (index) => ({
  id: `gate-${index + 1}`,
  label: `${t('gate')} ${String.fromCharCode(65 + index)}`,
  color: ENCRYPTION_GATE_COLORS[index % ENCRYPTION_GATE_COLORS.length],
  type: 'sbt',
  sbts: [],
  mode: 'all',
});

const getFieldTooltip = (path, value) => {
  const keyString = pathKey(path);
  const lastKey = path[path.length - 1];
  if (FIELD_TOOLTIPS[keyString]) return FIELD_TOOLTIPS[keyString];
  if (FIELD_TOOLTIPS[lastKey]) return FIELD_TOOLTIPS[lastKey];
  if (lastKey === 'apiKey') {
    return 'API key for this provider. Lock to store as Lit-encrypted.';
  }
  if (lastKey === 'rpcUrl' || lastKey === 'rpcUrlsByChainId') {
    return 'RPC endpoint(s) used by this provider. Required for worker deploy (include key in URL).';
  }
  if (lastKey === 'address') return 'Contract address for this resource.';
  if (lastKey === 'chainId') return 'Chain id for this contract or provider.';
  if (Array.isArray(value)) return 'List of values for this setting.';
  if (typeof value === 'boolean') return 'Toggle for this setting.';
  return `Config value for ${keyString}. See docs/session-registry.md for details.`;
};

export const resolveSessionWizardSelectorSourceConfig = ({
  activeSessionSlug = '',
  registryChainId = null,
  draftNetworkChainId = null,
  network = null,
  normalizeSlug = sessionRegistryUtils.normalizeSlug,
  resolveStrictConfig = getSessionConfigBySlugOrDefault,
  resolveDisplayConfig = (slug) => getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
  defaultChainId = DEFAULT_CHAIN_ID,
} = {}) => {
  const activeSlug = typeof normalizeSlug === 'function'
    ? normalizeSlug(activeSessionSlug || '')
    : toStr(activeSessionSlug).trim().toLowerCase();
  const fallbackChainId = Number(
    registryChainId ||
    draftNetworkChainId ||
    network?.id ||
    network?.chainId ||
    defaultChainId ||
    0
  ) || null;
  const normalizeSourceConfig = (cfg) => {
    if (!cfg || typeof cfg !== 'object') return null;
    const normalizedCfg = normalizeSessionNaming(cfg);
    return {
      ...normalizedCfg,
      slug: activeSlug || normalizedCfg?.slug || '',
      networkChainId: Number(normalizedCfg?.networkChainId || fallbackChainId || 0) || fallbackChainId,
      contracts: (normalizedCfg?.contracts && typeof normalizedCfg.contracts === 'object')
        ? normalizedCfg.contracts
        : {},
    };
  };

  const strictConfig = typeof resolveStrictConfig === 'function'
    ? resolveStrictConfig(activeSlug)
    : null;
  if (strictConfig && !strictConfig.__unresolved) {
    return normalizeSourceConfig(strictConfig);
  }

  const displayConfig = typeof resolveDisplayConfig === 'function'
    ? resolveDisplayConfig(activeSlug)
    : null;
  if (displayConfig && !displayConfig.__unresolved) {
    return normalizeSourceConfig(displayConfig);
  }

  // `/session/demo` is a read-only source-session alias in the wizard, so when no
  // explicit session config exists we still source discovery from the default bucket.
  if (activeSlug === 'demo') {
    const defaultConfig = (
      (typeof resolveStrictConfig === 'function' ? resolveStrictConfig('') : null) ||
      (typeof resolveDisplayConfig === 'function' ? resolveDisplayConfig('') : null)
    );
    const normalizedDefaultConfig = normalizeSourceConfig(defaultConfig);
    if (normalizedDefaultConfig) return normalizedDefaultConfig;
  }

  return {
    slug: activeSlug,
    networkChainId: fallbackChainId,
    contracts: {},
  };
};

const SessionWizard = ({
  account,
  provider,
  network,
  activeSessionSlug,
  ensureLightSbtUniverse,
  sbtCacheRevision,
  toggleLoginModal,
  loginComplete = !!toStr(account).trim(),
  loginInProgress = false,
  initialSessionId,
  initialRegistryChainId,
  initialSponsoredBundleId,
  initialSponsoredBundleKey,
}) => {
  const reduxContext = useContext(ReactReduxContext);
  const tooltipPreferenceStore = reduxContext?.store || null;
  const [sessionWizardTooltipsEnabled, setSessionWizardTooltipsEnabled] = useState(() => (
    readSessionWizardTooltipsEnabled(tooltipPreferenceStore)
  ));
  useEffect(() => {
    setSessionWizardTooltipsEnabled(readSessionWizardTooltipsEnabled(tooltipPreferenceStore));
    if (typeof tooltipPreferenceStore?.subscribe !== 'function') return undefined;
    return tooltipPreferenceStore.subscribe(() => {
      const nextEnabled = readSessionWizardTooltipsEnabled(tooltipPreferenceStore);
      setSessionWizardTooltipsEnabled((current) => (current === nextEnabled ? current : nextEnabled));
    });
  }, [tooltipPreferenceStore]);
  const resolvedActiveSessionSlug = sessionRegistryUtils.normalizeSlug(
    activeSessionSlug ?? ''
  );
  const hasSponsoredBundleLink = (
    !!toStr(initialSponsoredBundleId || '').trim() ||
    !!toStr(initialSponsoredBundleKey || '').trim()
  );
  const litPayerWalletInputEnabled = ENABLE_LIT_SESSION_PAYER_WALLET_INPUT === true;
  const cachedWizard = useMemo(() => readSessionWizardCache(), []);
  const cachedDraftHasEmbeddedDeployHelperEnabled = (
    typeof cachedWizard?.draft?.embeddedDeployHelperEnabled === 'boolean'
  );
  const sourceEmbeddedDeployHelperDefault = useMemo(() => {
    // The canonical default session slug is an empty string, so only treat
    // nullish values as "no source session".
    if (resolvedActiveSessionSlug === undefined || resolvedActiveSessionSlug === null) return null;
    const sourceConfig = resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: resolvedActiveSessionSlug,
      draftNetworkChainId: cachedWizard?.draft?.networkChainId,
      network: {
        id: network?.id,
        chainId: network?.chainId,
      },
    });
    return typeof sourceConfig?.embeddedDeployHelperEnabled === 'boolean'
      ? sourceConfig.embeddedDeployHelperEnabled
      : null;
  }, [
    cachedWizard?.draft?.networkChainId,
    network?.chainId,
    network?.id,
    resolvedActiveSessionSlug,
  ]);
  const initialDraft = useMemo(() => {
    const base = deepClone(DEFAULT_TEMPLATE);
    if (!cachedDraftHasEmbeddedDeployHelperEnabled && typeof sourceEmbeddedDeployHelperDefault === 'boolean') {
      base.embeddedDeployHelperEnabled = sourceEmbeddedDeployHelperDefault;
    }
    const cachedDraft = cachedWizard?.draft;
    const merged = cachedDraft && typeof cachedDraft === 'object' ? mergeDeep(base, cachedDraft) : base;
    const normalized = normalizeDraftShape(merged);
    if (!NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED && !cachedWizard?.deployComplete) {
      normalized.corsWorkerUrl = '';
    }
    return normalized;
  }, [cachedDraftHasEmbeddedDeployHelperEnabled, cachedWizard, sourceEmbeddedDeployHelperDefault]);
  const initialGates = useMemo(() => {
    const cachedGates = cachedWizard?.encryptionGates;
    if (Array.isArray(cachedGates) && cachedGates.length) return cachedGates;
    return [buildEncryptionGate(0)];
  }, [cachedWizard]);
  const initialDefaultGateId = useMemo(() => {
    const cachedId = toStr(cachedWizard?.defaultGateId).trim();
    if (cachedId) return cachedId;
    return initialGates[0]?.id || '';
  }, [cachedWizard, initialGates]);
  const initialGateSelections = useMemo(() => {
    const cachedSelections = cachedWizard?.gateSelections;
    if (cachedSelections && typeof cachedSelections === 'object') return cachedSelections;
    return buildDefaultGateState(initialDraft.networkChainId || network?.id);
  }, [cachedWizard, initialDraft.networkChainId, network?.id]);
  const initialFeaturedDraftGateAutoLink = useMemo(
    () => normalizeFeaturedDraftGateAutoLink(cachedWizard?.featuredDraftGateAutoLink),
    [cachedWizard]
  );
  const initialSessionIdValue = useMemo(() => {
    const fromQuery = sessionRegistryUtils.formatSessionId(initialSessionId);
    if (fromQuery) return fromQuery;
    const fromCache = sessionRegistryUtils.formatSessionId(cachedWizard?.sessionId);
    if (fromCache) return fromCache;
    return generateSessionId();
  }, [cachedWizard?.sessionId, initialSessionId]);

  const [draft, setDraft] = useState(() => initialDraft);
  const draftRef = useRef(initialDraft);
  const [sessionId, setSessionId] = useState(() => initialSessionIdValue);
  const [sessionIdStatus, setSessionIdStatus] = useState('');
  const [isSessionIdRegenerating, setIsSessionIdRegenerating] = useState(false);
  const [privateSlugMode, setPrivateSlugMode] = useState(() => !!cachedWizard?.privateSlugMode);
  const lastManualSlugRef = useRef(toStr(cachedWizard?.lastManualSlug).trim());
  const [encryptedFieldGates, setEncryptedFieldGates] = useState(() => (
    cachedWizard?.encryptedFieldGates && typeof cachedWizard.encryptedFieldGates === 'object'
      ? cachedWizard.encryptedFieldGates
      : {}
  ));
  const [openLockKey, setOpenLockKey] = useState('');
  const [openResourceGateKey, setOpenResourceGateKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataTxId, setMetadataTxId] = useState('');
  const [manualMetadataUrl, setManualMetadataUrl] = useState('');
  const [manualGasLimit, setManualGasLimit] = useState(() => (
    toStr(cachedWizard?.manualGasLimit || '1200000').trim() || '1200000'
  ));
  const [manualGasPriceGwei, setManualGasPriceGwei] = useState(() => (
    toStr(cachedWizard?.manualGasPriceGwei || '').trim()
  ));
  const [manualMaxFeePerGasGwei, setManualMaxFeePerGasGwei] = useState(() => (
    toStr(cachedWizard?.manualMaxFeePerGasGwei || '').trim()
  ));
  const [manualMaxPriorityFeePerGasGwei, setManualMaxPriorityFeePerGasGwei] = useState(() => (
    toStr(cachedWizard?.manualMaxPriorityFeePerGasGwei || '').trim()
  ));
  const [registerTxs, setRegisterTxs] = useState([]);
  const [pendingOnChainFields, setPendingOnChainFields] = useState({});
  const [status, setStatus] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [adminUrlStatus, setAdminUrlStatus] = useState('');
  const [publishAdvancedOpen, setPublishAdvancedOpen] = useState(false);
  const [publishStep, setPublishStep] = useState(0); // 0=idle, 1=deploying sbts/uploading, 2=uploading, 3=registering, 4=done
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishStepElapsedMs, setPublishStepElapsedMs] = useState(0);
  const [wizardMode, setWizardMode] = useState('normal');
  const [wizardDisplaySettingsOpen, setWizardDisplaySettingsOpen] = useState(false);
  const [registryChainId, setRegistryChainId] = useState(() => {
    const fromDraft = Number(draft.networkChainId || 0);
    if (fromDraft && getSessionRegistryAddress(fromDraft)) return fromDraft;
    const fromNetwork = Number(network?.id || 0);
    if (fromNetwork && getSessionRegistryAddress(fromNetwork)) return fromNetwork;
    const defaultRegistryChainId = Number(DEFAULT_CHAIN_ID || 0);
    if (defaultRegistryChainId && getSessionRegistryAddress(defaultRegistryChainId)) {
      return defaultRegistryChainId;
    }
    const available = getSessionRegistryChains();
    if (available.length) return available[0].id;
    return DEFAULT_CHAIN_ID;
  });
  const checkSessionSlugExists = useCallback(({ registryChainId: chainId, slug }) => (
    sessionRegistryUtils
      .getRegistryContract(chainId)
      .sessionExists(sessionRegistryUtils.toRegistrySlug(slug))
  ), []);
  const { slugAvailability } = useSessionSlugState({
    slug: draft?.slug,
    privateSlugMode,
    registryChainId,
    isReservedSlug: isReservedSessionSlug,
    sessionExists: checkSessionSlugExists,
  });
  const initialGateRef = useRef(initialGates[0]);
  const [encryptionGates, setEncryptionGates] = useState(() => initialGates);
  // Pending SBT drafts carry deploy secrets and claim codes, so keep them out
  // of localStorage while still surviving same-tab refreshes via sessionStorage.
  const {
    pendingSbtDrafts,
    setPendingSbtDrafts,
    normalizedPendingSbtDrafts,
    hasUndeployedPendingSbtDrafts,
  } = usePendingSbtDrafts();
  const [createSbtModalState, setCreateSbtModalState] = useState(() => ({
    open: false,
    targetType: 'gate',
    gateId: initialDefaultGateId || initialGateRef.current?.id || '',
    sessionSlug: '',
    arweaveJwkOverride: '',
  }));
  const [contractViewerModalState, setContractViewerModalState] = useState(() => ({
    open: false,
    contractKey: '',
  }));
  const [pendingCreateSbtLaunch, setPendingCreateSbtLaunch] = useState(null);
  const hasPrivateSbtName = useMemo(() => {
    const gates = Array.isArray(encryptionGates) ? encryptionGates : [];
    return gates.some((gate) => normalizeSbtSelection(gate?.sbts || []).some((sbt) => (
      toStr(sbt?.name).toLowerCase().includes('private')
    )));
  }, [encryptionGates]);
  const lastHasPrivateSbtNameRef = useRef(false);
  const [gateSelections, setGateSelections] = useState(() => initialGateSelections);
  const [defaultGateId, setDefaultGateId] = useState(() => initialDefaultGateId || initialGateRef.current.id);
  const [createSbtTargetGateId, setCreateSbtTargetGateId] = useState(
    () => initialDefaultGateId || initialGateRef.current?.id || ''
  );
  const [featuredDraftGateAutoLink, setFeaturedDraftGateAutoLink] = useState(() => initialFeaturedDraftGateAutoLink);
  // Gate selection is always per-resource when multiple gates exist (no toggle needed).
  const [resourceGateMap, setResourceGateMap] = useState(() => {
    const cachedMap = cachedWizard?.resourceGateMap;
    if (cachedMap && typeof cachedMap === 'object') return cachedMap;
    return buildResourceGateMap(initialGates, initialDefaultGateId || initialGateRef.current.id);
  });
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [latestChainBlock, setLatestChainBlock] = useState(null);
  const [latestBlockStatus, setLatestBlockStatus] = useState('');
  const [blockLimitDuration, setBlockLimitDuration] = useState('');
  const [blockLimitUnit, setBlockLimitUnit] = useState('hours');
  const blockStartManualRef = useRef(false);
  const blockEndAutoRef = useRef(false);
  const sessionIdRotationTimerRef = useRef(null);
  const adminUrlStatusTimerRef = useRef(null);
  const sessionIdStatusTimerRef = useRef(null);
  const jsonCopiedTimerRef = useRef(null);
  const compactSessionHeaderInputRef = useRef(null);
  const registryChainHydratedRef = useRef(false);
  const embeddedDeployHelperHydrationKeyRef = useRef('');
  const isMountedRef = useRef(true);
  const selectorSourceSessionConfig = useMemo(() => {
    return resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: resolvedActiveSessionSlug,
      registryChainId,
      draftNetworkChainId: draft?.networkChainId,
      network: {
        id: network?.id,
        chainId: network?.chainId,
      },
    });
  }, [
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
    resolvedActiveSessionSlug,
  ]);

  useEffect(() => {
    const sourceSlugRaw = resolvedActiveSessionSlug ?? selectorSourceSessionConfig?.slug;
    const sourceValue = selectorSourceSessionConfig?.embeddedDeployHelperEnabled;
    if ((sourceSlugRaw === undefined || sourceSlugRaw === null) || typeof sourceValue !== 'boolean') return;
    if (cachedDraftHasEmbeddedDeployHelperEnabled) return;

    const sourceSlug = toStr(sourceSlugRaw).trim();
    const hydrationKey = `${sourceSlug}:${sourceValue ? '1' : '0'}`;
    if (embeddedDeployHelperHydrationKeyRef.current === hydrationKey) return;

    setDraft((prev) => {
      if (prev?.embeddedDeployHelperEnabled === sourceValue) return prev;
      const next = deepClone(prev);
      next.embeddedDeployHelperEnabled = sourceValue;
      return next;
    });
    embeddedDeployHelperHydrationKeyRef.current = hydrationKey;
  }, [
    cachedDraftHasEmbeddedDeployHelperEnabled,
    resolvedActiveSessionSlug,
    selectorSourceSessionConfig?.embeddedDeployHelperEnabled,
    selectorSourceSessionConfig?.slug,
  ]);
  const selectorSourceChainId = Number(
    selectorSourceSessionConfig?.networkChainId ||
    registryChainId ||
    draft?.networkChainId ||
    network?.id ||
    network?.chainId ||
    0
  ) || null;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (sessionIdRotationTimerRef.current) {
        clearTimeout(sessionIdRotationTimerRef.current);
        sessionIdRotationTimerRef.current = null;
      }
      if (adminUrlStatusTimerRef.current) {
        clearTimeout(adminUrlStatusTimerRef.current);
        adminUrlStatusTimerRef.current = null;
      }
      if (sessionIdStatusTimerRef.current) {
        clearTimeout(sessionIdStatusTimerRef.current);
        sessionIdStatusTimerRef.current = null;
      }
      if (jsonCopiedTimerRef.current) {
        clearTimeout(jsonCopiedTimerRef.current);
        jsonCopiedTimerRef.current = null;
      }
    };
  }, []);
  const [workerMode, setWorkerMode] = useState('default');
  const [workerSecretsEnabled, setWorkerSecretsEnabled] = useState(() =>
    typeof cachedWizard?.workerSecretsEnabled === 'boolean' ? cachedWizard.workerSecretsEnabled : true
  );
  const [persistWorkerSecrets, setPersistWorkerSecrets] = useState(() => (
    typeof cachedWizard?.persistWorkerSecrets === 'boolean'
      ? cachedWizard.persistWorkerSecrets
      : DEV_PERSIST_WORKER_SECRETS
  ));
  const cachedDeployForm = (
    cachedWizard?.deployForm &&
    typeof cachedWizard.deployForm === 'object' &&
    !Array.isArray(cachedWizard.deployForm)
  ) ? cachedWizard.deployForm : {};
  const [deployHelperUrl, setDeployHelperUrl] = useState(() => toStr(CLOUDFLARE_DEPLOY_HELPER_URL));
  const [deployForm, setDeployForm] = useState({
    apiToken: toStr(cachedDeployForm.apiToken || '').trim(),
    workerName: toStr(cachedDeployForm.workerName || '').trim(),
    adminAddress: toStr(cachedDeployForm.adminAddress || '').trim() || null,
    accountId: toStr(cachedDeployForm.accountId || '').trim(),
    bundleUrl: toStr(cachedDeployForm.bundleUrl || CLOUDFLARE_WORKER_BUNDLE_URL),
  });
  const [bundleMode, setBundleMode] = useState(() => (toStr(CLOUDFLARE_WORKER_BUNDLE_URL) ? 'url' : 'upload'));
  const [bundleFile, setBundleFile] = useState(null);
  const [forceManualBundleFile, setForceManualBundleFile] = useState(false);
  const [normalModeBundleUrlOverride, setNormalModeBundleUrlOverride] = useState('');
  const [deployStatus, setDeployStatus] = useState('');
  const [deployInFlight, setDeployInFlight] = useState(false);
  const [deployComplete, setDeployComplete] = useState(() => !!cachedWizard?.deployComplete);
  const [deployWorkerUrl, setDeployWorkerUrl] = useState(() => normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  const [provisionedSponsoredContext, setProvisionedSponsoredContext] = useState(() => ({
    ...buildEmptyProvisionedSponsoredContext(),
    sessionSlug: sessionRegistryUtils.normalizeSlug(cachedWizard?.provisionedSponsoredContext?.sessionSlug),
    workerUrl: normalizeWorkerAuthUrl(toStr(cachedWizard?.provisionedSponsoredContext?.workerUrl).trim()),
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
      cachedWizard?.provisionedSponsoredContext?.fields,
      { litPayerWalletInputEnabled }
    ),
  }));
  const [sponsoredBundleStatus, setSponsoredBundleStatus] = useState(null);
  const [sponsoredBundleRetryNonce, setSponsoredBundleRetryNonce] = useState(0);
  const [persistedNewSessionBannerDismissed, setPersistedNewSessionBannerDismissed] = useState(() => (
    readSessionWizardNewSessionBannerDismissed()
  ));
  const [newSessionBannerDismissedContext, setNewSessionBannerDismissedContext] = useState('');
  const [workerSecrets, setWorkerSecrets] = useState(() => {
    const cached = cachedWizard?.workerSecrets;
    return sanitizeSessionWizardWorkerSecretsForLitMode(cached, { litPayerWalletInputEnabled });
  });
  const deployFormRef = useRef(deployForm);
  const resolvedWalletAccountRef = useRef(toStr(account).trim());
  const advancedBundleFileInputRef = useRef(null);
  const normalModeRetryBundleFileInputRef = useRef(null);
  const sponsoredPublishBundleFileInputRef = useRef(null);
  const deployCompleteRef = useRef(!!cachedWizard?.deployComplete);
  const deployWorkerUrlRef = useRef(normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  const provisionedSponsoredContextRef = useRef({
    ...buildEmptyProvisionedSponsoredContext(),
    sessionSlug: sessionRegistryUtils.normalizeSlug(cachedWizard?.provisionedSponsoredContext?.sessionSlug),
    workerUrl: normalizeWorkerAuthUrl(toStr(cachedWizard?.provisionedSponsoredContext?.workerUrl).trim()),
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
      cachedWizard?.provisionedSponsoredContext?.fields,
      { litPayerWalletInputEnabled }
    ),
  });
  const workerSecretsEnabledRef = useRef(workerSecretsEnabled);
  const persistWorkerSecretsRef = useRef(persistWorkerSecrets);
  const workerSecretsRef = useRef(
    sanitizeSessionWizardWorkerSecretsForLitMode(cachedWizard?.workerSecrets, { litPayerWalletInputEnabled })
  );
  const sponsoredBundleApplyRef = useRef('');
  const sponsoredBundleBaselineRef = useRef(null);
  const sponsoredBundleAppliedBundleRef = useRef(null);
  const sponsoredBundleTerminalTxIdRef = useRef('');
  const defaultSponsoredSbtLookupInFlightRef = useRef('');
  const pendingSbtDeployContextSignature = useMemo(() => (
    buildPendingSbtDeployContextSignature(
      {
        networkChainId: Number(draft?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || 0,
        contracts: draft?.contracts || {},
      },
      registryChainId || network?.id || network?.chainId || null
    )
  ), [
    draft?.contracts,
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
  ]);
  const slugFreezeAnchor = toStr(draft?.slug || resolvedActiveSessionSlug).trim();
  // Regression guard: queued SBT metadata already bakes in the active session slug.
  // Keep the wizard URL stable until those pending deployments are cleared.
  const slugPinnedByPendingSbtDrafts = hasUndeployedPendingSbtDrafts && !!slugFreezeAnchor;
  const pendingSbtDeployContextRef = useRef(pendingSbtDeployContextSignature);
  // Regression guard: hidden worker secrets must stay out of deferred SBT uploads
  // when the wizard is switched to user-paid mode.
  const getEnabledWorkerArweaveJwk = (secretsIn = workerSecrets) => (
    workerSecretsEnabled ? toStr(secretsIn?.arweaveJwk).trim() : ''
  );
  // Regression guard: sponsored-bundle apply/restore spans async work, so these
  // helpers must read from refs instead of state dependencies. Recreating them
  // mid-apply causes the bundle loader effect to cancel before it can finish.
  const getCurrentWorkerSecrets = useCallback(() => sanitizeSessionWizardWorkerSecretsForLitMode(
    resolveWorkerSecretsSnapshot({
      workerSecretsRef,
      defaults: DEFAULT_WORKER_SECRETS,
    }),
    { litPayerWalletInputEnabled }
  ), [litPayerWalletInputEnabled]);
  const applyWorkerSecretsUpdate = useCallback((nextValueOrUpdater) => {
    const current = resolveWorkerSecretsSnapshot({
      workerSecretsRef,
      defaults: DEFAULT_WORKER_SECRETS,
    });
    const nextValue = typeof nextValueOrUpdater === 'function'
      ? nextValueOrUpdater(current)
      : nextValueOrUpdater;
    const next = sanitizeSessionWizardWorkerSecretsForLitMode(
      {
        ...DEFAULT_WORKER_SECRETS,
        ...((nextValue && typeof nextValue === 'object') ? nextValue : {}),
      },
      { litPayerWalletInputEnabled }
    );
    workerSecretsRef.current = next;
    setWorkerSecrets(next);
    return next;
  }, [litPayerWalletInputEnabled]);
  const clearSelectedBundleFile = useCallback(() => {
    setBundleFile(null);
    [
      advancedBundleFileInputRef.current,
      normalModeRetryBundleFileInputRef.current,
      sponsoredPublishBundleFileInputRef.current,
    ].forEach((input) => {
      if (input && typeof input.value === 'string') {
        input.value = '';
      }
    });
  }, []);
  const buildRestoredSponsoredWorkerSecrets = useCallback(({
    currentSecrets = {},
    baselineSecrets = {},
    appliedBundle = {},
  } = {}) => {
    const next = normalizeWorkerSecrets(currentSecrets);
    const baseline = normalizeWorkerSecrets(baselineSecrets);
    const normalizedApplied = normalizeSparseSponsoredBundlePayload(appliedBundle);
    SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(next, key)) return;
      const appliedValue = toStr(normalizedApplied?.[key] || '').trim();
      if (!appliedValue) return;
      if (toStr(next[key] || '').trim() !== appliedValue) return;
      next[key] = toStr(baseline[key] || '').trim();
    });
    const appliedRpcUrl = toStr(normalizedApplied?.customRpcUrl || '').trim();
    if (
      appliedRpcUrl &&
      toStr(currentSecrets?.customRpcUrl || '').trim() === appliedRpcUrl &&
      !toStr(currentSecrets?.customRpcKey || '').trim()
    ) {
      next.customRpcKey = toStr(baseline.customRpcKey || '').trim();
    }
    return next;
  }, []);
  const resolveSponsoredBundleRestoreState = useCallback(({
    currentSecrets = {},
    currentDeployForm = {},
    currentDeployComplete = false,
    currentDeployWorkerUrl = '',
    currentCorsWorkerUrl = '',
    currentProvisionedSponsoredContext = buildEmptyProvisionedSponsoredContext(),
    currentWorkerSecretsEnabled = true,
    currentPersistWorkerSecrets = false,
    baseline = {},
    appliedBundle = {},
  } = {}) => {
    const resolvedBaseline = (baseline && typeof baseline === 'object') ? baseline : {};
    const normalizedApplied = normalizeSparseSponsoredBundlePayload(appliedBundle);
    const nextSecrets = buildRestoredSponsoredWorkerSecrets({
      currentSecrets,
      baselineSecrets: resolvedBaseline.workerSecrets,
      appliedBundle: normalizedApplied,
    });
    return {
      workerSecrets: nextSecrets,
      workerSecretsEnabled: currentWorkerSecretsEnabled === true
        ? !!resolvedBaseline.workerSecretsEnabled
        : currentWorkerSecretsEnabled,
      persistWorkerSecrets: currentPersistWorkerSecrets === false
        ? !!resolvedBaseline.persistWorkerSecrets
        : currentPersistWorkerSecrets,
      deployForm: currentDeployForm,
      deployComplete: currentDeployComplete === false
        ? !!resolvedBaseline.deployComplete
        : currentDeployComplete,
      deployWorkerUrl: toStr(currentDeployWorkerUrl).trim()
        ? currentDeployWorkerUrl
        : toStr(resolvedBaseline.deployWorkerUrl || '').trim(),
      corsWorkerUrl: toStr(currentCorsWorkerUrl).trim()
        ? currentCorsWorkerUrl
        : toStr(resolvedBaseline.corsWorkerUrl || '').trim(),
      provisionedSponsoredContext: (
        toStr(currentProvisionedSponsoredContext?.sessionSlug || '').trim() ||
        toStr(currentProvisionedSponsoredContext?.workerUrl || '').trim()
      )
        ? currentProvisionedSponsoredContext
        : {
            ...buildEmptyProvisionedSponsoredContext(),
            ...(resolvedBaseline.provisionedSponsoredContext && typeof resolvedBaseline.provisionedSponsoredContext === 'object'
              ? resolvedBaseline.provisionedSponsoredContext
              : {}),
          },
    };
  }, [buildRestoredSponsoredWorkerSecrets]);
  const clearSponsoredBundleTracking = useCallback(() => {
    sponsoredBundleApplyRef.current = '';
    sponsoredBundleBaselineRef.current = null;
    sponsoredBundleAppliedBundleRef.current = null;
    sponsoredBundleTerminalTxIdRef.current = '';
    clearSponsoredBootstrapFundingContext();
  }, []);
  const syncSponsoredBootstrapFundingContext = useCallback((bundle = null, targetSessionSlugOverride = undefined) => {
    const sourceBundle = (
      bundle &&
      typeof bundle === 'object'
    ) ? bundle : sponsoredBundleAppliedBundleRef.current;
    const sponsoredFundingContext = normalizeSponsoredBootstrapFundingContext({
      sessionSlug: sourceBundle?.meta?.sourceSessionSlug,
      workerUrl: sourceBundle?.bootstrapWorkerUrl || sourceBundle?.meta?.sourceWorkerUrl,
      targetSessionSlug: targetSessionSlugOverride ?? draftRef.current?.slug ?? '',
      faucetGrantToken: sourceBundle?.faucetGrantToken,
    });
    if (sponsoredFundingContext.sessionSlug || sponsoredFundingContext.workerUrl) {
      writeSponsoredBootstrapFundingContext(sponsoredFundingContext);
    } else {
      clearSponsoredBootstrapFundingContext();
    }
    return sponsoredFundingContext;
  }, []);
  const restoreSponsoredBundleOverrides = useCallback(() => {
    const baseline = sponsoredBundleBaselineRef.current;
    const appliedBundle = sponsoredBundleAppliedBundleRef.current;
    if (!baseline || !appliedBundle) {
      clearSponsoredBundleTracking();
      return;
    }
    const restored = resolveSponsoredBundleRestoreState({
      currentSecrets: getCurrentWorkerSecrets(),
      currentDeployForm: deployFormRef.current,
      currentDeployComplete: deployCompleteRef.current,
      currentDeployWorkerUrl: deployWorkerUrlRef.current,
      currentCorsWorkerUrl: toStr(draftRef.current?.corsWorkerUrl || '').trim(),
      currentProvisionedSponsoredContext: provisionedSponsoredContextRef.current,
      currentWorkerSecretsEnabled: workerSecretsEnabledRef.current,
      currentPersistWorkerSecrets: persistWorkerSecretsRef.current,
      baseline,
      appliedBundle,
    });
    applyWorkerSecretsUpdate(restored.workerSecrets);
    setDeployForm(restored.deployForm);
    setDeployComplete(!!restored.deployComplete);
    setDeployWorkerUrl(normalizeBaseUrl(toStr(restored.deployWorkerUrl).trim()));
    setProvisionedSponsoredContext({
      ...buildEmptyProvisionedSponsoredContext(),
      ...(restored.provisionedSponsoredContext && typeof restored.provisionedSponsoredContext === 'object'
        ? restored.provisionedSponsoredContext
        : {}),
      fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
        restored.provisionedSponsoredContext?.fields,
        { litPayerWalletInputEnabled }
      ),
    });
    setDraft((prev) => {
      const desiredWorkerUrl = toStr(restored.corsWorkerUrl || '').trim();
      if (toStr(prev?.corsWorkerUrl || '').trim() === desiredWorkerUrl) return prev;
      const next = deepClone(prev);
      next.corsWorkerUrl = desiredWorkerUrl;
      return next;
    });
    setWorkerSecretsEnabled(restored.workerSecretsEnabled);
    setPersistWorkerSecrets(restored.persistWorkerSecrets);
    clearSponsoredBundleTracking();
  }, [
    applyWorkerSecretsUpdate,
    clearSponsoredBundleTracking,
    getCurrentWorkerSecrets,
    litPayerWalletInputEnabled,
    resolveSponsoredBundleRestoreState,
  ]);
  const applySponsoredBundleOverrides = useCallback((bundle = {}, applyKey = '', terminalTxId = '') => {
    const normalizedBundle = normalizeSparseSponsoredBundlePayload(bundle);
    let baselineSource = {
      workerSecrets: getCurrentWorkerSecrets(),
      deployForm: deployFormRef.current,
      deployComplete: deployCompleteRef.current,
      deployWorkerUrl: deployWorkerUrlRef.current,
      corsWorkerUrl: toStr(draftRef.current?.corsWorkerUrl || '').trim(),
      provisionedSponsoredContext: provisionedSponsoredContextRef.current,
      workerSecretsEnabled: workerSecretsEnabledRef.current,
      persistWorkerSecrets: persistWorkerSecretsRef.current,
    };
    if (
      sponsoredBundleBaselineRef.current &&
      sponsoredBundleAppliedBundleRef.current &&
      sponsoredBundleApplyRef.current &&
      sponsoredBundleApplyRef.current !== applyKey
    ) {
      baselineSource = resolveSponsoredBundleRestoreState({
        currentSecrets: baselineSource.workerSecrets,
        currentDeployForm: baselineSource.deployForm,
        currentDeployComplete: baselineSource.deployComplete,
        currentDeployWorkerUrl: baselineSource.deployWorkerUrl,
        currentCorsWorkerUrl: baselineSource.corsWorkerUrl,
        currentProvisionedSponsoredContext: baselineSource.provisionedSponsoredContext,
        currentWorkerSecretsEnabled: baselineSource.workerSecretsEnabled,
        currentPersistWorkerSecrets: baselineSource.persistWorkerSecrets,
        baseline: sponsoredBundleBaselineRef.current,
        appliedBundle: sponsoredBundleAppliedBundleRef.current,
      });
    }
    sponsoredBundleBaselineRef.current = {
      workerSecrets: baselineSource.workerSecrets,
      deployApiToken: toStr(baselineSource.deployForm?.apiToken || '').trim(),
      deployComplete: !!baselineSource.deployComplete,
      deployWorkerUrl: toStr(baselineSource.deployWorkerUrl || '').trim(),
      corsWorkerUrl: toStr(baselineSource.corsWorkerUrl || '').trim(),
      provisionedSponsoredContext: {
        ...buildEmptyProvisionedSponsoredContext(),
        ...(baselineSource.provisionedSponsoredContext && typeof baselineSource.provisionedSponsoredContext === 'object'
          ? baselineSource.provisionedSponsoredContext
          : {}),
        fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
          baselineSource.provisionedSponsoredContext?.fields,
          { litPayerWalletInputEnabled }
        ),
      },
      workerSecretsEnabled: baselineSource.workerSecretsEnabled,
      persistWorkerSecrets: baselineSource.persistWorkerSecrets,
    };
    sponsoredBundleAppliedBundleRef.current = normalizedBundle;
    setPersistWorkerSecrets(false);
    setWorkerSecretsEnabled(true);
    applyWorkerSecretsUpdate(
      mergeSponsoredBundleWorkerSecrets(baselineSource.workerSecrets, normalizedBundle)
    );
    setDeployForm(
      mergeSponsoredBundleDeployForm(baselineSource.deployForm, normalizedBundle)
    );
    syncSponsoredBootstrapFundingContext(normalizedBundle);
    setDeployComplete(false);
    setDeployWorkerUrl('');
    setWorkerUrlAutoFilled(false);
    setProvisionedSponsoredContext(buildEmptyProvisionedSponsoredContext());
    setDraft((prev) => {
      if (!toStr(prev?.corsWorkerUrl || '').trim()) return prev;
      const next = deepClone(prev);
      next.corsWorkerUrl = '';
      return next;
    });
    sponsoredBundleApplyRef.current = applyKey;
    sponsoredBundleTerminalTxIdRef.current = terminalTxId;
  }, [
    applyWorkerSecretsUpdate,
    getCurrentWorkerSecrets,
    litPayerWalletInputEnabled,
    resolveSponsoredBundleRestoreState,
    syncSponsoredBootstrapFundingContext,
  ]);
  useEffect(() => {
    if (!sponsoredBundleAppliedBundleRef.current) return;
    syncSponsoredBootstrapFundingContext();
  }, [draft.slug, syncSponsoredBootstrapFundingContext]);
  const [workerUrlAutoFilled, setWorkerUrlAutoFilled] = useState(false);
  const DEFAULT_ALLOWED_ORIGINS = buildSessionWizardDefaultAllowedOrigins().join('\n');
  const [workerAllowOrigins, setWorkerAllowOrigins] = useState(DEFAULT_ALLOWED_ORIGINS);
  const [workerLimitPerWallet, setWorkerLimitPerWallet] = useState('');
  const [sessionHeaderMode, setSessionHeaderMode] = useState('url');
  const [compactSessionHeaderMode, setCompactSessionHeaderMode] = useState('idle');
  const [sessionHeaderFile, setSessionHeaderFile] = useState(null);
  const [sessionHeaderPreviewUrl, setSessionHeaderPreviewUrl] = useState('');
  const [sessionHeaderPreviewModalOpen, setSessionHeaderPreviewModalOpen] = useState(false);
  const [sessionHeaderUploadStatus, setSessionHeaderUploadStatus] = useState('');
  const [sessionHeaderUploadStatusTone, setSessionHeaderUploadStatusTone] = useState('default');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [metadataObjectCollapsed, setMetadataObjectCollapsed] = useState({ contracts: true, faucet: true, ai: true, lit: true });
  const [collapsedSections, setCollapsedSections] = useState(() => ({
    worker: true,
    encryption: wizardMode !== 'advanced',
    metadata: false,
    publish: true,
  }));
  const workerResourceKeys = useMemo(
    () => getSessionWizardWorkerResourceKeys({ litPayerWalletInputEnabled }),
    [litPayerWalletInputEnabled]
  );
  const setSessionHeaderStatus = useCallback((text = '', tone = 'default') => {
    setSessionHeaderUploadStatus(text);
    setSessionHeaderUploadStatusTone(text ? tone : 'default');
  }, []);
  useEffect(() => {
    if (wizardMode === 'advanced') return;
    setCollapsedSections((prev) => {
      const firstOpenSection = ['metadata', 'encryption', 'worker', 'publish']
        .find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: firstOpenSection !== 'worker',
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [wizardMode]);
  useEffect(() => {
    if (!hasSponsoredBundleLink) {
      setWizardDisplaySettingsOpen(false);
    }
  }, [hasSponsoredBundleLink]);

  const effectivePersistWorkerSecrets = DEV_PERSIST_WORKER_SECRETS && persistWorkerSecrets;

  const registryAddress = useMemo(() => {
    return resolveSessionWizardRegistryAddress(registryChainId, draft?.contracts);
  }, [registryChainId, draft?.contracts]);
  const registryChainName = useMemo(() => getChainName(registryChainId), [registryChainId]);
  const registryChainOptions = useMemo(() => getSessionRegistryChains(), []);
  const newSessionFundingChain = useMemo(() => {
    const chainId = Number(
      registryChainId ||
      DEFAULT_CHAIN_ID ||
      0
    ) || 0;
    const chain = getChainById(chainId);
    if (chain) return chain;
    if (!chainId) return null;
    return {
      id: chainId,
      name: getChainName(chainId) || `Chain ${chainId}`,
      nativeCurrency: { symbol: 'ETH' },
    };
  }, [registryChainId]);
  const newSessionFundingRequirementLabel = useMemo(() => {
    const chainName = toStr(newSessionFundingChain?.name).trim();
    const chainSymbol = toStr(newSessionFundingChain?.nativeCurrency?.symbol).trim() || 'ETH';
    return `${chainName || 'Selected network'} ${chainSymbol} for on-chain registration`;
  }, [newSessionFundingChain]);

  const buildWorkerName = (rawName) => {
    const base = toStr(rawName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    if (!base) return '';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${base}-worker-${dd}${hh}${yy}`;
  };

  useEffect(() => {
    if (account && (deployForm.adminAddress === undefined || deployForm.adminAddress === null)) {
      setDeployForm((prev) => ({ ...prev, adminAddress: account }));
    }
  }, [account, deployForm.adminAddress]);

  useEffect(() => {
    const desiredChain = Number(initialRegistryChainId || 0) || null;
    if (!desiredChain) return;
    // For now we assume session chain === registry chain; if this diverges, split these values.
    setRegistryChainId((prev) => (Number(prev || 0) === desiredChain ? prev : desiredChain));
  }, [initialRegistryChainId]);

  useEffect(() => {
    const bundleId = toStr(initialSponsoredBundleId || '').trim();
    const bundleKey = toStr(initialSponsoredBundleKey || '').trim();
    if (!bundleId && !bundleKey) {
      // Regression guard: query-only route changes do not remount SessionWizard,
      // so removing `?sponsored=` must explicitly roll back sponsor-applied state.
      restoreSponsoredBundleOverrides();
      setSponsoredBundleStatus(null);
      return;
    }
    const applyKey = bundleKey ? `${bundleId}::${bundleKey}` : `${bundleId}::__session_cache__`;
    const activeApplyKey = sponsoredBundleRetryNonce > 0
      ? `${applyKey}::retry:${sponsoredBundleRetryNonce}`
      : applyKey;
    if (sponsoredBundleApplyRef.current === activeApplyKey) return;
    let cancelled = false;
    const run = async () => {
      const cachedSponsoredBundle = await readSessionWizardSponsoredBundleCache(bundleId);
      if (cancelled) return;
      if (!bundleKey && cachedSponsoredBundle) {
        if (isSponsoredBundleExpired(cachedSponsoredBundle)) {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          restoreSponsoredBundleOverrides();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Sponsored bundle expired.', retryable: false });
          return;
        }
        applySponsoredBundleOverrides(cachedSponsoredBundle, activeApplyKey, bundleId);
        setSponsoredBundleStatus({
          tone: 'success',
          message: buildSponsoredBundleAppliedStatusMessage(cachedSponsoredBundle),
          retryable: false,
        });
        return;
      }
      if (!bundleKey && sponsoredBundleTerminalTxIdRef.current === bundleId) return;

      if (!bundleId || !bundleKey) {
        restoreSponsoredBundleOverrides();
        scrubSponsoredBundleHashSecret();
        setSponsoredBundleStatus({ tone: 'error', message: 'Malformed sponsored link.', retryable: false });
        return;
      }

      setSponsoredBundleStatus({ tone: 'info', message: 'Loading sponsored bundle…', retryable: false });
      try {
        const result = await readSponsoredBundleFromArweave({
          txId: bundleId,
          secret: bundleKey,
          arweaveOpts: {
            debugContext: {
              caller: 'SessionWizard.sponsoredBundle',
              source: 'session_wizard',
            },
            ...(sponsoredBundleRetryNonce > 0 ? { bypassFailureCache: true } : {}),
          },
        });
        if (cancelled) return;
        applySponsoredBundleOverrides(result.bundle, activeApplyKey, bundleId);
        await writeSessionWizardSponsoredBundleCache(bundleId, result.bundle);
        if (cancelled) return;
        scrubSponsoredBundleHashSecret();
        setSponsoredBundleStatus({
          tone: 'success',
          message: buildSponsoredBundleAppliedStatusMessage(result.bundle),
          retryable: false,
        });
      } catch (error) {
        if (cancelled) return;
        restoreSponsoredBundleOverrides();
        const code = toStr(error?.code || '').trim().toLowerCase();
        if (code === 'expired_bundle') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Sponsored bundle expired.', retryable: false });
          return;
        }
        if (code === 'decrypt_failed') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Failed to decrypt sponsored bundle.', retryable: false });
          return;
        }
        if (code === 'malformed_link') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Malformed sponsored link.', retryable: false });
          return;
        }
        if (code === 'invalid_bundle' || code === 'empty_bundle') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Invalid sponsored bundle.', retryable: false });
          return;
        }
        setSponsoredBundleStatus({ tone: 'error', message: 'Failed to load sponsored bundle.', retryable: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    applySponsoredBundleOverrides,
    initialSponsoredBundleId,
    initialSponsoredBundleKey,
    restoreSponsoredBundleOverrides,
    sponsoredBundleRetryNonce,
  ]);

  useEffect(() => {
    const raw = toStr(initialSessionId).trim();
    if (!raw) return;
    const parsedSessionId = sessionRegistryUtils.formatSessionId(raw);
    if (parsedSessionId) {
      setSessionId(parsedSessionId);
      return;
    }
    const desiredSlug = normalizeSlug(raw);
    setDraft((prev) => {
      if (toStr(prev.slug).trim()) return prev;
      const next = deepClone(prev);
      next.slug = desiredSlug;
      return next;
    });
  }, [initialSessionId]);

  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (!privateSlugMode) return;
    const desiredSlug = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
    if (!desiredSlug) return;
    setDraft((prev) => {
      if (toStr(prev.slug).trim() === desiredSlug) return prev;
      const next = deepClone(prev);
      next.slug = desiredSlug;
      return next;
    });
  }, [privateSlugMode, sessionId, slugPinnedByPendingSbtDrafts]);

  // Auto-generate slug from sessionName when not in private URL mode.
  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (privateSlugMode) return;
    const name = toStr(draft?.sessionName).trim();
    if (!name) return;
    const autoSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 48);
    if (!autoSlug) return;
    const currentSlug = toStr(draft?.slug).trim();
    if (currentSlug && currentSlug === lastManualSlugRef.current && currentSlug !== autoSlug) return;
    if (autoSlug === toStr(draft?.slug).trim()) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      next.slug = autoSlug;
      return next;
    });
  }, [draft?.sessionName, draft?.slug, privateSlugMode, slugPinnedByPendingSbtDrafts]);

  useEffect(() => {
    const prev = lastHasPrivateSbtNameRef.current;
    lastHasPrivateSbtNameRef.current = hasPrivateSbtName;
    if (!hasPrivateSbtName || prev) return;
    if (privateSlugMode) return;
    togglePrivateSlugMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPrivateSbtName]);

  useEffect(() => {
    // Persist wizard state between refreshes until deploy/upload clears them.
    // Default: redact secret values so refresh requires re-entry (security: no keys in localStorage).
    // Pending SBT drafts use sessionStorage so same-tab refresh can recover
    // queued CREATE2 drafts without turning them into long-lived local secrets.
    // Dev toggle: optionally persist secrets locally for faster iteration.
    const redactedSecrets = {};
    for (const k of Object.keys(workerSecrets || {})) {
      redactedSecrets[k] = workerSecrets[k] ? '[redacted]' : '';
    }
    const cacheSafePendingSbtDrafts = [];
    writeSessionWizardCache({
      sessionId,
      draft,
      privateSlugMode,
      lastManualSlug: lastManualSlugRef.current,
      encryptionGates,
      pendingSbtDrafts: cacheSafePendingSbtDrafts,
      encryptedFieldGates,
      gateSelections,
      defaultGateId,
      featuredDraftGateAutoLink,
      resourceGateMap,
      manualGasLimit,
      manualGasPriceGwei,
      manualMaxFeePerGasGwei,
      manualMaxPriorityFeePerGasGwei,
      workerSecretsEnabled,
      persistWorkerSecrets: !!effectivePersistWorkerSecrets,
      workerSecrets: effectivePersistWorkerSecrets ? workerSecrets : redactedSecrets,
      deployComplete,
      deployWorkerUrl,
      provisionedSponsoredContext,
    });
  }, [
    sessionId,
    draft,
    privateSlugMode,
    encryptionGates,
    pendingSbtDrafts,
    encryptedFieldGates,
    gateSelections,
    defaultGateId,
    featuredDraftGateAutoLink,
    resourceGateMap,
    manualGasLimit,
    manualGasPriceGwei,
    manualMaxFeePerGasGwei,
    manualMaxPriorityFeePerGasGwei,
    workerSecretsEnabled,
    effectivePersistWorkerSecrets,
    workerSecrets,
    deployComplete,
    deployWorkerUrl,
    provisionedSponsoredContext,
  ]);

  useEffect(() => {
    if (!encryptedFieldGates?.slug) return;
    setEncryptedFieldGates((prev) => {
      if (!prev?.slug) return prev;
      const next = { ...prev };
      delete next.slug;
      return next;
    });
  }, [encryptedFieldGates]);

  useEffect(() => {
    const nextName = buildWorkerName(draft.sessionName || '');
    if (nextName && nextName !== deployForm.workerName) {
      setDeployForm((prev) => ({ ...prev, workerName: nextName }));
    }
  }, [draft.sessionName, deployForm.workerName]);

  useEffect(() => {
    const defaultUrl = getDefaultWorkerUrl();
    const current = toStr(draft.corsWorkerUrl).trim();
    if (current && defaultUrl && current !== defaultUrl) {
      setWorkerMode('custom');
    }
  }, [draft.corsWorkerUrl]);

  useEffect(() => {
    if (!deployComplete) return;
    const configured = normalizeBaseUrl(toStr(draft.corsWorkerUrl).trim());
    const deployed = normalizeBaseUrl(toStr(deployWorkerUrl).trim());
    if (!configured || !deployed || configured !== deployed) {
      setDeployComplete(false);
    }
  }, [draft.corsWorkerUrl, deployComplete, deployWorkerUrl]);

  useEffect(() => {
    if (wizardMode !== 'normal' || NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED) return;
    const fallbackUrl = normalizeWorkerAuthUrl(getDefaultWorkerUrl());
    const configuredUrl = normalizeWorkerAuthUrl(toStr(draft.corsWorkerUrl).trim());
    if (workerMode === 'default') {
      setWorkerMode('custom');
    }
    if (!deployComplete && configuredUrl && fallbackUrl && configuredUrl === fallbackUrl) {
      setWorkerUrlAutoFilled(false);
      updateDraftValue(['corsWorkerUrl'], '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardMode, workerMode, draft.corsWorkerUrl, deployComplete]);

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    blockStartManualRef.current = false;
    blockEndAutoRef.current = false;
    if (!chainId) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (Number(next.networkChainId || 0) !== chainId) {
        // NOTE: For now we assume session chain === registry chain; split these when they diverge.
        next.networkChainId = chainId;
      }
      // Contract defaults currently come from bundled per-chain config; ENS discovery is tracked in PRD 060 / 096.
      const defaults = getSessionWizardContractDefaults(chainId);
      if (!next.contracts || typeof next.contracts !== 'object') {
        next.contracts = {};
      }
      const keys = new Set([
        ...Object.keys(next.contracts || {}),
        ...Object.keys(defaults || {}),
      ]);
      keys.forEach((key) => {
        if (!next.contracts[key] || typeof next.contracts[key] !== 'object') {
          next.contracts[key] = {};
        }
        const fallback = toStr(defaults?.[key] || '').trim();
        if (fallback) {
          next.contracts[key].address = fallback;
        }
        next.contracts[key].chainId = chainId;
      });
      // Auto-fill the current PATH public RPC; dedicated gateway/provider-tier work is tracked in PRD 198 / 354.
      const pathRpc = getDefaultHttpRpc(chainId);
      if (pathRpc) {
        if (!next.rpc || typeof next.rpc !== 'object') next.rpc = {};
        if (!toStr(next.rpc.provider).trim()) {
          next.rpc.provider = 'path';
        }
        if (!next.rpc.providers || typeof next.rpc.providers !== 'object') next.rpc.providers = {};
        if (!next.rpc.providers.path || typeof next.rpc.providers.path !== 'object') next.rpc.providers.path = {};
        if (!toStr(next.rpc.providers.path.rpcUrl).trim()) {
          next.rpc.providers.path.rpcUrl = pathRpc;
        }
        if (!next.faucet || typeof next.faucet !== 'object') next.faucet = {};
        if (!toStr(next.faucet.rpcUrl).trim()) {
          next.faucet.rpcUrl = pathRpc;
        }
      }
      return next;
    });
    setGateSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!next[key]) return;
        if (Number(next[key].chainId || 0) !== chainId) {
          next[key] = { ...next[key], chainId };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    const normalizedPendingDrafts = normalizePendingSbtDrafts(pendingSbtDrafts);
    if (!registryChainHydratedRef.current) {
      registryChainHydratedRef.current = true;
      return;
    }
    if (normalizedPendingDrafts.length > 0) {
      clearPendingSbtDrafts(
        normalizedPendingDrafts,
        'Pending SBT drafts were cleared because the session chain or SBT factory changed. Recreate them before publishing.'
      );
      pruneAllPendingSbtSelections();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryChainId]);

  useEffect(() => {
    const gateIds = encryptionGates.map((gate) => gate.id).filter(Boolean);
    if (!gateIds.length) return;
    if (!gateIds.includes(defaultGateId)) {
      setDefaultGateId(gateIds[0]);
    }
    setResourceGateMap((prev) => {
      let changed = false;
      const next = { ...prev };
      workerResourceKeys.forEach((key) => {
        const desiredGateIds = normalizeGateIds(prev[key]).filter((id) => gateIds.includes(id));
        const fallbackGateId = toStr(defaultGateId).trim() || gateIds[0] || '';
        const resolved = desiredGateIds.length > 1 ? desiredGateIds : (desiredGateIds[0] || fallbackGateId);
        if (JSON.stringify(next[key]) !== JSON.stringify(resolved)) {
          next[key] = resolved;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [defaultGateId, encryptionGates, workerResourceKeys]);

  useEffect(() => {
    if (!encryptionGates.length) return;
    const chainId = Number(registryChainId || 0) || null;
    setGateSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      workerResourceKeys.forEach((key) => {
        const resourceGate = resolveResourceGate(resourceGateMap[key], encryptionGates[0]?.id);
        if (!resourceGate) return;
        const sbts = resourceGate.sbts;
        const mode = resourceGate.mode || 'any';
        const prevGate = next[key] || {};
        const sameSbts = areSbtSelectionsEqual(prevGate.sbts, sbts);
        const sameMode = (prevGate.mode || 'any') === mode;
        const sameChain = Number(prevGate.chainId || 0) === Number(chainId || 0);
        if (!sameSbts || !sameMode || !sameChain) {
          next[key] = { ...prevGate, sbts, mode, chainId };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptionGates, registryChainId, resourceGateMap, workerResourceKeys]);

  useEffect(() => {
    if (!encryptionGates.length) return;
    const chainId = Number(registryChainId || 0) || null;
    const litChain = resolveLitChain({ chainId });
    // In /new, the default gate selection drives both the encryption defaultGateId and
    // the on-chain "default" resource gate snapshot used during registration.
    const resolvedDefaultGateId = defaultGateId || encryptionGates[0]?.id || '';
    setDraft((prev) => {
      const next = deepClone(prev);
      const gates = {};
      encryptionGates.forEach((gate) => {
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((sbt) => sbt.address)
          .filter(Boolean);
        gates[gate.id] = {
          type: 'sbt',
          label: gate.label,
          sbtAddresses,
          sbtAddress: sbtAddresses[0],
          chainId,
          litChain,
          mode: gate.mode,
        };
      });
      const resources = {};
      workerResourceKeys.forEach((key) => {
        const resourceGate = resolveResourceGate(resourceGateMap[key], resolvedDefaultGateId);
        if (!resourceGate) return;
        resources[key] = {
          gateId: resourceGate.gateId,
          ...(Array.isArray(resourceGate.gateIds) && resourceGate.gateIds.length > 1
            ? { gateIds: resourceGate.gateIds }
            : {}),
          ...(key === 'ai' ? { provider: next.ai?.mode || '' } : {}),
        };
      });
      next.sponsored = {
        ...(next.sponsored && typeof next.sponsored === 'object' ? next.sponsored : {}),
        defaultGateId: resolvedDefaultGateId || undefined,
        gates,
        resources,
      };
      if (next.lit && typeof next.lit === 'object' && resolvedDefaultGateId) {
        next.lit.defaultGateId = resolvedDefaultGateId;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultGateId, encryptionGates, registryChainId, resourceGateMap, workerResourceKeys]);

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    if (!chainId) {
      setLatestChainBlock(null);
      return;
    }
    const rpcUrl = getDefaultHttpRpc(chainId);
    if (!rpcUrl) {
      setLatestChainBlock(null);
      return;
    }
    let alive = true;
    setLatestBlockStatus('Fetching latest block...');
    // Static network avoids `detectNetwork()` overhead; rpcReadCache wraps `.send()` to dedupe/cache reads.
    const providerRpc = new ethers.providers.JsonRpcProvider(rpcUrl, { chainId, name: `chain-${chainId}` });
    wrapEthersJsonRpcSend(providerRpc, {
      chainId,
      providerKey: `sessionWizard:latestBlock:${chainId}`,
      providerLabel: 'sessionWizard',
      url: rpcUrl,
    });
    providerRpc
      .getBlockNumber()
      .then((blockNumber) => {
        if (!alive) return;
        setLatestChainBlock(blockNumber);
        setLatestBlockStatus('');
      })
      .catch(() => {
        if (!alive) return;
        setLatestChainBlock(null);
        setLatestBlockStatus('Unable to load latest block.');
      });
    return () => {
      alive = false;
    };
  }, [registryChainId]);

  useEffect(() => {
    if (!latestChainBlock) return;
    if (blockStartManualRef.current) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (!next.blockLimits || typeof next.blockLimits !== 'object') {
        next.blockLimits = {};
      }
      const currentStart = Number(next.blockLimits.start);
      if (!Number.isFinite(currentStart) || currentStart !== latestChainBlock) {
        next.blockLimits.start = latestChainBlock;
      }
      return next;
    });
  }, [latestChainBlock]);

  useEffect(() => {
    const duration = Number(blockLimitDuration || 0);
    const unitMs = blockLimitUnit === 'days' ? 86400000 : blockLimitUnit === 'minutes' ? 60000 : 3600000;
    const startFromDraft = Number(draft?.blockLimits?.start);
    const fallbackStart = Number(latestChainBlock);
    const startBlock = (Number.isFinite(startFromDraft) && startFromDraft > 0)
      ? startFromDraft
      : ((Number.isFinite(fallbackStart) && fallbackStart > 0) ? fallbackStart : 0);
    if (!startBlock || !Number.isFinite(duration) || duration <= 0) {
      if (blockEndAutoRef.current) {
        updateDraftValue(['blockLimits', 'end'], null);
        blockEndAutoRef.current = false;
      }
      return;
    }
    const blockTimeMs = getChainBlockTimeMs(registryChainId);
    const blocks = Math.max(1, Math.ceil((duration * unitMs) / blockTimeMs));
    const endBlock = startBlock + blocks;
    updateDraftValue(['blockLimits', 'end'], endBlock);
    blockEndAutoRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockLimitDuration, blockLimitUnit, latestChainBlock, registryChainId, draft?.blockLimits?.start]);

  useEffect(() => {
    const fastProvider = normalizeAiProvider(draft?.ai?.models?.fast?.provider || 'openai');
    const thinkingProvider = normalizeAiProvider(draft?.ai?.models?.thinking?.provider || 'openai');
    const fastCurrent = toStr(draft?.ai?.models?.fast?.model).trim();
    const thinkingCurrent = toStr(draft?.ai?.models?.thinking?.model).trim();
    const fastNext = normalizeAiModelForProvider('fast', fastProvider, fastCurrent);
    const thinkingNext = normalizeAiModelForProvider('thinking', thinkingProvider, thinkingCurrent);
    if (fastNext === fastCurrent && thinkingNext === thinkingCurrent) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (!next.ai || typeof next.ai !== 'object') next.ai = {};
      if (!next.ai.models || typeof next.ai.models !== 'object') next.ai.models = {};
      if (fastNext !== fastCurrent) {
        if (!next.ai.models.fast || typeof next.ai.models.fast !== 'object') next.ai.models.fast = {};
        next.ai.models.fast.model = fastNext;
      }
      if (thinkingNext !== thinkingCurrent) {
        if (!next.ai.models.thinking || typeof next.ai.models.thinking !== 'object') next.ai.models.thinking = {};
        next.ai.models.thinking.model = thinkingNext;
      }
      return next;
    });
  }, [
    draft?.ai?.models?.fast?.provider,
    draft?.ai?.models?.fast?.model,
    draft?.ai?.models?.thinking?.provider,
    draft?.ai?.models?.thinking?.model,
  ]);

  useEffect(() => {
    const canCreateObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (!sessionHeaderFile) {
      if (
        sessionHeaderPreviewUrl &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
      ) {
        URL.revokeObjectURL(sessionHeaderPreviewUrl);
      }
      setSessionHeaderPreviewUrl('');
      return;
    }
    if (!canCreateObjectUrl) return undefined;
    const previewUrl = URL.createObjectURL(sessionHeaderFile);
    setSessionHeaderPreviewUrl(previewUrl);
    return () => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionHeaderFile]);

  const sessionHeaderPreviewSrc = useMemo(() => {
    if (sessionHeaderMode === 'upload') {
      return toStr(sessionHeaderPreviewUrl).trim();
    }
    return normalizeArweaveUrl(draft?.sessionHeader || '', {
      contextLabel: 'session_wizard_header_preview',
    });
  }, [draft?.sessionHeader, sessionHeaderMode, sessionHeaderPreviewUrl]);

  useEffect(() => {
    if (sessionHeaderPreviewSrc) return;
    setSessionHeaderPreviewModalOpen(false);
  }, [sessionHeaderPreviewSrc]);

  const handlePasteSessionHeaderFromClipboard = async () => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-session-header',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      setSessionHeaderMode('upload');
      setCompactSessionHeaderMode('idle');
      setSessionHeaderFile(clipboardResult.file);
      setSessionHeaderStatus('');
      return;
    }

    if (clipboardResult?.kind === 'text') {
      setSessionHeaderMode('url');
      setCompactSessionHeaderMode('url');
      setSessionHeaderFile(null);
      updateDraftValue(['sessionHeader'], clipboardResult.text);
      setSessionHeaderStatus('');
      return;
    }

    setSessionHeaderStatus(clipboardResult?.error || 'Clipboard does not contain a supported image or URL.', 'error');
  };

  const handleClearSessionHeaderPreview = () => {
    setSessionHeaderPreviewModalOpen(false);
    setSessionHeaderMode('url');
    setCompactSessionHeaderMode('idle');
    setSessionHeaderFile(null);
    updateDraftValue(['sessionHeader'], '');
    setSessionHeaderStatus('');
  };

  const defaultSponsoredGateId = draft?.sponsored?.defaultGateId;
  const defaultSponsoredGate = defaultSponsoredGateId ? draft?.sponsored?.gates?.[defaultSponsoredGateId] : null;
  const defaultSponsoredSbtAddress = toStr(defaultSponsoredGate?.sbtAddress || '').trim();
  const defaultSponsoredLookupSlug = resolvedActiveSessionSlug || draft?.slug || '';
  const defaultSponsoredLookupContracts = useStableSerializedObject(draft?.contracts || {});
  const defaultSponsoredLookupRegistry = useStableSerializedObject(draft?.__registry || {});
  const defaultSponsoredLookupNetworkChainId = Number(
    draft?.networkChainId || registryChainId || DEFAULT_CHAIN_ID || 0
  ) || DEFAULT_CHAIN_ID;
  const defaultSponsoredLookupSessionName = draft?.sessionName || '';
  const defaultSponsoredSbtLookupContext = useMemo(() => ({
    slug: defaultSponsoredLookupSlug,
    contracts: defaultSponsoredLookupContracts,
    __registry: defaultSponsoredLookupRegistry,
    networkChainId: defaultSponsoredLookupNetworkChainId,
    sessionName: defaultSponsoredLookupSessionName,
  }), [
    defaultSponsoredLookupContracts,
    defaultSponsoredLookupNetworkChainId,
    defaultSponsoredLookupRegistry,
    defaultSponsoredLookupSessionName,
    defaultSponsoredLookupSlug,
  ]);
  const defaultSponsoredSbtLookupKey = useMemo(() => buildSponsoredSbtLookupContextKey({
    address: defaultSponsoredSbtAddress,
    slug: defaultSponsoredSbtLookupContext.slug,
    sessionName: defaultSponsoredSbtLookupContext.sessionName,
    networkChainId: defaultSponsoredSbtLookupContext.networkChainId,
    contracts: defaultSponsoredSbtLookupContext.contracts,
    registry: defaultSponsoredSbtLookupContext.__registry,
  }), [defaultSponsoredSbtAddress, defaultSponsoredSbtLookupContext]);
  const seededDefaultSponsoredSbtAddress = toStr(encryptionGates?.[0]?.sbts?.[0]?.address || '').trim().toLowerCase();

  useEffect(() => {
    const defaultAddr = defaultSponsoredSbtAddress;
    if (!defaultAddr || !ethers.utils.isAddress(defaultAddr)) return;
    if (seededDefaultSponsoredSbtAddress === defaultAddr.toLowerCase()) {
      if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) {
        defaultSponsoredSbtLookupInFlightRef.current = '';
      }
      return;
    }
    if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) return;
    // Regression guard: unrelated wizard draft updates should not fan out into repeated
    // SBT metadata fetches for the same sponsored default gate.
    defaultSponsoredSbtLookupInFlightRef.current = defaultSponsoredSbtLookupKey;
    let cancelled = false;
    const run = async () => {
      let sbtName = defaultAddr;
      try {
        const info = await contractScripts.getSbtMetadata(
          'none',
          defaultAddr,
          defaultSponsoredSbtLookupContext
        );
        const displayName = getSbtDisplayName(info);
        if (displayName) sbtName = displayName;
      } catch (e) { log.warn('SessionWizard: fallback', e); }
      if (cancelled) return;
      const defaultSbt = { address: defaultAddr, name: `${sbtName} (Sponsored SBT)` };
      setEncryptionGates((prev) => {
        if (!prev.length) return prev;
        if (Array.isArray(prev[0].sbts) && prev[0].sbts.length) return prev;
        const next = [...prev];
        next[0] = { ...next[0], sbts: [defaultSbt] };
        return next;
      });
    };
    run().finally(() => {
      if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) {
        defaultSponsoredSbtLookupInFlightRef.current = '';
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultSponsoredSbtAddress,
    defaultSponsoredSbtLookupContext,
    defaultSponsoredSbtLookupKey,
    seededDefaultSponsoredSbtAddress,
  ]);

  function focusNormalModeSection(key) {
    const validKeys = showNormalModeWorkerStep
      ? ['metadata', 'encryption', 'worker', 'publish']
      : ['metadata', 'encryption', 'publish'];
    if (!validKeys.includes(key)) return;
    setCollapsedSections((prev) => ({
      ...prev,
      metadata: key !== 'metadata',
      encryption: key !== 'encryption',
      worker: showNormalModeWorkerStep ? key !== 'worker' : true,
      publish: key !== 'publish',
    }));
    if (typeof window !== 'undefined') {
      const scrollToSection = () => {
        const el = document.getElementById(`session-wizard-section-${key}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollToSection);
      } else {
        setTimeout(scrollToSection, 0);
      }
    }
  }

  const toggleSection = (key) => {
    if (wizardMode !== 'advanced') {
      focusNormalModeSection(key);
      return;
    }
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnterNormalMode = () => {
    setWizardDisplaySettingsOpen(false);
    clearSelectedBundleFile();
    setWizardMode('normal');
  };

  const handleEnterAdvancedMode = () => {
    setWizardDisplaySettingsOpen(false);
    setWizardMode('advanced');
    const hasQueuedOrSelectedGateSbts = (
      normalizePendingSbtDrafts(pendingSbtDrafts).length > 0 ||
      encryptionGates.some((gate) => normalizeSbtSelection(gate?.sbts || []).length > 0)
    );
    if (hasQueuedOrSelectedGateSbts) {
      setCollapsedSections((prev) => ({ ...prev, encryption: false }));
    }
  };

  const allEncryptionGates = useMemo(() => {
    return [...encryptionGates];
  }, [encryptionGates]);

  const pendingSbtSelectorOptions = useMemo(() => (
    normalizePendingSbtDrafts(pendingSbtDrafts).map((draftEntry) => ({
      address: draftEntry.predictedAddress,
      name: `${draftEntry.displayName} (Pending)`,
      pending: true,
      metadataPreview: draftEntry.metadataPreview || null,
    }))
  ), [pendingSbtDrafts]);

  const getGateById = (gateId) => allEncryptionGates.find((gate) => gate.id === gateId) || null;
  const resolveCreateSbtTargetGateId = (requestedGateId = '') => {
    const validGateIds = allEncryptionGates
      .map((gate) => toStr(gate?.id).trim())
      .filter(Boolean);
    const requested = toStr(requestedGateId).trim();
    if (requested && validGateIds.includes(requested)) return requested;
    const fallback = toStr(defaultGateId).trim();
    if (fallback && validGateIds.includes(fallback)) return fallback;
    return validGateIds[0] || '';
  };
  const activeCreateSbtTargetGateId = resolveCreateSbtTargetGateId(createSbtTargetGateId);
  const activeCreateSbtTargetGate = getGateById(activeCreateSbtTargetGateId);
  const focusCreateSbtTargetGate = (gateId = '') => {
    const resolvedGateId = resolveCreateSbtTargetGateId(gateId);
    if (!resolvedGateId) return;
    setCreateSbtTargetGateId((prev) => (prev === resolvedGateId ? prev : resolvedGateId));
  };

  const buildCreateSbtModalLaunchState = (options = {}) => ({
    targetType: options?.targetType || 'gate',
    gateId: resolveCreateSbtTargetGateId(options?.gateId || ''),
    sessionSlug: toStr(
      Object.prototype.hasOwnProperty.call(options, 'sessionSlug')
        ? options.sessionSlug
        : draftRef.current?.slug || ''
    ).trim(),
    arweaveJwkOverride: toStr(
      Object.prototype.hasOwnProperty.call(options, 'arweaveJwkOverride')
        ? options.arweaveJwkOverride
        : getEnabledWorkerArweaveJwk(workerSecretsRef.current)
    ).trim(),
  });

  const openCreateSbtModal = (options = {}) => {
    const nextModalState = buildCreateSbtModalLaunchState(options);
    setCreateSbtModalState({
      open: true,
      ...nextModalState,
    });
  };

  const launchCreateSbtModal = (options = {}) => {
    const nextModalState = buildCreateSbtModalLaunchState(options);
    if (loginComplete !== true) {
      setPendingCreateSbtLaunch(nextModalState);
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      return;
    }
    setPendingCreateSbtLaunch(null);
    openCreateSbtModal(nextModalState);
  };

  const closeCreateSbtModal = () => {
    setCreateSbtModalState((prev) => ({ ...prev, open: false }));
  };

  const openContractViewerModal = useCallback((contractKey = '') => {
    setContractViewerModalState({
      open: true,
      contractKey: toStr(contractKey).trim(),
    });
  }, []);

  const closeContractViewerModal = useCallback(() => {
    setContractViewerModalState({
      open: false,
      contractKey: '',
    });
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    deployFormRef.current = deployForm;
  }, [deployForm]);

  useEffect(() => {
    const normalizedAccount = toStr(account).trim();
    if (normalizedAccount) {
      resolvedWalletAccountRef.current = normalizedAccount;
    }
  }, [account]);

  useEffect(() => {
    if (!toStr(account).trim() || !pendingCreateSbtLaunch) return;
    if (typeof toggleLoginModal === 'function') toggleLoginModal(false);
    openCreateSbtModal(pendingCreateSbtLaunch);
    setPendingCreateSbtLaunch(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, pendingCreateSbtLaunch]);

  useEffect(() => {
    if (!publishBusy || publishStep <= 0) {
      setPublishStepElapsedMs(0);
      return undefined;
    }
    setPublishStepElapsedMs(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPublishStepElapsedMs(Date.now() - startedAt);
    }, 120);
    return () => clearInterval(timer);
  }, [publishBusy, publishStep]);

  useEffect(() => {
    deployCompleteRef.current = deployComplete;
  }, [deployComplete]);

  useEffect(() => {
    deployWorkerUrlRef.current = deployWorkerUrl;
  }, [deployWorkerUrl]);

  useEffect(() => {
    provisionedSponsoredContextRef.current = provisionedSponsoredContext;
  }, [provisionedSponsoredContext]);

  useEffect(() => {
    workerSecretsEnabledRef.current = workerSecretsEnabled;
  }, [workerSecretsEnabled]);

  useEffect(() => {
    persistWorkerSecretsRef.current = persistWorkerSecrets;
  }, [persistWorkerSecrets]);

  useEffect(() => {
    workerSecretsRef.current = workerSecrets;
  }, [workerSecrets]);

  useEffect(() => {
    const resolvedGateId = resolveCreateSbtTargetGateId(createSbtTargetGateId);
    if (resolvedGateId !== toStr(createSbtTargetGateId).trim()) {
      setCreateSbtTargetGateId(resolvedGateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSbtTargetGateId, defaultGateId, encryptionGates]);

  const gateOptions = useMemo(() => (
    allEncryptionGates.map((gate) => ({
      id: gate.id,
      label: gate.label,
      color: gate.color,
    }))
  ), [allEncryptionGates]);

  const normalizeGateIds = (value) => {
    if (Array.isArray(value)) {
      return value.map((id) => toStr(id).trim()).filter(Boolean);
    }
    const raw = toStr(value).trim();
    return raw ? [raw] : [];
  };

  const resolveResourceGateIds = (value, fallbackGateId) => {
    const availableGateIds = encryptionGates.map((gate) => toStr(gate?.id).trim()).filter(Boolean);
    const requestedGateIds = normalizeGateIds(value).filter((id) => availableGateIds.includes(id));
    const fallback = toStr(fallbackGateId).trim();
    if (requestedGateIds.length > 0) return requestedGateIds;
    if (fallback && availableGateIds.includes(fallback)) return [fallback];
    return availableGateIds[0] ? [availableGateIds[0]] : [];
  };

  const resolveResourceGate = (value, fallbackGateId) => {
    const gateIds = resolveResourceGateIds(value, fallbackGateId);
    if (!gateIds.length) return null;
    const gatesById = new Map();
    gateIds.forEach((gateId) => {
      const gate = encryptionGates.find((entry) => toStr(entry?.id).trim() === gateId);
      if (!gate) return;
      gatesById.set(gateId, gate);
    });
    const resolvedGateIds = Array.from(gatesById.keys());
    const selectedGates = Array.from(gatesById.values());
    if (!selectedGates.length) return null;

    const sbtAddressSet = new Set();
    selectedGates.forEach((gate) => {
      normalizeSbtSelection(gate.sbts || []).forEach((entry) => {
        const address = toStr(entry?.address).trim();
        if (address) sbtAddressSet.add(address);
      });
    });
    const sbtAddresses = Array.from(sbtAddressSet);

    const primaryGate = selectedGates[0];
    const gateId = toStr(primaryGate?.id).trim();
    const modeSet = new Set(
      selectedGates.map((gate) => (toStr(gate?.mode).trim() === 'all' ? 'all' : 'any')),
    );
    const chainIdSet = new Set(
      selectedGates.map((gate) => Number(gate?.chainId || 0) || null),
    );
    const perMemberLimitSet = new Set(
      selectedGates.map((gate) => Number(gate?.perMemberLimit || 0) || 0),
    );
    const modeConflicts = modeSet.size > 1;
    const chainIdConflicts = chainIdSet.size > 1;
    const perMemberLimitConflicts = perMemberLimitSet.size > 1;
    const hasConflicts = modeConflicts || chainIdConflicts || perMemberLimitConflicts;
    const mode = toStr(primaryGate?.mode).trim() === 'all' ? 'all' : 'any';
    const chainId = Number(primaryGate?.chainId || 0) || null;
    const perMemberLimit = Number(primaryGate?.perMemberLimit || 0) || 0;
    const sbts = sbtAddresses.map((address) => ({ address, name: address }));
    return {
      gateId,
      gateIds: resolvedGateIds,
      sbts,
      mode,
      chainId,
      perMemberLimit,
      hasConflicts,
      conflictSummary: {
        modeConflicts,
        chainIdConflicts,
        perMemberLimitConflicts,
      },
    };
  };

  const togglePrivateSlugMode = () => {
    if (slugPinnedByPendingSbtDrafts) return;
    setPrivateSlugMode((prev) => {
      const next = !prev;
      setDraft((current) => {
        const nextDraft = deepClone(current);
        if (next) {
          const currentSlug = toStr(current.slug).trim();
          lastManualSlugRef.current = currentSlug;
          const desiredSlug = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
          if (desiredSlug) {
            nextDraft.slug = desiredSlug;
          }
        } else {
          nextDraft.slug = lastManualSlugRef.current || '';
        }
        return nextDraft;
      });
      return next;
    });
  };

  const updateDraftValue = (path, value) => {
    if (pathKey(path) === 'slug' && !privateSlugMode) {
      lastManualSlugRef.current = toStr(value).trim();
    }
    setDraft((prev) => {
      const next = deepClone(prev);
      setValueAtPath(next, path, value);
      draftRef.current = next;
      return next;
    });
  };

  const updateArrayValue = (path, raw, asJson = false) => {
    try {
      if (asJson) {
        const parsed = JSON.parse(raw);
        updateDraftValue(path, parsed);
        setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: '' }));
        return;
      }
      updateDraftValue(path, parseListInput(raw));
      setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: '' }));
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: 'Invalid JSON' }));
    }
  };

  const updateEncryptionGate = (gateId, updates) => {
    const normalizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sbts')) {
      normalizedUpdates.sbts = dedupeSbtSelection(normalizedUpdates.sbts || []);
    }
    setEncryptionGates((prev) =>
      prev.map((gate) => (gate.id === gateId ? { ...gate, ...normalizedUpdates } : gate))
    );
  };

  const clearFeaturedDraftGateAutoLink = (address = '') => {
    const addressLower = toStr(address).trim().toLowerCase();
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
      return null;
    });
  };

  const dismissFeaturedDraftGateAutoLink = ({ gateId = '', address = '' } = {}) => {
    const gateIdStr = toStr(gateId).trim();
    const addressLower = toStr(address).trim().toLowerCase();
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      if (gateIdStr && toStr(current.gateId).trim() !== gateIdStr) return prev;
      if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
      if (current.dismissed) return prev;
      return { ...current, dismissed: true };
    });
  };

  const handleGateAddSbt = (gateId, sbt) => {
    const gateIdStr = toStr(gateId).trim();
    const nextSbt = normalizeSbtSelection([sbt])[0];
    if (!gateIdStr || !nextSbt) return;
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    const nextAddressLower = toStr(nextSbt?.address).trim().toLowerCase();
    if (
      autoLink &&
      autoLink.dismissed !== true &&
      toStr(autoLink.gateId).trim() === gateIdStr &&
      nextAddressLower &&
      nextAddressLower !== autoLink.address.toLowerCase()
    ) {
      dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr });
    }
    const targetGate = getGateById(gateIdStr);
    updateEncryptionGate(gateIdStr, { sbts: [...normalizeSbtSelection(targetGate?.sbts || []), nextSbt] });
  };

  const handleGateRemoveSbt = (gateId, address) => {
    const gateIdStr = toStr(gateId).trim();
    const addressLower = toStr(address).trim().toLowerCase();
    if (!gateIdStr || !addressLower) return;
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (
      autoLink &&
      toStr(autoLink.gateId).trim() === gateIdStr &&
      autoLink.address.toLowerCase() === addressLower
    ) {
      dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr, address });
    }
    const targetGate = getGateById(gateIdStr);
    updateEncryptionGate(gateIdStr, {
      sbts: normalizeSbtSelection(targetGate?.sbts || [])
        .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower),
    });
  };

  const handleRemoveDefaultFeaturedSbt = (address) => {
    const addressLower = toStr(address).trim().toLowerCase();
    if (!addressLower) return;
    const nextSelections = normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
      .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower);
    updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(nextSelections));

    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (
      !autoLink ||
      autoLink.dismissed === true ||
      toStr(autoLink.source).trim() !== FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE ||
      autoLink.address.toLowerCase() !== addressLower
    ) {
      return;
    }

    // Regression guard: removing a Step-1 featured pending SBT should also
    // remove the auto-linked Gate A entry. Otherwise the gate keeps a draft the
    // admin already removed from the featured list.
    clearFeaturedDraftGateAutoLink(address);
    const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
    const targetGate = getGateById(gateId);
    updateEncryptionGate(gateId, {
      sbts: normalizeSbtSelection(targetGate?.sbts || [])
        .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower),
    });
  };

  const promoteDeployedPendingSbtSelections = (deployedDrafts = []) => {
    const normalizedDeployedDrafts = normalizePendingSbtDrafts(deployedDrafts);
    if (!normalizedDeployedDrafts.length) return;
    const deployedAddressSet = new Set(
      normalizedDeployedDrafts
        .map((entry) => toStr(entry?.deployedAddress || entry?.predictedAddress).trim().toLowerCase())
        .filter(Boolean)
    );
    if (!deployedAddressSet.size) return;

    // Regression guard: publish clears pending drafts immediately after
    // on-chain registration. Promote matching pending selections to normal
    // deployed selections first so the just-published gate/featured state
    // survives in the local wizard and cache.
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: promotePendingSbtSelectionsAfterDeploy({
        selections: gate?.sbts || [],
        deployedDrafts: normalizedDeployedDrafts,
      }),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(promotePendingSbtSelectionsAfterDeploy({
        selections: draftRef.current?.defaultFeaturedSBTs || [],
        deployedDrafts: normalizedDeployedDrafts,
      }))
    );
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      return deployedAddressSet.has(current.address.toLowerCase()) ? null : prev;
    });
  };

  const addEncryptionGate = () => {
    setEncryptionGates((prev) => {
      const idx = getNextGateIndex(prev);
      const next = [...prev, buildEncryptionGate(idx)];
      return next.sort((a, b) => {
        const matchA = /^gate-(\d+)$/.exec(toStr(a?.id).trim());
        const matchB = /^gate-(\d+)$/.exec(toStr(b?.id).trim());
        const numA = matchA ? Number.parseInt(matchA[1], 10) : Number.POSITIVE_INFINITY;
        const numB = matchB ? Number.parseInt(matchB[1], 10) : Number.POSITIVE_INFINITY;
        if (numA !== numB) return numA - numB;
        return toStr(a?.id).localeCompare(toStr(b?.id));
      });
    });
  };

  const removeEncryptionGate = (gateId) => {
    const gateIdStr = toStr(gateId).trim();
    setEncryptionGates((prev) => prev.filter((gate) => gate.id !== gateIdStr));
    setEncryptedFieldGates((prev) => {
      const next = { ...(prev || {}) };
      Object.keys(next).forEach((key) => {
        const value = next[key];
        if (Array.isArray(value)) {
          const filtered = value
            .map((id) => toStr(id).trim())
            .filter((id) => id && id !== gateIdStr);
          if (!filtered.length) {
            delete next[key];
          } else {
            next[key] = filtered.length === 1 ? filtered[0] : filtered;
          }
          return;
        }
        if (toStr(value).trim() === gateIdStr) delete next[key];
      });
      return next;
    });
  };

  const prunePendingSbtSelections = (addressLowerSet) => {
    if (!(addressLowerSet instanceof Set) || addressLowerSet.size === 0) return;
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: normalizeSbtSelection(gate?.sbts || []).filter(
        (sbt) => !addressLowerSet.has(toStr(sbt?.address).trim().toLowerCase())
      ),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(
        normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
          .filter((entry) => !addressLowerSet.has(toStr(entry?.address).trim().toLowerCase()))
      )
    );
  };

  const pruneAllPendingSbtSelections = () => {
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: normalizeSbtSelection(gate?.sbts || []).filter((sbt) => sbt?.pending !== true),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(
        normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
          .filter((entry) => entry?.pending !== true)
      )
    );
  };

  const removePendingSbtDraft = (predictedAddress) => {
    const addressLower = toStr(predictedAddress).trim().toLowerCase();
    if (!addressLower) return;
    setPendingSbtDrafts((prev) => prev.filter((entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== addressLower));
    prunePendingSbtSelections(new Set([addressLower]));
    clearFeaturedDraftGateAutoLink(predictedAddress);
  };

  const clearPendingSbtDrafts = (draftsToClear = [], statusMessage = '') => {
    const normalizedDrafts = normalizePendingSbtDrafts(draftsToClear);
    if (!normalizedDrafts.length) return;
    const addressLowerSet = new Set(
      normalizedDrafts.map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase()).filter(Boolean)
    );
    setPendingSbtDrafts((prev) => prev.filter(
      (entry) => !addressLowerSet.has(toStr(entry?.predictedAddress).trim().toLowerCase())
    ));
    prunePendingSbtSelections(addressLowerSet);
    if (statusMessage) {
      setStatus(statusMessage);
    }
  };

  const handleSavePendingSbtDraft = async (draftPayload) => {
    const normalizedDrafts = normalizePendingSbtDrafts([draftPayload]);
    const nextDraft = normalizedDrafts[0]
      ? {
          ...normalizedDrafts[0],
          deployed: false,
          networkChainId: Number(draftRef.current?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || 0,
          sbtFactoryAddress: toStr(draftRef.current?.contracts?.sbtFactory?.address || '').trim(),
          deploymentContextSignature: pendingSbtDeployContextSignature,
        }
      : null;
    if (!nextDraft) {
      throw new Error('Unable to prepare the pending SBT draft.');
    }
    const pendingSelection = buildPendingSbtSelection(nextDraft);
    if (!pendingSelection) {
      throw new Error('Unable to build the pending SBT selector entry.');
    }

    setPendingSbtDrafts((prev) => {
      const filtered = prev.filter(
        (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== nextDraft.predictedAddress.toLowerCase()
      );
      return [...filtered, nextDraft];
    });

    if (createSbtModalState.targetType === 'defaultFeaturedSBTs') {
      const next = [
        ...normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []),
        pendingSelection,
      ];
      updateDraftValue(
        ['defaultFeaturedSBTs'],
        serializeDefaultFeaturedSbtSelections(dedupeSbtSelection(next))
      );
      const gateA = getGateById(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID);
      const gateASelections = dedupeSbtSelection(gateA?.sbts || []);
      if (!gateASelections.length) {
        updateEncryptionGate(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID, {
          sbts: [...gateASelections, pendingSelection],
        });
        setFeaturedDraftGateAutoLink({
          gateId: FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
          address: pendingSelection.address,
          dismissed: false,
          source: FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
        });
      }
    } else {
      const targetGateId = resolveCreateSbtTargetGateId(createSbtModalState.gateId);
      if (targetGateId) {
        const targetGate = getGateById(targetGateId);
        const nextSelections = dedupeSbtSelection([
          ...normalizeSbtSelection(targetGate?.sbts || []),
          pendingSelection,
        ]);
        updateEncryptionGate(targetGateId, { sbts: nextSelections });
      }
    }

    notify.success(`Prepared ${nextDraft.displayName} for deploy.`);
    closeCreateSbtModal();
  };

  useEffect(() => {
    const previousContextSignature = pendingSbtDeployContextRef.current;
    pendingSbtDeployContextRef.current = pendingSbtDeployContextSignature;
    const normalizedDrafts = normalizePendingSbtDrafts(pendingSbtDrafts);
    if (!previousContextSignature || previousContextSignature === pendingSbtDeployContextSignature) return;
    if (!normalizedDrafts.length) return;
    // Regression guard: pending SBT drafts are CREATE2-addressed against the
    // current chain/factory pair. Keeping them after that context changes can
    // mine a real deploy tx and only fail after the address mismatch check.
    clearPendingSbtDrafts(
      normalizedDrafts,
      'Pending SBT drafts were cleared because the session chain or SBT factory changed. Recreate them before publishing.'
    );
    pruneAllPendingSbtSelections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSbtDeployContextSignature, pendingSbtDrafts]);

  useEffect(() => {
    const livePendingAddressSet = new Set(
      normalizePendingSbtDrafts(pendingSbtDrafts)
        .map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase())
        .filter(Boolean)
    );
    const hasDanglingPendingSelection = encryptionGates.some((gate) => (
      normalizeSbtSelection(gate?.sbts || []).some((sbt) => (
        sbt?.pending === true &&
        !livePendingAddressSet.has(toStr(sbt?.address).trim().toLowerCase())
      ))
    )) || normalizeSbtSelection(draft?.defaultFeaturedSBTs || []).some((entry) => (
      entry?.pending === true &&
      !livePendingAddressSet.has(toStr(entry?.address).trim().toLowerCase())
    ));
    if (!hasDanglingPendingSelection) return;
    // Keep gate selections aligned with the in-memory pending-draft list.
    // A `pending: true` entry without a live draft is always stale UI state.
    prunePendingSbtSelections(new Set(
      [
        ...encryptionGates.flatMap((gate) => normalizeSbtSelection(gate?.sbts || [])),
        ...normalizeSbtSelection(draft?.defaultFeaturedSBTs || []),
      ]
        .filter((entry) => entry?.pending === true)
        .map((entry) => toStr(entry?.address).trim().toLowerCase())
        .filter((addressLower) => addressLower && !livePendingAddressSet.has(addressLower))
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.defaultFeaturedSBTs, encryptionGates, pendingSbtDrafts]);

  useEffect(() => {
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (!autoLink) return;
    const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
    const linkedAddressLower = autoLink.address.toLowerCase();
    const liveDraft = normalizePendingSbtDrafts(pendingSbtDrafts).find(
      (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() === linkedAddressLower
    );
    if (!liveDraft) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    const targetGate = encryptionGates.find((gate) => toStr(gate?.id).trim() === gateId);
    if (!targetGate) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    const gateSelections = dedupeSbtSelection(targetGate?.sbts || []);
    const hasAutoLinkedSelection = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() === linkedAddressLower
    );
    const hasOtherSelections = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() !== linkedAddressLower
    );
    if (hasOtherSelections && autoLink.dismissed !== true) {
      dismissFeaturedDraftGateAutoLink({ gateId, address: autoLink.address });
      return;
    }
    if (autoLink.dismissed || hasAutoLinkedSelection) return;
    const pendingSelection = buildPendingSbtSelection(liveDraft);
    if (!pendingSelection) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    // Keep the Step-1 featured-draft link resilient across refreshes, but stop
    // restoring it once the user has explicitly edited Gate A or the draft is gone.
    setEncryptionGates((prev) => prev.map((gate) => {
      if (toStr(gate?.id).trim() !== gateId) return gate;
      return {
        ...gate,
        sbts: dedupeSbtSelection([...normalizeSbtSelection(gate?.sbts || []), pendingSelection]),
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredDraftGateAutoLink, encryptionGates, pendingSbtDrafts]);

  const renderField = (key, value, path, opts = {}) => {
    const forceShow = !!opts.forceShow;
    if (!forceShow && path.length === 0 && (ADMIN_ONLY_FIELDS.has(key) || HIDDEN_FIELDS.has(key))) {
      return null;
    }
    if (!forceShow && ENCRYPTED_FIELD_KEYS.has(key)) {
      return null;
    }
    const currentPath = [...path, key];
    const keyString = pathKey(currentPath);
    const isSlugField = keyString === 'slug';
    const isNormalMode = wizardMode !== 'advanced';
    if (!forceShow && isNormalMode && path.length === 0 && (
      key === 'slug' ||
      key === 'contracts' ||
      key === 'blockLimits' ||
      key === 'faucet' ||
      key === 'ai' ||
      key === 'lit'
    )) {
      return null;
    }
    if (!forceShow && key === 'chainId') {
      return null;
    }
    if (!forceShow && keyString === 'rpc.provider') {
      return null;
    }
    if (!forceShow && keyString === 'ai.models.transcription.rpcUrl') {
      return null;
    }
    if (!forceShow && keyString === 'rpc.providers.path.rpcUrl') {
      return null;
    }
    if (!forceShow && keyString === 'rpc.providers.path.rpcUrlsByChainId') {
      return null;
    }
    if (!forceShow && key === 'litChain') {
      return null;
    }
    if (!forceShow && currentPath.length >= 2 && currentPath[0] === 'ai' && currentPath[1] === 'providers') {
      return null;
    }
    if (!forceShow && keyString === 'faucet.rpcUrl') {
      return null;
    }
    const displayLabel = FIELD_LABELS[keyString] || FIELD_LABELS[key] || key;
    const isSecretPath = isSecretFieldPath(currentPath);
    const canLock = shouldLockable(value) && (!isSecretPath || !workerSecretsEnabled);
    if (!forceShow && isSecretPath && workerSecretsEnabled) return null;
    // PRD 423 tracks a user-facing builder for serialized defaultFilterState presets.
    const isDefaultFilterState = keyString === 'defaultFilterState';
    const isQuestionsPrompt = keyString === 'questionsGenPrompt';
    const isSessionHeaderField = keyString === 'sessionHeader';
    const isCorsWorkerField = keyString === 'corsWorkerUrl';
    const isNetworkChainField = keyString === 'networkChainId';
    const e2eTestId = (() => {
      if (keyString === 'sessionName') return E2E_TESTIDS.WIZARD_SESSION_NAME;
      if (keyString === 'sessionInfo') return E2E_TESTIDS.WIZARD_SESSION_INFO;
      if (keyString === 'slug') return E2E_TESTIDS.WIZARD_SLUG;
      if (keyString === 'corsWorkerUrl') return E2E_TESTIDS.WIZARD_WORKER_URL;
      return '';
    })();
    const gateIds = gateOptions.map((opt) => opt.id).filter(Boolean);
    const selectedGateIds = !isSlugField
      ? normalizeGateIds(encryptedFieldGates[keyString]).filter((id) => gateIds.includes(id))
      : [];
    const primaryGate = selectedGateIds.length === 1 ? getGateById(selectedGateIds[0]) : null;
    const locked = selectedGateIds.length > 0;
    const lockActive = isSlugField ? privateSlugMode : locked;
    const defaultLockLabel = isNormalMode ? '' : t('sbt');
    const lockBadgeLabel = isSlugField
      ? 'ID'
      : (selectedGateIds.length === 0
        ? defaultLockLabel
        : (selectedGateIds.length === 1
          ? (primaryGate?.label || selectedGateIds[0] || defaultLockLabel)
          : `${selectedGateIds.length} ${t('gatesLower')}`));
    const showLockBadge = !!lockBadgeLabel;
    const lockBadgeStyle = (!isSlugField && selectedGateIds.length === 1 && primaryGate)
      ? { borderColor: primaryGate.color, color: primaryGate.color }
      : undefined;
    const lockTitle = isSlugField
      ? (slugPinnedByPendingSbtDrafts
        ? `Queued ${t('sbt')} drafts pinned this session URL. Remove them before changing the slug.`
        : (privateSlugMode
          ? 'Private URL mode enabled (uses session ID). Click to restore manual URL.'
          : 'Use session ID as the URL (private mode). This does not encrypt the URL.'))
      : locked
        ? (selectedGateIds.length === 1
          ? `Locked with ${primaryGate?.label || selectedGateIds[0]}. Click to edit or unlock.`
          : `Locked with ${selectedGateIds.length} ${t('gatesLower')}. Click to edit or unlock.`)
        : `Click to lock with a ${t('gateLower')}.`;
    const lockIconStyle = (!isSlugField && selectedGateIds.length === 1 && primaryGate)
      ? { color: primaryGate.color }
      : undefined;
    const handleLockClick = () => {
      if (isSlugField) {
        if (slugPinnedByPendingSbtDrafts) return;
        togglePrivateSlugMode();
      }
    };
    const tooltipId = `gw-tip-${keyString.replace(/[^a-z0-9_-]/gi, '-')}`;
    const tooltipText = getFieldTooltip(currentPath, value);
    const chainName = /chainid$/i.test(keyString) ? getChainName(value) : '';
    const displayLabelText = chainName ? `${displayLabel} (${chainName})` : displayLabel;
    const fieldTooltipControl = renderSessionWizardInfoTooltip({
      id: tooltipId,
      content: tooltipText,
      placement: 'right',
      ariaLabel: `${displayLabelText} info`,
    });
    const slugValidationError = isSlugField ? getSessionSlugValidationError(value) : '';
    const fieldGateLockProps = !isSlugField ? {
      gateOptions,
      selectedGateIds,
      onChangeSelectedGateIds: (nextIds) => {
        const filtered = normalizeGateIds(nextIds).filter((id) => gateIds.includes(id));
        setEncryptedFieldGates((prev) => {
          const next = { ...(prev || {}) };
          if (!filtered.length) {
            delete next[keyString];
            return next;
          }
          next[keyString] = filtered.length === 1 ? filtered[0] : filtered;
          return next;
        });
        if (!filtered.length) setOpenLockKey('');
      },
      open: openLockKey === keyString,
      onToggleOpen: (nextOpen) => setOpenLockKey(nextOpen ? keyString : ''),
      disabled: !gateIds.length,
      showDots: true,
    } : null;
    const fieldFrameProps = {
      label: displayLabelText,
      tooltipText,
      tooltipId,
      tooltipPlacement: 'right',
      tooltipAriaLabel: `${displayLabelText} info`,
      tooltipsEnabled: sessionWizardTooltipsEnabled,
      canLock,
      isLocked: lockActive,
      onLockToggle: handleLockClick,
      lockTitle,
      lockBadgeLabel: showLockBadge ? lockBadgeLabel : '',
      lockBadgeStyle,
      lockIconStyle,
      gateLockProps: fieldGateLockProps,
    };

    if (keyString === 'ai.models.transcription.provider') {
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
          </div>
          <Input
            type="select"
            value={toStr(value).trim() || 'openai'}
            onChange={(e) => updateDraftValue(currentPath, e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="local" disabled>Local (coming soon)</option>
          </Input>
        </FormGroup>
      );
    }

    if (keyString === 'ai.models.fast.provider' || keyString === 'ai.models.thinking.provider') {
      const aiProviderModelType = keyString === 'ai.models.fast.provider' ? 'fast' : 'thinking';
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
          </div>
          <Input
            type="select"
            value={normalizeAiProvider(value)}
            onChange={(e) => {
              const nextProvider = normalizeAiProvider(e.target.value, 'openai');
              updateDraftValue(currentPath, nextProvider);
              const currentModel = toStr(draft?.ai?.models?.[aiProviderModelType]?.model).trim();
              const nextModel = normalizeAiModelForProvider(aiProviderModelType, nextProvider, currentModel);
              if (nextModel !== currentModel) {
                updateDraftValue(['ai', 'models', aiProviderModelType, 'model'], nextModel);
              }
            }}
          >
            {AI_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={!!option.disabled}>{option.label}</option>
            ))}
          </Input>
        </FormGroup>
      );
    }

    const modelType =
      keyString === 'ai.models.fast.model'
        ? 'fast'
        : keyString === 'ai.models.thinking.model'
          ? 'thinking'
          : keyString === 'ai.models.transcription.model'
            ? 'transcription'
            : null;
    const providerMode = modelType
      ? normalizeAiProvider(draft?.ai?.models?.[modelType]?.provider || 'openai')
      : normalizeAiProvider(draft?.ai?.mode || 'openai');
    const modelOptions =
      modelType === 'transcription'
        ? getAiModelOptions('transcription', 'openai')
        : modelType
          ? getAiModelOptions(modelType, providerMode)
          : null;
    if (modelOptions && modelOptions.length) {
      const options = Array.from(new Set(modelOptions.filter(Boolean)));
      const selectedModel = normalizeAiModelForProvider(modelType, providerMode, value);
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
          </div>
          <Input
            type="select"
            value={selectedModel}
            onChange={(e) => updateDraftValue(currentPath, e.target.value)}
          >
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Input>
        </FormGroup>
      );
    }

    if (keyString === 'lit.defaultGateId' || keyString === 'lit.defaultGate') {
      const activeGate = encryptionGates.find((gate) => gate.id === defaultGateId) || encryptionGates[0] || null;
      const gateValue = activeGate?.id || '';
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
          </div>
          <div className={styles.defaultGateControl}>
            {activeGate && (
              <span className={styles.gateColor} style={{ background: activeGate.color }} />
            )}
            <Input
              type="select"
              className={styles.defaultGateSelect}
              value={gateValue}
              onChange={(e) => setDefaultGateId(e.target.value)}
              disabled={!encryptionGates.length}
            >
              {encryptionGates.map((gate) => (
                <option key={gate.id} value={gate.id}>{gate.label || gate.id}</option>
              ))}
            </Input>
          </div>
        </FormGroup>
      );
    }

    if (keyString === 'defaultFeaturedSBTs') {
      const selections = normalizeSbtSelection(value);
      const uniqueSelections = selections.filter((sbt, idx, arr) => {
        const addr = toStr(sbt.address).toLowerCase();
        return addr && arr.findIndex((other) => toStr(other.address).toLowerCase() === addr) === idx;
      });
      return (
        <FeaturedSbtField
          key={keyString}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
          createButtonLabel={`Create ${t('sbt')}`}
          onCreateSbt={() => launchCreateSbtModal({ targetType: 'defaultFeaturedSBTs' })}
          selectedSBTs={uniqueSelections}
          onSelectionsChange={(next) => {
            updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(next));
          }}
          onRemove={(address) => handleRemoveDefaultFeaturedSbt(address)}
          selectorLabel={`Choose ${t('sbts')} to feature by default`}
          network={network}
          additionalSBTOptions={pendingSbtSelectorOptions}
          chainId={selectorSourceChainId}
          sessionSlug={selectorSourceSessionConfig?.slug || resolvedActiveSessionSlug || ''}
          sessionConfig={selectorSourceSessionConfig}
          sbtCacheRevision={sbtCacheRevision}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />
      );
    }

    if (path.length === 0 && key === 'contracts') {
      const contracts = value && typeof value === 'object' ? value : {};
      const defaults = getSessionWizardContractDefaults(registryChainId);
      const visibleKeys = getVisibleSessionWizardContractKeys(contracts, defaults);
      const isCollapsed = metadataObjectCollapsed.contracts;
      return (
        <ContractsSection
          key={keyString}
          title={displayLabel}
          contracts={contracts}
          defaults={defaults}
          visibleKeys={visibleKeys}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, contracts: !prev.contracts }))
          }
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          renderContractEntry={(contractKey) => {
            const entry = contracts[contractKey] || {};
            const address = toStr(entry.address || '').trim() || toStr(defaults?.[contractKey] || '').trim();
            const contractTooltipId = `gw-contract-tooltip-${contractKey}`;
            const contractLabel = formatContractLabel(contractKey);
            return (
              <div
                key={contractKey}
                className={styles.contractRow}
                data-testid={getSessionWizardContractRowTestId(contractKey)}
              >
                <div className={styles.contractRowHeader}>
                  <div className={styles.contractLabelActions}>
                    <div className={styles.contractLabel}>{contractLabel}</div>
                    <div className={styles.contractActions}>
                      {renderSessionWizardInfoTooltip({
                        id: contractTooltipId,
                        content: getContractExplainer(contractKey),
                        placement: 'right',
                        testId: getSessionWizardContractTooltipTestId(contractKey),
                        ariaLabel: `${contractLabel} contract info`,
                      })}
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.contractActionButton}`}
                        onClick={() => openContractViewerModal(contractKey)}
                        aria-label={`Open ${contractLabel} contract details`}
                        title={`Open ${contractLabel} contract details`}
                        data-testid={getSessionWizardContractModalTriggerTestId(contractKey)}
                      >
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                      </button>
                    </div>
                  </div>
                </div>
                <Input
                  className={styles.contractInput}
                  value={address}
                  placeholder="0x..."
                  onChange={(e) => updateDraftValue(['contracts', contractKey, 'address'], e.target.value)}
                />
              </div>
            );
          }}
        />
      );
    }

    if (path.length === 0 && key === 'faucet') {
      const faucet = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.faucet;
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
            <button
              type="button"
              className={styles.objectToggle}
              onClick={() =>
                setMetadataObjectCollapsed((prev) => ({ ...prev, faucet: !prev.faucet }))
              }
            >
              <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
            </button>
          </div>
          {!isCollapsed && (
            <div className={styles.objectBody}>
              {Object.entries(faucet).map(([childKey, childValue]) =>
                renderField(childKey, childValue, currentPath)
              )}
            </div>
          )}
        </div>
      );
    }

    if (path.length === 0 && key === 'ai') {
      const ai = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.ai;
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
            <button
              type="button"
              className={styles.objectToggle}
              onClick={() =>
                setMetadataObjectCollapsed((prev) => ({ ...prev, ai: !prev.ai }))
              }
            >
              <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
            </button>
          </div>
          {!isCollapsed && (
            <div className={styles.objectBody}>
              {Object.entries(ai).map(([childKey, childValue]) =>
                renderField(childKey, childValue, currentPath)
              )}
            </div>
          )}
        </div>
      );
    }

    if (path.length === 0 && key === 'lit') {
      if (wizardMode !== 'advanced') return null;
      const lit = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.lit;
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
            <button
              type="button"
              className={styles.objectToggle}
              onClick={() =>
                setMetadataObjectCollapsed((prev) => ({ ...prev, lit: !prev.lit }))
              }
            >
              <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
            </button>
          </div>
          {!isCollapsed && (
            <div className={styles.objectBody}>
              {Object.entries(lit).map(([childKey, childValue]) =>
                renderField(childKey, childValue, currentPath)
              )}
            </div>
          )}
        </div>
      );
    }

    if (path.length === 0 && key === 'blockLimits') {
      return (
        <BlockLimitsField
          key={keyString}
          blockLimits={value}
          onStartChange={(raw) => {
            blockStartManualRef.current = true;
            updateDraftValue(['blockLimits', 'start'], raw === '' ? null : Number(raw));
          }}
          blockLimitDuration={blockLimitDuration}
          blockLimitUnit={blockLimitUnit}
          onDurationChange={setBlockLimitDuration}
          onUnitChange={setBlockLimitUnit}
          latestChainBlock={latestChainBlock}
          latestBlockStatus={latestBlockStatus}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
        />
      );
    }

    if (Array.isArray(value)) {
      const isFlat = isStringArray(value);
      const display = isFlat ? value.join('\n') : JSON.stringify(value, null, 2);
      return (
        <LockableFieldFrame
          key={keyString}
          {...fieldFrameProps}
          fieldError={fieldErrors[keyString]}
        >
          <Input
            type="textarea"
            rows="4"
            value={display}
            onChange={(e) => updateArrayValue(currentPath, e.target.value, !isFlat)}
            className={styles.textarea}
          />
        </LockableFieldFrame>
      );
    }

    if (value && typeof value === 'object') {
      const childNodes = Object.entries(value)
        .map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))
        .filter(Boolean);
      const isContractsBlock = path.length === 0 && key === 'contracts';
      const isCollapsed = isContractsBlock && metadataObjectCollapsed.contracts;
      if (isContractsBlock) {
        return (
          <ContractsSection
            key={keyString}
            title={displayLabel}
            variant="object"
            childNodes={childNodes}
            emptyMessage="No editable fields in this section yet."
            isCollapsed={isCollapsed}
            onToggleCollapsed={() =>
              setMetadataObjectCollapsed((prev) => ({ ...prev, contracts: !prev.contracts }))
            }
          />
        );
      }
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
          </div>
          <div className={styles.objectBody}>
            {childNodes.length ? childNodes : (
              <div className={styles.helperText}>
                {key === 'arweave' && workerSecretsEnabled
                  ? 'Arweave keys are stored in worker secrets.'
                  : 'No editable fields in this section yet.'}
              </div>
            )}
          </div>
        </div>
      );
    }

    const isBool = typeof value === 'boolean';
    const isNumber = typeof value === 'number';
    if (isBool) {
      const checkboxClass = keyString === 'autoFeatureSBTsBySessionSlug' ? styles.checkboxOffset : '';
      return (
        <LockableFieldFrame
          key={keyString}
          {...fieldFrameProps}
          labelInlineControl={(
            <Input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateDraftValue(currentPath, !!e.target.checked)}
              disabled={isDefaultFilterState || isNetworkChainField}
              className={`${styles.inlineCheckbox} ${checkboxClass}`}
            />
          )}
        />
      );
    }
    if (isSessionHeaderField) {
      if (isNormalMode) {
        return (
          <LockableFieldFrame
            key={keyString}
            {...fieldFrameProps}
            label="Image"
            labelPrefix={<FontAwesomeIcon icon={faImage} className={styles.compactSessionHeaderIcon} />}
          >
            <SessionHeaderField
              compact
              value={draft?.sessionHeader}
              sessionHeaderMode={sessionHeaderMode}
              compactSessionHeaderMode={compactSessionHeaderMode}
              sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
              sessionHeaderUploadStatus={sessionHeaderUploadStatus}
              sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
              compactSessionHeaderInputRef={compactSessionHeaderInputRef}
              onCompactUrlChange={(event) => {
                updateDraftValue(['sessionHeader'], event.target.value);
                setSessionHeaderStatus('');
              }}
              onToggleCompactUrlMode={() => {
                setCompactSessionHeaderMode((prev) => (prev === 'url' ? 'idle' : 'url'));
                setSessionHeaderMode('url');
                setSessionHeaderFile(null);
                setSessionHeaderStatus('');
              }}
              onPaste={handlePasteSessionHeaderFromClipboard}
              onCompactUploadClick={() => {
                setCompactSessionHeaderMode('idle');
                setSessionHeaderMode('upload');
                setSessionHeaderStatus('');
                if (compactSessionHeaderInputRef.current) {
                  compactSessionHeaderInputRef.current.click();
                }
              }}
              onCompactFileChange={(event) => {
                setSessionHeaderMode('upload');
                setSessionHeaderFile(event.target.files?.[0] || null);
                setSessionHeaderStatus('');
              }}
              onClear={handleClearSessionHeaderPreview}
            />
          </LockableFieldFrame>
        );
      }
      return (
        <LockableFieldFrame key={keyString} {...fieldFrameProps}>
          <SessionHeaderField
            value={value}
            sessionHeaderMode={sessionHeaderMode}
            compactSessionHeaderMode={compactSessionHeaderMode}
            sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
            sessionHeaderUploadStatus={sessionHeaderUploadStatus}
            sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
            onUrlChange={(e) => updateDraftValue(currentPath, e.target.value)}
            onUseUrlMode={() => {
              setSessionHeaderMode('url');
              setSessionHeaderFile(null);
              setSessionHeaderStatus('');
            }}
            onUseUploadMode={() => {
              setSessionHeaderMode('upload');
              setSessionHeaderStatus('');
            }}
            onAdvancedFileChange={(e) => setSessionHeaderFile(e.target.files?.[0] || null)}
            onClear={handleClearSessionHeaderPreview}
            onExpandPreview={() => setSessionHeaderPreviewModalOpen(true)}
          />
        </LockableFieldFrame>
      );
    }

    if (isQuestionsPrompt) {
      const promptPreview = seedGenPrompt.replace('<GroupCustomInstructions>', toStr(value || ''));
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
            <Button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowPromptPreview((prev) => !prev)}
            >
              Preview prompt <FontAwesomeIcon icon={showPromptPreview ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
            </Button>
          </div>
          <Input
            type="textarea"
            rows="4"
            value={value == null ? '' : value}
            onChange={(e) => updateDraftValue(currentPath, e.target.value)}
            className={styles.textarea}
          />
          {showPromptPreview && (
            <div className={styles.promptPreview}>
              <pre className={styles.promptPreviewText}>{promptPreview}</pre>
            </div>
          )}
        </FormGroup>
      );
    }
    return (
      <LockableFieldFrame
        key={keyString}
        {...fieldFrameProps}
        lockTrailingContent={isSlugField ? (
          <>
            {!privateSlugMode && slugAvailability.status === 'checking' && (
              <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }} title="Checking availability…" />
            )}
            {!privateSlugMode && slugAvailability.status === 'available' && (
              <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 6, color: '#4dffa4', fontSize: 12 }} title="Slug available" data-testid={E2E_TESTIDS.WIZARD_SLUG_AVAILABLE} />
            )}
            {!privateSlugMode && slugAvailability.status === 'taken' && (
              <FontAwesomeIcon icon={faExclamationCircle} style={{ marginLeft: 6, color: '#ffcc7b', fontSize: 12 }} title="Slug already taken" data-testid={E2E_TESTIDS.WIZARD_SLUG_TAKEN} />
            )}
          </>
        ) : null}
        fieldError={slugValidationError}
      >
        <Input
          type={isNumber ? 'number' : 'text'}
          value={value == null ? '' : value}
          disabled={
            isDefaultFilterState ||
            isNetworkChainField ||
            (isSlugField && (privateSlugMode || slugPinnedByPendingSbtDrafts))
          }
          data-testid={e2eTestId || undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (isCorsWorkerField) setWorkerUrlAutoFilled(false);
            updateDraftValue(currentPath, isNumber ? Number(raw) : raw);
          }}
        />
        {isSlugField && slugPinnedByPendingSbtDrafts && (
          <div className={styles.helperText}>
            {`Queued ${t('sbt')} drafts pinned this slug so their uploaded metadata stays aligned with the final session URL.`}
          </div>
        )}
      </LockableFieldFrame>
    );
  };

  const applyEncryption = async (metadata) => {
    const encryptedKeys = Object.keys(encryptedFieldGates || {}).filter((key) => key !== 'slug');
    // Testing mode: we do not remap legacy cached gate keys.
    // Only canonical `session*` field paths are encrypted from this point forward.
    const onChainFields = {};
    // Reset any stale encryption artifacts from cached drafts before rebuilding.
    delete metadata.encryptedFields;
    delete metadata.encryptedFieldGates;
    delete metadata.encryption;
    delete metadata.sessionInfoEncrypted;
    if (!encryptedKeys.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      return { metadata, onChainFields };
    }

    const chainId = Number(metadata.networkChainId || registryChainId || network?.id || 0) || null;
    const litChain = resolveLitChain({ chainId });

    const encryptedFields = {};
    const encryptedFieldGatesOut = {};
    const encryptionQueue = [];
    for (const key of encryptedKeys) {
      const selectedGateIds = normalizeGateIds(encryptedFieldGates[key] ?? encryptedFieldGates?.[key])
        .map((id) => toStr(id).trim())
        .filter(Boolean);
      if (!selectedGateIds.length) continue;
      const path = key.split('.');
      const value = getValueAtPath(metadata, path);
      if (value == null || value === '') continue;

      const recipients = [];
      const appliedGateIds = [];

      for (const gateId of selectedGateIds) {
        const gate = getGateById(gateId);
        if (!gate) continue;
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((s) => s.address)
          .filter(Boolean);
        if (!sbtAddresses.length) {
          if (typeof console !== 'undefined') {
            log.warn('[lit][encrypt] skipping gate without SBTs', { key, gateId });
          }
          continue;
        }
        const accessControlConditions = buildSbtAccessControlConditions({
          sbtAddresses,
          chainId,
          litChain,
          mode: gate.mode,
        });
        if (!accessControlConditions) continue;
        recipients.push({ accessControlConditions, chain: litChain });
        appliedGateIds.push(gateId);
      }

      if (!recipients.length) continue;

      encryptionQueue.push({
        key,
        gateIds: appliedGateIds,
        path,
        value,
        recipients,
      });
    }

    if (!encryptionQueue.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      metadata.encryptedFields = encryptedFields;
      metadata.encryptedFieldGates = encryptedFieldGatesOut;
      return { metadata, onChainFields };
    }

    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to encrypt fields.');
    }
    const hooks = getGlobalLitHooks();
    if (!hooks || typeof hooks.saveKey !== 'function') {
      throw new Error('Lit hooks not initialized.');
    }

    if (typeof console !== 'undefined') {
      const litNetwork = hooks?.litNetwork || null;
      log.info('[lit][encrypt] start', {
        fields: encryptionQueue.length,
        chainId,
        litChain,
        litNetwork,
      });
    }

    for (const entry of encryptionQueue) {
      const { key, gateIds, path, value, recipients } = entry;
      let envelope;
      try {
        if (typeof console !== 'undefined') {
          log.info('[lit][encrypt] field start', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            recipientCount: Array.isArray(recipients) ? recipients.length : 0,
          });
        }
        envelope = await cryptoUtils.encryptEnvelopeValue(value, {
          providerLike: provider,
          account,
          chainId,
          contextLabel: `group:${metadata.slug || 'group'}:${key}`,
          lit: {
            saveKey: hooks.saveKey,
            accessControlConditions: recipients?.[0]?.accessControlConditions,
            chain: recipients?.[0]?.chain || litChain,
            recipients,
          },
        });
      } catch (err) {
        if (typeof console !== 'undefined') {
          log.error('[lit][encrypt] field failed', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            message: err?.message || err,
          });
        }
        throw err;
      }

      const onChainFieldKey = getOnChainFieldKeyForPath(path);
      const skipEncryptedFields = (path.length === 1 && path[0] === 'sessionInfo');
      if (path.length >= 4 && path[0] === 'ai' && path[1] === 'providers' && path[path.length - 1] === 'apiKey') {
        const providerKey = path[2];
        const encryptedPath = ['ai', 'providers', providerKey, 'encryptedApiKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length >= 4 && path[0] === 'rpc' && path[1] === 'providers' && path[path.length - 1] === 'apiKey') {
        const providerKey = path[2];
        const encryptedPath = ['rpc', 'providers', providerKey, 'encryptedApiKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length === 1 && path[0] === 'sessionInfo') {
        metadata.sessionInfoEncrypted = envelope;
        setValueAtPath(metadata, path, '');
      } else if (path.length === 2 && path[0] === 'arweave' && path[1] === 'jwk') {
        const encryptedPath = ['arweave', 'encryptedJwk'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length === 2 && path[0] === 'faucet' && path[1] === 'privateKey') {
        const encryptedPath = ['faucet', 'encryptedPrivateKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else {
        setValueAtPath(metadata, path, '');
      }
      if (onChainFieldKey) {
        onChainFields[onChainFieldKey] = envelope;
      } else if (!skipEncryptedFields) {
        encryptedFields[key] = envelope;
      }
      const cleanGateIds = Array.isArray(gateIds)
        ? gateIds.map((id) => toStr(id).trim()).filter(Boolean)
        : [];
      if (cleanGateIds.length === 1) {
        encryptedFieldGatesOut[key] = cleanGateIds[0];
      } else if (cleanGateIds.length > 1) {
        encryptedFieldGatesOut[key] = cleanGateIds;
      }
    }

    ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
      if (Object.prototype.hasOwnProperty.call(onChainFields, fieldKey)) return;
      const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
      const value = getValueAtPath(metadata, path);
      if (value != null && value !== '') {
        onChainFields[fieldKey] = value;
      }
    });

    metadata.encryptedFields = encryptedFields;
    metadata.encryptedFieldGates = encryptedFieldGatesOut;
    const gatesById = allEncryptionGates.reduce((acc, gate) => {
      const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
        .map((s) => s.address)
        .filter(Boolean);
      acc[gate.id] = {
        type: 'sbt',
        sbtAddresses,
        mode: gate.mode,
        chainId,
        litChain,
        color: gate.color,
        label: gate.label,
      };
      return acc;
    }, {});
    const gateIds = allEncryptionGates.map((gate) => gate.id);
    const gateCounts = {};
    Object.values(encryptedFieldGatesOut || {}).forEach((value) => {
      if (!value) return;
      const ids = Array.isArray(value) ? value : [value];
      ids.forEach((id) => {
        const gateId = toStr(id).trim();
        if (!gateId) return;
        gateCounts[gateId] = (gateCounts[gateId] || 0) + 1;
      });
    });
    let primaryGateId = gateIds[0] || null;
    if (primaryGateId) {
      gateIds.forEach((id) => {
        if ((gateCounts[id] || 0) > (gateCounts[primaryGateId] || 0)) {
          primaryGateId = id;
        }
      });
    }
    metadata.encryption = { gates: gatesById };
    if (primaryGateId && gatesById[primaryGateId]) {
      metadata.encryption.gate = gatesById[primaryGateId];
    }

    return { metadata, encryptedFields, onChainFields };
  };

  const stripSecretFieldsFromMetadata = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return;
    if (metadata.ai && typeof metadata.ai === 'object') {
      delete metadata.ai.providers;
      delete metadata.ai.mode;
      delete metadata.ai.provider;
    }
    if (metadata.rpc && typeof metadata.rpc === 'object') {
      delete metadata.rpc;
    }
    if (metadata.arweave && typeof metadata.arweave === 'object') {
      delete metadata.arweave;
    }
    if (metadata.faucet && typeof metadata.faucet === 'object') {
      delete metadata.faucet.privateKey;
      delete metadata.faucet.encryptedPrivateKey;
    }
    if (metadata.encryptedFields && typeof metadata.encryptedFields === 'object') {
      Object.keys(metadata.encryptedFields).forEach((key) => {
        if (isSecretFieldPath(key.split('.'))) {
          delete metadata.encryptedFields[key];
        }
      });
    }
    if (metadata.encryptedFieldGates && typeof metadata.encryptedFieldGates === 'object') {
      Object.keys(metadata.encryptedFieldGates).forEach((key) => {
        if (isSecretFieldPath(key.split('.'))) {
          delete metadata.encryptedFieldGates[key];
        }
      });
    }
  };

  const buildMetadataPayload = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
    const metadata = normalizeSessionNaming(normalizeLitMetadataNetwork(deepClone(draft)));
    const authAccount = toStr(signerAccountOverride || resolvedWalletAccountRef.current || account).trim();
    metadata.sessionName = toStr(metadata.sessionName || '').trim();
    metadata.sessionInfo = toStr(metadata.sessionInfo || '').trim();
    if (!metadata.sessionName) delete metadata.sessionName;
    if (!metadata.sessionInfo) delete metadata.sessionInfo;
    metadata.slug = normalizeSlug(metadata.slug);
    const resolvedAutoFeature = resolveAutoFeatureBySessionSlug(metadata);
    delete metadata.autoFeatureSBTsWithFeaturedSbtTags;
    if (resolvedAutoFeature !== undefined) {
      metadata.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
    }
    const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionId);
    const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
    metadata.sessionId = formattedSessionId || toStr(sessionId).trim() || '';
    if (sessionIdHex) {
      metadata.sessionIdHex = sessionIdHex;
    } else {
      delete metadata.sessionIdHex;
    }
    delete metadata.sponsoredSbtAddress;
    if (metadata.defaultFeaturedSBTs != null) {
      if (Array.isArray(metadata.defaultFeaturedSBTs)) {
        metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs
          .map((entry) => (typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress))
          .map((entry) => toStr(entry).trim())
          .filter(Boolean);
      } else if (typeof metadata.defaultFeaturedSBTs === 'string') {
        metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs
          .split(/[\n,]+/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      } else {
        metadata.defaultFeaturedSBTs = [];
      }
      const seen = new Set();
      metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs.filter((entry) => {
        const lower = entry.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
    }
    if (sessionHeaderMode === 'upload') {
      if (sessionHeaderFile) {
        setSessionHeaderStatus('Uploading header image…', 'loading');
        const format = resolveSessionHeaderImageFormat(sessionHeaderFile);
        if (!format) {
          throw new Error('Unsupported header image format. Use png, jpg, jpeg, or gif.');
        }
        let arweaveJwk = toStr(getCurrentWorkerSecrets().arweaveJwk).trim();
        if (!arweaveJwk && !workerSecretsEnabled) {
          const resolved = await getEffectiveArweaveKey({
            sessionConfig: metadata,
            sessionSlug: metadata.slug || '',
            context: { account: authAccount, providerLike: provider, chainId: metadata.networkChainId || registryChainId },
          });
          arweaveJwk = resolved?.arweaveJwk || '';
        }
        const headerRequestId = `arw_header_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const baseUrl = normalizeWorkerAuthUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
        const uploadAuthOptions = await buildSessionWizardPublishArweaveUploadOptions({
          arweaveJwk,
          workerUrl: baseUrl,
          sessionSlug: metadata.slug,
          authAccount,
        });
        log.info('[arweave][ui] header upload start', {
          requestId: headerRequestId,
          workerUrl: uploadAuthOptions.forceDirectArweaveUpload ? null : uploadAuthOptions.workerUrl || null,
          sessionSlug: metadata.slug || '',
          adminAddress: null,
          hasJwk: !!uploadAuthOptions.arweaveJwk,
          ts: new Date().toISOString(),
        });
        let headerTxId;
        try {
          headerTxId = await arweaveScripts.uploadDataToArweave(sessionHeaderFile, format, {
            sessionConfig: metadata,
            sessionSlug: metadata.slug || '',
            context: { account: authAccount, providerLike: provider, chainId: metadata.networkChainId || registryChainId },
            requestId: headerRequestId,
            ...uploadAuthOptions,
          });
        } catch (err) {
          log.error('[arweave][ui] header upload error', {
            requestId: headerRequestId,
            message: err?.message || err,
            ts: new Date().toISOString(),
          });
          throw err;
        }
        log.info('[arweave][ui] header upload success', {
          requestId: headerRequestId,
          txId: headerTxId,
          ts: new Date().toISOString(),
        });
        metadata.sessionHeader = `ar://${headerTxId}`;
        setSessionHeaderStatus('Header image uploaded.');
      } else {
        metadata.sessionHeader = '';
      }
    } else {
      setSessionHeaderStatus('');
    }
    const normalizedBlockLimits = normalizeBlockLimitsForConfig(metadata.blockLimits, latestChainBlock);
    if (normalizedBlockLimits) {
      metadata.blockLimits = normalizedBlockLimits;
    }
    stripSecretFieldsFromMetadata(metadata);
    // Keep selected Lit gate id for encryption UX, but do not write auth gate authority to metadata.
    if (metadata.lit && typeof metadata.lit === 'object') {
      metadata.lit.defaultGateId = defaultGateId || metadata.lit.defaultGateId;
    }
    // PRD 424 tracks per-member budget semantics and enforcement. Keep the field hidden until then.
    metadata.perMemberSpendLimits = {
      ...(metadata.perMemberSpendLimits || {}),
      ai: gateSelections.ai?.perMemberLimit || metadata.perMemberSpendLimits?.ai || '',
      arweave: gateSelections.arweave?.perMemberLimit || metadata.perMemberSpendLimits?.arweave || '',
      txGas: gateSelections.txGas?.perMemberLimit || metadata.perMemberSpendLimits?.txGas || '',
    };
    const result = await applyEncryption(metadata);
    result.metadata = sanitizeSessionWizardMetadataPayload(result.metadata, {
      fieldOrder: METADATA_FIELD_ORDER,
      sanitizeContracts: sanitizeSessionWizardContracts,
      normalizeAiProvider,
      normalizeAiModels,
      normalizeAiModelForProvider,
      defaultAiModels: DEFAULT_AI_MODELS,
    });
    result.onChainFields = buildSessionWizardRegistrySessionFields({
      onChainFields: result.onChainFields,
      sponsoredFields: buildSponsoredFlagFields(),
    });
    return { ...result };
  };

  const handleUploadMetadata = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
    let uploadRequestId = '';
    try {
      const rawSlug = toStr(draft.slug).trim();
      const slugValidationError = getSessionSlugValidationError(rawSlug);
      if (slugValidationError) {
        throw new Error(slugValidationError);
      }
      setStatus('Preparing metadata…');
      const authAccount = toStr(signerAccountOverride || resolvedWalletAccountRef.current || account).trim();
      const { metadata, onChainFields } = await buildMetadataPayload({
        workerUrlOverride,
        signerAccountOverride: authAccount,
      });
      setStatus('Uploading to Arweave…');
      let arweaveJwk = toStr(getCurrentWorkerSecrets().arweaveJwk).trim();
      if (!arweaveJwk && !workerSecretsEnabled) {
        const resolved = await getEffectiveArweaveKey({
          sessionConfig: draft,
          sessionSlug: draft.slug || '',
          context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
        });
        arweaveJwk = resolved?.arweaveJwk || '';
      }
      uploadRequestId = `arw_meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const baseUrl = normalizeWorkerAuthUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
      const uploadAuthOptions = await buildSessionWizardPublishArweaveUploadOptions({
        arweaveJwk,
        workerUrl: baseUrl,
        sessionSlug: draft.slug,
        authAccount,
      });
      log.info('[arweave][ui] metadata upload start', {
        requestId: uploadRequestId,
        workerUrl: uploadAuthOptions.forceDirectArweaveUpload ? null : uploadAuthOptions.workerUrl || null,
        sessionSlug: draft.slug || '',
        adminAddress: null,
        hasJwk: !!uploadAuthOptions.arweaveJwk,
        ts: new Date().toISOString(),
      });
      const txId = await arweaveScripts.uploadDataToArweave(metadata, 'json', {
        sessionConfig: draft,
        sessionSlug: draft.slug || '',
        context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
        requestId: uploadRequestId,
        ...uploadAuthOptions,
      });
      log.info('[arweave][ui] metadata upload success', {
        requestId: uploadRequestId,
        txId,
        ts: new Date().toISOString(),
      });
      const metadataUri = `ar://${txId}`;
      setMetadataTxId(txId);
      setMetadataUrl(metadataUri);
      setPendingOnChainFields(onChainFields || {});
      setStatus('Uploaded metadata to Arweave.');
      clearCachedArweaveJwkAfterUpload();
      return { txId, metadataUri, onChainFields: onChainFields || {} };
    } catch (err) {
      log.error('[arweave][ui] metadata upload error', {
        requestId: uploadRequestId || null,
        message: err?.message || err,
        ts: new Date().toISOString(),
      });
      const errorMessage = err?.message || 'Failed to upload metadata.';
      setStatus(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const buildDeferredCreateSbtComponentProps = ({
    sessionSlugOverride = '',
    workerUrlOverride = '',
    accountOverride = '',
  } = {}) => {
    const chainId = Number(
      draftRef.current?.networkChainId ||
      registryChainId ||
      network?.id ||
      network?.chainId ||
      0
    ) || null;
    const sessionSlug = toStr(
      sessionSlugOverride ||
      draftRef.current?.slug ||
      resolvedActiveSessionSlug ||
      ''
    ).trim();
    return {
      account: toStr(accountOverride || resolvedWalletAccountRef.current || account).trim(),
      provider,
      network: getChainById(chainId) || (
        chainId
          ? { id: chainId, name: getChainName(chainId) || `Chain ${chainId}` }
          : (network || { id: null, name: '' })
      ),
      loginComplete: true,
      toggleLoginModal,
      sessionSlug,
      sessionConfigOverride: {
        ...(draftRef.current && typeof draftRef.current === 'object' ? draftRef.current : {}),
        slug: sessionSlug,
        corsWorkerUrl: normalizeWorkerAuthUrl(
          toStr(workerUrlOverride || draftRef.current?.corsWorkerUrl).trim()
        ),
        networkChainId: chainId,
        contracts: (
          draftRef.current &&
          typeof draftRef.current?.contracts === 'object'
        ) ? draftRef.current.contracts : {},
      },
      arweaveJwkOverride: getEnabledWorkerArweaveJwk(workerSecretsRef.current),
      encryptionGates: encryptionGates.map((gate) => ({
        id: gate.id,
        gateId: gate.id,
        label: gate.label,
        name: gate.label,
        color: gate.color,
        mode: gate.mode,
        requireAll: gate.mode === 'all',
        sbtAddresses: normalizeSbtSelection(gate.sbts || []).map((entry) => entry.address),
        chainId,
      })),
      defaultGateId: defaultGateId || encryptionGates[0]?.id || '',
      defaultSbtTags: draftRef.current?.defaultSbtTags || '',
      deferredDeploy: true,
      attemptImmediateDeferredUpload: true,
      hideNetworkSelector: true,
      // Publish finalization should use the resolved session worker first.
      // A provided JWK stays available as fallback inside the upload helper.
      preferDirectArweaveUpload: false,
      signAdminAction: signBootstrapAdminAction,
    };
  };

  const deployPendingSbtDrafts = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
    const draftsToDeploy = normalizePendingSbtDrafts(pendingSbtDrafts).filter((entry) => entry.deployed !== true);
    if (!draftsToDeploy.length) return [];

    const sessionConfigForDeploy = {
      ...(draft && typeof draft === 'object' ? draft : {}),
      slug: resolvedActiveSessionSlug || draft.slug || '',
      networkChainId: Number(draft.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null,
      contracts: (draft && typeof draft.contracts === 'object') ? draft.contracts : {},
    };
    const deployContextSignature = buildPendingSbtDeployContextSignature(
      sessionConfigForDeploy,
      registryChainId || network?.id || network?.chainId || null
    );
    const incompatibleDraft = draftsToDeploy.find((entry) => {
      const storedSignature = toStr(
        entry?.deploymentContextSignature ||
        buildPendingSbtDeployContextSignature(
          {
            networkChainId: entry?.networkChainId,
            contracts: {
              sbtFactory: {
                address: entry?.sbtFactoryAddress,
              },
            },
          },
          null
        )
      ).trim();
      return !!storedSignature && storedSignature !== deployContextSignature;
    });
    if (incompatibleDraft) {
      throw new Error(
        'Pending SBT drafts were created for a different session chain or SBT factory. Recreate them before publishing.'
      );
    }

    const deployedDrafts = [];
    for (let index = 0; index < draftsToDeploy.length; index += 1) {
      const sbtDraft = draftsToDeploy[index];
      const needsMetadataFinalization = !toStr(sbtDraft.tokenURI).trim();
      setStatus(
        needsMetadataFinalization
          ? `Finalizing ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`
          : `Deploying ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`
      );
      const { finalizedDraft, receipt } = await deploySessionWizardPendingSbtDraft({
        sbtDraft,
        providerLike: provider,
        sessionConfigForDeploy,
        workerUrlOverride,
        createSbtComponentProps: buildDeferredCreateSbtComponentProps({
          sessionSlugOverride: sbtDraft.sessionSlug,
          workerUrlOverride,
          accountOverride: signerAccountOverride,
        }),
      });
      if (toStr(finalizedDraft.tokenURI).trim() !== toStr(sbtDraft.tokenURI).trim()) {
        setPendingSbtDrafts((prev) => prev.map((entry) => (
          toStr(entry?.predictedAddress).trim().toLowerCase() === toStr(finalizedDraft.predictedAddress).trim().toLowerCase()
            ? {
                ...entry,
                tokenURI: finalizedDraft.tokenURI,
                metadataUploadStatus: finalizedDraft.metadataUploadStatus || 'ready',
                metadataPreview: finalizedDraft.metadataPreview || entry?.metadataPreview || null,
                authoringPayload: finalizedDraft.authoringPayload || entry?.authoringPayload,
              }
            : entry
        )));
      }

      const sbtAddress = resolveSbtAddressFromFactoryReceipt(receipt);
      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        throw new Error(`Failed to resolve deployed address for ${finalizedDraft.displayName}.`);
      }
      if (toStr(finalizedDraft.predictedAddress).trim().toLowerCase() !== sbtAddress.toLowerCase()) {
        throw new Error(
          `Deterministic deploy mismatch for ${finalizedDraft.displayName}: expected ${finalizedDraft.predictedAddress}, received ${sbtAddress}.`
        );
      }

      persistSessionWizardSbtRecoveryCodes({
        finalizedDraft,
        sbtAddress,
        sessionConfigForDeploy,
      });

      const deployedDraft = {
        ...finalizedDraft,
        tokenURI: finalizedDraft.tokenURI,
        metadataUploadStatus: finalizedDraft.metadataUploadStatus || sbtDraft.metadataUploadStatus || 'ready',
        metadataPreview: finalizedDraft.metadataPreview || sbtDraft.metadataPreview || null,
        authoringPayload: finalizedDraft.authoringPayload || sbtDraft.authoringPayload,
        deployed: true,
        deployedAddress: sbtAddress,
        deploymentTxHash: receipt?.transactionHash || '',
      };
      deployedDrafts.push(deployedDraft);

      setPendingSbtDrafts((prev) => prev.map((entry) => (
        toStr(entry?.predictedAddress).trim().toLowerCase() === sbtAddress.toLowerCase()
          ? { ...entry, ...deployedDraft }
          : entry
      )));
    }

    return deployedDrafts;
  };

  const handleRegisterGroup = async ({ metadataUriOverride, sessionFieldsOverride } = {}) => {
    try {
      const rawSlug = toStr(draft.slug).trim();
      // Empty slug maps to the on-chain "general" session; metadata keeps ''.
      const registrySlug = sessionRegistryUtils.toRegistrySlug(rawSlug);
      const sessionIdHexValue = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
      if (!sessionIdHexValue) throw new Error('Session ID (UUID) is required.');
      if (!registryAddress) throw new Error('Registry address is not configured for this chain.');
      const effectiveMetadataUrl =
        normalizeArweaveUri(metadataUriOverride) ||
        normalizeArweaveUri(manualMetadataUrl) ||
        metadataUrl;
      if (!effectiveMetadataUrl) throw new Error('Upload metadata or provide a manual Arweave URI.');
      const registryChainIdValue = Number(registryChainId || draft.networkChainId || 0);
      try {
        const registryRead = sessionRegistryUtils.getRegistryContract(registryChainIdValue);
        if (registryRead) {
          if (typeof registryRead.sessionExists === 'function') {
            const slugExists = await registryRead.sessionExists(registrySlug);
            if (slugExists) {
              throw new Error(`Session slug already exists on-chain: ${registrySlug}`);
            }
          }
          if (typeof registryRead.sessionIdExists === 'function') {
            const idExists = await registryRead.sessionIdExists(sessionIdHexValue);
            if (idExists) {
              throw new Error('Session ID already exists on-chain. Generate a new session ID.');
            }
          }
        }
      } catch (err) {
        if (err?.message) throw err;
      }

      setRegisterTxs([]);
      setStatus('Registering session on-chain…');
      const gateSelectionsSnapshot = buildGateSelectionsSnapshot();
      const effectiveSessionFields = sessionFieldsOverride !== undefined
        ? (sessionFieldsOverride || {})
        : pendingOnChainFields;
      const result = await registerSessionOnChain({
        providerLike: provider,
        chainId: registryChainIdValue,
        registryAddress,
        slug: registrySlug,
        sessionId: sessionIdHexValue,
        sessionChainId: Number(draft.networkChainId || 0),
        metadataURI: effectiveMetadataUrl,
        encryptedMetadataURI: '',
        gateSelections: gateSelectionsSnapshot,
        sessionFields: effectiveSessionFields,
        gasLimitOverride: manualGasLimit,
        gasPriceGwei: manualGasPriceGwei,
        maxFeePerGasGwei: manualMaxFeePerGasGwei,
        maxPriorityFeePerGasGwei: manualMaxPriorityFeePerGasGwei,
        onTxHash: (entry) => {
          setRegisterTxs((prev) => [...prev, entry]);
        },
      });
      if (result?.txs?.length) {
        setRegisterTxs(result.txs);
      }
      setStatus('Session registered on-chain.');
      const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionIdHexValue) || sessionIdHexValue;
      setSessionUrl(buildSessionUrl({ slug: registrySlug }));
      const adminLink = buildAdminUrl({
        sessionId: formattedSessionId,
        chainId: registryChainIdValue,
      });
      setAdminUrl(adminLink);
      setAdminUrlStatus('');
      clearSessionWizardCache();
      const nextSessionId = generateSessionId();
      setSessionId(nextSessionId);
      setSessionIdStatus('Generated a new session ID for your next session.');
      try {
        const refreshed = await sessionRegistryUtils.fetchSessionFromRegistry({
          chainId: Number(registryChainId || draft.networkChainId || 0),
          slug: registrySlug,
          providerLike: provider,
          account,
          lit: getGlobalLitHooks(),
        });
        if (refreshed) {
          sessionRegistryUtils.upsertSessionRegistryCache({ config: refreshed });
        }
      } catch (e) { log.warn('SessionWizard: fallback', e); }
    } catch (err) {
      const txHash = err?.transactionHash || err?.transaction?.hash || '';
      if (txHash) {
        setRegisterTxs((prev) => {
          if (prev.some((entry) => entry.hash === txHash)) return prev;
          return [...prev, { action: 'createSession', hash: txHash }];
        });
      }
      const errorMessage = err?.message || 'Failed to register session.';
      setStatus(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const handlePublish = async () => {
    if (publishBusy) return;
    setPublishStep(0);
    setSessionUrl('');
    const slugValidationError = getSessionSlugValidationError(draft?.slug);
    if (slugValidationError) {
      setStatus(slugValidationError);
      return;
    }
    if (loginComplete !== true) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      setStatus(
        loginInProgress
          ? 'Finish logging in before publishing this session.'
          : 'Connect your wallet to publish this session.'
      );
      return;
    }
    const resolvedPublisher = await resolveConnectedAdminAddress();
    if (!resolvedPublisher) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      setStatus('Connect your wallet to publish this session.');
      return;
    }
    setPublishBusy(true);
    try {
      const pendingDraftSnapshot = normalizePendingSbtDrafts(pendingSbtDrafts);
      const hasPendingDrafts = pendingDraftSnapshot.some((entry) => entry.deployed !== true);
      const hasManualMetadata = Boolean(normalizeArweaveUri(manualMetadataUrl));
      const currentWorkerSecrets = getCurrentWorkerSecrets();
      const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
        wizardMode,
        sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
        deployForm: deployFormRef.current,
        workerSecretsEnabled: workerSecretsEnabledRef.current,
        currentWorkerSecrets,
        getMissingWorkerSecretsForDeploy,
        hasBundleFile: !!bundleFile,
        normalModeBundleUrlOverride,
      });
      const shouldAutoDeployWorker = resolveSessionWizardShouldAutoDeployWorker({
        workerMode,
        sponsoredAutoDeployReady: sponsoredAutoDeployState.ready,
        deployComplete,
      });
      const publishStepNumbers = buildSessionWizardPublishStepNumbers({
        shouldAutoDeployWorker,
        hasPendingDrafts,
        hasManualMetadata,
      });
      let uploadResult = null;
      let workerUrlOverride = '';
      let deployedPendingDrafts = [];
      if (shouldAutoDeployWorker) {
        setPublishStep(publishStepNumbers['deploy-worker']);
        const deployResult = await handleDeployWorker({ forceSponsoredAutoDeploy: true });
        if (!deployResult?.ok) {
          throw new Error(deployResult?.error || 'Worker deploy failed.');
        }
        if (!deployResult?.deployComplete || !deployResult?.workerUrl) {
          throw new Error('Worker deploy did not return a verified worker URL.');
        }
        workerUrlOverride = deployResult.workerUrl;
      }
      if (hasPendingDrafts) {
        setPublishStep(publishStepNumbers['deploy-sbts']);
        deployedPendingDrafts = await deployPendingSbtDrafts({
          workerUrlOverride,
          signerAccountOverride: resolvedPublisher,
        });
      }
      if ((canUploadMetadataNow || sponsoredAutoDeployState.ready) && !hasManualMetadata) {
        setPublishStep(publishStepNumbers['upload-metadata']);
        uploadResult = await handleUploadMetadata({
          workerUrlOverride,
          signerAccountOverride: resolvedPublisher,
        });
      }
      setPublishStep(publishStepNumbers['register-session']);
      await handleRegisterGroup({
        metadataUriOverride: uploadResult?.metadataUri,
        sessionFieldsOverride: uploadResult?.onChainFields,
      });
      const normalizedDeployedPendingDrafts = normalizePendingSbtDrafts(deployedPendingDrafts);
      const newlyDeployedPendingAddressSet = new Set(
        normalizedDeployedPendingDrafts
          .map((entry) => toStr(entry?.predictedAddress || entry?.deployedAddress).trim().toLowerCase())
          .filter(Boolean)
      );
      // Retry publish can resume with some drafts already marked deployed from a
      // previous partial failure. Promote those selectors too before clearing
      // pending drafts, or the stale pending entries get pruned on success.
      promoteDeployedPendingSbtSelections([
        ...normalizedDeployedPendingDrafts,
        ...pendingDraftSnapshot.filter((entry) => (
          entry?.deployed === true &&
          !newlyDeployedPendingAddressSet.has(
            toStr(entry?.predictedAddress || entry?.deployedAddress).trim().toLowerCase()
          )
        )),
      ]);
      setPendingSbtDrafts([]);
      setPublishStep(publishStepNumbers.done);
    } catch (err) {
      setStatus(err?.message || 'Publish failed.');
      setPublishStep(0);
    } finally {
      setPublishBusy(false);
    }
  };

  const scheduleAdminUrlStatusReset = () => {
    if (adminUrlStatusTimerRef.current) {
      clearTimeout(adminUrlStatusTimerRef.current);
      adminUrlStatusTimerRef.current = null;
    }
    adminUrlStatusTimerRef.current = setTimeout(() => {
      adminUrlStatusTimerRef.current = null;
      setAdminUrlStatus('');
    }, 2500);
  };

  const scheduleSessionIdStatusReset = () => {
    if (sessionIdStatusTimerRef.current) {
      clearTimeout(sessionIdStatusTimerRef.current);
      sessionIdStatusTimerRef.current = null;
    }
    sessionIdStatusTimerRef.current = setTimeout(() => {
      sessionIdStatusTimerRef.current = null;
      setSessionIdStatus('');
    }, 2500);
  };

  const scheduleJsonCopiedReset = () => {
    if (jsonCopiedTimerRef.current) {
      clearTimeout(jsonCopiedTimerRef.current);
      jsonCopiedTimerRef.current = null;
    }
    jsonCopiedTimerRef.current = setTimeout(() => {
      jsonCopiedTimerRef.current = null;
      setJsonCopied(false);
    }, 1500);
  };

  const handleCopyAdminUrl = async () => {
    const url = toStr(adminUrl).trim();
    if (!url) {
      setAdminUrlStatus('Admin URL unavailable yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify.success('Copied to clipboard');
      setAdminUrlStatus('Admin URL copied.');
    } catch {
      setAdminUrlStatus('Copy failed. Select the URL manually.');
    }
    scheduleAdminUrlStatusReset();
  };

  const isArweaveTxId = (value) => /^[a-z0-9_-]{43}$/i.test(value);
  const isArweaveGatewayHost = (host) => host.endsWith('arweave.net') || host.endsWith('arweave.dev') || host.endsWith('arweave.app');
  const extractArweaveTxId = (raw) => {
    const value = toStr(raw).trim();
    if (!value) return '';
    if (value.startsWith('ar://')) {
      const txId = value.slice(5).trim();
      return isArweaveTxId(txId) ? txId : '';
    }
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      const segments = parsed.pathname.split('/').filter(Boolean);
      const candidate = segments[segments.length - 1] || '';
      if (isArweaveGatewayHost(host) && isArweaveTxId(candidate)) {
        return candidate;
      }
    } catch (e) { log.warn('SessionWizard: fallback', e); }
    return isArweaveTxId(value) ? value : '';
  };

  const parseArweaveTxId = (raw) => extractArweaveTxId(raw);

  const normalizeArweaveUri = (raw) => {
    const value = toStr(raw).trim();
    if (!value) return '';
    if (value.startsWith('ar://')) return value;
    const txId = extractArweaveTxId(value);
    if (txId) return `ar://${txId}`;
    return value;
  };

  const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
  const sessionIdDisplay = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();

  const handleCopySessionId = async () => {
    const value = sessionIdDisplay || '';
    if (!value) {
      setSessionIdStatus('Enter a valid session ID first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify.success('Copied to clipboard');
      setSessionIdStatus('Copied session ID.');
    } catch {
      setSessionIdStatus('Copy failed.');
    }
    scheduleSessionIdStatusReset();
  };

  const handleCopyLitPayerAddress = async (value) => {
    const nextValue = toStr(value).trim();
    if (!nextValue) return;
    try {
      await navigator.clipboard.writeText(nextValue);
      notify.success('Copied to clipboard');
    } catch {
      notify.warn('Copy failed');
    }
  };

  const handleRegenerateSessionId = () => {
    if (slugPinnedByPendingSbtDrafts && privateSlugMode) {
      setSessionIdStatus('Remove queued SBT drafts before changing the session URL.');
      scheduleSessionIdStatusReset();
      return;
    }
    if (isSessionIdRegenerating) return;
    const next = generateSessionId();
    setSessionId(next);
    setSessionIdStatus('Generated a new session ID.');
    setIsSessionIdRegenerating(true);
    if (sessionIdRotationTimerRef.current) {
      clearTimeout(sessionIdRotationTimerRef.current);
    }
    sessionIdRotationTimerRef.current = setTimeout(() => {
      setIsSessionIdRegenerating(false);
      sessionIdRotationTimerRef.current = null;
    }, 650);
    scheduleSessionIdStatusReset();
  };

  const handleCopyDraftJson = () => {
    navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).then(() => {
      notify.success('Copied to clipboard');
      setJsonCopied(true);
      scheduleJsonCopiedReset();
    }).catch((e) => { void e; notify.warn('Copy failed'); });
  };

  const getExplorerBaseUrl = (chainId) => {
    const chain = getChainById(Number(chainId || 0));
    return toStr(chain?.blockExplorers?.default?.url).trim();
  };

  const normalizeSlug = (slug) => sessionRegistryUtils.normalizeSlug(slug);
  const normalizeWorkerUrl = (url) => normalizeWorkerAuthUrl(url);
  const buildSessionUrl = ({ slug }) => {
    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) return '';
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${base}/session/${encodeURIComponent(normalizedSlug)}`;
  };
  const buildAdminUrl = ({ sessionId, chainId }) => {
    const params = new URLSearchParams();
    if (sessionId) params.set('sessionId', sessionId);
    if (chainId) params.set('chainId', String(chainId));
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const query = params.toString();
    return `${base}/admin${query ? `?${query}` : ''}`;
  };

  const resolveWorkerBaseUrl = () => {
    const fallbackWorkerUrl = getDefaultWorkerUrl();
    const configuredWorkerUrl = toStr(draft.corsWorkerUrl).trim();
    const effectiveConfiguredWorkerUrl = (
      wizardMode === 'normal' &&
      !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED &&
      !deployComplete &&
      isDefaultWorkerPlaceholderUrl(configuredWorkerUrl, fallbackWorkerUrl)
    )
      ? ''
      : configuredWorkerUrl;
    return resolveSessionWizardWorkerBaseUrl({
      configuredWorkerUrl: effectiveConfiguredWorkerUrl,
      deployWorkerUrl: deployComplete ? deployWorkerUrl : '',
      fallbackWorkerUrl,
      workerMode: (wizardMode === 'normal' && !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED) ? 'custom' : workerMode,
    });
  };

  const resolveWorkerRpcUrl = () => {
    const chainId = Number(registryChainId || draft.networkChainId || network?.id || 0) || null;
    const providers = draft?.rpc?.providers || {};
    const pathProvider = providers.path || draft?.rpc?.path || {};
    return resolveSessionWizardWorkerRpcUrl({
      chainId,
      pathProvider,
      faucetRpcUrl: draft?.faucet?.rpcUrl,
    });
  };

  const resolveWorkerRpcUrlMap = () => {
    const providers = draft?.rpc?.providers || {};
    const pathProvider = providers.path || draft?.rpc?.path || {};
    const chainId = Number(registryChainId || draft.networkChainId || network?.id || 0) || null;
    return buildSessionWizardWorkerRpcUrlMap({ chainId, pathProvider });
  };

  const resolveWorkerFaucetConfig = () => {
    const faucetCfg = draft?.faucet || {};
    const fallbackIfUnset = (val, fallback) => {
      const cleaned = toStr(val).trim();
      return cleaned ? cleaned : toStr(fallback).trim();
    };
    const chainId = Number(registryChainId || draft.networkChainId || network?.id || 0) || null;
    const defaultRpcUrl = resolveWorkerRpcUrl() || getDefaultHttpRpc(chainId) || resolveFallbackRpcUrl(chainId);
    return {
      rpcUrl: fallbackIfUnset(faucetCfg.rpcUrl, defaultRpcUrl),
      amountEth: fallbackIfUnset(faucetCfg.amountEth, '0.0002'),
      balanceThresholdEth: fallbackIfUnset(faucetCfg.balanceThresholdEth, '0.001'),
    };
  };
  const effectiveDefaultWorkerRpcUrl = toStr(resolveWorkerRpcUrl()).trim();
  const resolvedWorkerBaseUrlForDelegation = resolveWorkerBaseUrl();

  const parseAllowOriginsInput = () => {
    const raw = toStr(workerAllowOrigins).trim();
    if (!raw) return [];
    const entries = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const normalized = normalizeOriginList(entries);
    return normalized.length ? normalized : normalizeOriginList(DEFAULT_WORKER_ALLOWED_ORIGINS);
  };

  const getAiModelProviders = () => {
    const fastProvider = normalizeAiProvider(draft?.ai?.models?.fast?.provider || 'openai');
    const thinkingProvider = normalizeAiProvider(draft?.ai?.models?.thinking?.provider || 'openai');
    return { fastProvider, thinkingProvider };
  };

  const getResourceSecretFields = (resourceKey) => {
    if (resourceKey !== 'ai') return RESOURCE_SECRET_FIELDS[resourceKey] || [];
    const { fastProvider, thinkingProvider } = getAiModelProviders();
    const fields = [...RESOURCE_SECRET_FIELDS.ai];
    if (fastProvider === 'anthropic' || thinkingProvider === 'anthropic') fields.push(ANTHROPIC_AI_SECRET_FIELD);
    if (fastProvider === 'openrouter' || thinkingProvider === 'openrouter') fields.push(OPENROUTER_AI_SECRET_FIELD);
    return fields;
  };

  const buildSponsoredFlagFields = (secretsSnapshot = getCurrentWorkerSecrets()) => {
    const currentSlug = normalizeSlug(draft?.slug || '');
    const currentWorkerUrl = normalizeWorkerAuthUrl(resolvedWorkerBaseUrlForDelegation);
    const fallbackFields = (
      currentSlug &&
      currentSlug === normalizeSlug(provisionedSponsoredContext?.sessionSlug || '') &&
      (!currentWorkerUrl || !provisionedSponsoredContext?.workerUrl || currentWorkerUrl === provisionedSponsoredContext.workerUrl)
    )
      ? provisionedSponsoredContext?.fields
      : {};

    return buildSponsoredSessionFlagFields({
      secrets: sanitizeSessionWizardWorkerSecretsForLitMode(
        secretsSnapshot,
        { litPayerWalletInputEnabled }
      ),
      fallbackFields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
        fallbackFields,
        { litPayerWalletInputEnabled }
      ),
      workerSecretsEnabled,
    });
  };

  // Build a snapshot of gate selections from the current gate UI (default gate + resource mapping).
  // This keeps on-chain resource gates aligned with the selected default gate even if state updates are still pending.
  const buildGateSelectionsSnapshot = () => {
    const chainId = Number(registryChainId || draft.networkChainId || 0) || null;
    const resolvedDefaultGateId = defaultGateId || encryptionGates[0]?.id || '';
    const snapshot = {};
    workerResourceKeys.forEach((key) => {
      const gate = resolveResourceGate(resourceGateMap[key], resolvedDefaultGateId);
      if (!gate) return;
      if (gate.hasConflicts) {
        const reason = [
          ...(gate.conflictSummary?.modeConflicts ? ['mode'] : []),
          ...(gate.conflictSummary?.chainIdConflicts ? ['chain'] : []),
          ...(gate.conflictSummary?.perMemberLimitConflicts ? ['per-member limit'] : []),
        ];
        throw new Error(`Resource "${key}" has conflicting gate settings (${reason.join(', ')}).`);
      }
      const prev = gateSelections?.[key] || {};
      snapshot[key] = {
        sbts: gate.sbts,
        mode: gate.mode || 'any',
        chainId,
        perMemberLimit: prev.perMemberLimit || '',
      };
    });
    return snapshot;
  };


  const getMissingWorkerSecretsForDeploy = (secretsSnapshot = getCurrentWorkerSecrets()) => {
    const missing = [];
    const { fastProvider, thinkingProvider } = getAiModelProviders();
    if ((fastProvider === 'openai' || thinkingProvider === 'openai') && !toStr(secretsSnapshot.openaiKey).trim()) {
      missing.push('OpenAI key');
    }
    if ((fastProvider === 'anthropic' || thinkingProvider === 'anthropic') && !toStr(secretsSnapshot.anthropicKey).trim()) {
      missing.push('Anthropic key');
    }
    if ((fastProvider === 'openrouter' || thinkingProvider === 'openrouter') && !toStr(secretsSnapshot.openrouterKey).trim()) {
      missing.push('OpenRouter key');
    }
    if (!toStr(secretsSnapshot.arweaveJwk).trim()) missing.push('Arweave JWK');
    const rpcUrl = resolveWorkerRpcUrl();
    if (!rpcUrl) missing.push('RPC URL (include key in URL)');
    return missing;
  };

  useEffect(() => {
    const previousHooks = getGlobalLitHooks();
    const chainId = Number(registryChainId || draft?.networkChainId || network?.id || 0) || null;
    const litPayerPrivateKeyForWizard = litPayerWalletInputEnabled
      ? toStr(workerSecrets.litPayerPrivateKey).trim()
      : '';
    const paymentDelegation = resolveSessionWizardLitPaymentDelegation({
      workerSecretsEnabled,
      resolvedWorkerUrl: resolvedWorkerBaseUrlForDelegation,
      litPayerPrivateKey: litPayerPrivateKeyForWizard,
      draft,
      chainId,
    });
    const nextHooks = createLitHooks({
      providerLike: provider,
      account,
      chainId,
      litChain: resolveLitChain({ chainId }),
      litNetwork: draft?.lit?.network || draft?.litNetwork || previousHooks?.litNetwork || 'naga-dev',
      paymentDelegation,
    });
    setGlobalLitHooks(nextHooks);
    return () => {
      setGlobalLitHooks(previousHooks);
    };
  }, [
    account,
    draft,
    network?.id,
    provider,
    registryChainId,
    resolvedWorkerBaseUrlForDelegation,
    litPayerWalletInputEnabled,
    workerSecretsEnabled,
    workerSecrets.litPayerPrivateKey,
  ]);

  const clearWorkerSecretFields = () => {
    const aiProviders = draft?.ai?.providers || {};
    Object.keys(aiProviders).forEach((key) => {
      updateDraftValue(['ai', 'providers', key, 'apiKey'], '');
      updateDraftValue(['ai', 'providers', key, 'encryptedApiKey'], '');
    });
    const rpcProviders = draft?.rpc?.providers || {};
    Object.keys(rpcProviders).forEach((key) => {
      updateDraftValue(['rpc', 'providers', key, 'apiKey'], '');
      updateDraftValue(['rpc', 'providers', key, 'encryptedApiKey'], '');
    });
    updateDraftValue(['arweave', 'jwk'], '');
    updateDraftValue(['arweave', 'encryptedJwk'], '');
    updateDraftValue(['faucet', 'privateKey'], '');
    updateDraftValue(['faucet', 'encryptedPrivateKey'], '');
  };

  // Cache worker secrets only until they've been submitted in a deploy payload.
  // After a successful deploy, stop persisting secrets to cache. Keep the live
  // in-memory copy so the current publish run can still finish without forcing
  // the user to re-enter keys.
  const clearCachedWorkerSecretsAfterDeploy = () => {
    if (effectivePersistWorkerSecrets) return;
  };

  // After successful metadata upload, clear arweaveJwk from cache (skip in dev).
  const clearCachedArweaveJwkAfterUpload = () => {
    if (effectivePersistWorkerSecrets) return;
    applyWorkerSecretsUpdate((prev) => ({ ...prev, arweaveJwk: '' }));
  };

  const signBootstrapAdminAction = async ({ statement, targetSlug, workerUrl, accountOverride = '' }) => {
    const baseUrl = normalizeWorkerUrl(workerUrl || resolveWorkerBaseUrl());
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
    return buildSignedBootstrapAdminAuth({
      slug: normalizeSlug(targetSlug),
      workerUrl: baseUrl,
      statement,
      context: {
        account: authAccount,
        chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  };

  const buildSessionWizardPublishArweaveUploadOptions = async ({
    arweaveJwk = '',
    workerUrl = '',
    sessionSlug = '',
    authAccount = '',
  } = {}) => (
    // Regression guard: keep session metadata/header uploads on the same
    // sponsored-JWK path as deferred SBT finalization so /new publish does not
    // fix only one Arweave leg and regress the next.
    resolvePublishArweaveUploadOptions({
      arweaveJwk,
      workerUrl,
      preferDirectArweaveUpload: !!toStr(arweaveJwk).trim(),
      allowDirectFallbackOnBootstrapFailure: false,
      requireAdminAuthWithoutJwk: true,
      buildAdminAuth: ({ workerUrl: resolvedWorkerUrl }) => (
        signBootstrapAdminAction({
          statement: 'Admin request: bootstrap arweave upload',
          targetSlug: sessionSlug,
          workerUrl: resolvedWorkerUrl,
          accountOverride: authAccount,
        })
      ),
    })
  );

  const signTypedAdminAction = async ({ action = 'set-config', body = {}, targetSlug, workerUrl, accountOverride = '' }) => {
    const baseUrl = normalizeWorkerUrl(workerUrl || resolveWorkerBaseUrl());
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
    return buildSignedAdminActionAuth({
      action,
      slug: normalizeSlug(targetSlug),
      body,
      workerUrl: baseUrl,
      context: {
        account: authAccount,
        chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  };

  const resolveConnectedAdminAddress = async () => {
    const cachedResolved = toStr(resolvedWalletAccountRef.current || account).trim();
    if (cachedResolved) return cachedResolved;

    const providerObj = cryptoUtils._getProvider(provider || 'wagmi');
    if (!providerObj) return '';

    let resolvedAddress = toStr(providerObj?.selectedAddress || providerObj?.address).trim();
    if (typeof providerObj.request === 'function') {
      try {
        const accounts = await providerObj.request({ method: 'eth_accounts' });
        if (Array.isArray(accounts) && accounts[0]) {
          resolvedAddress = toStr(accounts[0]).trim();
        }
      } catch (_) {}
    }

    if (resolvedAddress) {
      resolvedWalletAccountRef.current = resolvedAddress;
      setDeployForm((prev) => (
        toStr(prev?.adminAddress).trim()
          ? prev
          : { ...prev, adminAddress: resolvedAddress }
      ));
    }
    return resolvedAddress;
  };

  const handleDeployWorker = async (options = {}) => {
    let helperBase = '';
    const forceSponsoredAutoDeploy = options?.forceSponsoredAutoDeploy === true;
    let effectiveBundleMode = 'upload';
    try {
      const currentDeployForm = (
        deployFormRef.current &&
        typeof deployFormRef.current === 'object'
      ) ? deployFormRef.current : deployForm;
      const rawSlug = toStr(draft.slug).trim();
      const slugValidationError = getSessionSlugValidationError(rawSlug);
      if (slugValidationError) {
        setDeployStatus(slugValidationError);
        return { ok: false, error: slugValidationError };
      }
      if (loginComplete !== true) {
        const loginMessage = (
          loginInProgress
            ? 'Finish logging in before deploying the worker.'
            : 'Connect your wallet to set the admin address.'
        );
        if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
        setDeployStatus(loginMessage);
        return { ok: false, error: loginMessage };
      }
      setDeployStatus('Deploying worker…');
      setDeployInFlight(true);
      setDeployComplete(false);
      setWorkerUrlAutoFilled(false);
      const slug = normalizeSlug(rawSlug) || 'general';
      const resolvedAdmin = await resolveConnectedAdminAddress();
      if (!resolvedAdmin) {
        if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
        throw new Error('Connect your wallet to set the admin address.');
      }
      const configuredWorkerUrlBeforeDeploy = normalizeWorkerUrl(toStr(draft.corsWorkerUrl).trim());
      const workerConfigError = getSessionWizardWorkerDeployValidationError({
        registryAddress,
        registryChainId,
        networkChainId: draft.networkChainId,
        pathProvider: draft?.rpc?.providers?.path || draft?.rpc?.path || {},
        faucetRpcUrl: draft?.faucet?.rpcUrl,
      });
      if (workerConfigError) {
        throw new Error(workerConfigError);
      }
      const currentWorkerSecrets = getCurrentWorkerSecrets();
      if (workerSecretsEnabled) {
        const missing = getMissingWorkerSecretsForDeploy(currentWorkerSecrets);
        if (missing.length) {
          throw new Error(`Missing required secrets before deploy: ${missing.join(', ')}`);
        }
      }
      // Regression guard: deploy-ready sponsored links still force the URL path
      // in normal mode, but manual retry must still be able to override that
      // path with an uploaded bundle file after a remote fetch failure.
      const sponsoredAutoDeployReady = (
        workerMode !== 'default' &&
        resolveSessionWizardSponsoredAutoDeployReadiness({
          wizardMode,
          sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
          deployForm: currentDeployForm,
          workerSecretsEnabled,
          currentWorkerSecrets,
          getMissingWorkerSecretsForDeploy,
          hasBundleFile: !!bundleFile,
          normalModeBundleUrlOverride,
        }).ready
      );
      effectiveBundleMode = resolveSessionWizardDeployBundleMode({
        wizardMode,
        bundleMode,
        bundleUrl: currentDeployForm.bundleUrl,
        sponsoredAutoDeployReady: forceSponsoredAutoDeploy || sponsoredAutoDeployReady,
        forceSponsoredAutoDeploy,
        forceManualBundleFile,
        hasBundleFile: !!bundleFile,
        normalModeBundleUrlOverride,
      });
      if (effectiveBundleMode === 'upload' && !bundleFile) {
        throw new Error(
          effectiveBundleMode === 'upload' && wizardMode === 'normal'
            ? 'Upload a worker bundle file before deploy.'
            : 'Upload a worker bundle file or switch to bundle URL.'
        );
      }
      const requestedBundleUrl = resolveSessionWizardBundleUrlForMode({
        wizardMode,
        bundleUrl: currentDeployForm.bundleUrl,
        normalModeBundleUrlOverride,
      });
      const {
        bundleText,
        bundleUrl,
      } = await resolveSessionWizardDeployBundlePayload({
        effectiveBundleMode,
        bundleFile,
        bundleUrl: requestedBundleUrl,
      });
      const deploySecrets = workerSecretsEnabled ? buildWorkerSecretsPayload(currentWorkerSecrets) : {};
      const deployBlockLimits = normalizeBlockLimitsForConfig(draft?.blockLimits, latestChainBlock);
      const payload = {
        workerName: currentDeployForm.workerName,
        sessionSlug: slug,
        bundleUrl,
        bundleText: bundleText || undefined,
        registryAddress: toStr(registryAddress).trim(),
        registryChainId: Number(registryChainId || draft.networkChainId || 0) || 0,
        adminAddress: resolvedAdmin,
        rpcUrl: resolveWorkerRpcUrl(),
        rpcUrlsByChainId: resolveWorkerRpcUrlMap(),
        allowOrigins: parseAllowOriginsInput(),
        limits: Number(workerLimitPerWallet || 0) ? { perWalletPerDay: Number(workerLimitPerWallet) } : {},
        scopes: {},
        faucet: resolveWorkerFaucetConfig(),
        embeddedDeployHelperEnabled,
      };
      if (deployBlockLimits) {
        payload.blockLimits = deployBlockLimits;
      }
      if (Object.keys(deploySecrets).length) {
        payload.secrets = deploySecrets;
      }
      const normalizedSponsoredBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundleAppliedBundleRef.current);
      const sponsoredDeployGrantToken = toStr(normalizedSponsoredBundle?.deployGrantToken || '').trim();
      const sponsoredBootstrapWorkerUrl = resolveSponsoredBundleBootstrapWorkerUrl(normalizedSponsoredBundle);
      const submitDeployPayload = async (deployPayload) => {
        if ((forceSponsoredAutoDeploy || sponsoredAutoDeployReady) && sponsoredDeployGrantToken && sponsoredBootstrapWorkerUrl) {
          helperBase = sponsoredBootstrapWorkerUrl;
          const sponsoredDeployRes = await fetch(`${sponsoredBootstrapWorkerUrl}/sponsored/redeem-deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deployGrantToken: sponsoredDeployGrantToken,
              deployPayload,
            }),
          });
          const nextDeployStatusCode = sponsoredDeployRes.status;
          const nextData = await sponsoredDeployRes.json().catch(() => ({}));
          if (!sponsoredDeployRes.ok) {
            const err = new Error(nextData?.error || `Worker deploy failed (${sponsoredDeployRes.status}).`);
            err.statusCode = sponsoredDeployRes.status;
            err.responseError = nextData?.error || '';
            err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
            throw err;
          }
          return {
            deployStatusCode: nextDeployStatusCode,
            data: nextData,
          };
        }

        helperBase = normalizeWorkerUrl(deployHelperUrl);
        if (!helperBase) throw new Error('Deploy-helper URL is missing.');
        if (!currentDeployForm.apiToken || !currentDeployForm.workerName) {
          throw new Error('Fill in API token and worker name.');
        }
        const res = await fetch(`${helperBase}/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...deployPayload,
            apiToken: currentDeployForm.apiToken,
            accountId: toStr(currentDeployForm.accountId || '').trim() || undefined,
          }),
        });
        const nextDeployStatusCode = res.status;
        const nextData = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(nextData?.error || `Worker deploy failed (${res.status}).`);
          err.statusCode = res.status;
          err.responseError = nextData?.error || '';
          err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
          throw err;
        }
        return {
          deployStatusCode: nextDeployStatusCode,
          data: nextData,
        };
      };
      let deployStatusCode = 0;
      let data = {};
      ({ deployStatusCode, data } = await submitDeployPayload(payload));
      const {
        resolvedDeployWorkerUrl,
        displayWorkerUrl,
        deployComplete: isDeployVerified,
      } = resolveDeployWorkerState({
        responseWorkerUrl: data?.workerUrl,
        configuredWorkerUrl: configuredWorkerUrlBeforeDeploy,
      });
      if (data?.workerUrl && resolvedDeployWorkerUrl) {
        updateDraftValue(['corsWorkerUrl'], resolvedDeployWorkerUrl);
        setWorkerMode('custom');
        setWorkerUrlAutoFilled(true);
      }
      const workerConfigPayload = {
        ...buildSessionWizardWorkerConfigPayload({
          slug,
          draft,
          deployPayload: payload,
          account: toStr(resolvedAdmin || currentDeployForm.adminAddress || account).trim(),
          registryAddress,
          registryChainId,
          networkChainId: network?.id,
          sessionId,
          latestChainBlock,
          workerUrl: resolvedDeployWorkerUrl,
          resolveWorkerFaucetConfig,
        }),
        corsWorkerUrl: resolvedDeployWorkerUrl,
      };
      const ensureWorkerSessionConfig = async ({ workerUrl, slug: targetSlug }) => {
        const requestBody = {
          sessionSlug: targetSlug,
          adminAddress: workerConfigPayload.adminAddress || account || '',
          config: workerConfigPayload,
        };
        const auth = await signTypedAdminAction({
          action: 'set-config',
          body: requestBody,
          targetSlug,
          workerUrl,
          accountOverride: resolvedAdmin,
        });
        const configRes = await fetch(`${workerUrl}/admin/set-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestBody,
            adminAddress: requestBody.adminAddress || auth.address,
            ...auth,
          }),
        });
        const configData = await configRes.json().catch(() => ({}));
        if (!configRes.ok) {
          throw new Error(configData?.error || 'Failed to sync worker config after deploy.');
        }
      };
      let configSyncStatus = { warning: '', note: '', synced: false, skipped: true };
      if (resolvedDeployWorkerUrl) {
        configSyncStatus = await syncWorkerConfigAfterPartialDeploy({
          deployResponse: data,
          workerUrl: resolvedDeployWorkerUrl,
          account: resolvedAdmin,
          slug,
          ensureSessionConfig: ensureWorkerSessionConfig,
        });
      } else {
        configSyncStatus = {
          warning: 'Worker URL unavailable - skipped config sync.',
          note: '',
          synced: false,
          skipped: true,
        };
      }
      let secretsSyncStatus = { warning: '', note: '' };
      let helperWritesSecrets = false;
      if (resolvedDeployWorkerUrl && workerSecretsEnabled && Object.keys(deploySecrets).length) {
        helperWritesSecrets = (
          data?.writesSessionSecrets === true ||
          toStr(data?.sessionSecretsKey).startsWith('session:')
        );
        secretsSyncStatus = await syncWorkerSecretsAfterDeploy({
          workerUrl: resolvedDeployWorkerUrl,
          account: resolvedAdmin,
          slug,
          deploySecrets,
          // Older deploy-helper revisions may not write session-prefixed keys.
          // If unknown, force a real sync attempt instead of assuming helper success.
          helperWritesSecrets,
          signAdminAction: ({ targetSlug, workerUrl, body }) => signTypedAdminAction({
            action: 'set-secrets',
            body,
            targetSlug,
            workerUrl,
            accountOverride: resolvedAdmin,
          }),
          ensureSessionConfig: ensureWorkerSessionConfig,
          postSecrets: async ({ auth, secrets, workerUrl, slug }) => {
            const requestBody = {
              sessionSlug: slug,
              secrets,
            };
            const secretsRes = await fetch(`${workerUrl}/admin/set-secrets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...requestBody, ...auth }),
            });
            const secretsData = await secretsRes.json().catch(() => ({}));
            if (!secretsRes.ok) {
              throw new Error(secretsData?.error || 'Failed to sync worker secrets after deploy.');
            }
          },
        });
      }
      cacheSessionWorkerConfigAfterDeploy({
        deployStatusCode,
        configSyncStatus,
        workerUrl: resolvedDeployWorkerUrl,
        slug,
        sessionIdHex,
        registryChainId,
        config: workerConfigPayload,
      });
      if (
        resolvedDeployWorkerUrl &&
        workerSecretsEnabled &&
        Object.keys(deploySecrets).length &&
        (helperWritesSecrets || secretsSyncStatus?.synced === true || secretsSyncStatus?.deferred === true)
      ) {
        setProvisionedSponsoredContext({
          sessionSlug: slug,
          workerUrl: resolvedDeployWorkerUrl,
          fields: buildSponsoredSessionFlagFields({
            secrets: sanitizeSessionWizardWorkerSecretsForLitMode(
              deploySecrets,
              { litPayerWalletInputEnabled }
            ),
            workerSecretsEnabled: true,
          }),
        });
      }
      setDeployWorkerUrl(displayWorkerUrl);
      const baseDeployStatus = withDeployHelperWorkersDevStatus(
        data?.workerUrl ? 'Worker deployed.' : 'Worker deployed (URL unavailable).',
        data,
      );
      setDeployStatus(withWorkerConfigSyncWarning(
        withSecretsSyncStatus(baseDeployStatus, secretsSyncStatus),
        configSyncStatus.warning,
      ));
      setDeployComplete(isDeployVerified);
      // Manual bundle uploads are one-off retries; clear the cached file so
      // later URL-mode deploys and sponsored publish flows don't reuse stale bytes.
      setForceManualBundleFile(false);
      clearSelectedBundleFile();
      setNormalModeBundleUrlOverride('');
      clearCachedWorkerSecretsAfterDeploy();
      return {
        ok: true,
        workerUrl: resolvedDeployWorkerUrl,
        deployComplete: isDeployVerified,
      };
    } catch (err) {
      if (shouldForceSessionWizardNormalModeManualBundleRetry({
        err,
        wizardMode,
        effectiveBundleMode,
        hasBundleFile: !!bundleFile,
      })) {
        setForceManualBundleFile(true);
      }
      const errorMessage = normalizeDeployErrorMessage({ err, helperBase });
      setDeployStatus(errorMessage);
      return {
        ok: false,
        error: errorMessage,
      };
    } finally {
      setDeployInFlight(false);
    }
  };

  const resourceGateOptions = useMemo(
    () => encryptionGates.map((gate) => ({ value: gate.id, label: gate.label || gate.id })),
    [encryptionGates]
  );

  const updateResourceGate = (resourceKey, gateId) => {
    setResourceGateMap((prev) => ({
      ...prev,
      [resourceKey]: gateId,
    }));
  };

  const renderSessionWizardTooltipContent = useCallback(({
    id,
    content,
    placement = 'right',
  } = {}) => {
    const tooltipText = toStr(content).trim();
    if (!sessionWizardTooltipsEnabled || !id || !tooltipText) return null;
    return (
      <CETooltip
        placement={placement}
        trigger="hover focus click"
        target={id}
        className={styles.tooltipBubble}
        delay={0}
        container="body"
      >
        {content}
      </CETooltip>
    );
  }, [sessionWizardTooltipsEnabled]);

  const renderSessionWizardInfoTooltip = useCallback(({
    id,
    content,
    placement = 'right',
    testId = '',
    ariaLabel = 'Show more info',
  } = {}) => {
    const tooltipText = toStr(content).trim();
    if (!sessionWizardTooltipsEnabled || !id || !tooltipText) return null;
    return (
      <>
        <span
          id={id}
          className={styles.tooltipTrigger}
          data-testid={testId || undefined}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
        >
          <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} />
        </span>
        {renderSessionWizardTooltipContent({ id, content, placement })}
      </>
    );
  }, [renderSessionWizardTooltipContent, sessionWizardTooltipsEnabled]);

  const renderResourceInputs = (resourceKey) => {
    const fields = getResourceSecretFields(resourceKey);
    if (!fields.length) {
      return null;
    }
    if (resourceKey === 'lit') {
      const payerPrivateKey = toStr(workerSecrets.litPayerPrivateKey).trim();
      const hasLitPayerPrivateKey = !!payerPrivateKey;
      const payerStatus = getLitPayerWalletStatus(payerPrivateKey);
      const payerAddress = payerStatus.address || toStr(workerSecrets.litPayerAddress).trim();
      return (
        <div className={styles.resourceFields}>
          <div className={styles.litCompactRow}>
            <FormGroup className={`${styles.resourceInput} ${styles.inlineLabelInput} ${styles.litCompactField}`}>
              <Label>Private key</Label>
              <Input
                type="password"
                value={workerSecrets.litPayerPrivateKey || ''}
                placeholder="0x..."
                onChange={(e) => {
                  applyWorkerSecretsUpdate((prev) => ({
                    ...prev,
                    litPayerPrivateKey: e.target.value,
                  }));
                }}
                disabled={!workerSecretsEnabled}
                data-testid={getSessionWizardSecretFieldTestId('litPayerPrivateKey')}
              />
            </FormGroup>
            <Button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                const nextWallet = createLitPayerWallet();
                applyWorkerSecretsUpdate((prev) => ({
                  ...prev,
                  litPayerPrivateKey: nextWallet.privateKey,
                  litPayerAddress: nextWallet.address,
                }));
              }}
              disabled={!workerSecretsEnabled}
            >
              Generate
            </Button>
          </div>
          {hasLitPayerPrivateKey && payerAddress && (
            <FormGroup className={`${styles.resourceInput} ${styles.inlineLabelInput} ${styles.litCompactField}`}>
              <Label>{t('wallet')}</Label>
              <div className={styles.copyFieldRow}>
                <Input
                  type="text"
                  value={payerAddress}
                  readOnly
                  data-testid={getSessionWizardSecretFieldTestId('litPayerAddress')}
                />
                <Button
                  type="button"
                  size="sm"
                  className={styles.secondaryButton}
                  onClick={() => handleCopyLitPayerAddress(payerAddress)}
                  data-testid={E2E_TESTIDS.WIZARD_COPY_LIT_PAYER_ADDRESS}
                  aria-label="Copy Lit payer address"
                >
                  <FontAwesomeIcon icon={faCopy} /> Copy
                </Button>
              </div>
            </FormGroup>
          )}
        </div>
      );
    }
    return (
      <div className={styles.resourceInputGrid}>
        {fields.map((field) => {
          const value = workerSecrets[field.key] ?? '';
          const label = `${field.label}${field.required ? ' *' : ''}`;
          const isTextarea = field.type === 'textarea';
          const placeholder = (
            resourceKey === 'rpc' &&
            field.key === 'customRpcUrl' &&
            !toStr(value).trim()
          )
            ? (effectiveDefaultWorkerRpcUrl || field.placeholder || '')
            : (field.placeholder || '');
          return (
            <FormGroup key={field.key} className={`${styles.resourceInput} ${!isTextarea ? styles.inlineLabelInput : ''}`}>
              <Label>{label}</Label>
              <Input
                type={isTextarea ? 'textarea' : field.type}
                rows={isTextarea ? field.rows || 3 : undefined}
                value={value}
                placeholder={placeholder}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    applyWorkerSecretsUpdate((prev) => ({ ...prev, [field.key]: nextValue }));
                  }}
	                disabled={!workerSecretsEnabled}
                required={workerSecretsEnabled && field.required}
                data-testid={getSessionWizardSecretFieldTestId(field.key)}
              />
              {!isNormalMode && field.key === 'faucetPrivateKey' && showSponsoredFaucetNotice && (
                <div className={styles.helperText}>
                  Faucet funding is currently provided by the sponsored bundle. Enter a private key here to override it.
                </div>
              )}
            </FormGroup>
          );
        })}
      </div>
    );
  };

  const renderResourceCard = (resourceKey) => {
    const fallbackGateId = defaultGateId || resourceGateOptions[0]?.value || '';
    const gateId = resourceGateMap[resourceKey] || fallbackGateId;
    const resourceGateOptionValues = (resourceGateOptions || []).map((option) => option?.value).filter(Boolean);
    const selectedGateIds = normalizeGateIds(gateId)
      .filter((id) => resourceGateOptionValues.includes(id))
      .filter(Boolean);
    const resourceTooltipText = RESOURCE_SECTION_TOOLTIPS[resourceKey] || '';
    const resourceTooltipId = `gw-resource-secret-tip-${resourceKey}`;
    return (
      <div
        key={resourceKey}
        className={styles.gateCard}
        data-testid={E2E_TESTIDS.WIZARD_RESOURCE_CARD}
        data-ce-resource-key={resourceKey}
      >
        <div className={styles.gateHeader}>
          <div className={styles.gateTitleRow}>
            <div className={styles.gateTitle}>{RESOURCE_LABELS[resourceKey] || resourceKey}</div>
            {renderSessionWizardInfoTooltip({
              id: resourceTooltipId,
              content: resourceTooltipText,
              placement: 'right',
              testId: `ce-wizard-resource-tooltip-${resourceKey}`,
              ariaLabel: `${RESOURCE_LABELS[resourceKey] || resourceKey} info`,
            })}
          </div>
          <GateMultiSelectLock
            gateOptions={gateOptions}
            selectedGateIds={selectedGateIds}
            onChangeSelectedGateIds={(nextIds) => {
              const nextGateIds = normalizeGateIds(nextIds).filter((id) => resourceGateOptionValues.includes(id));
              if (!nextGateIds.length) {
                updateResourceGate(resourceKey, fallbackGateId || '');
                return;
              }
              updateResourceGate(resourceKey, nextGateIds.length === 1 ? nextGateIds[0] : nextGateIds);
            }}
            open={openResourceGateKey === resourceKey}
            onToggleOpen={(nextOpen) => setOpenResourceGateKey(nextOpen ? resourceKey : '')}
            disabled={resourceGateOptions.length <= 1}
            showDots={false}
          />
        </div>
        <div className={styles.resourceFields}>
          {renderResourceInputs(resourceKey)}
        </div>
      </div>
    );
  };

  const renderEmbeddedDeployHelperToggle = () => (
    <FormGroup className={styles.bundleToggleGroup}>
      <Label className={styles.workerToggle}>
        <Input
          type="checkbox"
          checked={embeddedDeployHelperEnabled}
          data-testid={E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED}
          onChange={(e) => updateDraftValue(['embeddedDeployHelperEnabled'], !!e.target.checked)}
        />
        <span>Enable embedded deploy-helper on this worker</span>
        {renderSessionWizardInfoTooltip({
          id: 'gw-embedded-deploy-helper-tip',
          content: 'Lets this session worker handle sponsored bootstrap deploys locally first. Turn it off to reduce surface area and force sponsored deploys to fall back to the standalone helper URL.',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-embedded-deploy-helper-tip',
          ariaLabel: 'Embedded deploy-helper info',
        })}
      </Label>
    </FormGroup>
  );

  const orderedDraftEntries = useMemo(() => {
    const keys = Object.keys(draft || {}).filter((key) => !WORKER_ONLY_DRAFT_FIELDS.has(key));
    const ordered = [
      ...TOP_LEVEL_FIELD_ORDER.filter((key) => keys.includes(key)),
      ...keys.filter((key) => !TOP_LEVEL_FIELD_ORDER.includes(key)),
    ];
    return ordered.map((key) => [key, draft[key]]);
  }, [draft]);

  const effectiveMetadataUrl = normalizeArweaveUri(manualMetadataUrl) || metadataUrl;
  const effectiveMetadataTxId = parseArweaveTxId(effectiveMetadataUrl);
  const effectiveMetadataGatewayUrl = effectiveMetadataTxId
    ? arweaveScripts.buildArweaveGatewayUrl(effectiveMetadataTxId)
    : '';
  const registerChainId = Number(registryChainId || draft.networkChainId || 0) || null;
  const registerExplorerBaseUrl = getExplorerBaseUrl(registerChainId);
  const isNormalMode = wizardMode !== 'advanced';
  const embeddedDeployHelperEnabled = typeof draft.embeddedDeployHelperEnabled === 'boolean'
    ? draft.embeddedDeployHelperEnabled
    : (CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false);
  const hasConfiguredDeployHelperUrl = !!normalizeWorkerAuthUrl(toStr(CLOUDFLARE_DEPLOY_HELPER_URL).trim());
  const shouldShowDeployHelperUrlInput = !isNormalMode || !hasConfiguredDeployHelperUrl;

  const primaryDraftEntries = useMemo(
    () => orderedDraftEntries.filter(([key]) => !MORE_OPTIONS_FIELDS.has(key) && !(isNormalMode && key === 'blockLimits')),
    [isNormalMode, orderedDraftEntries]
  );
  const moreOptionsEntries = useMemo(
    () => orderedDraftEntries.filter(([key]) => MORE_OPTIONS_FIELDS.has(key) || (isNormalMode && key === 'blockLimits')),
    [isNormalMode, orderedDraftEntries]
  );

  const renderMoreOptionsSection = () => {
    if (moreOptionsEntries.length === 0) return null;
    const toggleLabel = wizardMode === 'advanced' ? 'More options' : 'Optional details';
    return (
      <div className={styles.moreOptionsSection}>
        <button
          type="button"
          className={styles.moreOptionsToggle}
          onClick={() => setMoreOptionsOpen((prev) => !prev)}
        >
          {toggleLabel} <FontAwesomeIcon icon={moreOptionsOpen ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
        </button>
        {moreOptionsOpen && (
          <div className={styles.moreOptionsBody}>
            {moreOptionsEntries.map(([key, value]) => (
              renderField(key, value, [], isNormalMode && key === 'blockLimits' ? { forceShow: true } : undefined)
            ))}
          </div>
        )}
      </div>
    );
  };

  const resolvedWorkerBaseUrl = resolveWorkerBaseUrl();
  const configuredWorkerUrl = normalizeWorkerUrl(toStr(draft.corsWorkerUrl).trim());
  const defaultWorkerUrl = normalizeWorkerUrl(getDefaultWorkerUrl());
  const deployedWorkerUrl = normalizeWorkerUrl(toStr(deployWorkerUrl).trim());
  const normalModeRequiresCustomWorker = isNormalMode && !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED;
  const {
    deployVerifiedInUi,
    effectiveConfiguredWorkerUrl,
  } = resolveSessionWizardWorkerVerificationUiState({
    configuredWorkerUrl,
    deployWorkerUrl: deployedWorkerUrl,
    defaultWorkerUrl,
    deployComplete,
    normalModeRequiresCustomWorker,
  });
  const customWorkerSelected = normalModeRequiresCustomWorker || workerMode !== 'default';
  const hideNormalModeDefaultWorkerUrl = normalModeRequiresCustomWorker &&
    !deployVerifiedInUi &&
    isDefaultWorkerPlaceholderUrl(configuredWorkerUrl, defaultWorkerUrl);
  const visibleConfiguredWorkerUrl = hideNormalModeDefaultWorkerUrl ? '' : effectiveConfiguredWorkerUrl;
  const displayedWorkerUrl = hideNormalModeDefaultWorkerUrl
    ? ''
    : (toStr(draft.corsWorkerUrl).trim() || visibleConfiguredWorkerUrl);
  const usesDefaultWorkerUrl = !!visibleConfiguredWorkerUrl && !!defaultWorkerUrl && visibleConfiguredWorkerUrl === defaultWorkerUrl;
  const deployWorkerMatchesConfiguredUrl = !!visibleConfiguredWorkerUrl &&
    !!deployedWorkerUrl &&
    visibleConfiguredWorkerUrl === deployedWorkerUrl;
  const showSharedWorkerChoice = !normalModeRequiresCustomWorker;
  const showWorkerUrlField = customWorkerSelected && deployVerifiedInUi;
  const workerUrlSource = !resolvedWorkerBaseUrl
    ? 'missing (set worker URL)'
    : (workerMode === 'default' || usesDefaultWorkerUrl)
      ? 'default worker'
      : deployVerifiedInUi && deployWorkerMatchesConfiguredUrl
        ? 'deployed worker URL (verified this run)'
        : deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl
          ? 'custom worker URL changed after deploy (re-deploy to verify)'
          : 'custom worker URL (not verified in this run)';
  const currentWorkerSecrets = getCurrentWorkerSecrets();
  const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
    wizardMode,
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    deployForm,
    workerSecretsEnabled,
    currentWorkerSecrets,
    getMissingWorkerSecretsForDeploy,
    hasBundleFile: !!bundleFile,
    normalModeBundleUrlOverride,
  });
  const normalModeBundleUrl =
    toStr(CLOUDFLARE_WORKER_BUNDLE_URL).trim();
  const {
    showSponsoredFaucetNotice,
    showSponsoredDeployAccessNotice,
  } = resolveSponsoredBundleAdvancedFieldNotices({
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    workerSecrets,
    deployForm,
  });
  const shouldUseSponsoredAutoDeployFlow = (
    toStr(workerMode).trim() !== 'default' &&
    sponsoredAutoDeployState.ready
  );
  const hasManualBundleFallbackFile = !!bundleFile;
  const sponsoredAutoDeployBundleMode = resolveSessionWizardDeployBundleMode({
    wizardMode,
    bundleMode,
    bundleUrl: deployForm.bundleUrl,
    sponsoredAutoDeployReady: shouldUseSponsoredAutoDeployFlow,
    forceManualBundleFile,
    hasBundleFile: hasManualBundleFallbackFile,
    normalModeBundleUrlOverride,
  });
  const showNormalModeWorkerStep = !(
    sponsoredAutoDeployState.active &&
    toStr(workerMode).trim() !== 'default'
  );
  const sponsoredLocalBundledAssetAvailable = (
    sponsoredAutoDeployBundleMode !== 'upload' ||
    hasManualBundleFallbackFile
  );
  const canUseSponsoredAutoDeployNow = shouldUseSponsoredAutoDeployFlow && sponsoredLocalBundledAssetAvailable;
  const hasNormalModeBundleUrlOverride = !!toStr(normalModeBundleUrlOverride).trim();
  const sponsoredAutoDeployMissingBundleUrl = (
    sponsoredAutoDeployState.active &&
    sponsoredAutoDeployState.missing.includes('Worker bundle URL')
  );
  const showSponsoredBundleFallbackInput = (
    isNormalMode &&
    !showNormalModeWorkerStep &&
    (
      forceManualBundleFile ||
      hasManualBundleFallbackFile ||
      hasNormalModeBundleUrlOverride ||
      sponsoredAutoDeployMissingBundleUrl
    )
  );
  const normalModeBundleUrlOverrideValidationError = useMemo(
    () => getSessionWizardNormalModeBundleUrlOverrideValidationError(normalModeBundleUrlOverride),
    [normalModeBundleUrlOverride]
  );
  const normalModeHostedBundleConfigured = !!toStr(CLOUDFLARE_WORKER_BUNDLE_URL).trim();
  const showNormalModeManualBundleControls = (
    isNormalMode &&
    (forceManualBundleFile || !normalModeHostedBundleConfigured)
  );
  const normalModeBundleHelpText = normalModeHostedBundleConfigured
    ? 'Normal mode deploys use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep this Git URL as the default and add a manual bundle URL or upload below after a fetch failure.'
    : NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE;
  const normalModeManualBundleHelpText = normalModeHostedBundleConfigured
    ? NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE
    : NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE;
  const currentSessionWizardPathname = (
    typeof window === 'undefined' || !window.location ? '' : window.location.pathname
  );
  const isNewSessionWizardRoute = isNewSessionWizardPathname(
    currentSessionWizardPathname
  );
  const newSessionBannerDismissalContextKey = buildSessionWizardNewSessionBannerDismissalContextKey({
    pathname: currentSessionWizardPathname,
    sponsoredBundleId: initialSponsoredBundleId,
    sponsoredBundleKey: initialSponsoredBundleKey,
  });
  const normalizedAppliedSponsoredBundle = normalizeSparseSponsoredBundlePayload(
    sponsoredBundleAppliedBundleRef.current
  );
  const sponsoredBundleStatusTone = toStr(sponsoredBundleStatus?.tone).trim().toLowerCase();
  const hasNewSessionAiRequirementCovered = !!(
    toStr(currentWorkerSecrets?.openaiKey).trim() ||
    toStr(currentWorkerSecrets?.anthropicKey).trim() ||
    toStr(currentWorkerSecrets?.openrouterKey).trim()
  );
  const hasNewSessionArweaveRequirementCovered = !!toStr(currentWorkerSecrets?.arweaveJwk).trim();
  const hasNewSessionFundingRequirementCovered = !!(
    toStr(currentWorkerSecrets?.faucetPrivateKey).trim() ||
    toStr(normalizedAppliedSponsoredBundle?.faucetGrantToken).trim()
  );
  const hasNewSessionDeployRequirementCovered = !!toStr(
    normalizedAppliedSponsoredBundle?.deployGrantToken
  ).trim();
  const sponsoredBundleCoversNewSessionRequirements = (
    sponsoredBundleStatusTone === 'success' &&
    hasNewSessionAiRequirementCovered &&
    hasNewSessionArweaveRequirementCovered &&
    hasNewSessionFundingRequirementCovered &&
    hasNewSessionDeployRequirementCovered
  );
  // Sponsored links should suppress the generic requirements banner while
  // preload is in flight, or after success when the applied bundle covers the
  // publish prerequisites. Faucet-only bundles still leave /new in manual setup
  // mode because Publish needs sponsored deploy access as well.
  const sponsoredBundleOwnsNewSessionEntryFlow = hasSponsoredBundleLink && (
    !sponsoredBundleStatus ||
    sponsoredBundleStatusTone === 'info' ||
    sponsoredBundleCoversNewSessionRequirements
  );
  const isNewSessionBannerDismissedForCurrentContext = (
    !!newSessionBannerDismissalContextKey &&
    newSessionBannerDismissedContext === newSessionBannerDismissalContextKey
  );
  const shouldRespectPersistedNewSessionBannerDismissal = !hasSponsoredBundleLink;
  const showNewSessionRequirementsBanner = isNewSessionWizardRoute &&
    !isNewSessionBannerDismissedForCurrentContext &&
    !(shouldRespectPersistedNewSessionBannerDismissal && persistedNewSessionBannerDismissed) &&
    !sponsoredBundleOwnsNewSessionEntryFlow;
  const canUploadMetadataNow = !!resolvedWorkerBaseUrl && (
    workerMode === 'default' ||
    usesDefaultWorkerUrl ||
    (deployVerifiedInUi && deployWorkerMatchesConfiguredUrl)
  );
  const uploadBlockedReason = !resolvedWorkerBaseUrl
    ? 'Set a worker URL before uploading metadata.'
    : (workerMode !== 'default' && !usesDefaultWorkerUrl && !deployVerifiedInUi)
      ? 'Custom worker mode requires a successful deploy in this run before metadata upload.'
      : (workerMode !== 'default' && !usesDefaultWorkerUrl && deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl)
        ? 'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.'
        : 'Deploy the worker and ensure the worker URL is set before uploading metadata.';
  const hasManualMetadata = !!normalizeArweaveUri(manualMetadataUrl);
  const hasUploadedMetadata = !!normalizeArweaveUri(metadataUrl);
  const canPublishNow = canUploadMetadataNow || canUseSponsoredAutoDeployNow || hasManualMetadata || hasUploadedMetadata;
  const deployStatusLower = toStr(deployStatus).toLowerCase();
  const deployStatusIsError = !!deployStatus &&
    !deployInFlight &&
    !deployVerifiedInUi &&
    !deployStatusLower.includes('worker deployed');
  const pendingDraftCount = normalizedPendingSbtDrafts.length;
  const sessionDetailsComplete = !!toStr(draft?.sessionName).trim() && !!toStr(draft?.sessionInfo).trim();
  const configuredPrivateGateCount = encryptionGates.filter(
    (gate) => normalizeSbtSelection(gate?.sbts || []).length > 0
  ).length;
  const normalModeCards = [
    {
      key: 'metadata',
      title: 'Session Details',
      summary: toStr(draft?.sessionName).trim()
        ? toStr(draft.sessionName).trim()
        : '',
      tone: sessionDetailsComplete ? 'ready' : 'pending',
    },
    {
      key: 'encryption',
      title: 'Privacy',
      summary: configuredPrivateGateCount
        ? `${configuredPrivateGateCount} ${configuredPrivateGateCount === 1 ? `${t('sbt')} ${t('gate')}` : `${t('sbt')} ${t('gates')}`} selected`
        : (privateSlugMode ? 'Private URL enabled' : 'Open link by default'),
      tone: configuredPrivateGateCount || privateSlugMode ? 'ready' : 'neutral',
    },
    ...(showNormalModeWorkerStep ? [{
      key: 'worker',
      title: 'Worker',
      summary: normalModeRequiresCustomWorker
        ? (resolvedWorkerBaseUrl
          ? 'Your worker URL is configured.'
          : 'Deploy or paste your own worker URL.')
        : workerMode === 'default'
          ? 'Using the shared default worker.'
          : (deployVerifiedInUi ? 'Custom worker deployed in this run.' : 'Custom worker setup is available here.'),
      tone: normalModeRequiresCustomWorker
        ? (resolvedWorkerBaseUrl ? 'ready' : 'pending')
        : (workerMode === 'default' || deployVerifiedInUi ? 'ready' : 'neutral'),
    }] : []),
    {
      key: 'publish',
      title: 'Deploy Session',
      summary: canPublishNow
        ? (canUseSponsoredAutoDeployNow
          ? 'Publish will deploy the sponsored worker before uploading metadata.'
          : 'Review the setup and deploy when ready.')
        : uploadBlockedReason,
      tone: canPublishNow ? 'ready' : 'pending',
    },
  ].map((card, index) => ({
    ...card,
    stepNumber: index + 1,
  }));
  const activeNormalModeIndex = normalModeCards.findIndex((card) => collapsedSections[card.key] === false);
  const normalModePublishSummary = [
    {
      label: 'Session',
      value: toStr(draft?.sessionName).trim() || 'Add a session name',
    },
    {
      label: 'Privacy',
      value: configuredPrivateGateCount
        ? `${configuredPrivateGateCount} ${configuredPrivateGateCount === 1 ? t('gate') : t('gates')} configured`
        : (privateSlugMode ? 'Private URL mode' : 'Open access'),
    },
    {
      label: 'Worker',
      value: canUseSponsoredAutoDeployNow
        ? 'Sponsored auto-deploy on Publish'
        : shouldUseSponsoredAutoDeployFlow
        ? 'Sponsored auto-deploy waiting for the hosted bundle URL'
        : normalModeRequiresCustomWorker
        ? (resolvedWorkerBaseUrl ? 'Custom worker ready' : 'Bring your own worker')
        : workerMode === 'default'
          ? 'Shared hosted worker'
          : (deployVerifiedInUi ? 'Custom worker deployed' : 'Custom worker setup'),
    },
    {
      label: `Pending ${t('sbts')}`,
      value: pendingDraftCount
        ? `${pendingDraftCount} draft${pendingDraftCount === 1 ? '' : 's'} ready`
        : 'None',
    },
  ];
  useEffect(() => {
    if (!isNormalMode) return;
    const visibleSectionOrder = showNormalModeWorkerStep
      ? ['metadata', 'encryption', 'worker', 'publish']
      : ['metadata', 'encryption', 'publish'];
    setCollapsedSections((prev) => {
      const firstOpenSection = visibleSectionOrder.find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: showNormalModeWorkerStep ? firstOpenSection !== 'worker' : true,
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [isNormalMode, showNormalModeWorkerStep]);
  const createSbtModalChainId = Number(draft.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null;
  const createSbtModalNetwork = getChainById(createSbtModalChainId) || (
    createSbtModalChainId
      ? { id: createSbtModalChainId, name: getChainName(createSbtModalChainId) || `Chain ${createSbtModalChainId}` }
      : (network || { id: null, name: '' })
  );
  const createSbtModalSessionSlug = toStr(
    createSbtModalState.sessionSlug ||
    draft.slug ||
    resolvedActiveSessionSlug ||
    ''
  ).trim();
  const createSbtModalArweaveJwkOverride = workerSecretsEnabled
    ? toStr(
        createSbtModalState.arweaveJwkOverride ||
        getEnabledWorkerArweaveJwk()
      ).trim()
    : '';
  const wizardContractViewerContracts = useMemo(() => {
    const draftContracts = draft?.contracts && typeof draft.contracts === 'object'
      ? draft.contracts
      : {};
    const defaults = getSessionWizardContractDefaults(registryChainId);
    const visibleKeys = getVisibleSessionWizardContractKeys(draftContracts, defaults);
    const resolvedChainId = Number(
      registryChainId ||
      draft?.networkChainId ||
      network?.id ||
      network?.chainId ||
      0
    ) || null;
    const mergedContracts = visibleKeys.reduce((acc, contractKey) => {
      const entry = draftContracts[contractKey] && typeof draftContracts[contractKey] === 'object'
        ? draftContracts[contractKey]
        : {};
      const address = toStr(entry.address || '').trim() || toStr(defaults?.[contractKey] || '').trim();
      acc[contractKey] = {
        ...entry,
        address,
        chainId: Number(entry.chainId || resolvedChainId || 0) || null,
      };
      return acc;
    }, {});

    return buildContractViewerContracts({
      sessionContracts: mergedContracts,
      chainId: resolvedChainId,
      includeSessionRegistry: true,
      includeCustomSBT: false,
    });
  }, [
    draft?.contracts,
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
  ]);
  const selectedWizardContract = useMemo(() => (
    wizardContractViewerContracts.find(
      (contract) => contract.key === contractViewerModalState.contractKey
    ) || null
  ), [contractViewerModalState.contractKey, wizardContractViewerContracts]);
  const selectedWizardContractSessionSlug = toStr(
    selectorSourceSessionConfig?.slug ||
    activeSessionSlug ||
    resolvedActiveSessionSlug ||
    ''
  ).trim();
  const selectedWizardContractHref = useMemo(() => buildContractsPageHref({
    contractKey: selectedWizardContract?.key || '',
    sessionSlug: selectedWizardContractSessionSlug,
  }), [selectedWizardContract?.key, selectedWizardContractSessionSlug]);
  const publishProgressSteps = buildSessionWizardPublishPlan({
    shouldAutoDeployWorker: resolveSessionWizardShouldAutoDeployWorker({
      workerMode,
      sponsoredAutoDeployReady: canUseSponsoredAutoDeployNow,
      deployComplete,
    }),
    hasPendingDrafts: hasUndeployedPendingSbtDrafts,
    hasManualMetadata,
  }).map((key) => ({
    key,
    label: key === 'deploy-worker'
      ? 'Deploy Worker'
      : key === 'deploy-sbts'
        ? `Deploy ${t('sbts')}`
        : key === 'upload-metadata'
          ? 'Upload Arweave'
          : key === 'register-session'
            ? 'Register On-chain'
            : 'Done',
  }));
  const activePublishProgressStep = publishProgressSteps[
    Math.max(0, Math.min((publishStep || 1) - 1, Math.max(0, publishProgressSteps.length - 1)))
  ] || publishProgressSteps[0] || null;
  const publishProgressPercent = getSessionWizardPublishProgressPercent({
    publishStep,
    publishBusy,
    totalSteps: publishProgressSteps.length,
    elapsedMs: publishStepElapsedMs,
  });
  const publishProgressPercentRounded = Math.round(publishProgressPercent);
  const wizardModeControls = (
    <div className={styles.wizardModeToggle} role="group" aria-label="Session wizard mode">
      <button
        type="button"
        className={`${styles.wizardModeBtn} ${wizardMode === 'normal' ? styles.wizardModeBtnActive : ''}`}
        onClick={handleEnterNormalMode}
        aria-pressed={wizardMode === 'normal'}
        data-testid={E2E_TESTIDS.WIZARD_MODE_NORMAL}
      >
        Normal
      </button>
      <button
        type="button"
        className={`${styles.wizardModeBtn} ${wizardMode === 'advanced' ? styles.wizardModeBtnActive : ''}`}
        onClick={handleEnterAdvancedMode}
        aria-pressed={wizardMode === 'advanced'}
        data-testid={E2E_TESTIDS.WIZARD_MODE_ADVANCED}
      >
        Advanced
      </button>
    </div>
  );
  const handleDismissNewSessionRequirementsBanner = useCallback(() => {
    if (newSessionBannerDismissalContextKey) {
      setNewSessionBannerDismissedContext(newSessionBannerDismissalContextKey);
    }
    if (!hasSponsoredBundleLink) {
      setPersistedNewSessionBannerDismissed(true);
      writeSessionWizardNewSessionBannerDismissed();
    }
  }, [hasSponsoredBundleLink, newSessionBannerDismissalContextKey]);

  return (
    <div className={styles.groupWizard}>
      <header className={styles.header}>
        <div className={styles.headerTitleBlock}>
          <h1>Session Setup</h1>
          {!isNormalMode && (
            <div className={styles.modeHint}>
              Advanced mode shows the full session configuration.
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          {hasSponsoredBundleLink ? (
            <div className={styles.wizardSettingsMenu}>
              {wizardDisplaySettingsOpen ? (
                <button
                  type="button"
                  className={styles.wizardSettingsBackdrop}
                  aria-label="Close session wizard display settings"
                  onClick={() => setWizardDisplaySettingsOpen(false)}
                />
              ) : null}
              <button
                type="button"
                className={`${styles.iconButton} ${styles.wizardSettingsButton} ${wizardDisplaySettingsOpen ? styles.iconButtonActive : ''}`}
                onClick={() => setWizardDisplaySettingsOpen((prev) => !prev)}
                title="Session wizard display settings"
                aria-label="Session wizard display settings"
                aria-expanded={wizardDisplaySettingsOpen}
                aria-haspopup="dialog"
              >
                <FontAwesomeIcon icon={faCog} />
              </button>
              <div
                className={styles.wizardSettingsPanel}
                role="dialog"
                aria-label="Session wizard display settings"
                hidden={!wizardDisplaySettingsOpen}
              >
                <div className={styles.wizardSettingsLabel}>Display mode</div>
                {wizardModeControls}
              </div>
            </div>
          ) : wizardModeControls}
          {wizardMode === 'advanced' && (
            <div className={styles.headerChainSelector}>
              <span className={styles.headerChainLabel}>Network:</span>
              <Input
                type="select"
                value={registryChainId || ''}
                onChange={(e) => setRegistryChainId(e.target.value)}
                className={styles.headerChainInput}
              >
                {registryChainOptions.length ? (
                  registryChainOptions.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} ({chain.id})
                    </option>
                  ))
                ) : (
                  <option value={registryChainId || ''}>
                    {registryChainName || registryChainId || 'Select a chain'}
                  </option>
                )}
              </Input>
              {renderSessionWizardInfoTooltip({
                id: 'gw-registry-chain',
                content: `Chain for session deployment. Registry: ${registryAddress || 'Unavailable'}`,
                placement: 'bottom',
                testId: 'ce-wizard-tooltip-gw-registry-chain',
                ariaLabel: 'Registry chain info',
              })}
            </div>
          )}
        </div>
      </header>

      {showNewSessionRequirementsBanner ? (
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
              onClick={handleDismissNewSessionRequirementsBanner}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className={styles.newSessionBannerBody}>
            <ul className={styles.newSessionBannerList}>
              <li>An AI API key (OpenAI, Anthropic, or OpenRouter)</li>
              <li>An Arweave wallet (JWK) for permanent storage</li>
              <li>{newSessionFundingRequirementLabel}</li>
              <li>(Optional) A faucet private key for sponsoring user gas</li>
            </ul>
            <p className={styles.newSessionBannerCopy}>
              A turnkey tool for bundling these resources is in development.
            </p>
            <p className={styles.newSessionBannerCopy}>
              In the meantime, you can get a sponsored session URL by contacting{' '}
              <a
                href="mailto:contextengine@protonmail.com"
                className={styles.newSessionBannerLink}
              >
                contextengine@protonmail.com
              </a>
              .
            </p>
          </div>
        </section>
      ) : null}

      {sponsoredBundleStatus ? (
        <div
          className={`${styles.statusNote} ${styles.sponsoredBundleStatus} ${
            sponsoredBundleStatus.tone === 'success'
              ? styles.sponsoredBundleStatusSuccess
              : sponsoredBundleStatus.tone === 'error'
                ? styles.sponsoredBundleStatusError
                : styles.sponsoredBundleStatusInfo
          }`}
          data-testid={E2E_TESTIDS.WIZARD_SPONSORED_STATUS}
        >
          <div className={styles.sponsoredBundleStatusContent}>
            <span>{sponsoredBundleStatus.message}</span>
            {sponsoredBundleStatus.retryable ? (
              <Button
                type="button"
                size="sm"
                color="secondary"
                outline
                className={styles.sponsoredBundleRetryButton}
                onClick={() => setSponsoredBundleRetryNonce((prev) => prev + 1)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isNormalMode && (
        <section
          className={styles.normalModeRail}
          aria-label="Normal mode sections"
          style={{ '--session-wizard-card-count': String(normalModeCards.length) }}
        >
          {normalModeCards.map((card, index) => {
            const isOpen = !collapsedSections[card.key];
            const showExpandedDetails = activeNormalModeIndex > index;
            const toneClass = card.tone === 'ready'
              ? styles.normalModeCardReady
              : card.tone === 'pending'
                ? styles.normalModeCardPending
                : styles.normalModeCardNeutral;
            return (
              <button
                key={card.key}
                type="button"
                className={`${styles.normalModeCard} ${toneClass} ${isOpen ? styles.normalModeCardActive : ''}`}
                onClick={() => focusNormalModeSection(card.key)}
                aria-label={`Step ${card.stepNumber}: ${card.title}`}
              >
                <span className={styles.normalModeCardNumber}>{card.stepNumber}</span>
                <span className={styles.normalModeCardContent}>
                  <span className={styles.normalModeCardTitle}>{card.title}</span>
                  {showExpandedDetails && (
                    <span className={styles.normalModeCardSummary}>{card.summary}</span>
                  )}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {(!isNormalMode || !collapsedSections.encryption) && (
        <EncryptionPanel
          isNormalMode={isNormalMode}
          t={t}
          renderSessionWizardInfoTooltip={renderSessionWizardInfoTooltip}
          isCollapsed={collapsedSections.encryption}
          onToggleCollapsed={() => toggleSection('encryption')}
          launchCreateSbtModal={launchCreateSbtModal}
          activeCreateSbtTargetGateId={activeCreateSbtTargetGateId}
          activeCreateSbtTargetGate={activeCreateSbtTargetGate}
          encryptionGates={encryptionGates}
          focusCreateSbtTargetGate={focusCreateSbtTargetGate}
          updateEncryptionGate={updateEncryptionGate}
          removeEncryptionGate={removeEncryptionGate}
          normalizeSbtSelection={normalizeSbtSelection}
          handleGateAddSbt={handleGateAddSbt}
          handleGateRemoveSbt={handleGateRemoveSbt}
          network={network}
          pendingSbtSelectorOptions={pendingSbtSelectorOptions}
          selectorSourceChainId={selectorSourceChainId}
          selectorSourceSessionConfig={selectorSourceSessionConfig}
          resolvedActiveSessionSlug={resolvedActiveSessionSlug}
          sbtCacheRevision={sbtCacheRevision}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
          addEncryptionGate={addEncryptionGate}
          pendingSbtDrafts={pendingSbtDrafts}
          removePendingSbtDraft={removePendingSbtDraft}
        />
      )}

      {(!isNormalMode || !collapsedSections.metadata) && (
      <section id="session-wizard-section-metadata" className={styles.panel}>
        {wizardMode === 'advanced' && (
          <div className={styles.panelHeaderRow}>
            <button
              type="button"
              className={styles.panelHeader}
              onClick={() => toggleSection('metadata')}
              data-testid={E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE}
            >
              <span className={styles.panelTitle}>Session Information</span>
              <FontAwesomeIcon icon={collapsedSections.metadata ? faCaretDown : faCaretUp} />
            </button>
            {sessionIdDisplay && (
              <span className={styles.sessionIdBadge} title={sessionIdDisplay}>
                {sessionIdDisplay.length > 14 ? sessionIdDisplay.slice(0, 14) + '…' : sessionIdDisplay}
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={handleRegenerateSessionId}
                  title="Generate a new session ID"
                  aria-label="Generate a new session ID"
                >
                  <FontAwesomeIcon icon={faRedoAlt} spin={isSessionIdRegenerating} />
                </button>
                <button type="button" className={styles.iconButton} onClick={handleCopySessionId} title="Copy session ID" aria-label="Copy session ID">
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                {renderSessionWizardInfoTooltip({
                  id: 'gw-session-id',
                  content: 'On-chain session identifier. Use with /admin?sessionId=<uuid>&chainId=<id>.',
                  placement: 'bottom',
                  testId: 'ce-wizard-tooltip-gw-session-id',
                  ariaLabel: 'Session ID info',
                })}
              </span>
            )}
          </div>
        )}
        {(isNormalMode || !collapsedSections.metadata) && (
          <div className={styles.panelBody}>
            <div className={styles.objectBody}>
              {/* Admin-only lists should be moved to a post-create admin UI. */}
              {primaryDraftEntries.map(([key, value]) => {
                if (key === 'blockLimits') return null; // rendered below sessionHeader
                if (isNormalMode && key === 'sessionName') {
                  return (
                    <div key={`${key}-row`} className={styles.sessionIdentityRow}>
                      <div className={styles.sessionIdentityPrimary}>
                        {renderField(key, value, [])}
                      </div>
                      <div className={styles.sessionIdentitySecondary}>
                        {renderField('sessionHeader', draft?.sessionHeader ?? '', [])}
                      </div>
                    </div>
                  );
                }
                if (isNormalMode && key === 'sessionHeader') {
                  return (
                    <React.Fragment key={`${key}-options`}>
                      {renderMoreOptionsSection()}
                    </React.Fragment>
                  );
                }
                if (key === 'sessionHeader') {
                  const blockLimitsValue = draft?.blockLimits;
                  return (
                    <React.Fragment key={`${key}-block`}>
                      {renderField(key, value, [])}
                      {blockLimitsValue !== undefined && renderField('blockLimits', blockLimitsValue, [])}
                      {renderMoreOptionsSection()}
                    </React.Fragment>
                  );
                }
                return renderField(key, value, []);
              })}
            </div>
            {wizardMode === 'advanced' && (
              <JsonButtonRow>
                <JsonToggleButton
                  label="view .json"
                  active={showJsonPreview}
                  onClick={() => setShowJsonPreview((prev) => !prev)}
                  title="Preview session metadata JSON"
                />
              </JsonButtonRow>
            )}
            {wizardMode === 'advanced' && showJsonPreview && (
              <JsonPanel
                onCopy={handleCopyDraftJson}
                copied={jsonCopied}
                as="pre"
              >
                {JSON.stringify(draft, null, 2)}
              </JsonPanel>
            )}
          </div>
        )}
      </section>
      )}

      {(!isNormalMode || (showNormalModeWorkerStep && !collapsedSections.worker)) && (
        <WorkerPanel
          isNormalMode={isNormalMode}
          t={t}
          renderSessionWizardInfoTooltip={renderSessionWizardInfoTooltip}
          isCollapsed={collapsedSections.worker}
          onToggleCollapsed={() => toggleSection('worker')}
          showSharedWorkerChoice={showSharedWorkerChoice}
          workerMode={workerMode}
          onWorkerModeChange={setWorkerMode}
          setWorkerUrlAutoFilled={setWorkerUrlAutoFilled}
          updateDraftValue={updateDraftValue}
          getDefaultWorkerUrl={getDefaultWorkerUrl}
          draft={draft}
          deployWorkerUrl={deployWorkerUrl}
          deployComplete={deployComplete}
          devPersistWorkerSecrets={DEV_PERSIST_WORKER_SECRETS}
          persistWorkerSecrets={persistWorkerSecrets}
          setPersistWorkerSecrets={setPersistWorkerSecrets}
          workerSecretsEnabled={workerSecretsEnabled}
          setWorkerSecretsEnabled={setWorkerSecretsEnabled}
          clearWorkerSecretFields={clearWorkerSecretFields}
          effectivePersistWorkerSecrets={effectivePersistWorkerSecrets}
          workerResourceKeys={workerResourceKeys}
          renderResourceCard={renderResourceCard}
          workerAllowOrigins={workerAllowOrigins}
          setWorkerAllowOrigins={setWorkerAllowOrigins}
          defaultAllowedOrigins={DEFAULT_ALLOWED_ORIGINS}
          shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
          deployForm={deployForm}
          renderEmbeddedDeployHelperToggle={renderEmbeddedDeployHelperToggle}
          shouldShowDeployHelperUrlInput={shouldShowDeployHelperUrlInput}
          deployHelperUrl={deployHelperUrl}
          setDeployHelperUrl={setDeployHelperUrl}
          bundleMode={bundleMode}
          setBundleMode={setBundleMode}
          normalModeBundleUrl={normalModeBundleUrl}
          normalModeBundleHelpText={normalModeBundleHelpText}
          showNormalModeManualBundleControls={showNormalModeManualBundleControls}
          normalModeBundleUrlOverride={normalModeBundleUrlOverride}
          setNormalModeBundleUrlOverride={setNormalModeBundleUrlOverride}
          normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
          manualBundleUrlOverrideHelp={MANUAL_BUNDLE_URL_OVERRIDE_HELP}
          normalModeRetryBundleFileInputRef={normalModeRetryBundleFileInputRef}
          setBundleFile={setBundleFile}
          clearSelectedBundleFile={clearSelectedBundleFile}
          bundleFile={bundleFile}
          normalModeManualBundleHelpText={normalModeManualBundleHelpText}
          localWorkerBundleFallbackFilePath={LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH}
          advancedBundleFileInputRef={advancedBundleFileInputRef}
          showSponsoredDeployAccessNotice={showSponsoredDeployAccessNotice}
          account={account}
          resolvedActiveSessionSlug={resolvedActiveSessionSlug}
          setDeployForm={setDeployForm}
          handleDeployWorker={handleDeployWorker}
          deployInFlight={deployInFlight}
          deployStatus={deployStatus}
          deployStatusIsError={deployStatusIsError}
          showWorkerUrlField={showWorkerUrlField}
          displayedWorkerUrl={displayedWorkerUrl}
          renderField={renderField}
          workerUrlAutoFilled={workerUrlAutoFilled}
        />
      )}

      {(!isNormalMode || !collapsedSections.publish) && (
      <section id="session-wizard-section-publish" className={styles.panel}>
        {wizardMode === 'advanced' && (
          <button type="button" className={styles.panelHeader} onClick={() => toggleSection('publish')}>
            <span className={styles.panelTitle}>Publish</span>
            <FontAwesomeIcon icon={collapsedSections.publish ? faCaretDown : faCaretUp} />
          </button>
        )}
        {(isNormalMode || !collapsedSections.publish) && (
          <div className={styles.panelBody}>
            {isNormalMode ? (
              <div className={styles.publishHero}>
                <div className={styles.publishSummaryGrid}>
                  {normalModePublishSummary.map((item) => (
                    <div key={item.label} className={styles.publishSummaryCard}>
                      <span className={styles.publishSummaryLabel}>{item.label}</span>
                      <span className={styles.publishSummaryValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.publishActionCluster}>
                  <Button
                    onClick={handlePublish}
                    className={styles.publishPrimaryButton}
                    data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
                    disabled={publishBusy || !canPublishNow}
                  >
                    {publishBusy ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} /> Deploy Session
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    className={`${styles.publishSettingsButton} ${publishAdvancedOpen ? styles.publishSettingsButtonActive : ''}`}
                    onClick={() => setPublishAdvancedOpen((prev) => !prev)}
                    title="Advanced publish settings"
                    aria-label="Advanced publish settings"
                  >
                    <FontAwesomeIcon icon={faCog} />
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.publishRow}>
	                <Button
	                  onClick={handlePublish}
	                  className={styles.primaryButton}
	                  data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
	                  disabled={publishBusy || !canPublishNow}
	                >
                  {publishBusy ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} /> Publish
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  className={`${styles.iconButton} ${publishAdvancedOpen ? styles.iconButtonActive : ''}`}
                  onClick={() => setPublishAdvancedOpen((prev) => !prev)}
                  title="Advanced publish settings"
                  aria-label="Advanced publish settings"
                >
                  <FontAwesomeIcon icon={faCog} />
                </button>
              </div>
            )}
            {showSponsoredBundleFallbackInput && (
              <>
                <FormGroup className={styles.fieldGroup}>
                  <Label>Manual bundle URL override (optional)</Label>
                  <Input
                    type="url"
                    value={normalModeBundleUrlOverride}
                    placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
                    data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
                    invalid={!!normalModeBundleUrlOverrideValidationError}
                    onChange={(e) => setNormalModeBundleUrlOverride(e.target.value)}
                  />
                  <div className={styles.helperText}>
                    {MANUAL_BUNDLE_URL_OVERRIDE_HELP}
                  </div>
                  {normalModeBundleUrlOverrideValidationError && (
                    <div className={styles.errorText}>{normalModeBundleUrlOverrideValidationError}</div>
                  )}
                </FormGroup>
                <FormGroup className={styles.fieldGroup}>
                  <Label>Worker bundle fallback (optional)</Label>
                  <div className={styles.bundleFileInputRow}>
                    <Input
                      type="file"
                      accept=".js,.mjs,.txt"
                      innerRef={sponsoredPublishBundleFileInputRef}
                      data-testid={E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT}
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        setBundleFile(file || null);
                      }}
                    />
                    <Button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={clearSelectedBundleFile}
                      data-testid={E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH}
                      disabled={!bundleFile}
                    >
                      Clear bundle file
                    </Button>
                  </div>
                  <div className={styles.helperText}>
                    {SPONSORED_MANUAL_BUNDLE_RETRY_MESSAGE}
                  </div>
                  {bundleFile && (
                    <div className={styles.helperText}>
                      Using {bundleFile.name || LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} for this publish.
                    </div>
                  )}
                </FormGroup>
              </>
            )}
            {(publishBusy || publishStep > 0) && (
              <div className={styles.publishProgressCard} data-testid="ce-wizard-publish-progress">
                <div className={styles.publishProgressHeader}>
                  <div className={styles.publishProgressCopy}>
                    <span className={styles.publishProgressEyebrow}>
                      {publishBusy ? 'Publishing Session' : 'Publish Complete'}
                    </span>
                    <strong className={styles.publishProgressStage}>
                      {activePublishProgressStep?.label || 'Preparing'}
                    </strong>
                  </div>
                  <span className={styles.publishProgressPercent}>{publishProgressPercentRounded}%</span>
                </div>
                <div
                  className={styles.publishProgressBar}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={publishProgressPercentRounded}
                  aria-valuetext={`${publishProgressPercentRounded}% ${activePublishProgressStep?.label || 'Preparing'}`}
                >
                  <div
                    className={styles.publishProgressFill}
                    style={{ width: `${publishProgressPercent}%` }}
                  />
                </div>
                <div className={styles.progressIndicator}>
                  {publishProgressSteps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isActive = publishStep === stepNumber && (publishBusy || step.key !== 'done');
                    const isComplete = publishStep > stepNumber || (step.key === 'done' && publishStep >= stepNumber);
                    return (
                      <div
                        key={step.key}
                        className={`${publishStep >= stepNumber ? styles.stepCompleted : styles.step} ${isActive ? styles.stepActive : ''}`}
                      >
                        <FontAwesomeIcon
                          icon={isActive ? faSpinner : isComplete ? faCheck : faExclamationCircle}
                          spin={isActive}
                        />
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!canPublishNow &&
              !hasManualMetadata &&
              !hasUploadedMetadata && (
              <div className={styles.statusNote}>
                {uploadBlockedReason}
              </div>
            )}
            {publishAdvancedOpen && (
              <>
                <div className={styles.statusNote}>
                  Arweave upload worker: {resolvedWorkerBaseUrl || 'Not set'} ({workerUrlSource})
                </div>
                <FormGroup className={styles.fieldGroup}>
                  <Label>Manual metadata URI (optional)</Label>
                  <Input
                    type="text"
                    value={manualMetadataUrl}
                    placeholder="ar://<txId> or https://arweave.net/<txId>"
                    onChange={(e) => setManualMetadataUrl(e.target.value)}
                  />
                </FormGroup>
                <FormGroup className={styles.fieldGroup}>
                  <Label className={styles.fieldLabelRow}>
                    <span>Gas limit override</span>
                    {renderSessionWizardInfoTooltip({
                      id: 'gw-tip-gas-limit',
                      content: 'Optional. Observed gas: createSession ~350k, setSessionFields ~275k (gates vary with count).',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-tip-gas-limit',
                      ariaLabel: 'Gas limit override info',
                    })}
                  </Label>
                  <Input
                    type="number"
                    value={manualGasLimit}
                    placeholder="1000000"
                    onChange={(e) => setManualGasLimit(e.target.value)}
                  />
                </FormGroup>
                <FormGroup className={styles.fieldGroup}>
                  <Label className={styles.fieldLabelRow}>
                    <span>Gas price override (gwei, legacy)</span>
                    {renderSessionWizardInfoTooltip({
                      id: 'gw-tip-gas-price',
                      content: 'Optional. Forces a legacy gas price (type 0). Some wallets may ignore this on EIP-1559 networks.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-tip-gas-price',
                      ariaLabel: 'Gas price override info',
                    })}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={manualGasPriceGwei}
                    placeholder="(leave blank)"
                    onChange={(e) => setManualGasPriceGwei(e.target.value)}
                  />
                </FormGroup>
                <FormGroup className={styles.fieldGroup}>
                  <Label className={styles.fieldLabelRow}>
                    <span>Max fee per gas (gwei)</span>
                    {renderSessionWizardInfoTooltip({
                      id: 'gw-tip-max-fee',
                      content: 'Optional. EIP-1559 maxFeePerGas override. Use this (and priority fee) to bump a stuck/pending tx when you hit "replacement fee too low". Leave blank to use wallet defaults.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-tip-max-fee',
                      ariaLabel: 'Max fee per gas info',
                    })}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={manualMaxFeePerGasGwei}
                    placeholder="(leave blank)"
                    onChange={(e) => setManualMaxFeePerGasGwei(e.target.value)}
                  />
                </FormGroup>
                <FormGroup className={styles.fieldGroup}>
                  <Label className={styles.fieldLabelRow}>
                    <span>Max priority fee per gas (gwei)</span>
                    {renderSessionWizardInfoTooltip({
                      id: 'gw-tip-max-priority',
                      content: 'Optional. EIP-1559 maxPriorityFeePerGas override (tip). Leave blank to use wallet defaults.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-tip-max-priority',
                      ariaLabel: 'Max priority fee per gas info',
                    })}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={manualMaxPriorityFeePerGasGwei}
                    placeholder="(leave blank)"
                    onChange={(e) => setManualMaxPriorityFeePerGasGwei(e.target.value)}
                  />
                </FormGroup>
              </>
            )}
            {metadataUrl && !manualMetadataUrl && (
              <div className={styles.linkRow}>
                <span className={styles.linkLabel}>Metadata URI:</span>
                <span data-testid={E2E_TESTIDS.WIZARD_METADATA_URI}>{metadataUrl}</span>
              </div>
            )}
            {metadataUrl && manualMetadataUrl && (
              <div className={styles.linkRow}>
                <span className={styles.linkLabel}>Uploaded metadata URI:</span>
                <span data-testid={E2E_TESTIDS.WIZARD_METADATA_URI}>{metadataUrl}</span>
              </div>
            )}
            {manualMetadataUrl && (
              <div className={styles.linkRow}>
                <span className={styles.linkLabel}>Manual metadata URI:</span>
                <span>{normalizeArweaveUri(manualMetadataUrl)}</span>
              </div>
            )}
            {effectiveMetadataTxId && (
              <div className={styles.linkRow}>
                <span className={styles.linkLabel}>Arweave tx:</span>
                <a href={effectiveMetadataGatewayUrl} target="_blank" rel="noopener noreferrer">
                  {effectiveMetadataGatewayUrl}
                </a>
              </div>
            )}
            {registerTxs.length > 0 && (
              <div>
                <div className={styles.linkRow}>
                  <span className={styles.linkLabel}>Register txs:</span>
                  <span>{registerTxs.length}</span>
                </div>
	                {registerTxs.map((entry) => {
	                  const txUrl = registerExplorerBaseUrl
	                    ? `${registerExplorerBaseUrl}/tx/${entry.hash}`
	                    : '';
	                  return (
	                    <div
	                      key={entry.hash}
	                      className={styles.linkRow}
	                      data-testid={E2E_TESTIDS.WIZARD_REGISTER_TX}
	                      data-ce-tx-hash={entry.hash}
	                      data-ce-tx-action={entry.action}
	                    >
	                      <span className={styles.linkLabel}>{entry.action}:</span>
	                      {txUrl ? (
	                        <a href={txUrl} target="_blank" rel="noopener noreferrer">{txUrl}</a>
	                      ) : (
                        <span>{entry.hash}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {sessionUrl && (
              <div className={styles.linkRow}>
                <span className={styles.linkLabel}>Session URL:</span>
                <a href={sessionUrl} target="_blank" rel="noopener noreferrer">{sessionUrl}</a>
              </div>
            )}
	            {adminUrl && (
	              <div className={styles.linkRow}>
	                <span className={styles.linkLabel}>Admin URL:</span>
	                <a href={adminUrl} target="_blank" rel="noopener noreferrer" data-testid={E2E_TESTIDS.WIZARD_ADMIN_URL}>{adminUrl}</a>
	                <Button type="button" size="sm" className={styles.actionButton} onClick={handleCopyAdminUrl}>
	                  <FontAwesomeIcon icon={faCopy} /> Copy
	                </Button>
              </div>
            )}
            {adminUrlStatus && <div className={styles.copyStatus}>{adminUrlStatus}</div>}
            {status && <div className={styles.statusNote}>{status}</div>}
          </div>
        )}
      </section>
      )}
      <Modal
        isOpen={createSbtModalState.open}
        toggle={closeCreateSbtModal}
        className={styles.createSbtModal}
        size="xl"
        scrollable
      >
        <ModalHeader toggle={closeCreateSbtModal} className={styles.createSbtModalHeader}>
          {`Add ${t('sbt')} to Session`}
        </ModalHeader>
        <ModalBody className={styles.createSbtModalBody}>
          <CreateSBTGroup
            account={account}
            provider={provider}
            network={createSbtModalNetwork}
            loginComplete={!!account}
            toggleLoginModal={toggleLoginModal}
            sessionSlug={createSbtModalSessionSlug}
            sessionConfigOverride={{
              ...(draft && typeof draft === 'object' ? draft : {}),
              slug: createSbtModalSessionSlug,
              networkChainId: createSbtModalChainId,
              contracts: (draft && typeof draft.contracts === 'object') ? draft.contracts : {},
            }}
            arweaveJwkOverride={createSbtModalArweaveJwkOverride}
            encryptionGates={encryptionGates.map((gate) => ({
              id: gate.id,
              gateId: gate.id,
              label: gate.label,
              name: gate.label,
              color: gate.color,
              mode: gate.mode,
              requireAll: gate.mode === 'all',
              sbtAddresses: normalizeSbtSelection(gate.sbts || []).map((entry) => entry.address),
              chainId: createSbtModalChainId,
            }))}
            defaultGateId={defaultGateId || encryptionGates[0]?.id || ''}
            defaultSbtTags={draft?.defaultSbtTags || ''}
            deferredDeploy={true}
            attemptImmediateDeferredUpload={false}
            hideNetworkSelector={true}
            signAdminAction={signBootstrapAdminAction}
            onSaveDraft={handleSavePendingSbtDraft}
          />
        </ModalBody>
      </Modal>
      <Modal
        isOpen={contractViewerModalState.open && !!selectedWizardContract}
        toggle={closeContractViewerModal}
        className={styles.contractViewerModal}
        contentClassName={styles.contractViewerModalContent}
        centered
      >
        <ModalBody
          className={styles.contractViewerModalBody}
          data-testid={WIZARD_CONTRACT_MODAL_TESTID}
        >
          {selectedWizardContract && (
            <ContractViewer
              variant="compact"
              contracts={[selectedWizardContract]}
              onClose={closeContractViewerModal}
              renderSourceHeaderActions={(contract) => (
                <a
                  href={selectedWizardContractHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contractViewerFullPageLink}
                  aria-label={`Open full Contracts page for ${contract.name}`}
                  title={`Open full Contracts page for ${contract.name}`}
                  data-testid="ce-wizard-contract-modal-full-link"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>Full page</span>
                </a>
              )}
            />
          )}
        </ModalBody>
      </Modal>
      <Modal
        isOpen={sessionHeaderPreviewModalOpen}
        toggle={() => setSessionHeaderPreviewModalOpen(false)}
        centered
        size="xl"
        contentClassName={styles.sessionHeaderPreviewModalContent}
      >
        <ModalBody
          className={styles.sessionHeaderPreviewModalBody}
          onClick={() => setSessionHeaderPreviewModalOpen(false)}
        >
          {sessionHeaderPreviewSrc && (
            <img src={sessionHeaderPreviewSrc} alt="Expanded session header preview" />
          )}
        </ModalBody>
      </Modal>
    </div>
  );
};

export default SessionWizard;
