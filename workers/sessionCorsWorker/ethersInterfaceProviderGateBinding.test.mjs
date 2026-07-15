import test from 'node:test';
import assert from 'node:assert/strict';

import { createEthersInterfaceProviderGateHelpersWithWorkerDeps } from './ethersInterfaceProviderGateBinding.js';
import { PRIVATE_SESSION_RPC_LABEL } from './rpcDiagnosticSafety.js';

test('createEthersInterfaceProviderGateHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createEthersInterfaceProviderGateHelpersWithWorkerDeps();

  assert.equal(typeof helpers.getRegistryInterface, 'function');
  assert.equal(typeof helpers.getErc721Interface, 'function');
  assert.equal(typeof helpers.getSbtAdminInterface, 'function');
  assert.equal(typeof helpers.getHatsInterface, 'function');
  assert.equal(typeof helpers.getFaucetSbtGateInterface, 'function');
  assert.equal(typeof helpers.getJsonRpcProvider, 'function');
  assert.equal(typeof helpers.getRegistryContract, 'function');
  assert.equal(typeof helpers.isPositiveBalance, 'function');
  assert.equal(typeof helpers.checkSbtGate, 'function');
});

test('createEthersInterfaceProviderGateHelpersWithWorkerDeps preserves interface caching by abi', () => {
  const constructed = [];
  class InterfaceStub {
    constructor(abi) {
      this.abi = abi;
      constructed.push(abi);
    }
  }

  const helpers = createEthersInterfaceProviderGateHelpersWithWorkerDeps({
    deps: {
      getEthersInterfaceCtor: () => InterfaceStub,
    },
    constants: {
      sessionRegistryAbi: ['registry'],
      erc721Abi: ['erc721'],
      sbtAdminAbi: ['sbtAdmin'],
      hatsAbi: ['hats'],
      faucetSbtGateAbi: ['faucet'],
    },
  });

  const registryA = helpers.getRegistryInterface();
  const registryB = helpers.getRegistryInterface();
  const erc721A = helpers.getErc721Interface();
  const erc721B = helpers.getErc721Interface();
  const sbtAdmin = helpers.getSbtAdminInterface();
  const hats = helpers.getHatsInterface();
  const faucet = helpers.getFaucetSbtGateInterface();

  assert.equal(registryA, registryB);
  assert.equal(erc721A, erc721B);
  assert.deepEqual(constructed, [
    ['registry'],
    ['erc721'],
    ['sbtAdmin'],
    ['hats'],
    ['faucet'],
  ]);
  assert.deepEqual(registryA.abi, ['registry']);
  assert.deepEqual(sbtAdmin.abi, ['sbtAdmin']);
  assert.deepEqual(hats.abi, ['hats']);
  assert.deepEqual(faucet.abi, ['faucet']);
});

test('createEthersInterfaceProviderGateHelpersWithWorkerDeps preserves provider selection and registry contract creation', () => {
  const providers = [];
  const contracts = [];

  class StaticJsonRpcProvider {
    constructor(rpcUrl, network) {
      providers.push(['static', rpcUrl, network]);
      this.rpcUrl = rpcUrl;
      this.network = network;
    }
  }

  class JsonRpcProvider {
    constructor(rpcUrl, network) {
      providers.push(['json', rpcUrl, network]);
      this.rpcUrl = rpcUrl;
      this.network = network;
    }
  }

  class ContractStub {
    constructor(address, abi, provider) {
      contracts.push([address, abi, provider]);
      this.address = address;
      this.abi = abi;
      this.provider = provider;
    }
  }

  const helpers = createEthersInterfaceProviderGateHelpersWithWorkerDeps({
    deps: {
      ethers: {
        providers: {
          StaticJsonRpcProvider,
          JsonRpcProvider,
        },
        Contract: ContractStub,
      },
      toChainId: (value) => Number(value) || 0,
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      resolveRegistryRpcUrl: (config) => config.rpcUrl || '',
    },
    constants: {
      sessionRegistryAbi: ['registry'],
    },
  });

  const staticProvider = helpers.getJsonRpcProvider('https://rpc-a.example', 84532);
  const jsonProvider = helpers.getJsonRpcProvider('https://rpc-b.example', 0);

  assert.equal(staticProvider.network.chainId, 84532);
  assert.equal(jsonProvider.network, undefined);

  const contract = helpers.getRegistryContract({
    registryAddress: '0x0000000000000000000000000000000000000001',
    rpcUrl: 'https://rpc-c.example',
    registryChainId: 84532,
  });

  assert.equal(contract.address, '0x0000000000000000000000000000000000000001');
  assert.deepEqual(providers, [
    ['static', 'https://rpc-a.example', { chainId: 84532, name: 'chain-84532' }],
    ['json', 'https://rpc-b.example', undefined],
    ['static', 'https://rpc-c.example', { chainId: 84532, name: 'chain-84532' }],
  ]);
  assert.deepEqual(contracts, [[
    '0x0000000000000000000000000000000000000001',
    ['registry'],
    contract.provider,
  ]]);

  assert.equal(
    helpers.getRegistryContract({
      registryAddress: 'not-an-address',
      rpcUrl: 'https://rpc.example',
      registryChainId: 84532,
    }),
    null,
  );
  assert.equal(
    helpers.getRegistryContract({
      registryAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: '',
      registryChainId: 84532,
    }),
    null,
  );
});

