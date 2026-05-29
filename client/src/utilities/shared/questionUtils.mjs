// Shared pure utility functions for question/response handling.
// Used by both the React client AND contextEngine-cc (via symlink).
// NO browser dependencies — must work in Node.js and browser.
//
// If you modify this file, contextEngine-cc will pick up changes automatically
// via its symlink at contextEngine-cc/lib/shared/questionUtils.mjs
//
// Depends on: ethers (v5)

import bufferModule from 'buffer';
import * as ethersModule from 'ethers';

const Buffer =
  bufferModule?.Buffer ||
  bufferModule;

const resolveEthersCompat = (loadedModule) => {
  const direct =
    loadedModule?.ethers ||
    loadedModule?.default?.ethers ||
    loadedModule?.default ||
    loadedModule;
  if (direct) return direct;
  try {
    if (typeof require === 'function') {
      const requiredModule = require('ethers');
      return (
        requiredModule?.ethers ||
        requiredModule?.default?.ethers ||
        requiredModule?.default ||
        requiredModule
      );
    }
  } catch (_) {}
  return loadedModule;
};

const ethers =
  resolveEthersCompat(ethersModule);

// --- Question ID generation ---
// Canonical implementation. Matches CreateQuestionsAndSurveys.jsx and SurveyGenerator.tsx.
// The ID is a keccak256 hash of "type:prompt[:options][:single]"

export function generateQuestionId(type, prompt, options = [], singleSelect = false) {
  let dataToHash = `${type}:${(prompt || '').trim().toLowerCase()}`;
  const validOpts = Array.isArray(options) ? options.filter(o => o && o.trim() !== '') : [];
  if (type === 'multichoice') {
    if (validOpts.length > 0) dataToHash += `:${validOpts.map(o => o.trim()).join(',').toLowerCase()}`;
    if (singleSelect) dataToHash += ':single';
  }
  return ethers.utils.id(dataToHash);
}

// --- Hex ↔ Base64url conversion ---
// Canonical implementation. Matches arweaveScripts.js.

export function hexToBase64url(hexString) {
  if (!hexString || hexString === '0x') return '';
  const byteArray = ethers.utils.arrayify(hexString);
  const b64string = Buffer.from(byteArray).toString('base64');
  return b64string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToHex(b64urlstring) {
  if (!b64urlstring) return '0x';
  const byteArray = base64DecodeURL(b64urlstring);
  return ethers.utils.hexlify(byteArray);
}

export function base64DecodeURL(b64urlstring) {
  const b64string = b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64string, 'base64');
}

// --- Arweave gateway ---

export const ARWEAVE_GATEWAY = 'https://ar-io.dev';
