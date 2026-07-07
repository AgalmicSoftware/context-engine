/** naming-migration alias, remove per PRD 653/654. */
/**
 * @module contractScripts
 * @description Legacy on-disk import-path compatibility shim for app/Jest
 *              callers that still reference `contractScripts.js` directly.
 *              The typed barrel implementation now lives in `chainGateway.ts`.
 *
 * Note: this source-tree shim still expects the same transpilation/module
 *       resolver pipeline as the rest of the client source. Plain Node
 *       `require()` of raw client source is not supported here.
 */

module.exports = require('./chainGateway.ts');
