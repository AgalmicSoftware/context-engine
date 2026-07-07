import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';

export type CreateSbtDigestFn = (value: string) => string;

export type BuildCreateSbtAutoCreate2SaltSourceArgs = {
  groupHash?: unknown;
  sbtName?: unknown;
  sessionSlug?: unknown;
};

export type BuildCreateSbtDeterministicSymbolArgs = {
  digest?: CreateSbtDigestFn;
  saltSource?: unknown;
};

export type ResolveCreateSbtPredictedAddressDisplayTextArgs = {
  predictedAddress?: unknown;
  predictedAddressBusy?: unknown;
  unavailableReason?: unknown;
  walletLowerLabel?: unknown;
};

export type ResolveCreateSbtPredictableAddressActiveArgs = {
  create2Salt?: unknown;
  deferredDeployMode?: unknown;
  predictableAddressEnabled?: unknown;
};

export type ResolveCreateSbtPredictableDeployBaseStateArgs = {
  account?: unknown;
  burnAdmin?: unknown;
  isLimited?: unknown;
  limitedNumber?: unknown;
  sbtName?: unknown;
  walletLowerLabel?: unknown;
};

export type CreateSbtPredictableDeployBaseState = {
  adminAddress: string;
  limitedCount: number;
  sbtNameTrimmed: string;
  unavailableReason: string;
};

export type ResolveCreateSbtPredictedAddressCacheHitArgs = {
  allowCached?: unknown;
  cachedShapeSignature?: unknown;
  predictedAddress?: unknown;
  predictionSignature?: unknown;
};

export type CreateSbtPredictedAddressCacheHit = {
  predictedAddress: string;
  predictionSignature: string;
};

export type BuildCreateSbtPredictableDeploySignatureArgs = {
  network?: unknown;
  predictionShape?: unknown;
  selectedAuthoringChainId?: unknown;
};

const isCreateSbtPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export const buildCreateSbtAutoCreate2SaltSource = ({
  groupHash = '',
  sbtName = '',
  sessionSlug = '',
}: BuildCreateSbtAutoCreate2SaltSourceArgs = {}): string => {
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug || '') || 'general';
  const rawName = String(sbtName || '')
    .trim()
    .toLowerCase();
  const nameSlug = rawName
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (nameSlug) return `${normalizedSessionSlug}/${nameSlug}`;
  const hashSuffix =
    String(groupHash || '')
      .replace(/^0x/i, '')
      .slice(0, 10) || 'draft';
  return `${normalizedSessionSlug}/group-${hashSuffix}`;
};

export const buildCreateSbtDeterministicSymbol = ({
  digest = () => '',
  saltSource = '',
}: BuildCreateSbtDeterministicSymbolArgs = {}): string => {
  const source = String(saltSource || 'context-engine-sbt');
  const digestValue = String(digest(source) || '').replace(/^0x/i, '');
  return `CE-SBT-${digestValue.slice(0, 6).toUpperCase()}`;
};

export const resolveCreateSbtPredictedAddressDisplayText = ({
  predictedAddress = '',
  predictedAddressBusy = false,
  unavailableReason = '',
  walletLowerLabel = 'wallet',
}: ResolveCreateSbtPredictedAddressDisplayTextArgs = {}): string => {
  const resolvedAddress = String(predictedAddress || '').trim();
  if (resolvedAddress) return resolvedAddress;
  if (predictedAddressBusy) return 'Pending…';

  const reason = String(unavailableReason || '').trim();
  if (reason === 'Enter a group name to preview the address.') {
    return 'Pending group name…';
  }
  const walletLower = String(walletLowerLabel || 'wallet').trim() || 'wallet';
  if (reason === `Connect a ${walletLower} to preview the address.`) {
    return 'Pending admin account…';
  }

  return 'Pending…';
};

export const resolveCreateSbtPredictableAddressActive = ({
  create2Salt = '',
  deferredDeployMode = false,
  predictableAddressEnabled = false,
}: ResolveCreateSbtPredictableAddressActiveArgs = {}): boolean =>
  !!deferredDeployMode || !!predictableAddressEnabled || !!String(create2Salt || '').trim();

