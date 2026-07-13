'use strict';

const ROOT_NODE_TEST_FILES = Object.freeze([
  'tests/root/arweave-metadata-uri.test.js',
  'tests/root/client.package.test.js',
  'tests/root/deployHelperOrigins.test.mjs',
  'tests/root/e2eTestIds.compat.test.js',
  'tests/root/rpcDefaults.compat.test.js',
  'tests/root/sessionCorsWorker.faucet-proof.test.mjs',
  'tests/root/sessionCorsWorker.package.test.js',
  'workers/shared/deployHelperEndpointConfig.test.mjs',
]);

// These tests belong to private E2E surfaces that are stripped from public
// release copies. The normal checkout runs them when present without making
// their absence a public test-inventory failure.
const ROOT_OPTIONAL_NODE_TEST_FILES = Object.freeze([
  'scripts/e2e/cloudflare/session-worker-ui.test.js',
  'scripts/e2e/cloudflare/worker-login-result.test.js',
]);

const ROOT_JEST_TEST_FILES = Object.freeze([
  'tests/root/deployHelper.worker.test.js',
  'tests/root/sessionCorsWorker.admin.test.js',
  'tests/root/sessionCorsWorker.arweave.test.js',
  'tests/root/sessionCorsWorker.auth.test.js',
  'tests/root/sessionCorsWorker.authenticatedActions.test.js',
  'tests/root/sessionCorsWorker.authenticatedRoutes.test.js',
  'tests/root/sessionCorsWorker.gates.test.js',
  'tests/root/sessionCorsWorker.health.test.js',
]);

const ROOT_LOCAL_CHAIN_TEST_FILES = Object.freeze([
  'tests/root/contractScripts.surveys-sbt.test.js',
]);

const ROOT_PRIVATE_STRIPPED_TEST_FILE_RE = /^tests\/root\/[^/]+\.private\.test\.(?:c?js|mjs)$/;

const ROOT_TEST_FILES = Object.freeze([
  ...ROOT_NODE_TEST_FILES,
  ...ROOT_JEST_TEST_FILES,
  ...ROOT_LOCAL_CHAIN_TEST_FILES,
]);

module.exports = {
  ROOT_JEST_TEST_FILES,
  ROOT_LOCAL_CHAIN_TEST_FILES,
  ROOT_NODE_TEST_FILES,
  ROOT_OPTIONAL_NODE_TEST_FILES,
  ROOT_PRIVATE_STRIPPED_TEST_FILE_RE,
  ROOT_TEST_FILES,
};
