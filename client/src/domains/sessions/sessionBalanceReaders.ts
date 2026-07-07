import contractScripts from '../../utilities/web3/chainGateway.js';

export type SessionBalance = {
  gte(value: string | number | { toString: () => string }): boolean;
};

type SessionBalanceGroupConfig = {
  slug?: unknown;
  [key: string]: unknown;
};

type SessionBalanceGroupKeyOrConfig = string | SessionBalanceGroupConfig | null | undefined;

type SessionBalanceReader = (
  address: string,
  groupKeyOrCfg?: SessionBalanceGroupKeyOrConfig,
) => Promise<SessionBalance | null>;

type SessionBalanceRuntime = {
  getETHBalance?: SessionBalanceReader;
  getNativeBalance?: SessionBalanceReader;
};

const readBalanceRuntime = (): SessionBalanceRuntime => contractScripts as SessionBalanceRuntime;

export const hasNativeBalanceReader = (): boolean => typeof readBalanceRuntime().getNativeBalance === 'function';

export const hasLegacyEthBalanceReader = (): boolean => typeof readBalanceRuntime().getETHBalance === 'function';

export const getNativeBalance = (
  address: string,
  groupKeyOrCfg?: SessionBalanceGroupKeyOrConfig,
): Promise<SessionBalance | null> =>
  readBalanceRuntime().getNativeBalance?.(address, groupKeyOrCfg) ?? Promise.resolve(null);

export const getLegacyEthBalance = (
  address: string,
  groupKeyOrCfg?: SessionBalanceGroupKeyOrConfig,
): Promise<SessionBalance | null> =>
  readBalanceRuntime().getETHBalance?.(address, groupKeyOrCfg) ?? Promise.resolve(null);
