/**
 * @module chainGateway
 * @description Canonical barrel for the chain gateway entry point.
 *              Uses CJS property assignment so jest.spyOn() can patch named exports.
 *
 * Key exports: default, getSessionConfigBySlug, getReadProviderForGroup, getSBTsForUser, getUserActivity
 */

import * as contractScriptsImpl from './contractScripts.impl.js';

type CommonJsExportRecord = Record<string, unknown>;
type ContractScriptsImplModule = typeof import('./contractScripts.impl.js');
type ContractScriptsDefaultExport = ContractScriptsImplModule['default'];

const _impl = contractScriptsImpl as ContractScriptsImplModule;
const defaultExport = _impl.default as ContractScriptsDefaultExport;
const commonJsExports = typeof exports === 'undefined' ? null : (exports as CommonJsExportRecord);

if (commonJsExports) {
  Object.defineProperty(commonJsExports, '__esModule', { value: true });
}

// Re-export as plain configurable properties (required for jest.spyOn compatibility)
export default defaultExport;
export const normalizeSessionSlug = _impl.normalizeSessionSlug;
export const getDefaultSessionConfig = _impl.getDefaultSessionConfig;
export const getSessionConfigBySlug = _impl.getSessionConfigBySlug;
export const getDemoSessionConfigBySlug = _impl.getDemoSessionConfigBySlug;
export const getSessionConfigBySlugOrDefault = _impl.getSessionConfigBySlugOrDefault;
export const getAllSessionEntries = _impl.getAllSessionEntries;
export const getAllSessionSlugs = _impl.getAllSessionSlugs;
export const getSessionConfigByName = _impl.getSessionConfigByName;
export const getSessionSlugByName = _impl.getSessionSlugByName;
export const getSessionLists = _impl.getSessionLists;
export const getSessionChainId = _impl.getSessionChainId;
export const getSessionNetwork = _impl.getSessionNetwork;
export const getChainLabelById = _impl.getChainLabelById;
export const getReadProviderForGroup = _impl.getReadProviderForGroup;
export const getReadProviderForSession = _impl.getReadProviderForSession;
export const getProviderLocation = defaultExport?.getProviderLocation;
export const getNativeBalance = defaultExport?.getNativeBalance;
export const __test__contractScriptsArweaveCache = _impl.__test__contractScriptsArweaveCache;
export const __test__contractScriptsArweaveUploads = _impl.__test__contractScriptsArweaveUploads;
export const __test__contractScriptsSessionNameFields = _impl.__test__contractScriptsSessionNameFields;
export const __test__contractScriptsSbtMemo = _impl.__test__contractScriptsSbtMemo;
export const __test__contractScriptsSbtProgress = _impl.__test__contractScriptsSbtProgress;
export const __test__contractScriptsSbtHistory = _impl.__test__contractScriptsSbtHistory;
export const __test__contractScriptsErrors = _impl.__test__contractScriptsErrors;
export const __test__contractScriptsReadCaches = _impl.__test__contractScriptsReadCaches;

if (commonJsExports) {
  commonJsExports.default = defaultExport;
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
  commonJsExports.__test__contractScriptsArweaveCache = __test__contractScriptsArweaveCache;
  commonJsExports.__test__contractScriptsArweaveUploads = __test__contractScriptsArweaveUploads;
  commonJsExports.__test__contractScriptsSessionNameFields = __test__contractScriptsSessionNameFields;
  commonJsExports.__test__contractScriptsSbtMemo = __test__contractScriptsSbtMemo;
  commonJsExports.__test__contractScriptsSbtProgress = __test__contractScriptsSbtProgress;
  commonJsExports.__test__contractScriptsSbtHistory = __test__contractScriptsSbtHistory;
  commonJsExports.__test__contractScriptsErrors = __test__contractScriptsErrors;
  commonJsExports.__test__contractScriptsReadCaches = __test__contractScriptsReadCaches;
}
