const baseConfig = require('./jest.config.cjs');
const { JEST_COLLECT_COVERAGE_FROM } = require('../scripts/clientCoverageUniverse');

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [...JEST_COLLECT_COVERAGE_FROM],
  // The fixed legacy and new whole-production floors are both enforced from
  // this run's coverage-final.json by the repository-level dual checker.
  coverageThreshold: undefined,
};
