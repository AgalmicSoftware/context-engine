/*
 * @file sponsoredAccess.ts
 * @module sponsoredAccess
 * @description Sponsored resource access — resolves whether a resource is gated, open, or sponsored.
 *              Checks SBT gate conditions and faucet configuration for session resources.
 *
 * Key exports: checkSponsoredAccess, getDefaultSponsoredGate, getGateSbtAddresses, SPONSORED_GATE_STATES, normalizeGateMode
 */
import contractScripts from './chainGateway.js';
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
import type {
  SponsoredGate,
  SponsoredGateState,
  SponsoredResource,
  SponsoredAccessResult,
} from './sponsoredAccessState.js';

type SessionConfigLike = Record<string, unknown>;
type UserHasSBTFn = (
  providerName: string,
  sbtAddress?: string | null,
  account?: string | null,
  fromBlock?: number,
  toBlock?: string,
  groupKeyOrCfg?: SessionConfigLike | string | null,
) => ReturnType<typeof contractScripts.userHasSBT>;

const checkSbtAccess = ({
  sbtAddress,
  account,
  sessionConfig,
  sessionSlug,
}: {
  sbtAddress?: string | null;
  account?: string | null;
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string | null;
} = {}) =>
  (contractScripts.userHasSBT as UserHasSBTFn)(
    'none',
    sbtAddress,
    account,
    0,
    'latest',
    sessionConfig || sessionSlug || '',
  );

/**
 * Check sponsored access by resolving SBT ownership through contractScripts.
 */
export const checkSponsoredAccess = (
  args: {
    sessionConfig?: SessionConfigLike | null;
    sessionSlug?: string;
    account?: string;
    resourceKey?: SponsoredResource;
  } = {},
): Promise<SponsoredAccessResult> =>
  checkSponsoredAccessWithChecker({
    ...args,
    checkSbtAccess,
  });

/**
 * Resolve the default sponsored gate from a session config.
 */
export const getDefaultSponsoredGate: typeof getDefaultSponsoredGateImpl = (...args) =>
  getDefaultSponsoredGateImpl(...args);

/**
 * Resolve the sponsored gate state for a resource key.
 */
export const resolveSponsoredGateStateForResource: typeof resolveSponsoredGateStateForResourceImpl = (...args) =>
  resolveSponsoredGateStateForResourceImpl(...args);

/**
 * Resolve the sponsored gate payload for a resource key.
 */
export const resolveSponsoredGateForResource: typeof resolveSponsoredGateForResourceImpl = (...args) =>
  resolveSponsoredGateForResourceImpl(...args);

/**
 * Read a recent sponsored access result from cache.
 */
export const readCachedSponsoredAccess: typeof readCachedSponsoredAccessImpl = (...args) =>
  readCachedSponsoredAccessImpl(...args);

/**
 * Warm the sponsored access cache for a gated resource.
 */
export const primeSponsoredAccessCheck = (
  args: {
    sessionConfig?: SessionConfigLike | null;
    sessionSlug?: string;
    account?: string;
    resourceKey?: SponsoredResource;
  } = {},
): Promise<SponsoredAccessResult | null> =>
  primeSponsoredAccessCheckWithChecker({
    ...args,
    checkSbtAccess,
  });

/**
 * Collect unique SBT addresses from a sponsored gate payload.
 */
export const getGateSbtAddresses: typeof getGateSbtAddressesImpl = (...args) => getGateSbtAddressesImpl(...args);

/**
 * Normalize a sponsored gate mode to `any` or `all`.
 */
export const normalizeGateMode: typeof normalizeGateModeImpl = (...args) => normalizeGateModeImpl(...args);

export { SPONSORED_GATE_STATES };