export const resolveCreateSbtPredictableDeployBaseState = ({
  account = '',
  burnAdmin = '',
  isLimited = false,
  limitedNumber = 0,
  sbtName = '',
  walletLowerLabel = 'wallet',
}: ResolveCreateSbtPredictableDeployBaseStateArgs = {}): CreateSbtPredictableDeployBaseState => {
  const sbtNameTrimmed = String(sbtName || '').trim();
  const adminAddress = String(burnAdmin || account || '').trim();
  const limitedCountRaw = isLimited ? Number(limitedNumber) : 0;
  const limitedCount = Number.isFinite(limitedCountRaw) ? Math.floor(limitedCountRaw) : 0;
  const walletLower = String(walletLowerLabel || 'wallet').trim() || 'wallet';
  let unavailableReason = '';
  if (!sbtNameTrimmed) {
    unavailableReason = 'Enter a group name to preview the address.';
  } else if (!adminAddress) {
    unavailableReason = `Connect a ${walletLower} to preview the address.`;
  } else if (isLimited && limitedCount <= 0) {
    unavailableReason = 'Set a positive mint limit to preview the address.';
  }
  return {
    adminAddress,
    limitedCount,
    sbtNameTrimmed,
    unavailableReason,
  };
};

export const resolveCreateSbtPredictedAddressCacheHit = ({
  allowCached = false,
  cachedShapeSignature = '',
  predictedAddress = '',
  predictionSignature = '',
}: ResolveCreateSbtPredictedAddressCacheHitArgs = {}): CreateSbtPredictedAddressCacheHit | null => {
  const signature = String(predictionSignature || '');
  const cachedSignature = String(cachedShapeSignature || '');
  const cachedPredictedAddress = String(predictedAddress || '').trim();
  if (allowCached !== true || !signature || signature !== cachedSignature || !cachedPredictedAddress) {
    return null;
  }
  return {
    predictedAddress: cachedPredictedAddress,
    predictionSignature: signature,
  };
};

export const buildCreateSbtPredictableDeploySignature = ({
  network = null,
  predictionShape = null,
  selectedAuthoringChainId = null,
}: BuildCreateSbtPredictableDeploySignatureArgs = {}): string => {
  if (!isCreateSbtPlainObject(predictionShape)) return '';
  const groupCfg = isCreateSbtPlainObject(predictionShape.groupCfg) ? predictionShape.groupCfg : {};
  const contracts = isCreateSbtPlainObject(groupCfg.contracts) ? groupCfg.contracts : {};
  const sbtFactory = isCreateSbtPlainObject(contracts.sbtFactory) ? contracts.sbtFactory : {};
  const networkRecord = isCreateSbtPlainObject(network) ? network : {};
  const sbtFactoryAddress = String(sbtFactory.address || groupCfg.sbtFactoryAddress || '')
    .trim()
    .toLowerCase();
  const networkChainId =
    Number(
      groupCfg.networkChainId ||
        sbtFactory.chainId ||
        selectedAuthoringChainId ||
        networkRecord.id ||
        networkRecord.chainId ||
        0,
    ) || 0;

  return JSON.stringify({
    contractName: String(predictionShape.contractName || '').trim(),
    symbol: String(predictionShape.symbol || '').trim(),
    limitedNumber: Number(predictionShape.limitedNumber || 0) || 0,
    adminAddress: String(predictionShape.adminAddress || '')
      .trim()
      .toLowerCase(),
    mintingEndTimeUnix: Number(predictionShape.mintingEndTimeUnix || 0) || 0,
    mintModeOnChain: Number(predictionShape.mintModeOnChain ?? 0) || 0,
    hasPasswordMintOnChain: predictionShape.hasPasswordMintOnChain === true,
    burnAuthEnum: Number(predictionShape.burnAuthEnum || 0) || 0,
    hashedPasswords: Array.isArray(predictionShape.hashedPasswords) ? predictionShape.hashedPasswords : [],
    create2Salt: String(predictionShape.create2Salt || '').trim(),
    initializeGroupPasswordHash: predictionShape.initializeGroupPasswordHash === true,
    sbtFactoryAddress,
    networkChainId,
  });
};
