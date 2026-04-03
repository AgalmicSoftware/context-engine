import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRuntimeDepsWithWorkerDeps } from './workerRuntimeDepsBinding.js';

test('createWorkerRuntimeDepsWithWorkerDeps returns the runtime contract from the runtime-input binding', () => {
  const runtime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };

  const result = createWorkerRuntimeDepsWithWorkerDeps({
    deps: {
      createWorkerRuntimeInputWithWorkerDeps: () => runtime,
    },
  });

  assert.equal(result, runtime);
});

test('createWorkerRuntimeDepsWithWorkerDeps preserves worker-local and imported dependency wiring', () => {
  const runtime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };
  const rawDeps = {
    ethers: 'ethers',
    log: 'log',
  };
  const rawConstants = {
    OPENAI_TRANSCRIBE_URL: 'openAiTranscribeUrl',
  };
  const defaults = {
    DEFAULT_FAUCET_RPC_URL: 'defaultFaucetRpcUrl',
    DEFAULT_FAUCET_AMOUNT_ETH: 'defaultAmountEth',
    DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH: 'defaultThresholdEth',
  };
  const resolved = {
    deps: { id: 'resolved-deps' },
    constants: { id: 'resolved-constants' },
  };

  const result = createWorkerRuntimeDepsWithWorkerDeps({
    deps: {
      ...rawDeps,
      resolveWorkerRuntimeDeps: (value) => {
        assert.deepEqual(value, {
          deps: {
            ethers: 'ethers',
            log: 'log',
            resolveWorkerRuntimeDeps: value.deps.resolveWorkerRuntimeDeps,
            createWorkerRuntimeInputWithWorkerDeps: value.deps.createWorkerRuntimeInputWithWorkerDeps,
          },
          constants: rawConstants,
        });
        return resolved;
      },
      createWorkerRuntimeInputWithWorkerDeps: (value) => {
        assert.deepEqual(value, {
          deps: resolved.deps,
          constants: resolved.constants,
          defaults,
        });
        return runtime;
      },
    },
    constants: rawConstants,
    defaults,
  });

  assert.equal(result, runtime);
});
