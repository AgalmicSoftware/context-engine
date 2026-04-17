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

/** @typedef {Object<string, any>} SessionConfigLike */
/** @typedef {import('./sponsoredAccessState.js').SponsoredGate} SponsoredGate */
/** @typedef {import('./sponsoredAccessState.js').SponsoredGateState} SponsoredGateState */
/** @typedef {import('./sponsoredAccessState.js').SponsoredResource} SponsoredResource */
/** @typedef {import('./sponsoredAccessState.js').SponsoredAccessResult} SponsoredAccessResult */

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

/**
 * Check sponsored access by resolving SBT ownership through contractScripts.
 * @param {{
 *   sessionConfig?: SessionConfigLike|null,
 *   sessionSlug?: string,
 *   account?: string,
 *   resourceKey?: SponsoredResource,
 * }} [args={}]
 * @returns {Promise<SponsoredAccessResult>}
 */
export const checkSponsoredAccess = (args = {}) => checkSponsoredAccessWithChecker({
  ...args,
  checkSbtAccess,
});

/**
 * Resolve the default sponsored gate from a session config.
 * @type {typeof getDefaultSponsoredGateImpl}
 */
export const getDefaultSponsoredGate = (...args) => getDefaultSponsoredGateImpl(...args);

/**
 * Resolve the sponsored gate state for a resource key.
 * @type {typeof resolveSponsoredGateStateForResourceImpl}
 */
export const resolveSponsoredGateStateForResource = (...args) => (
  resolveSponsoredGateStateForResourceImpl(...args)
);

/**
 * Resolve the sponsored gate payload for a resource key.
 * @type {typeof resolveSponsoredGateForResourceImpl}
 */
export const resolveSponsoredGateForResource = (...args) => (
  resolveSponsoredGateForResourceImpl(...args)
);

/**
 * Read a recent sponsored access result from cache.
 * @type {typeof readCachedSponsoredAccessImpl}
 */
export const readCachedSponsoredAccess = (...args) => readCachedSponsoredAccessImpl(...args);

/**
 * Warm the sponsored access cache for a gated resource.
 * @param {{
 *   sessionConfig?: SessionConfigLike|null,
 *   sessionSlug?: string,
 *   account?: string,
 *   resourceKey?: SponsoredResource,
 * }} [args={}]
 * @returns {Promise<SponsoredAccessResult|null>}
 */
export const primeSponsoredAccessCheck = (args = {}) => primeSponsoredAccessCheckWithChecker({
  ...args,
  checkSbtAccess,
});

/**
 * Collect unique SBT addresses from a sponsored gate payload.
 * @type {typeof getGateSbtAddressesImpl}
 */
export const getGateSbtAddresses = (...args) => getGateSbtAddressesImpl(...args);

/**
 * Normalize a sponsored gate mode to `any` or `all`.
 * @type {typeof normalizeGateModeImpl}
 */
export const normalizeGateMode = (...args) => normalizeGateModeImpl(...args);

/**
 * Convenience bundle of the sponsored access public helpers.
 * @type {{
 *   getDefaultSponsoredGate: typeof getDefaultSponsoredGate,
 *   resolveSponsoredGateStateForResource: typeof resolveSponsoredGateStateForResource,
 *   resolveSponsoredGateForResource: typeof resolveSponsoredGateForResource,
 *   checkSponsoredAccess: typeof checkSponsoredAccess,
 *   readCachedSponsoredAccess: typeof readCachedSponsoredAccess,
 *   primeSponsoredAccessCheck: typeof primeSponsoredAccessCheck,
 *   getGateSbtAddresses: typeof getGateSbtAddresses,
 *   normalizeGateMode: typeof normalizeGateMode,
 *   SPONSORED_GATE_STATES: typeof SPONSORED_GATE_STATES,
 * }}
 */
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
