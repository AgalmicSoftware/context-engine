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
    meta: normalizedSessionChainLabel
      ? `Reading ${normalizedSessionChainLabel}`
      : shortAddress(normalizedAddress),
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
