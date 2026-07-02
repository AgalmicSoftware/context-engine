import { arweaveScripts } from '../arweave/arweaveScripts.js';

export const hexToBase64url = (value: string): string => (
  arweaveScripts.hexToBase64url(value)
);

export const base64urlToHex = (value: string): string => (
  arweaveScripts.base64urlToHex(value)
);

export const base64urlToBase64 = (value: string): string => (
  arweaveScripts.base64urlToBase64(value)
);

export {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../web3/contractScripts.js';
