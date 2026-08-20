// Shared pure utility functions for question/response handling.
// Shared by the React client and Node consumers.
// NO browser dependencies — must work in Node.js and browser.
//
// Node consumers may load this module through a symlink, so keep it free of
// browser-only dependencies.
//
// Depends on: ethers (v5)

import * as ethersModule from 'ethers';

const resolveEthersCompat = (loadedModule) => {
  const direct = loadedModule?.ethers || loadedModule?.default?.ethers || loadedModule?.default || loadedModule;
  if (direct) return direct;
  try {
    if (typeof require === 'function') {
      const requiredModule = require('ethers');
      return requiredModule?.ethers || requiredModule?.default?.ethers || requiredModule?.default || requiredModule;
    }
  } catch (_) {}
  return loadedModule;
};

const ethers = resolveEthersCompat(ethersModule);

// --- Question ID generation ---
// Canonical implementation. Matches CreateQuestionsAndSurveys.jsx and SurveyGenerator.tsx.
// The ID is a keccak256 hash of "type:prompt[:options][:single]"

export function generateQuestionId(type, prompt, options = [], singleSelect = false) {
  let dataToHash = `${type}:${(prompt || '').trim().toLowerCase()}`;
  const validOpts = Array.isArray(options) ? options.filter((o) => o && o.trim() !== '') : [];
  if (type === 'multichoice') {
    if (validOpts.length > 0)
      dataToHash += `:${validOpts
        .map((o) => o.trim())
        .join(',')
        .toLowerCase()}`;
    if (singleSelect) dataToHash += ':single';
  }
  return ethers.utils.id(dataToHash);
}

// --- Hex ↔ Base64url conversion ---
// Canonical implementation. Matches arweaveClient.js.

function padBase64String(b64string) {
  const remainder = b64string.length % 4;
  return remainder === 0 ? b64string : `${b64string}${'='.repeat(4 - remainder)}`;
}

function encodeBytesToBase64(byteArray) {
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
}

function decodeBase64ToBytes(b64string) {
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
}

export function hexToBase64url(hexString) {
  if (!hexString || hexString === '0x') return '';
  const byteArray = ethers.utils.arrayify(hexString);
  const b64string = encodeBytesToBase64(byteArray);
  return b64string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToHex(b64urlstring) {
  if (!b64urlstring) return '0x';
  const byteArray = base64DecodeURL(b64urlstring);
  return ethers.utils.hexlify(byteArray);
}

export function base64DecodeURL(b64urlstring) {
  const b64string = b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
  return decodeBase64ToBytes(b64string);
}
