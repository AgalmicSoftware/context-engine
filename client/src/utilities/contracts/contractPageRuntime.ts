import contractScripts from '../web3/contractScripts.js';

const contractScriptsUntyped = contractScripts as unknown as {
  hexToBase64url: (value: string) => string;
  base64urlToHex: (value: string) => string;
  base64urlToBase64: (value: string) => string;
};

const contractPageRuntime = {
  hexToBase64url: (value: string) => contractScriptsUntyped.hexToBase64url(value),
  base64urlToHex: (value: string) => contractScriptsUntyped.base64urlToHex(value),
  base64urlToBase64: (value: string) => contractScriptsUntyped.base64urlToBase64(value),
};

export default contractPageRuntime;

export {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../web3/contractScripts.js';
