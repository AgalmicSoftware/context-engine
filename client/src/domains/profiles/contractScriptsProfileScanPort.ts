import contractScripts from '../../utilities/web3/contractScripts.js';

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

type ProfileScanContractScripts = {
  getSBTsForUser: (
    userAddress: string,
    groupKeyOrCfg?: unknown,
    fromBlock?: number,
    options?: ProfileScanOptions
  ) => Promise<ProfileScanSbtRecord[] | ProfileScanMetaResult<ProfileScanSbtRecord[]>>;
  getUserActivity: (
    userAddress: string,
    groupKeyOrCfg?: unknown,
    fromBlock?: number,
    options?: ProfileScanOptions
  ) => Promise<ProfileScanActivityPayload | ProfileScanMetaResult<ProfileScanActivityPayload>>;
};

export type ProfileScanPort = ProfileScanContractScripts;

type BindProfileScanPortArgs = {
  contractScripts: () => ProfileScanContractScripts;
};

export const bindProfileScanPort = ({
  contractScripts: readContractScripts,
}: BindProfileScanPortArgs): ProfileScanPort => ({
  getSBTsForUser: (userAddress, groupKeyOrCfg, fromBlock, options) => (
    readContractScripts().getSBTsForUser(userAddress, groupKeyOrCfg, fromBlock, options)
  ),
  getUserActivity: (userAddress, groupKeyOrCfg, fromBlock, options) => (
    readContractScripts().getUserActivity(userAddress, groupKeyOrCfg, fromBlock, options)
  ),
});

export const profileScanPort = bindProfileScanPort({
  contractScripts: () => contractScripts,
});
