import { toStr } from '../../utilities/shared/primitives.js';

export type AdminResourceDisplayState = {
  address: string;
  display: string;
  meta: string;
  loading: boolean;
  manualRefreshAvailable?: boolean;
};

type ShortAddressFormatter = (address: unknown) => string;
type ArweaveBalanceFormatter = (winston: unknown, precision?: number) => string;
type EtherFormatter = (value: any) => string;
type PreviewFormatter = (value: unknown, limit?: unknown) => string;

const LIT_CHIPOTLE_NOT_CONFIGURED_META =
  'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const buildAdminArweaveEmptyResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'No JWK entered',
  meta: 'Enter a JWK above to read the public wallet balance.',
  loading: false,
});

export const buildAdminArweaveInvalidResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'Invalid JWK',
  meta: 'The wallet JSON could not be parsed.',
  loading: false,
});

export const buildAdminArweaveLoadingResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'Loading...',
  meta: 'Resolving wallet address and balance…',
  loading: true,
});

export const buildAdminArweaveBalanceResource = ({
  address,
  winston,
  formatWinstonToAr,
  shortAddress,
}: {
  address?: unknown;
  winston?: unknown;
  formatWinstonToAr: ArweaveBalanceFormatter;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  return {
    address: normalizedAddress,
    display: `${formatWinstonToAr(winston, 6)} AR`,
    meta: shortAddress(normalizedAddress),
    loading: false,
  };
};

export const buildAdminArweaveErrorResource = ({
  address,
  shortAddress,
}: {
  address?: unknown;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  return {
    address: normalizedAddress,
    display: normalizedAddress ? 'Unable to load balance' : 'Invalid JWK',
    meta: normalizedAddress
      ? shortAddress(normalizedAddress)
      : 'The wallet JSON is missing required Arweave key fields.',
    loading: false,
  };
};

export const buildAdminFaucetEmptyResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'No faucet key entered',
  meta: 'Enter a faucet private key above to read the wallet balance.',
  loading: false,
});

export const buildAdminFaucetInvalidResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'Invalid key',
  meta: 'The private key could not be parsed.',
  loading: false,
});

