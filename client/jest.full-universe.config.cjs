const baseConfig = require('./jest.config.cjs');
const { JEST_COLLECT_COVERAGE_FROM } = require('../scripts/clientCoverageUniverse');

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [...JEST_COLLECT_COVERAGE_FROM],
  // scripts/check-client-coverage-floors.mjs enforces the whole-production
  // floor from this run's coverage-final.json.
};
