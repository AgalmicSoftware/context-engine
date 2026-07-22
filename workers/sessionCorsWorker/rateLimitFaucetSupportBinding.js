import { toTrimmedString } from './stringCoercion.js';
import {
  createFaucetGateAuthorityWithDeps,
} from './faucetGateAuthority.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';
import {
  checkCoordinatedAuthRateLimit as checkCoordinatedAuthRateLimitBoundary,
} from './sessionWriteCoordinator.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const recordRateLimitTrip = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEventBoundary)({
      env,
      type: ABUSE_COUNTER_TYPES.RATE_LIMIT_TRIP,
      now: deps?.now,
    });
  } catch {
    // Rate-limit telemetry must not change the allow/deny result.
  }
};

export const createRateLimitFaucetSupportWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const checkRateLimit = async ({
    env,
    slug,
    address,
    limit,
    route,
  } = {}) => {
    const numeric = Number(limit || 0);
    if (!numeric || Number.isNaN(numeric) || numeric <= 0) return true;

    const routeKey = toTrimmedString(route, deps).toLowerCase() || 'default';
    const identity = toTrimmedString(address, deps).toLowerCase() || 'anonymous';
    const coordinate = deps?.checkCoordinatedAuthRateLimit || checkCoordinatedAuthRateLimitBoundary;
    const result = await coordinate({
      env,
      slug,
      route: routeKey,
      identity,
      limit: numeric,
      windowMs: DAY_MS,
      now: deps?.now,
    });
    const allowed = result?.ok === true && result?.allowed === true;
    if (!allowed) await recordRateLimitTrip({ env, deps });
    return allowed;
  };

  const faucetGateAuthority = (
    deps?.createFaucetGateAuthorityWithDeps || createFaucetGateAuthorityWithDeps
  )({
    deps: {
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      normalizeAddressLower: deps?.normalizeAddressLower,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      readSessionExistsOnChain: deps?.readSessionExistsOnChain,
      maskRpcUrl: deps?.maskRpcUrl,
      readResourceGateOnChain: deps?.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      toChainId: deps?.toChainId,
      rpcRequest: deps?.rpcRequest,
      getFaucetSbtGateInterface: deps?.getFaucetSbtGateInterface,
      callContractFunction: deps?.callContractFunction,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      resourceGateKeys: constants?.resourceGateKeys,
      zeroBytes32: constants?.zeroBytes32,
    },
  });

  return {
    checkRateLimit,
    findSessionGateForSbt: faucetGateAuthority.findSessionGateForSbt,
    readSbtFaucetValidationState: faucetGateAuthority.readSbtFaucetValidationState,
    validateSbtPasswordForFaucet: faucetGateAuthority.validateSbtPasswordForFaucet,
  };
};
