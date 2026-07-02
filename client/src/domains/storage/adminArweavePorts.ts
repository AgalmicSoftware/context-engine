import { arweaveScripts as defaultArweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import * as defaultArweaveUrls from '../../utilities/arweave/arweaveUrls.js';

export type AdminArweaveRecord = Record<string, unknown>;

export type AdminArweaveWalletBalance = {
  address: string;
  balanceUrl: string;
  gatewayBase: string;
  winston: string;
};

export type AdminArweaveUploadOptions = AdminArweaveRecord;

export type AdminNormalizeArweaveUrlOptions = {
  gateway?: unknown;
  contextLabel?: unknown;
};

export type AdminArweaveScriptsModule = {
  readArweaveWalletBalance: (
    jwk: unknown,
    opts?: AdminArweaveRecord
  ) => Promise<AdminArweaveWalletBalance>;
  formatWinstonToAr: (
    winston: unknown,
    decimals?: number
  ) => string;
  uploadDataToArweave: (
    data: unknown,
    format: string,
    opts?: AdminArweaveUploadOptions
  ) => Promise<string>;
  buildArweaveGatewayUrl: (
    txId: unknown,
    gateway?: unknown
  ) => string;
};

export type AdminArweaveUrlsModule = {
  normalizeArweaveUrl: (
    value: unknown,
    options?: AdminNormalizeArweaveUrlOptions
  ) => string;
};

export type AdminArweavePort = {
  readArweaveWalletBalance: (
    jwk: unknown,
    opts?: AdminArweaveRecord
  ) => Promise<AdminArweaveWalletBalance>;
  formatWinstonToAr: (
    winston: unknown,
    decimals?: number
  ) => string;
  uploadDataToArweave: (
    data: unknown,
    format: string,
    opts?: AdminArweaveUploadOptions
  ) => Promise<string>;
  buildArweaveGatewayUrl: (
    txId: unknown,
    gateway?: unknown
  ) => string;
  normalizeArweaveUrl: (
    value: unknown,
    options?: AdminNormalizeArweaveUrlOptions
  ) => string;
};

export type BindAdminArweavePortsArgs = {
  scripts: () => AdminArweaveScriptsModule;
  urls: () => AdminArweaveUrlsModule;
};

export const bindAdminArweavePorts = ({
  scripts: readScripts,
  urls: readUrls,
}: BindAdminArweavePortsArgs): AdminArweavePort => ({
  readArweaveWalletBalance: (jwk, opts) => (
    readScripts().readArweaveWalletBalance(jwk, opts)
  ),
  formatWinstonToAr: (winston, decimals) => (
    readScripts().formatWinstonToAr(winston, decimals)
  ),
  uploadDataToArweave: (data, format, opts) => (
    readScripts().uploadDataToArweave(data, format, opts)
  ),
  buildArweaveGatewayUrl: (txId, gateway) => (
    readScripts().buildArweaveGatewayUrl(txId, gateway)
  ),
  normalizeArweaveUrl: (value, options) => (
    readUrls().normalizeArweaveUrl(value, options)
  ),
});

export const adminArweavePort = bindAdminArweavePorts({
  scripts: () => defaultArweaveScripts,
  urls: () => defaultArweaveUrls,
});
