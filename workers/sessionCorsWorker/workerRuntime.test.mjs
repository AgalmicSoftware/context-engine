import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_OPENAI_TRANSCRIBE_URL,
  OPENAI_TRANSCRIBE_URL_ENV,
} from './endpointConfig.js';
import { createWorkerRuntime } from './worker.js';

test('createWorkerRuntime returns a frozen runtime contract from the runtime-input binding', () => {
  const runtime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };

  const result = createWorkerRuntime(undefined, {
    createWorkerRuntimeInputWithWorkerDeps: () => runtime,
  });

  assert.equal(result, runtime);
  assert.equal(Object.isFrozen(result), true);
});

test('createWorkerRuntime preserves worker globals and static bundle wiring', () => {
  const runtime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };

  const result = createWorkerRuntime(undefined, {
    ethers: 'ethers',
    URL: 'URL',
    Headers: 'Headers',
    log: 'log',
    fetch: 'fetch',
    rpcFetch: 'rpcFetch',
    now: 'now',
    resolveWorkerRuntimeDeps: (value) => {
      assert.deepEqual(value, {
        deps: {
          ethers: 'ethers',
          URL: 'URL',
          Headers: 'Headers',
          log: 'log',
          fetch: 'fetch',
          rpcFetch: 'rpcFetch',
          now: 'now',
        },
        constants: {
          OPENAI_TRANSCRIBE_URL: DEFAULT_OPENAI_TRANSCRIBE_URL,
          SESSION_REGISTRY_ABI: [
            'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
            'function sessionExists(string) view returns (bool)',
            'function getSessionBySlug(string) view returns (string,uint256,string,string,address,uint256,uint256,bytes16)',
          ],
          ERC721_ABI: ['function balanceOf(address owner) view returns (uint256)'],
          SBT_ADMIN_ABI: ['function admin() view returns (address)', 'function owner() view returns (address)'],
          HATS_ABI: ['function isWearerOfHat(address wearer, uint256 hatId) view returns (bool)'],
          FAUCET_SBT_GATE_ABI: [
            'function hasPasswordMint() view returns (bool)',
            'function isPasswordValid(bytes32 hashedPassword) view returns (bool)',
            'function groupPasswordHash() view returns (bytes32)',
          ],
          TOKEN_TTL_SECONDS: 14400,
          NONCE_TTL_SECONDS: 300,
          NONCE_RATE_LIMIT_MAX: 5,
          NONCE_RATE_LIMIT_WINDOW_MS: 60000,
          NONCE_RATE_LIMIT_TTL_SECONDS: 60,
          USED_NONCE_TTL_SECONDS: 600,
          LOGIN_SIWE_MAX_AGE_MS: 300000,
          LOGIN_SIWE_FUTURE_SKEW_MS: 60000,
          ZERO_BYTES32: `0x${'0'.repeat(64)}`,
          RESOURCE_GATE_KEYS: ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'],
          ANONYMOUS_RATE_ID_HEADER: 'X-Anonymous-Client-Id',
          ANONYMOUS_GATE_UNAVAILABLE_ERROR: 'Access denied: on-chain gate data unavailable.',
          ANONYMOUS_ROUTE_DENIED_ERROR:
            'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
          ANONYMOUS_SCOPE_DISABLED_ERROR: 'Anonymous access denied: route scope disabled in session config.',
          SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
          BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR:
            'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
        },
      });
      return {
        deps: { id: 'resolved-deps' },
        constants: { id: 'resolved-constants' },
      };
    },
    createWorkerRuntimeInputWithWorkerDeps: (value) => {
      assert.deepEqual(value, {
        deps: { id: 'resolved-deps' },
        constants: { id: 'resolved-constants' },
        defaults: {
          DEFAULT_FAUCET_RPC_URL: 'https://op-sepolia-testnet.api.pocket.network',
          DEFAULT_FAUCET_AMOUNT_ETH: '0.0002',
          DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH: '0.001',
        },
      });
      return runtime;
    },
  });

  assert.equal(result, runtime);
});

test('createWorkerRuntime honors env transcription endpoint overrides', () => {
  const runtime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };
  let constants = null;

  const result = createWorkerRuntime(
    {
      [OPENAI_TRANSCRIBE_URL_ENV]: 'https://transcribe.example.test/v1/audio/transcriptions',
    },
    {
      resolveWorkerRuntimeDeps: (value) => value,
      createWorkerRuntimeInputWithWorkerDeps: (value) => {
        constants = value.constants;
        return runtime;
      },
    },
  );

  assert.equal(result, runtime);
  assert.equal(
    constants.OPENAI_TRANSCRIBE_URL,
    'https://transcribe.example.test/v1/audio/transcriptions'
  );
});
