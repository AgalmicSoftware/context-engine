import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIVATE_SESSION_RPC_LABEL,
  buildSafeRpcFailure,
  createRpcDiagnosticMasker,
  sanitizeRpcFailureDetails,
} from './rpcDiagnosticSafety.js';

const SECRET_RPC = 'https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET';

test('createRpcDiagnosticMasker preserves private provenance instead of exposing credential hostnames', () => {
  const mask = createRpcDiagnosticMasker({
    privateRpcUrls: [SECRET_RPC],
    maskRpcUrl: (value) => new URL(value).origin,
  });

  assert.equal(mask(SECRET_RPC), PRIVATE_SESSION_RPC_LABEL);
  assert.equal(mask(new URL(SECRET_RPC).origin), PRIVATE_SESSION_RPC_LABEL);
  assert.equal(mask('https://public-rpc.example/path/key'), 'https://public-rpc.example');
  assert.equal(mask(PRIVATE_SESSION_RPC_LABEL), PRIVATE_SESSION_RPC_LABEL);
});

test('buildSafeRpcFailure retains only safe status/code diagnostics', () => {
  const error = new Error(`request to ${SECRET_RPC} failed`);
  error.rpcStatus = 502;
  error.rpcError = { code: -32000, message: `upstream echoed ${SECRET_RPC}` };

  const failure = buildSafeRpcFailure({
    rpcUrl: SECRET_RPC,
    error,
    errorLabel: 'RPC transaction submission failed.',
    isPrivate: true,
    maskRpcUrl: (value) => new URL(value).origin,
  });

  assert.deepEqual(failure, {
    rpcUrl: PRIVATE_SESSION_RPC_LABEL,
    status: 502,
    code: -32000,
    error: 'RPC transaction submission failed.',
  });
  assert.equal(JSON.stringify(failure).includes('SECRET'), false);
  assert.equal(Object.hasOwn(failure, 'rpcError'), false);
});

test('sanitizeRpcFailureDetails drops raw nested rpc errors and credential paths', () => {
  const details = sanitizeRpcFailureDetails([
    {
      rpcUrl: SECRET_RPC,
      status: 429,
      error: `rate limited by ${SECRET_RPC}`,
      rpcError: { code: -32005, data: { endpoint: SECRET_RPC } },
    },
  ], {
    privateRpcUrls: [SECRET_RPC],
    errorLabel: 'SBT validation RPC request failed.',
    maskRpcUrl: (value) => new URL(value).origin,
  });

  assert.deepEqual(details, [{
    rpcUrl: PRIVATE_SESSION_RPC_LABEL,
    status: 429,
    code: -32005,
    error: 'SBT validation RPC request failed.',
  }]);
  assert.equal(JSON.stringify(details).includes('SECRET'), false);
  assert.equal(JSON.stringify(details).includes('rpcError'), false);
});

test('buildSafeRpcFailure rejects arbitrary upstream string error codes', () => {
  const failure = buildSafeRpcFailure({
    rpcUrl: SECRET_RPC,
    error: {
      rpcStatus: 502,
      rpcError: { code: 'TENANT_SECRET', message: 'provider-specific failure' },
    },
    privateRpcUrls: [SECRET_RPC],
  });

  assert.deepEqual(failure, {
    rpcUrl: PRIVATE_SESSION_RPC_LABEL,
    status: 502,
    error: 'RPC request failed.',
  });
  assert.equal(JSON.stringify(failure).includes('TENANT_SECRET'), false);
});
