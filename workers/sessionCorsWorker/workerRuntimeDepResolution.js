import {
  normalizeAiRequestPayload as normalizeAiRequestPayloadBoundary,
  readAiRequestPayload as readAiRequestPayloadBoundary,
  validateAnonymousAiRequest as validateAnonymousAiRequestBoundary,
} from './aiRequestNormalization.js';
import {
  evaluateAuthenticatedRoutePreflight as evaluateAuthenticatedRoutePreflightBoundary,
} from './authenticatedRoutePreflight.js';
import {
  resolveAuthenticatedRouteSecrets as resolveAuthenticatedRouteSecretsBoundary,
} from './authenticatedRouteSecretsResolution.js';
import {
  dispatchAuthenticatedSecretPathRoute as dispatchAuthenticatedSecretPathRouteBoundary,
} from './authenticatedSecretPathRouteDispatch.js';
import {
  dispatchAuthenticatedSecretActionRoute as dispatchAuthenticatedSecretActionRouteBoundary,
} from './authenticatedSecretActionRouteDispatch.js';
import {
  dispatchAuthenticatedNonSecretActionRoute as dispatchAuthenticatedNonSecretActionRouteBoundary,
} from './authenticatedNonSecretActionRouteDispatch.js';
import {
  dispatchAuthenticatedRoute as dispatchAuthenticatedRouteBoundary,
} from './authenticatedRouteDispatch.js';
import {
  dispatchAnonymousRoute as dispatchAnonymousRouteBoundary,
} from './anonymousRouteDispatch.js';
import {
  readAuthenticatedActionPayload as readAuthenticatedActionPayloadBoundary,
} from './authenticatedActionRequestNormalization.js';
import {
  readTranscribeRequestPayload as readTranscribeRequestPayloadBoundary,
} from './transcribeRequestNormalization.js';
import {
  MISSING_SLUG_ERROR as MISSING_SLUG_ERROR_BOUNDARY,
  normalizeWorkerSessionSlug as normalizeWorkerSessionSlugBoundary,
  resolveWorkerBodySlugContext as resolveWorkerBodySlugContextBoundary,
  resolveWorkerRequestSlugContext as resolveWorkerRequestSlugContextBoundary,
  SLUG_ALIAS_MISMATCH_ERROR as SLUG_ALIAS_MISMATCH_ERROR_BOUNDARY,
  SLUG_MISMATCH_ERROR as SLUG_MISMATCH_ERROR_BOUNDARY,
} from './sessionSlugResolution.js';
import {
  mergeWorkerConfigRecords as mergeWorkerConfigRecordsBoundary,
  mergeWorkerLimitRecords as mergeWorkerLimitRecordsBoundary,
} from './sessionConfigNormalization.js';
import {
  normalizeSecretValue as normalizeSecretValueBoundary,
} from './secretValueNormalization.js';
import {
  parseSiweMessage as parseSiweMessageBoundary,
  resolveTrustedAdminOrigins as resolveTrustedAdminOriginsBoundary,
  validateBrowserLoginOrigin as validateBrowserLoginOriginBoundary,
  validateSiwe as validateSiweBoundary,
  validateTrustedLoginRequestOrigin as validateTrustedLoginRequestOriginBoundary,
} from './siweMessageValidation.js';
import {
  buildNonce as buildNonceBoundary,
  checkNonceRateLimit as checkNonceRateLimitBoundary,
  consumeNonce as consumeNonceBoundary,
} from './nonceLifecycle.js';
import {
  readAbuseCounterSummary as readAbuseCounterSummaryBoundary,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';
import {
  corsHeaders as corsHeadersBoundary,
  originAllowed as originAllowedBoundary,
  parseAllowOrigins as parseAllowOriginsBoundary,
} from './corsPrimitives.js';
import {
  json as jsonBoundary,
} from './responseKvHelpers.js';
import {
  getSessionConfig as getSessionConfigBoundary,
  getSessionSecrets as getSessionSecretsBoundary,
  putSessionConfig as putSessionConfigBoundary,
  putSessionSecrets as putSessionSecretsBoundary,
} from './sessionConfigSecretsStore.js';
import {
  base64UrlEncode as base64UrlEncodeBoundary,
  signToken as signTokenBoundary,
  verifyToken as verifyTokenBoundary,
} from './tokenSigning.js';
import {
  buildAuthTokenJti as buildAuthTokenJtiBoundary,
  persistAuthTokenRecord as persistAuthTokenRecordBoundary,
  validateAuthTokenRecord as validateAuthTokenRecordBoundary,
} from './authTokenClaims.js';
import {
  normalizeSignedWorkerRequest as normalizeSignedWorkerRequestBoundary,
  validateRecoveredAddressMatchesRequest as validateRecoveredAddressMatchesRequestBoundary,
  validateSiweAddressMatchesRequest as validateSiweAddressMatchesRequestBoundary,
} from './signedRequestNormalization.js';
import {
  readArweaveBootstrapUploadPayload as readArweaveBootstrapUploadPayloadBoundary,
} from './arweaveBootstrapNormalization.js';
import {
  mergeRpcUrlLists as mergeRpcUrlListsBoundary,
  normalizeRpcUrlList as normalizeRpcUrlListBoundary,
} from './rpcUrlListNormalization.js';
import { toChainId as toChainIdBoundary } from './chainIdNormalization.js';
import { toStr as toStrBoundary } from './stringCoercion.js';

export const resolveWorkerRuntimeDeps = ({
  deps,
  constants,
} = {}) => {
  const resolveDep = (key, fallback) => deps?.[key] || fallback;

  return {
    deps: {
      ethers: deps?.ethers,
      URL: deps?.URL,
      Headers: deps?.Headers,
      log: deps?.log,
      fetch: deps?.fetch,
      rpcFetch: deps?.rpcFetch,
      now: deps?.now,
      toStr: resolveDep('toStr', toStrBoundary),
      normalizeWorkerSessionSlug: resolveDep('normalizeWorkerSessionSlug', normalizeWorkerSessionSlugBoundary),
      normalizeRpcUrlList: resolveDep('normalizeRpcUrlList', normalizeRpcUrlListBoundary),
      mergeRpcUrlLists: resolveDep('mergeRpcUrlLists', mergeRpcUrlListsBoundary),
      toChainId: resolveDep('toChainId', toChainIdBoundary),
      parseAllowOrigins: resolveDep('parseAllowOrigins', parseAllowOriginsBoundary),
      originAllowed: resolveDep('originAllowed', originAllowedBoundary),
      corsHeaders: resolveDep('corsHeaders', corsHeadersBoundary),
      json: resolveDep('json', jsonBoundary),
      getSessionConfig: resolveDep('getSessionConfig', getSessionConfigBoundary),
      verifyToken: resolveDep('verifyToken', verifyTokenBoundary),
      validateAuthTokenRecord: resolveDep('validateAuthTokenRecord', validateAuthTokenRecordBoundary),
      resolveWorkerRequestSlugContext: resolveDep('resolveWorkerRequestSlugContext', resolveWorkerRequestSlugContextBoundary),
      readTranscribeRequestPayload: resolveDep('readTranscribeRequestPayload', readTranscribeRequestPayloadBoundary),
      normalizeSignedWorkerRequest: resolveDep('normalizeSignedWorkerRequest', normalizeSignedWorkerRequestBoundary),
      resolveWorkerBodySlugContext: resolveDep('resolveWorkerBodySlugContext', resolveWorkerBodySlugContextBoundary),
      validateRecoveredAddressMatchesRequest: resolveDep('validateRecoveredAddressMatchesRequest', validateRecoveredAddressMatchesRequestBoundary),
      parseSiweMessage: resolveDep('parseSiweMessage', parseSiweMessageBoundary),
      resolveTrustedAdminOrigins: resolveDep('resolveTrustedAdminOrigins', resolveTrustedAdminOriginsBoundary),
      validateSiwe: resolveDep('validateSiwe', validateSiweBoundary),
      validateTrustedLoginRequestOrigin: resolveDep('validateTrustedLoginRequestOrigin', validateTrustedLoginRequestOriginBoundary),
      validateBrowserLoginOrigin: resolveDep('validateBrowserLoginOrigin', validateBrowserLoginOriginBoundary),
      validateSiweAddressMatchesRequest: resolveDep('validateSiweAddressMatchesRequest', validateSiweAddressMatchesRequestBoundary),
      buildNonce: resolveDep('buildNonce', buildNonceBoundary),
      checkNonceRateLimit: resolveDep('checkNonceRateLimit', checkNonceRateLimitBoundary),
      consumeNonce: resolveDep('consumeNonce', consumeNonceBoundary),
      recordAbuseEvent: resolveDep('recordAbuseEvent', recordAbuseEventBoundary),
      readAbuseCounterSummary: resolveDep('readAbuseCounterSummary', readAbuseCounterSummaryBoundary),
      base64UrlEncode: resolveDep('base64UrlEncode', base64UrlEncodeBoundary),
      signToken: resolveDep('signToken', signTokenBoundary),
      buildAuthTokenJti: resolveDep('buildAuthTokenJti', buildAuthTokenJtiBoundary),
      persistAuthTokenRecord: resolveDep('persistAuthTokenRecord', persistAuthTokenRecordBoundary),
      readArweaveBootstrapUploadPayload: resolveDep('readArweaveBootstrapUploadPayload', readArweaveBootstrapUploadPayloadBoundary),
      getSessionSecrets: resolveDep('getSessionSecrets', getSessionSecretsBoundary),
      mergeWorkerConfigRecords: resolveDep('mergeWorkerConfigRecords', mergeWorkerConfigRecordsBoundary),
      mergeWorkerLimitRecords: resolveDep('mergeWorkerLimitRecords', mergeWorkerLimitRecordsBoundary),
      putSessionConfig: resolveDep('putSessionConfig', putSessionConfigBoundary),
      normalizeSecretValue: resolveDep('normalizeSecretValue', normalizeSecretValueBoundary),
      putSessionSecrets: resolveDep('putSessionSecrets', putSessionSecretsBoundary),
      dispatchAnonymousRoute: resolveDep('dispatchAnonymousRoute', dispatchAnonymousRouteBoundary),
      readAiRequestPayload: resolveDep('readAiRequestPayload', readAiRequestPayloadBoundary),
      validateAnonymousAiRequest: resolveDep('validateAnonymousAiRequest', validateAnonymousAiRequestBoundary),
      dispatchAuthenticatedRoute: resolveDep('dispatchAuthenticatedRoute', dispatchAuthenticatedRouteBoundary),
      dispatchAuthenticatedSecretPathRoute: resolveDep('dispatchAuthenticatedSecretPathRoute', dispatchAuthenticatedSecretPathRouteBoundary),
      readAuthenticatedActionPayload: resolveDep('readAuthenticatedActionPayload', readAuthenticatedActionPayloadBoundary),
      dispatchAuthenticatedNonSecretActionRoute: resolveDep('dispatchAuthenticatedNonSecretActionRoute', dispatchAuthenticatedNonSecretActionRouteBoundary),
      dispatchAuthenticatedSecretActionRoute: resolveDep('dispatchAuthenticatedSecretActionRoute', dispatchAuthenticatedSecretActionRouteBoundary),
      evaluateAuthenticatedRoutePreflight: resolveDep('evaluateAuthenticatedRoutePreflight', evaluateAuthenticatedRoutePreflightBoundary),
      resolveAuthenticatedRouteSecrets: resolveDep('resolveAuthenticatedRouteSecrets', resolveAuthenticatedRouteSecretsBoundary),
      normalizeAiRequestPayload: resolveDep('normalizeAiRequestPayload', normalizeAiRequestPayloadBoundary),
    },
    constants: {
      OPENAI_TRANSCRIBE_URL: constants?.OPENAI_TRANSCRIBE_URL,
      SESSION_REGISTRY_ABI: constants?.SESSION_REGISTRY_ABI,
      ERC721_ABI: constants?.ERC721_ABI,
      SBT_ADMIN_ABI: constants?.SBT_ADMIN_ABI,
      HATS_ABI: constants?.HATS_ABI,
      FAUCET_SBT_GATE_ABI: constants?.FAUCET_SBT_GATE_ABI,
      TOKEN_TTL_SECONDS: constants?.TOKEN_TTL_SECONDS,
      NONCE_TTL_SECONDS: constants?.NONCE_TTL_SECONDS,
      NONCE_RATE_LIMIT_MAX: constants?.NONCE_RATE_LIMIT_MAX,
      NONCE_RATE_LIMIT_WINDOW_MS: constants?.NONCE_RATE_LIMIT_WINDOW_MS,
      NONCE_RATE_LIMIT_TTL_SECONDS: constants?.NONCE_RATE_LIMIT_TTL_SECONDS,
      USED_NONCE_TTL_SECONDS: constants?.USED_NONCE_TTL_SECONDS,
      LOGIN_SIWE_MAX_AGE_MS: constants?.LOGIN_SIWE_MAX_AGE_MS,
      LOGIN_SIWE_FUTURE_SKEW_MS: constants?.LOGIN_SIWE_FUTURE_SKEW_MS,
      ZERO_BYTES32: constants?.ZERO_BYTES32,
      RESOURCE_GATE_KEYS: constants?.RESOURCE_GATE_KEYS,
      ANONYMOUS_RATE_ID_HEADER: constants?.ANONYMOUS_RATE_ID_HEADER,
      ANONYMOUS_GATE_UNAVAILABLE_ERROR: constants?.ANONYMOUS_GATE_UNAVAILABLE_ERROR,
      ANONYMOUS_ROUTE_DENIED_ERROR: constants?.ANONYMOUS_ROUTE_DENIED_ERROR,
      ANONYMOUS_SCOPE_DISABLED_ERROR: constants?.ANONYMOUS_SCOPE_DISABLED_ERROR,
      SESSION_CONFIG_NOT_FOUND_ERROR: constants?.SESSION_CONFIG_NOT_FOUND_ERROR,
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR: constants?.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
      MISSING_SLUG_ERROR: constants?.MISSING_SLUG_ERROR || MISSING_SLUG_ERROR_BOUNDARY,
      SLUG_ALIAS_MISMATCH_ERROR: constants?.SLUG_ALIAS_MISMATCH_ERROR || SLUG_ALIAS_MISMATCH_ERROR_BOUNDARY,
      SLUG_MISMATCH_ERROR: constants?.SLUG_MISMATCH_ERROR || SLUG_MISMATCH_ERROR_BOUNDARY,
    },
  };
};