export const buildAdminFaucetRpcUnavailableResource = ({
  address,
  shortAddress,
}: {
  address?: unknown;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  return {
    address: normalizedAddress,
    display: 'RPC unavailable',
    meta: shortAddress(normalizedAddress),
    loading: false,
  };
};

export const buildAdminFaucetLoadingResource = ({
  address,
  sessionChainLabel,
  shortAddress,
}: {
  address?: unknown;
  sessionChainLabel?: unknown;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  const normalizedSessionChainLabel = toStr(sessionChainLabel);
  return {
    address: normalizedAddress,
    display: 'Loading...',
    meta: normalizedSessionChainLabel ? `Reading ${normalizedSessionChainLabel}` : shortAddress(normalizedAddress),
    loading: true,
  };
};

export const buildAdminFaucetBalanceResource = ({
  address,
  balanceWei,
  sessionChainLabel,
  formatEther,
  shortAddress,
}: {
  address?: unknown;
  balanceWei?: unknown;
  sessionChainLabel?: unknown;
  formatEther: EtherFormatter;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  const normalizedSessionChainLabel = toStr(sessionChainLabel);
  const meta = normalizedSessionChainLabel
    ? `${shortAddress(normalizedAddress)} • ${normalizedSessionChainLabel}`
    : shortAddress(normalizedAddress);
  return {
    address: normalizedAddress,
    display: `${Number(formatEther(balanceWei)).toFixed(4)} ETH`,
    meta,
    loading: false,
  };
};

export const buildAdminFaucetErrorResource = ({
  address,
  shortAddress,
}: {
  address?: unknown;
  shortAddress: ShortAddressFormatter;
}): AdminResourceDisplayState => {
  const normalizedAddress = toStr(address);
  return {
    address: normalizedAddress,
    display: 'Unable to load balance',
    meta: shortAddress(normalizedAddress),
    loading: false,
  };
};

export const buildAdminLitNotConfiguredResource = (): AdminResourceDisplayState => ({
  address: '',
  display: 'Lit Chipotle not configured',
  meta: LIT_CHIPOTLE_NOT_CONFIGURED_META,
  loading: false,
  manualRefreshAvailable: false,
});

export const buildAdminLitUnavailableResource = ({
  useChipotlePath,
}: {
  useChipotlePath?: unknown;
} = {}): AdminResourceDisplayState =>
  useChipotlePath
    ? {
        address: '',
        display: 'Worker unavailable',
        meta: 'Resolve the worker URL to read Lit Chipotle status.',
        loading: false,
        manualRefreshAvailable: false,
      }
    : buildAdminLitNotConfiguredResource();

export const buildAdminLitStatusNotLoadedResource = ({
  hasAccountApiKey,
  hasUsageApiKey,
  configuredLitApiBase,
  configuredLitGroupId,
  configuredLitPkpId,
  configuredLitActionCid,
  formatPreviewValue,
}: {
  hasAccountApiKey?: unknown;
  hasUsageApiKey?: unknown;
  configuredLitApiBase?: unknown;
  configuredLitGroupId?: unknown;
  configuredLitPkpId?: unknown;
  configuredLitActionCid?: unknown;
  formatPreviewValue: PreviewFormatter;
}): AdminResourceDisplayState => {
  const accountKeyPresent = !!hasAccountApiKey;
  const usageKeyPresent = !!hasUsageApiKey;
  const apiBase = toStr(configuredLitApiBase).trim();
  const groupId = toStr(configuredLitGroupId).trim();
  const pkpId = toStr(configuredLitPkpId).trim();
  const actionCid = toStr(configuredLitActionCid).trim();
  return {
    address: '',
    display: 'Status not loaded',
    meta: [
      accountKeyPresent ? 'Unsaved account key' : '',
      usageKeyPresent ? 'Unsaved usage key' : '',
      !accountKeyPresent && !usageKeyPresent ? 'Saved worker config' : '',
      apiBase ? formatPreviewValue(apiBase.replace(/^https?:\/\//, ''), 28) : '',
      groupId ? `group ${formatPreviewValue(groupId, 20)}` : '',
      pkpId ? 'PKP configured' : '',
      actionCid ? 'Action configured' : '',
      'Click refresh to query the worker for Lit Chipotle status.',
    ]
      .filter(Boolean)
      .join(' • '),
    loading: false,
    manualRefreshAvailable: true,
  };
};

export const buildAdminLitLoadingResource = ({
  configuredLitGroupId,
  formatPreviewValue,
}: {
  configuredLitGroupId?: unknown;
  formatPreviewValue: PreviewFormatter;
}): AdminResourceDisplayState => {
  const groupId = toStr(configuredLitGroupId).trim();
  return {
    address: '',
    display: 'Loading...',
    meta: groupId ? `Checking group ${formatPreviewValue(groupId, 20)}` : 'Checking Lit Chipotle worker status',
    loading: true,
    manualRefreshAvailable: true,
  };
};

export const buildAdminLitStatusResource = ({
  ready,
  warnings,
  groupSummary,
  balanceDisplay,
  configuredLitApiBase,
  configuredLitGroupId,
  configuredLitPkpId,
  configuredLitActionCid,
  formatPreviewValue,
}: {
  ready?: unknown;
  warnings?: unknown;
  groupSummary?: unknown;
  balanceDisplay?: unknown;
  configuredLitApiBase?: unknown;
  configuredLitGroupId?: unknown;
  configuredLitPkpId?: unknown;
  configuredLitActionCid?: unknown;
  formatPreviewValue: PreviewFormatter;
}): AdminResourceDisplayState => {
  const normalizedWarnings = Array.isArray(warnings) ? warnings : [];
  const summary = asRecord(groupSummary);
  const walletCount = summary.walletCount == null ? null : Number(summary.walletCount);
  const actionCount = summary.actionCount == null ? null : Number(summary.actionCount);
  const hasHardConfigMiss = summary.hasConfiguredPkp === false || summary.hasConfiguredAction === false;
  const apiBase = toStr(configuredLitApiBase).trim();
  const groupId = toStr(configuredLitGroupId).trim();
  const pkpId = toStr(configuredLitPkpId).trim();
  const actionCid = toStr(configuredLitActionCid).trim();
  const normalizedBalanceDisplay = toStr(balanceDisplay).trim();
  return {
    address: '',
    display:
      ready === true
        ? 'Ready'
        : hasHardConfigMiss
          ? 'Needs config'
          : normalizedWarnings.length
            ? 'Needs review'
            : 'Configured',
    meta:
      [
        apiBase ? formatPreviewValue(apiBase.replace(/^https?:\/\//, ''), 28) : '',
        normalizedBalanceDisplay ? `balance ${normalizedBalanceDisplay}` : '',
        groupId ? `group ${formatPreviewValue(groupId, 20)}` : '',
        pkpId
          ? summary.hasConfiguredPkp === true
            ? 'PKP ready'
            : summary.hasConfiguredPkp === false
              ? 'PKP missing'
              : 'PKP unchecked'
          : walletCount != null
            ? `${walletCount} wallet${walletCount === 1 ? '' : 's'}`
            : '',
        actionCid
          ? summary.hasConfiguredAction === true
            ? 'Action ready'
            : summary.hasConfiguredAction === false
              ? 'Action missing'
              : 'Action unchecked'
          : actionCount != null
            ? `${actionCount} action${actionCount === 1 ? '' : 's'}`
            : '',
        normalizedWarnings.length
          ? `${normalizedWarnings.length} warning${normalizedWarnings.length === 1 ? '' : 's'}`
          : '',
      ]
        .filter(Boolean)
        .join(' • ') || 'Lit Chipotle status loaded.',
    loading: false,
    manualRefreshAvailable: true,
  };
};

export const buildAdminLitErrorResource = (message: unknown): AdminResourceDisplayState => ({
  address: '',
  display: 'Unable to load status',
  meta: toStr(message),
  loading: false,
  manualRefreshAvailable: true,
});

export const getAdminLitResourceLabel = ({
  hasAccountApiKey,
  hasUsageApiKey,
  configuredLitApiBase,
  configuredLitGroupId,
  configuredLitPkpId,
  configuredLitActionCid,
}: {
  hasAccountApiKey?: unknown;
  hasUsageApiKey?: unknown;
  configuredLitApiBase?: unknown;
  configuredLitGroupId?: unknown;
  configuredLitPkpId?: unknown;
  configuredLitActionCid?: unknown;
} = {}): string =>
  hasAccountApiKey ||
  hasUsageApiKey ||
  toStr(configuredLitApiBase).trim() ||
  toStr(configuredLitGroupId).trim() ||
  toStr(configuredLitPkpId).trim() ||
  toStr(configuredLitActionCid).trim()
    ? 'Lit Chipotle status'
    : 'Lit sponsorship status';
