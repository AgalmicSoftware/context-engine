import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const ethersModule = requireRoot('ethers');
const v5Ethers = ethersModule.ethers || ethersModule;

const PAYER_PRIVATE_KEY = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5';
const PAYER_ADDRESS = '0x3AC823CA9AcDA550244C6fF4927b5e1478E70Ff7';
const REQUESTER_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_PUBLIC_KEY = '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4';
const DEFAULT_LIT_RPC_URL = 'https://yellowstone-rpc.litprotocol.com/'; // intentional: real URL — tests default RPC enforcement

const loadLitPaymentDelegationModule = async (ethersOverride) => {
  const source = readFileSync(new URL('./litPaymentDelegation.js', import.meta.url), 'utf8');
  const patchedSource = source.replace(
    "import { ethers } from 'ethers';",
    'const { ethers } = globalThis.__LIT_PAYMENT_TEST_DEPS__;',
  );
  globalThis.__LIT_PAYMENT_TEST_DEPS__ = { ethers: ethersOverride };
  try {
    return await import(
      `data:text/javascript;base64,${Buffer.from(`${patchedSource}\n// ${Math.random()}`).toString('base64')}`
    );
  } finally {
    delete globalThis.__LIT_PAYMENT_TEST_DEPS__;
  }
};

const buildV5CompatEthers = ({ Contract, JsonRpcProvider }) => ({
  Wallet: v5Ethers.Wallet,
  Contract,
  BigNumber: v5Ethers.BigNumber,
  utils: v5Ethers.utils,
  providers: { JsonRpcProvider },
});

test('readLitPayerStatus supports a v5-shaped ethers runtime', async () => {
  class FakeContract {
    constructor(_address, _abi, provider) {
      this.provider = provider;
    }

    balance(address) {
      assert.equal(address, PAYER_ADDRESS);
      assert.equal(this.provider.connection?.url, DEFAULT_LIT_RPC_URL);
      return Promise.resolve(v5Ethers.BigNumber.from('1000000000000000000'));
    }

    stableBalance() {
      return Promise.resolve(v5Ethers.BigNumber.from('500000000000000000'));
    }

    getRestriction() {
      return Promise.resolve({
        totalMaxPrice: v5Ethers.BigNumber.from(7),
        requestsPerPeriod: v5Ethers.BigNumber.from(8),
        periodSeconds: v5Ethers.BigNumber.from(9),
      });
    }

    getUsers() {
      return Promise.resolve([REQUESTER_ADDRESS]);
    }
  }

  const { readLitPayerStatus } = await loadLitPaymentDelegationModule(
    buildV5CompatEthers({
      Contract: FakeContract,
      JsonRpcProvider: v5Ethers.providers.JsonRpcProvider,
    }),
  );

  const result = await readLitPayerStatus({
    litNetwork: 'naga-test',
    litPayerPrivateKey: PAYER_PRIVATE_KEY,
  });

  assert.deepEqual(result, {
    payerAddress: PAYER_ADDRESS,
    litNetwork: 'naga-test',
    balance: {
      totalBalance: '1.0',
      availableBalance: '0.5',
    },
    restriction: {
      totalMaxPrice: '7',
      requestsPerPeriod: '8',
      periodSeconds: '9',
    },
    delegatedUsersCount: 1,
    ready: true,
  });
});

test('issueLitPaymentDelegation caps expiration at the worker ttl', async () => {
  const originalDateNow = Date.now;
  const nowMs = Date.parse('2026-03-22T12:00:00.000Z');

  class FakeContract {
    constructor(_address, _abi, provider) {
      this.provider = provider;
    }

    getPayers(address) {
      assert.equal(address.toLowerCase(), REQUESTER_ADDRESS.toLowerCase());
      assert.equal(this.provider.connection?.url, DEFAULT_LIT_RPC_URL);
      return Promise.resolve([]);
    }

    connect(_signer) {
      return {
        delegatePayments: async (address) => {
          assert.equal(address.toLowerCase(), REQUESTER_ADDRESS.toLowerCase());
          return { wait: async () => {} };
        },
      };
    }

    balance() {
      return Promise.resolve(v5Ethers.BigNumber.from(0));
    }

    stableBalance() {
      return Promise.resolve(v5Ethers.BigNumber.from(0));
    }

    getRestriction() {
      return Promise.resolve(null);
    }

    getUsers() {
      return Promise.resolve([]);
    }
  }

  Date.now = () => nowMs;
  try {
    const { issueLitPaymentDelegation } = await loadLitPaymentDelegationModule(
      buildV5CompatEthers({
        Contract: FakeContract,
        JsonRpcProvider: v5Ethers.providers.JsonRpcProvider,
      }),
    );

    const result = await issueLitPaymentDelegation({
      requesterAddress: REQUESTER_ADDRESS,
      sessionPublicKey: SESSION_PUBLIC_KEY,
      litNetwork: 'naga-dev',
      litPayerPrivateKey: PAYER_PRIVATE_KEY,
      audience: 'https://allowed.example.test/path',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    assert.equal(result.expiresAt, '2026-03-22T12:10:00.000Z');
    assert.equal(result.payerAddress, PAYER_ADDRESS);
    assert.equal(result.delegatedNow, true);
    assert.match(
      result.capabilityAuthSig.signedMessage,
      /^allowed\.example.test wants you to sign in with your Ethereum account:/m,
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test('issueLitPaymentDelegation preserves the auth sig when status refresh fails', async () => {
  class FakeContract {
    constructor(_address, _abi, provider) {
      this.provider = provider;
    }

    getPayers(address) {
      assert.equal(address.toLowerCase(), REQUESTER_ADDRESS.toLowerCase());
      assert.equal(this.provider.connection?.url, DEFAULT_LIT_RPC_URL);
      return Promise.resolve([]);
    }

    connect(_signer) {
      return {
        delegatePayments: async (address) => {
          assert.equal(address.toLowerCase(), REQUESTER_ADDRESS.toLowerCase());
          return { wait: async () => {} };
        },
      };
    }

    balance() {
      return Promise.reject(new Error('rpc unavailable'));
    }

    stableBalance() {
      return Promise.resolve(v5Ethers.BigNumber.from(0));
    }

    getRestriction() {
      return Promise.resolve(null);
    }

    getUsers() {
      return Promise.resolve([]);
    }
  }

  const { issueLitPaymentDelegation } = await loadLitPaymentDelegationModule(
    buildV5CompatEthers({
      Contract: FakeContract,
      JsonRpcProvider: v5Ethers.providers.JsonRpcProvider,
    }),
  );

  const result = await issueLitPaymentDelegation({
    requesterAddress: REQUESTER_ADDRESS,
    sessionPublicKey: SESSION_PUBLIC_KEY,
    litNetwork: 'naga-dev',
    litPayerPrivateKey: PAYER_PRIVATE_KEY,
    audience: 'https://allowed.example.test/path',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });

  assert.equal(result.payerAddress, PAYER_ADDRESS);
  assert.equal(result.delegatedNow, true);
  assert.equal(result.status, null);
  assert.match(
    result.capabilityAuthSig.signedMessage,
    /^allowed\.example.test wants you to sign in with your Ethereum account:/m,
  );
});
