/**
 * @module contractScripts
 * @description Compatibility barrel for the legacy contractScripts entry point.
 *              Uses CJS property assignment so jest.spyOn() can patch named exports.
 *
 * Key exports: default, getSessionConfigBySlug, getReadProviderForGroup, getSBTsForUser, getUserActivity
 */

type AnyRecord = Record<string, any>;
type ContractScriptsImplModule = typeof import('./contractScripts.impl.js');
type ContractScriptsDefaultExport = ContractScriptsImplModule['default'];

const _impl = require('./contractScripts.impl.js') as ContractScriptsImplModule;
const defaultExport = _impl.default as ContractScriptsDefaultExport;
const barrelExports = exports as AnyRecord;

Object.defineProperty(exports, '__esModule', { value: true });

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
export const getETHBalance = (defaultExport as AnyRecord)?.getETHBalance || defaultExport?.getNativeBalance;
export const __test__contractScriptsArweaveCache = _impl.__test__contractScriptsArweaveCache;
export const __test__contractScriptsArweaveUploads = _impl.__test__contractScriptsArweaveUploads;
export const __test__contractScriptsSessionNameFields = _impl.__test__contractScriptsSessionNameFields;
export const __test__contractScriptsSbtMemo = _impl.__test__contractScriptsSbtMemo;
export const __test__contractScriptsSbtProgress = _impl.__test__contractScriptsSbtProgress;
export const __test__contractScriptsSbtHistory = _impl.__test__contractScriptsSbtHistory;
export const __test__contractScriptsErrors = _impl.__test__contractScriptsErrors;

barrelExports.default = defaultExport;
barrelExports.normalizeSessionSlug = normalizeSessionSlug;
barrelExports.getDefaultSessionConfig = getDefaultSessionConfig;
barrelExports.getSessionConfigBySlug = getSessionConfigBySlug;
barrelExports.getDemoSessionConfigBySlug = getDemoSessionConfigBySlug;
barrelExports.getSessionConfigBySlugOrDefault = getSessionConfigBySlugOrDefault;
barrelExports.getAllSessionEntries = getAllSessionEntries;
barrelExports.getAllSessionSlugs = getAllSessionSlugs;
barrelExports.getSessionConfigByName = getSessionConfigByName;
barrelExports.getSessionSlugByName = getSessionSlugByName;
barrelExports.getSessionLists = getSessionLists;
barrelExports.getSessionChainId = getSessionChainId;
barrelExports.getSessionNetwork = getSessionNetwork;
barrelExports.getChainLabelById = getChainLabelById;
barrelExports.getReadProviderForGroup = getReadProviderForGroup;
barrelExports.getReadProviderForSession = getReadProviderForSession;
barrelExports.getProviderLocation = getProviderLocation;
barrelExports.getNativeBalance = getNativeBalance;
barrelExports.getETHBalance = getETHBalance;
barrelExports.__test__contractScriptsArweaveCache = __test__contractScriptsArweaveCache;
barrelExports.__test__contractScriptsArweaveUploads = __test__contractScriptsArweaveUploads;
barrelExports.__test__contractScriptsSessionNameFields = __test__contractScriptsSessionNameFields;
barrelExports.__test__contractScriptsSbtMemo = __test__contractScriptsSbtMemo;
barrelExports.__test__contractScriptsSbtProgress = __test__contractScriptsSbtProgress;
barrelExports.__test__contractScriptsSbtHistory = __test__contractScriptsSbtHistory;
barrelExports.__test__contractScriptsErrors = __test__contractScriptsErrors;
