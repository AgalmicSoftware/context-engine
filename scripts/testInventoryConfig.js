'use strict';

const ROOT_NODE_TEST_FILES = Object.freeze([
  'test/arweave-metadata-uri.test.js',
  'test/client.package.test.js',
  'test/deployHelperOrigins.test.mjs',
  'test/e2eTestIds.compat.test.js',
  'test/rpcDefaults.compat.test.js',
  'test/sessionCorsWorker.faucet-proof.test.mjs',
  'test/sessionCorsWorker.package.test.js',
]);

const ROOT_JEST_TEST_FILES = Object.freeze([
  'test/deployHelper.worker.test.js',
  'test/sessionCorsWorker.admin.test.js',
  'test/sessionCorsWorker.arweave.test.js',
  'test/sessionCorsWorker.auth.test.js',
  'test/sessionCorsWorker.authenticatedActions.test.js',
  'test/sessionCorsWorker.authenticatedRoutes.test.js',
  'test/sessionCorsWorker.gates.test.js',
  'test/sessionCorsWorker.health.test.js',
]);

const ROOT_LOCAL_CHAIN_TEST_FILES = Object.freeze([
  'test/contractScripts.surveys-sbt.test.js',
]);

const ROOT_PRIVATE_STRIPPED_TEST_FILE_RE = /^test\/[^/]+\.private\.test\.(?:c?js|mjs)$/;

const ROOT_TEST_FILES = Object.freeze([
  ...ROOT_NODE_TEST_FILES,
  ...ROOT_JEST_TEST_FILES,
  ...ROOT_LOCAL_CHAIN_TEST_FILES,
]);

module.exports = {
  ROOT_JEST_TEST_FILES,
  ROOT_LOCAL_CHAIN_TEST_FILES,
  ROOT_NODE_TEST_FILES,
  ROOT_PRIVATE_STRIPPED_TEST_FILE_RE,
  ROOT_TEST_FILES,
};
