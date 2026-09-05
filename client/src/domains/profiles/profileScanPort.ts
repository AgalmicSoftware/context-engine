import chainGateway from '../../utilities/web3/chainGateway.js';

export type ProfileScanSbtRecord = Record<string, unknown>;
export type ProfileScanActivityPayload = {
  surveys?: unknown[];
  responses?: unknown[];
  [key: string]: unknown;
};
export type ProfileScanMetaResult<T> = {
  data: T;
  hadError: boolean;
  error?: string;
};
export type ProfileScanOptions = Record<string, unknown>;

export type ProfileScanPort = {
  getSBTsForUser: (
    userAddress: string,
    groupKeyOrCfg?: unknown,
    fromBlock?: number,
    options?: ProfileScanOptions,
  ) => Promise<ProfileScanSbtRecord[] | ProfileScanMetaResult<ProfileScanSbtRecord[]>>;
  getUserActivity: (
    userAddress: string,
    groupKeyOrCfg?: unknown,
    fromBlock?: number,
    options?: ProfileScanOptions,
  ) => Promise<ProfileScanActivityPayload | ProfileScanMetaResult<ProfileScanActivityPayload>>;
};

export const profileScanPort: ProfileScanPort = {
  getSBTsForUser: (userAddress, groupKeyOrCfg, fromBlock, options) =>
    chainGateway.getSBTsForUser(userAddress, groupKeyOrCfg, fromBlock, options),
  getUserActivity: (userAddress, groupKeyOrCfg, fromBlock, options) =>
    chainGateway.getUserActivity(userAddress, groupKeyOrCfg, fromBlock, options),
};
