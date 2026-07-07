import { ethers } from 'ethers';
import { finalizeDeferredCreateSbtDraftUpload } from '../SBTs/CreateSBTGroup';
import contractScripts from '../../utilities/web3/chainGateway.js';
import { hasPasswordMintForSbtMintMode } from '../../utilities/sbt/sbtMintMode.js';
import { upsertSbtPasswordRecoveryCodes } from '../../utilities/sbt/sbtPasswordRecoveryStore.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';
import type { PendingSbtDraftLike } from './sessionWizardSbtSelections';

type PendingSbtCreateOptions = {
  useConfiguredDeterministic?: boolean;
  initializeGroupPasswordHash?: boolean;
  [key: string]: unknown;
};

export type PendingSbtDeployReceipt =
  | {
      transactionHash?: string;
      events?: unknown[];
      logs?: unknown[];
      receipt?: {
        logs?: unknown[];
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

type CreateSbtForPendingDraft = (
  providerLike: unknown,
  contractName: unknown,
  symbol: unknown,
  limitedNumber: number,
  adminAddress: unknown,
  mintingEndTimeUnix: number,
  hasPasswordMintOnChain: boolean,
  burnAuthEnum: number,
  hashedPasswords: unknown[],
  tokenURI: string,
  finalGroupPasswordHash: string,
  sessionConfigForDeploy: AnyRecord,
  create2Salt: string,
  createOptions: PendingSbtCreateOptions,
) => Promise<PendingSbtDeployReceipt>;

type DeploySessionWizardPendingSbtDraftResult = {
  finalizedDraft: PendingSbtDraftLike;
  receipt: PendingSbtDeployReceipt;
};

const createSessionWizardPendingDraftSbt = contractScripts.createSBT as unknown as CreateSbtForPendingDraft;

export const FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID = 'gate-1';
export const FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE = 'defaultFeaturedSBTs';

export const normalizeFeaturedDraftGateAutoLink = (value: AnyRecord | null = null): AnyRecord | null => {
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

export const buildPendingSbtDeployContextSignature = (
  sessionLike: AnyRecord = {},
  fallbackChainId: ChainIdLike = null,
): string => {
  // Stronger invalidation and slug-finalization rules for linked pending SBT drafts remain future work.
  const chainId =
    Number(sessionLike?.networkChainId || sessionLike?.contracts?.sbtFactory?.chainId || fallbackChainId || 0) || 0;
  const sbtFactoryAddress = toStr(sessionLike?.contracts?.sbtFactory?.address || sessionLike?.sbtFactoryAddress || '')
    .trim()
    .toLowerCase();
  return `${chainId}|${sbtFactoryAddress}`;
};

export const finalizeSessionWizardPendingSbtDraft = async ({
  draftEntry = {},
  workerUrlOverride = '',
  createSbtComponentProps = {},
  finalizeDeferredDraftUpload = finalizeDeferredCreateSbtDraftUpload,
}: {
  draftEntry?: PendingSbtDraftLike;
  workerUrlOverride?: string;
  createSbtComponentProps?: AnyRecord;
  finalizeDeferredDraftUpload?: (args?: AnyRecord) => Promise<AnyRecord>;
} = {}): Promise<PendingSbtDraftLike> => {
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

  const existingSessionConfig =
    createSbtComponentProps?.sessionConfigOverride && typeof createSbtComponentProps.sessionConfigOverride === 'object'
      ? createSbtComponentProps.sessionConfigOverride
      : {};
  const effectiveWorkerUrl = normalizeWorkerAuthUrl(
    toStr(workerUrlOverride || existingSessionConfig?.corsWorkerUrl).trim(),
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
  createSBT = createSessionWizardPendingDraftSbt,
}: {
  sbtDraft?: PendingSbtDraftLike;
  providerLike?: unknown;
  sessionConfigForDeploy?: AnyRecord;
  workerUrlOverride?: string;
  createSbtComponentProps?: AnyRecord;
  finalizePendingDraft?: (args?: AnyRecord) => Promise<PendingSbtDraftLike>;
  createSBT?: CreateSbtForPendingDraft;
} = {}): Promise<DeploySessionWizardPendingSbtDraftResult> => {
  const finalizedDraft = await finalizePendingDraft({
    draftEntry: sbtDraft,
    workerUrlOverride,
    createSbtComponentProps,
  });
  const hasPasswordMintOnChain =
    finalizedDraft.hasPasswordMintOnChain === true || hasPasswordMintForSbtMintMode(finalizedDraft.mintModeOnChain);
  const receipt = await createSBT(
    providerLike,
    finalizedDraft.contractName,
    finalizedDraft.symbol,
    Number(finalizedDraft.limitedNumber || 0) || 0,
    finalizedDraft.adminAddress,
    Number(finalizedDraft.mintingEndTimeUnix || 0) || 0,
    hasPasswordMintOnChain,
    Number(finalizedDraft.burnAuthEnum || 0),
    Array.isArray(finalizedDraft.hashedPasswords) ? finalizedDraft.hashedPasswords : [],
    toStr(finalizedDraft.tokenURI).trim(),
    toStr(finalizedDraft.finalGroupPasswordHash).trim() || ethers.constants.HashZero,
    sessionConfigForDeploy,
    toStr(finalizedDraft.create2Salt).trim(),
    finalizedDraft.createOptions || {},
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
}: {
  finalizedDraft?: PendingSbtDraftLike;
  sbtAddress?: string;
  sessionConfigForDeploy?: AnyRecord;
  writeRecoveryCodes?: (args?: AnyRecord) => AnyRecord;
} = {}) => {
  const codesToStore = finalizedDraft.usesInviteCodes
    ? [toStr(finalizedDraft.groupPassword).trim()].filter(Boolean)
    : (Array.isArray(finalizedDraft.passwordList) ? finalizedDraft.passwordList : []).filter((value) =>
        toStr(value).trim(),
      );
  const hasPasswordMintOnChain =
    finalizedDraft.hasPasswordMintOnChain === true || hasPasswordMintForSbtMintMode(finalizedDraft.mintModeOnChain);

  if (!hasPasswordMintOnChain || codesToStore.length === 0) {
    return {
      ok: false,
      status: 'empty-recovery-payload',
      passwords: codesToStore,
    };
  }

  const chainId =
    Number(
      finalizedDraft.networkChainId ||
        sessionConfigForDeploy?.networkChainId ||
        sessionConfigForDeploy?.contracts?.sbtFactory?.chainId ||
        0,
    ) || null;

  return writeRecoveryCodes({
    chainId,
    sbtAddress,
    passwords: codesToStore,
    mode: 'replace',
  });
};
