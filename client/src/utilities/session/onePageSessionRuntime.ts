import contractScripts, * as contractScriptsExports from '../web3/contractScripts.js';

export type OnePageSessionBalance = {
  gte(value: string | number | { toString: () => string }): boolean;
};

type OnePageSessionGroupConfig = {
  slug?: unknown;
  [key: string]: unknown;
};

type OnePageSessionGroupKeyOrConfig = string | OnePageSessionGroupConfig | null | undefined;

type OnePageSessionBalanceReader = (
  address: string,
  groupKeyOrCfg?: OnePageSessionGroupKeyOrConfig
) => Promise<OnePageSessionBalance | null>;

type OnePageSessionContractRuntime = {
  getETHBalance?: OnePageSessionBalanceReader;
  getNativeBalance?: OnePageSessionBalanceReader;
};

type OnePageSessionAllSlugsOptions = {
  includeEmpty?: boolean;
};

type OnePageSessionContractExports = {
  getAllSessionSlugs: (options?: OnePageSessionAllSlugsOptions) => unknown[];
};

const contractRuntime = contractScripts as OnePageSessionContractRuntime;
const contractNamedExports = contractScriptsExports as OnePageSessionContractExports;

export const getAllSessionSlugs = (options?: OnePageSessionAllSlugsOptions): unknown[] => (
  contractNamedExports.getAllSessionSlugs(options)
);

export const hasNativeBalanceReader = (): boolean => (
  typeof contractRuntime.getNativeBalance === 'function'
);

export const hasLegacyEthBalanceReader = (): boolean => (
  typeof contractRuntime.getETHBalance === 'function'
);

export const getNativeBalance = (
  address: string,
  groupKeyOrCfg?: OnePageSessionGroupKeyOrConfig
): Promise<OnePageSessionBalance | null> => (
  contractRuntime.getNativeBalance?.(address, groupKeyOrCfg) ?? Promise.resolve(null)
);

export const getLegacyEthBalance = (
  address: string,
  groupKeyOrCfg?: OnePageSessionGroupKeyOrConfig
): Promise<OnePageSessionBalance | null> => (
  contractRuntime.getETHBalance?.(address, groupKeyOrCfg) ?? Promise.resolve(null)
);
