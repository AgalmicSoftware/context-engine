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
