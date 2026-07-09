import { ethers } from 'ethers';

type ByteInput = Uint8Array | ArrayLike<number>;
type EthersArrayifyInput = Parameters<typeof ethers.utils.arrayify>[0];

const padBase64String = (b64string: string): string => {
  const remainder = b64string.length % 4;
  return remainder === 0 ? b64string : `${b64string}${'='.repeat(4 - remainder)}`;
};

const encodeBytesToBase64 = (byteArray: ByteInput): string => {
  const bytes = byteArray instanceof Uint8Array ? byteArray : Uint8Array.from(byteArray);
  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder is available.');
};

const decodeBase64ToBytes = (b64string: string): Uint8Array => {
  const padded = padBase64String(b64string);
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Uint8Array.from(Buffer.from(padded, 'base64'));
  }
  throw new Error('No base64 decoder is available.');
};

export const base64DecodeURL = (b64urlstring: string): Uint8Array => {
  const b64string = b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
  return decodeBase64ToBytes(b64string);
};

export const hexToBase64url = (hexString: EthersArrayifyInput): string => {
  if (!hexString || hexString === '0x') return '';
  const byteArray = ethers.utils.arrayify(hexString);
  const b64string = encodeBytesToBase64(byteArray);
  return b64string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const base64urlToHex = (b64urlstring: string): string => {
  if (!b64urlstring) return '0x';
  const byteArray = base64DecodeURL(b64urlstring);
  return ethers.utils.hexlify(byteArray);
};

export const base64urlToBase64 = (b64urlstring: string): string => b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