test('createEthersInterfaceProviderGateHelpersWithWorkerDeps preserves positive-balance coercion', () => {
  const { isPositiveBalance } = createEthersInterfaceProviderGateHelpersWithWorkerDeps();

  assert.equal(isPositiveBalance(1n), true);
  assert.equal(isPositiveBalance('2'), true);
  assert.equal(isPositiveBalance({ gt: (value) => value === 0 }), true);
  assert.equal(isPositiveBalance({ toString: () => '3' }), true);
  assert.equal(isPositiveBalance('0'), false);
  assert.equal(isPositiveBalance('bad'), false);
});

test('createEthersInterfaceProviderGateHelpersWithWorkerDeps preserves SBT gate any/all evaluation and failure logging', async () => {
  const logs = [];
  const iface = { name: 'erc721' };
  const secretRpcUrl = 'https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET';
  const helpers = createEthersInterfaceProviderGateHelpersWithWorkerDeps({
    deps: {
      getEthersInterfaceCtor: () => class InterfaceStub {
        constructor() {
          return iface;
        }
      },
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      callContractFunction: async ({ contractAddress }) => {
        if (contractAddress === '0x00000000000000000000000000000000000000aa') return [1n];
        if (contractAddress === '0x00000000000000000000000000000000000000bb') {
          const err = new Error(`balance failed at ${secretRpcUrl}`);
          err.rpcStatus = 502;
          err.rpcError = { code: -32000, message: `upstream echoed ${secretRpcUrl}` };
          throw err;
        }
        return [0n];
      },
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      rpcRequest: async ({ method }) => {
        assert.equal(method, 'eth_chainId');
        return '0x14a34';
      },
      toChainId: (value) => {
        if (typeof value === 'string' && value.startsWith('0x')) return parseInt(value, 16) || 0;
        return Number(value) || 0;
      },
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      log: (...args) => {
        logs.push(args);
      },
    },
    constants: {
      erc721Abi: ['erc721'],
    },
  });

  assert.equal(
    await helpers.checkSbtGate({
      sbtAddresses: ['0x00000000000000000000000000000000000000aa', '0x00000000000000000000000000000000000000bb'],
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: 'https://rpc.example',
      mode: 0,
      chainId: 84532,
    }),
    true,
  );

  assert.equal(
    await helpers.checkSbtGate({
      sbtAddresses: ['0x00000000000000000000000000000000000000aa', '0x00000000000000000000000000000000000000dd'],
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: 'https://rpc.example',
      mode: 'all',
      chainId: 84532,
    }),
    false,
  );

  logs.length = 0;
  assert.equal(
    await helpers.checkSbtGate({
      sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: secretRpcUrl,
      mode: 0,
      chainId: 84532,
      rpcUrlIsPrivate: true,
    }),
    false,
  );
  assert.deepEqual(logs, [[
    '[gating] sbt balanceOf failed',
    {
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: PRIVATE_SESSION_RPC_LABEL,
      errors: [{
        sbt: '0x00000000000000000000000000000000000000bb',
        status: 502,
        code: -32000,
        error: 'SBT balance check failed.',
      }],
    },
  ]]);

  assert.equal(
    await helpers.checkSbtGate({
      sbtAddresses: [],
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: 'https://rpc.example',
      mode: 0,
    }),
    true,
  );
  assert.equal(
    await helpers.checkSbtGate({
      sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
      address: '0x00000000000000000000000000000000000000cc',
      rpcUrl: '',
      mode: 0,
      chainId: 84532,
    }),
    false,
  );
  assert.equal(JSON.stringify(logs).includes('TENANT_SECRET'), false);
  assert.equal(JSON.stringify(logs).includes('ALCHEMY_SECRET'), false);
  assert.equal(JSON.stringify(logs).includes('rpcError'), false);
});
