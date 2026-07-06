import { arweaveClient as defaultArweaveScripts } from '../../utilities/arweave/arweaveClient.js';

export type ArweaveEncodingScripts = {
  hexToBase64url: (hexString: string) => string;
  base64urlToHex: (base64url: string) => string;
  base64urlToBase64: (base64url: string) => string;
};

export type ArweaveEncodingPort = ArweaveEncodingScripts;

export type BindArweaveEncodingArgs = {
  scripts: () => ArweaveEncodingScripts;
};

export const bindArweaveEncoding = ({
  scripts: readScripts,
}: BindArweaveEncodingArgs): ArweaveEncodingPort => ({
  hexToBase64url: (hexString) => (
    readScripts().hexToBase64url(hexString)
  ),
  base64urlToHex: (base64url) => (
    readScripts().base64urlToHex(base64url)
  ),
  base64urlToBase64: (base64url) => (
    readScripts().base64urlToBase64(base64url)
  ),
});

export const arweaveEncodingPort = bindArweaveEncoding({
  scripts: () => defaultArweaveScripts,
});

export const hexToBase64url = (hexString: string): string => (
  arweaveEncodingPort.hexToBase64url(hexString)
);

export const base64urlToHex = (base64url: string): string => (
  arweaveEncodingPort.base64urlToHex(base64url)
);

export const base64urlToBase64 = (base64url: string): string => (
  arweaveEncodingPort.base64urlToBase64(base64url)
);
