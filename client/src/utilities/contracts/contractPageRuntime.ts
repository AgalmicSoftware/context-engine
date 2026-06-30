import contractScripts from '../web3/contractScripts.js';

const contractScriptsUntyped = contractScripts as unknown as {
  hexToBase64url: (value: string) => string;
  base64urlToHex: (value: string) => string;
  base64urlToBase64: (value: string) => string;
};

export const hexToBase64url = (value: string): string => (
  contractScriptsUntyped.hexToBase64url(value)
);

export const base64urlToHex = (value: string): string => (
  contractScriptsUntyped.base64urlToHex(value)
);

export const base64urlToBase64 = (value: string): string => (
  contractScriptsUntyped.base64urlToBase64(value)
);

export {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../web3/contractScripts.js';
