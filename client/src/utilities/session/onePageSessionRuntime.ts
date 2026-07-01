import contractScripts, * as contractScriptsExports from '../web3/contractScripts.js';

type OnePageSessionBalance = {
  gte: (value: unknown) => boolean;
};

type OnePageSessionContractRuntime = {
  getETHBalance?: (...args: unknown[]) => Promise<OnePageSessionBalance | null>;
  getNativeBalance?: (...args: unknown[]) => Promise<OnePageSessionBalance | null>;
};

type OnePageSessionContractExports = {
  getAllSessionSlugs: (...args: unknown[]) => unknown[];
};

const contractRuntime = contractScripts as unknown as OnePageSessionContractRuntime;
const contractNamedExports = contractScriptsExports as unknown as OnePageSessionContractExports;

export const getAllSessionSlugs = (...args: unknown[]): unknown[] => (
  contractNamedExports.getAllSessionSlugs(...args)
);

export const hasNativeBalanceReader = (): boolean => (
  typeof contractRuntime.getNativeBalance === 'function'
);

export const hasLegacyEthBalanceReader = (): boolean => (
  typeof contractRuntime.getETHBalance === 'function'
);

export const getNativeBalance = (...args: unknown[]): Promise<OnePageSessionBalance | null> => (
  contractRuntime.getNativeBalance?.(...args) ?? Promise.resolve(null)
);

export const getLegacyEthBalance = (...args: unknown[]): Promise<OnePageSessionBalance | null> => (
  contractRuntime.getETHBalance?.(...args) ?? Promise.resolve(null)
);
