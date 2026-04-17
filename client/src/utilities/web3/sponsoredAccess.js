/**
 * @file sponsoredAccess.js
 * @module sponsoredAccess
 * @description Sponsored resource access — resolves whether a resource is gated, open, or sponsored.
 *              Checks SBT gate conditions and faucet configuration for session resources.
 *
 * Key exports: checkSponsoredAccess, getDefaultSponsoredGate, getGateSbtAddresses, SPONSORED_GATE_STATES, normalizeGateMode
 */
import contractScripts from './contractScripts.js';
import {
  SPONSORED_GATE_STATES,
  getDefaultSponsoredGate as getDefaultSponsoredGateImpl,
  resolveSponsoredGateStateForResource as resolveSponsoredGateStateForResourceImpl,
  resolveSponsoredGateForResource as resolveSponsoredGateForResourceImpl,
  readCachedSponsoredAccess as readCachedSponsoredAccessImpl,
  checkSponsoredAccessWithChecker,
  primeSponsoredAccessCheckWithChecker,
  getGateSbtAddresses as getGateSbtAddressesImpl,
  normalizeGateMode as normalizeGateModeImpl,
} from './sponsoredAccessState.js';

const checkSbtAccess = ({
  sbtAddress,
  account,
  sessionConfig,
  sessionSlug,
} = {}) => contractScripts.userHasSBT(
  'none',
  sbtAddress,
  account,
  0,
  'latest',
  sessionConfig || sessionSlug || ''
);

export const checkSponsoredAccess = (args = {}) => checkSponsoredAccessWithChecker({
  ...args,
  checkSbtAccess,
});

export const getDefaultSponsoredGate = (...args) => getDefaultSponsoredGateImpl(...args);

export const resolveSponsoredGateStateForResource = (...args) => (
  resolveSponsoredGateStateForResourceImpl(...args)
);

export const resolveSponsoredGateForResource = (...args) => (
  resolveSponsoredGateForResourceImpl(...args)
);

export const readCachedSponsoredAccess = (...args) => readCachedSponsoredAccessImpl(...args);

export const primeSponsoredAccessCheck = (args = {}) => primeSponsoredAccessCheckWithChecker({
  ...args,
  checkSbtAccess,
});

export const getGateSbtAddresses = (...args) => getGateSbtAddressesImpl(...args);

export const normalizeGateMode = (...args) => normalizeGateModeImpl(...args);

export const sponsoredAccessUtils = {
  getDefaultSponsoredGate,
  resolveSponsoredGateStateForResource,
  resolveSponsoredGateForResource,
  checkSponsoredAccess,
  readCachedSponsoredAccess,
  primeSponsoredAccessCheck,
  getGateSbtAddresses,
  normalizeGateMode,
  SPONSORED_GATE_STATES,
};

export {
  SPONSORED_GATE_STATES,
};
