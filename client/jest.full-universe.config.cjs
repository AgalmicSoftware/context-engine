const baseConfig = require('./jest.config.cjs');
const { JEST_COLLECT_COVERAGE_FROM } = require('../scripts/client-coverage-universe');

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [...JEST_COLLECT_COVERAGE_FROM],
  // Used only with --shard: scripts/run-client-coverage.mjs runs the suite as shards of equal run time.
  testSequencer: '<rootDir>/scripts/jest/timeBalancedSequencer.cjs',
  // scripts/check-client-coverage-floors.mjs enforces the whole-production
  // floor from this run's coverage-final.json.
};
