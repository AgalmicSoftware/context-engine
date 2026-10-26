// SPDX-License-Identifier: MPL-2.0
// Worker wrapper keeps ethers v6 isolated from the client's v5 runtime.

import * as ethersModule from 'ethers';

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
const getEthersFn = (...candidates) => candidates.find((fn) => typeof fn === 'function') || null;
const getEthersUtils = () => (
  ethers?.utils ||
  ethersModule?.utils ||
  ethersModule?.ethers?.utils ||
  null
);
const getAdminHashFns = () => {
  const utils = getEthersUtils();
  return {
    keccak256: getEthersFn(
      utils?.keccak256,
      ethers?.keccak256,
      ethers?.ethers?.keccak256,
    ),
    toUtf8Bytes: getEthersFn(
      utils?.toUtf8Bytes,
      ethers?.toUtf8Bytes,
      ethers?.ethers?.toUtf8Bytes,
    ),
  };
};

import { createAdminActionBodyHash } from '../../shared/auth/adminTypedData.mjs';
export {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
  ADMIN_ACTION_AUTH_FIELDS,
  buildAdminActionMessage,
  buildAdminActionTypedData,
  stripAdminActionAuthFields,
} from '../../shared/auth/adminTypedData.mjs';

export const buildAdminActionBodyHash = createAdminActionBodyHash(getAdminHashFns());
