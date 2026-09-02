/**
 * CommonJS compatibility adapter for Node-based E2E scripts.
 * The canonical TestID map lives in e2eTestIds.json.
 */
const E2E_TESTIDS = Object.freeze(require('./e2eTestIds.json'));

module.exports = { E2E_TESTIDS };
