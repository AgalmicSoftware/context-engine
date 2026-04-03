/**
 * @module contractScripts
 * @description Compatibility barrel for the legacy contractScripts entry point.
 *              Uses CJS property assignment so jest.spyOn() can patch named exports.
 *
 * Key exports: default, getSessionConfigBySlug, getReadProviderForGroup, getSBTsForUser, getUserActivity
 */

const _impl = require('./contractScripts.impl.js');
Object.defineProperty(exports, '__esModule', { value: true });

// Re-export as plain configurable properties (required for jest.spyOn compatibility)
exports.default = _impl.default;
exports.normalizeSessionSlug = _impl.normalizeSessionSlug;
exports.getDefaultSessionConfig = _impl.getDefaultSessionConfig;
exports.getSessionConfigBySlug = _impl.getSessionConfigBySlug;
exports.getDemoSessionConfigBySlug = _impl.getDemoSessionConfigBySlug;
exports.getSessionConfigBySlugOrDefault = _impl.getSessionConfigBySlugOrDefault;
exports.getAllSessionEntries = _impl.getAllSessionEntries;
exports.getAllSessionSlugs = _impl.getAllSessionSlugs;
exports.getSessionConfigByName = _impl.getSessionConfigByName;
exports.getSessionSlugByName = _impl.getSessionSlugByName;
exports.getSessionLists = _impl.getSessionLists;
exports.getSessionChainId = _impl.getSessionChainId;
exports.getSessionNetwork = _impl.getSessionNetwork;
exports.getChainLabelById = _impl.getChainLabelById;
exports.getReadProviderForGroup = _impl.getReadProviderForGroup;
exports.getReadProviderForSession = _impl.getReadProviderForSession;
exports.getProviderLocation = _impl.default?.getProviderLocation;
exports.getNativeBalance = _impl.default?.getNativeBalance;
exports.getETHBalance = _impl.default?.getETHBalance || _impl.default?.getNativeBalance;
exports.__test__contractScriptsArweaveCache = _impl.__test__contractScriptsArweaveCache;
exports.__test__contractScriptsArweaveUploads = _impl.__test__contractScriptsArweaveUploads;
exports.__test__contractScriptsSessionNameFields = _impl.__test__contractScriptsSessionNameFields;
exports.__test__contractScriptsSbtMemo = _impl.__test__contractScriptsSbtMemo;
exports.__test__contractScriptsSbtProgress = _impl.__test__contractScriptsSbtProgress;
exports.__test__contractScriptsSbtHistory = _impl.__test__contractScriptsSbtHistory;
exports.__test__contractScriptsErrors = _impl.__test__contractScriptsErrors;
