/**
 * @module contractScripts
 * @description Legacy on-disk import-path compatibility shim for app/Jest
 *              callers that still reference `contractScripts.js` directly.
 *              The typed barrel implementation now lives in `contractScripts.ts`.
 *
 * Note: this source-tree shim still expects the same transpilation/module
 *       resolver pipeline as the rest of the client source. Plain Node
 *       `require()` of raw client source is not supported here.
 */

/** @typedef {typeof import('./contractScripts.impl')} ContractScriptsImplModule */
/** @typedef {ContractScriptsImplModule['default']} ContractScriptsDefaultExport */

const _impl = require('./contractScripts.impl.js');
Object.defineProperty(exports, '__esModule', { value: true });

// Re-export as plain configurable properties (required for jest.spyOn compatibility)
/** @type {ContractScriptsDefaultExport} */
exports.default = _impl.default;
/** @type {ContractScriptsImplModule['normalizeSessionSlug']} */
exports.normalizeSessionSlug = _impl.normalizeSessionSlug;
/** @type {ContractScriptsImplModule['getDefaultSessionConfig']} */
exports.getDefaultSessionConfig = _impl.getDefaultSessionConfig;
/** @type {ContractScriptsImplModule['getSessionConfigBySlug']} */
exports.getSessionConfigBySlug = _impl.getSessionConfigBySlug;
/** @type {ContractScriptsImplModule['getDemoSessionConfigBySlug']} */
exports.getDemoSessionConfigBySlug = _impl.getDemoSessionConfigBySlug;
/** @type {ContractScriptsImplModule['getSessionConfigBySlugOrDefault']} */
exports.getSessionConfigBySlugOrDefault = _impl.getSessionConfigBySlugOrDefault;
/** @type {ContractScriptsImplModule['getAllSessionEntries']} */
exports.getAllSessionEntries = _impl.getAllSessionEntries;
/** @type {ContractScriptsImplModule['getAllSessionSlugs']} */
exports.getAllSessionSlugs = _impl.getAllSessionSlugs;
/** @type {ContractScriptsImplModule['getSessionConfigByName']} */
exports.getSessionConfigByName = _impl.getSessionConfigByName;
/** @type {ContractScriptsImplModule['getSessionSlugByName']} */
exports.getSessionSlugByName = _impl.getSessionSlugByName;
/** @type {ContractScriptsImplModule['getSessionLists']} */
exports.getSessionLists = _impl.getSessionLists;
/** @type {ContractScriptsImplModule['getSessionChainId']} */
exports.getSessionChainId = _impl.getSessionChainId;
/** @type {ContractScriptsImplModule['getSessionNetwork']} */
exports.getSessionNetwork = _impl.getSessionNetwork;
/** @type {ContractScriptsImplModule['getChainLabelById']} */
exports.getChainLabelById = _impl.getChainLabelById;
/** @type {ContractScriptsImplModule['getReadProviderForGroup']} */
exports.getReadProviderForGroup = _impl.getReadProviderForGroup;
/** @type {ContractScriptsImplModule['getReadProviderForSession']} */
exports.getReadProviderForSession = _impl.getReadProviderForSession;
/** @type {ContractScriptsDefaultExport['getProviderLocation']} */
exports.getProviderLocation = _impl.default?.getProviderLocation;
/** @type {ContractScriptsDefaultExport['getNativeBalance']} */
exports.getNativeBalance = _impl.default?.getNativeBalance;
/** @type {ContractScriptsDefaultExport['getETHBalance']} */
exports.getETHBalance = _impl.default?.getETHBalance || _impl.default?.getNativeBalance;
exports.__test__contractScriptsArweaveCache = _impl.__test__contractScriptsArweaveCache;
exports.__test__contractScriptsArweaveUploads = _impl.__test__contractScriptsArweaveUploads;
exports.__test__contractScriptsSessionNameFields = _impl.__test__contractScriptsSessionNameFields;
exports.__test__contractScriptsSbtMemo = _impl.__test__contractScriptsSbtMemo;
exports.__test__contractScriptsSbtProgress = _impl.__test__contractScriptsSbtProgress;
exports.__test__contractScriptsSbtHistory = _impl.__test__contractScriptsSbtHistory;
exports.__test__contractScriptsErrors = _impl.__test__contractScriptsErrors;
