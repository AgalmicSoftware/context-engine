import { arweaveClient as defaultArweaveClient } from '../../utilities/arweave/arweaveClient.js';
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

export type AdminArweavePort = {
  readArweaveWalletBalance: (jwk: unknown, opts?: AdminArweaveRecord) => Promise<AdminArweaveWalletBalance>;
  formatWinstonToAr: (winston: unknown, decimals?: number) => string;
  uploadDataToArweave: (data: unknown, format: string, opts?: AdminArweaveUploadOptions) => Promise<string | undefined>;
  buildArweaveGatewayUrl: (txId: unknown, gateway?: unknown) => string;
  normalizeArweaveUrl: (value: unknown, options?: AdminNormalizeArweaveUrlOptions) => string;
};

export const adminArweavePort: AdminArweavePort = {
  readArweaveWalletBalance: (jwk, opts) =>
    opts === undefined
      ? defaultArweaveClient.readArweaveWalletBalance(jwk)
      : defaultArweaveClient.readArweaveWalletBalance(jwk, opts),
  formatWinstonToAr: (winston, decimals) =>
    decimals === undefined
      ? defaultArweaveClient.formatWinstonToAr(winston)
      : defaultArweaveClient.formatWinstonToAr(winston, decimals),
  uploadDataToArweave: (data, format, opts) =>
    opts === undefined
      ? defaultArweaveClient.uploadDataToArweave(data, format)
      : defaultArweaveClient.uploadDataToArweave(data, format, opts),
  buildArweaveGatewayUrl: (txId, gateway) =>
    gateway === undefined
      ? defaultArweaveClient.buildArweaveGatewayUrl(txId)
      : defaultArweaveClient.buildArweaveGatewayUrl(txId, gateway),
  normalizeArweaveUrl: (value, options) =>
    options === undefined
      ? defaultArweaveUrls.normalizeArweaveUrl(value)
      : defaultArweaveUrls.normalizeArweaveUrl(value, options),
};
