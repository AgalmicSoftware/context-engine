'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENV_EXAMPLE_PATH = path.join(__dirname, '..', '.env.e2e.example');

test('.env.e2e.example defaults to deterministic AI mock mode', () => {
  const source = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');

  assert.match(source, /^E2E_AI_MOCK=1$/m);
  assert.doesNotMatch(source, /^E2E_AI_MOCK=0$/m);
});

test('.env.e2e.example marks the old .e2e-secrets convention as unsupported', () => {
  const source = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');

  assert.match(source, /Unsupported previous local file convention: `\.e2e-secrets\/arweave-jwk\.json`/);
  assert.match(source, /Unsupported previous local file convention: `\.e2e-secrets\/cloudflare-api-token\.txt`/);
  assert.match(source, /Unsupported previous local file convention: `\.e2e-secrets\/faucet-private-key\.txt`/);
});

test('.env.e2e.example includes the Lit Chipotle smoke-test vars', () => {
  const source = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');

  assert.match(source, /^LIT_API_BASE=https:\/\/api\.chipotle\.litprotocol\.com$/m);
  assert.match(source, /^LIT_USAGE_API_KEY=$/m);
  assert.match(source, /^LIT_GROUP_ID=$/m);
  assert.match(source, /^LIT_PKP_ID=$/m);
  assert.match(source, /^LIT_ACTION_CID=$/m);
  assert.match(source, /^LIT_E2E_EXECUTE_MODE=inline$/m);
  assert.match(source, /^LIT_E2E_RUNTIME_ADDRESS=$/m);
  assert.match(source, /^LIT_E2E_SBT_ADDRESSES=$/m);
  assert.match(source, /^LIT_E2E_GATE_CHAIN_ID=$/m);
  assert.match(source, /^LIT_E2E_GATE_MODE=any$/m);
  assert.match(source, /^LIT_E2E_AUTO_PROVISION=1$/m);
  assert.match(source, /^LIT_E2E_PERSIST_ARTIFACTS=$/m);
  assert.match(source, /^LIT_E2E_ARTIFACT_JSON=$/m);
});
