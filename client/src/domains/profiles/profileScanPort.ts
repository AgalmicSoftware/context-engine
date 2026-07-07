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

type ProfileScanChainGateway = {
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

export type ProfileScanPort = ProfileScanChainGateway;

type BindProfileScanPortArgs = {
  chainGateway: () => ProfileScanChainGateway;
};

export const bindProfileScanPort = ({ chainGateway: readChainGateway }: BindProfileScanPortArgs): ProfileScanPort => ({
  getSBTsForUser: (userAddress, groupKeyOrCfg, fromBlock, options) =>
    readChainGateway().getSBTsForUser(userAddress, groupKeyOrCfg, fromBlock, options),
  getUserActivity: (userAddress, groupKeyOrCfg, fromBlock, options) =>
    readChainGateway().getUserActivity(userAddress, groupKeyOrCfg, fromBlock, options),
});

export const profileScanPort = bindProfileScanPort({
  chainGateway: () => chainGateway,
});
