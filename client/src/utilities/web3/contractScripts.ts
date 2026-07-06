/** naming-migration alias, remove per PRD 653/654. */
import chainGateway, * as chainGatewayModule from './chainGateway.js';

type CommonJsExportRecord = Record<string, unknown>;

const commonJsExports = typeof exports === 'undefined'
  ? null
  : (exports as CommonJsExportRecord);

if (commonJsExports) {
  Object.defineProperty(commonJsExports, '__esModule', { value: true });
}

export default chainGateway;
export const normalizeSessionSlug = chainGatewayModule.normalizeSessionSlug;
export const getDefaultSessionConfig = chainGatewayModule.getDefaultSessionConfig;
export const getSessionConfigBySlug = chainGatewayModule.getSessionConfigBySlug;
export const getDemoSessionConfigBySlug = chainGatewayModule.getDemoSessionConfigBySlug;
export const getSessionConfigBySlugOrDefault = chainGatewayModule.getSessionConfigBySlugOrDefault;
export const getAllSessionEntries = chainGatewayModule.getAllSessionEntries;
export const getAllSessionSlugs = chainGatewayModule.getAllSessionSlugs;
export const getSessionConfigByName = chainGatewayModule.getSessionConfigByName;
export const getSessionSlugByName = chainGatewayModule.getSessionSlugByName;
export const getSessionLists = chainGatewayModule.getSessionLists;
export const getSessionChainId = chainGatewayModule.getSessionChainId;
export const getSessionNetwork = chainGatewayModule.getSessionNetwork;
export const getChainLabelById = chainGatewayModule.getChainLabelById;
export const getReadProviderForGroup = chainGatewayModule.getReadProviderForGroup;
export const getReadProviderForSession = chainGatewayModule.getReadProviderForSession;
export const getProviderLocation = chainGatewayModule.getProviderLocation;
export const getNativeBalance = chainGatewayModule.getNativeBalance;
export const getETHBalance = chainGatewayModule.getETHBalance;
export const __test__contractScriptsArweaveCache = chainGatewayModule.__test__contractScriptsArweaveCache;
export const __test__contractScriptsArweaveUploads = chainGatewayModule.__test__contractScriptsArweaveUploads;
export const __test__contractScriptsSessionNameFields = chainGatewayModule.__test__contractScriptsSessionNameFields;
export const __test__contractScriptsSbtMemo = chainGatewayModule.__test__contractScriptsSbtMemo;
export const __test__contractScriptsSbtProgress = chainGatewayModule.__test__contractScriptsSbtProgress;
export const __test__contractScriptsSbtHistory = chainGatewayModule.__test__contractScriptsSbtHistory;
export const __test__contractScriptsErrors = chainGatewayModule.__test__contractScriptsErrors;
export const __test__contractScriptsReadCaches = chainGatewayModule.__test__contractScriptsReadCaches;

if (commonJsExports) {
  commonJsExports.default = chainGateway;
  commonJsExports.normalizeSessionSlug = normalizeSessionSlug;
  commonJsExports.getDefaultSessionConfig = getDefaultSessionConfig;
  commonJsExports.getSessionConfigBySlug = getSessionConfigBySlug;
  commonJsExports.getDemoSessionConfigBySlug = getDemoSessionConfigBySlug;
  commonJsExports.getSessionConfigBySlugOrDefault = getSessionConfigBySlugOrDefault;
  commonJsExports.getAllSessionEntries = getAllSessionEntries;
  commonJsExports.getAllSessionSlugs = getAllSessionSlugs;
  commonJsExports.getSessionConfigByName = getSessionConfigByName;
  commonJsExports.getSessionSlugByName = getSessionSlugByName;
  commonJsExports.getSessionLists = getSessionLists;
  commonJsExports.getSessionChainId = getSessionChainId;
  commonJsExports.getSessionNetwork = getSessionNetwork;
  commonJsExports.getChainLabelById = getChainLabelById;
  commonJsExports.getReadProviderForGroup = getReadProviderForGroup;
  commonJsExports.getReadProviderForSession = getReadProviderForSession;
  commonJsExports.getProviderLocation = getProviderLocation;
  commonJsExports.getNativeBalance = getNativeBalance;
  commonJsExports.getETHBalance = getETHBalance;
  commonJsExports.__test__contractScriptsArweaveCache = __test__contractScriptsArweaveCache;
  commonJsExports.__test__contractScriptsArweaveUploads = __test__contractScriptsArweaveUploads;
  commonJsExports.__test__contractScriptsSessionNameFields = __test__contractScriptsSessionNameFields;
  commonJsExports.__test__contractScriptsSbtMemo = __test__contractScriptsSbtMemo;
  commonJsExports.__test__contractScriptsSbtProgress = __test__contractScriptsSbtProgress;
  commonJsExports.__test__contractScriptsSbtHistory = __test__contractScriptsSbtHistory;
  commonJsExports.__test__contractScriptsErrors = __test__contractScriptsErrors;
  commonJsExports.__test__contractScriptsReadCaches = __test__contractScriptsReadCaches;
}
