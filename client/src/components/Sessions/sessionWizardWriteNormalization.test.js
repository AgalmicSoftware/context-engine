/* eslint-disable import/first */

import { ethers } from 'ethers';

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn((providerLike) => providerLike || null),
  },
}));

import { getSessionRegistryAddress } from '../../variables/chains.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { setSessionFieldsOnChain } from '../../utilities/web3/sessionRegistry.js';
import {
  buildSessionWizardRegistrySessionFields,
  buildSessionWizardWorkerConfigPayload,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization.js';

describe('sessionWizardWriteNormalization', () => {
  beforeEach(() => {
    cryptoUtils._getProvider.mockReset();
    cryptoUtils._getProvider.mockImplementation((providerLike) => providerLike || null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sanitizeSessionWizardMetadataPayload strips worker-only fields from Arweave metadata', () => {
    const metadata = sanitizeSessionWizardMetadataPayload({
      slug: 'edge',
      sessionName: '  Edge Session  ',
      sessionInfo: '  Session info  ',
      sessionHeader: ' https://images.example/header.png ',
      corsWorkerUrl: 'https://worker.example',
      corsWorkerURL: 'https://worker-alias.example',
      allowOrigins: ['https://app.example'],
      limits: { perWalletPerDay: 10 },
      rpcEndpoint: 'https://rpc.example',
      embeddedDeployHelperEnabled: false,
      rpcUrl: 'https://rpc-worker-alias.example',
      rpcUrlsByChainId: { 84532: ['https://rpc-chain.example'] },
      scopes: { ai: true },
      sponsored: { gate: 'registry-only' },
      sponsoredSbtAddress: '0x123',
      faucet: {
        rpcUrl: 'https://faucet-rpc.example',
        amountEth: '0.0002',
        privateKey: '0xpriv',
        encryptedPrivateKey: 'enc',
      },
      contracts: {
        surveys: { address: '0x111', chainId: 84532 },
        reputation: { address: '0x999', chainId: 84532 },
      },
      blockLimits: { start: '100', end: '120' },
    }, {
      fieldOrder: ['slug', 'sessionName', 'sessionInfo', 'sessionHeaderImg', 'faucet', 'contracts', 'blockLimits'],
    });

    expect(metadata).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      sessionInfo: 'Session info',
      sessionHeaderImg: 'https://images.example/header.png',
      faucet: { amountEth: '0.0002' },
      contracts: {
        surveys: { address: '0x111', chainId: 84532 },
      },
      blockLimits: { start: 100, end: 120 },
    });
  });

  test('buildSessionWizardRegistrySessionFields keeps the worker URL compatibility mirror and sponsored flags only', () => {
    expect(buildSessionWizardRegistrySessionFields({
      onChainFields: {
        corsWorkerUrl: ' https://worker.example ',
        unexpectedField: 'should-not-pass-through',
      },
      sponsoredFields: {
        sponsored_ai: '1',
        sponsored_rpc: '',
        sponsored_arweave: '0',
      },
    })).toEqual({
      corsWorkerUrl: 'https://worker.example',
      sponsored_ai: '1',
      sponsored_arweave: '0',
    });
  });

  test('buildSessionWizardRegistrySessionFields preserves empty worker URL clears for registry writes', async () => {
    const walletProvider = {
      request: jest.fn(async ({ method }) => (method === 'eth_sendTransaction' ? '0xtxhash' : null)),
    };
    const signer = {
      provider: null,
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contractMock = {
      address: getSessionRegistryAddress(84532),
      interface: {
        encodeFunctionData: jest.fn(() => '0xdeadbeef'),
      },
      estimateGas: {
        setSessionFields: jest.fn(),
      },
      setSessionFields: jest.fn(),
    };
    const web3ProviderMock = {
      getSigner: () => signer,
      waitForTransaction: jest.fn().mockResolvedValue({ status: 1, transactionHash: '0xtxhash' }),
    };

    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return web3ProviderMock;
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const onChainFields = buildSessionWizardRegistrySessionFields({
      onChainFields: {
        corsWorkerUrl: '',
      },
    });

    expect(onChainFields).toEqual({
      corsWorkerUrl: '',
    });

    await setSessionFieldsOnChain({
      providerLike: walletProvider,
      chainId: 84532,
      slug: 'edge',
      fields: onChainFields,
    });

    expect(contractMock.estimateGas.setSessionFields).not.toHaveBeenCalled();
    expect(walletProvider.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'eth_sendTransaction',
      params: [expect.objectContaining({
        from: '0x00000000000000000000000000000000000000aa',
        to: getSessionRegistryAddress(84532),
        data: '0xdeadbeef',
        gas: ethers.BigNumber.from('300000').toHexString(),
      })],
    }));
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith('0xtxhash');
  });

  test('buildSessionWizardWorkerConfigPayload writes worker config authority fields to Worker KV payloads', () => {
    const payload = buildSessionWizardWorkerConfigPayload({
      slug: 'edge',
      draft: {
        networkChainId: 84532,
        corsWorkerUrl: 'https://draft-worker.example',
        blockLimits: { start: '250', end: '275' },
        contracts: {
          surveys: { address: '0x111', chainId: 84532 },
          reputation: { address: '0x999', chainId: 84532 },
        },
      },
      deployPayload: {
        adminAddress: ' 0xAdmin ',
        registryAddress: ' 0xRegistry ',
        registryChainId: 84532,
        rpcUrl: ' https://rpc.example ',
        rpcUrlsByChainId: { 84532: ['https://rpc.example'] },
        allowOrigins: ['https://app.example'],
        limits: { perWalletPerDay: 1000 },
        scopes: { ai: true },
        embeddedDeployHelperEnabled: false,
        faucet: {
          rpcUrl: 'https://faucet-rpc.example',
          amountEth: '0.0002',
          balanceThresholdEth: '0.001',
        },
      },
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      workerUrl: ' https://worker.example/ ',
      latestChainBlock: 500,
      resolveWorkerFaucetConfig: () => ({
        rpcUrl: 'https://fallback-faucet.example',
        amountEth: '0.0003',
        balanceThresholdEth: '0.002',
      }),
    });

    expect(payload.slug).toBe('edge');
    expect(payload.adminAddress).toBe('0xAdmin');
    expect(payload.registryAddress).toBe('0xRegistry');
    expect(payload.registryChainId).toBe(84532);
    expect(payload.networkChainId).toBe(84532);
    expect(payload.corsWorkerUrl).toBe('https://worker.example/');
    expect(payload.rpcUrl).toBe('https://rpc.example');
    expect(payload.blockLimits).toEqual({ start: 250, end: 275 });
    expect(payload.embeddedDeployHelperEnabled).toBe(false);
    expect(payload.sessionId).toBe('0x123e4567e89b12d3a456426614174000');
    expect(payload.contracts.surveys).toEqual({ address: '0x111', chainId: 84532 });
    expect(payload.contracts.sessionRegistry).toEqual({
      address: getSessionRegistryAddress(84532),
      chainId: 84532,
    });
    expect(payload.contracts.reputation).toBeUndefined();
  });
});
