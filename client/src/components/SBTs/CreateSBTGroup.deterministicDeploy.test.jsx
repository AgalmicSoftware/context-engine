import { act } from '@testing-library/react';
import { ethers } from 'ethers';

import CreateSBTGroup from './CreateSBTGroup';
import contractScripts from '../../utilities/web3/chainGateway.js';

const SBT_FACTORY_RECEIPT_TEST_IFACE = new ethers.utils.Interface([
  'event SBTCreated(address indexed sbtAddress)',
  'event SBTCreatedDeterministic(address indexed sbtAddress, bytes32 indexed salt)',
]);

const makeFactoryReceiptLog = (eventName, args) => {
  const encoded = SBT_FACTORY_RECEIPT_TEST_IFACE.encodeEventLog(
    SBT_FACTORY_RECEIPT_TEST_IFACE.getEvent(eventName),
    args,
  );
  return {
    address: '0x00000000000000000000000000000000000000fa',
    topics: encoded.topics,
    data: encoded.data,
  };
};

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup deterministic deploy payloads', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });

  it('uses the predicted address when group-password hashes are computed for deterministic deploys', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Scoped Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const predictedAddress = '0x00000000000000000000000000000000000000f1';
    const deterministicSymbol = `CE-SBT-${ethers.utils.id('deterministic-salt').slice(2, 8).toUpperCase()}`;
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'11'.repeat(32)}`);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [
        makeFactoryReceiptLog('SBTCreatedDeterministic', [predictedAddress, ethers.utils.id('deterministic-salt')]),
      ],
    });

    await instance.mintSBT();

    expect(hashSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress: predictedAddress,
    });
    expect(createSpy).toHaveBeenCalledWith(
      'mock-provider',
      'Scoped Group',
      deterministicSymbol,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar://metadata',
      `0x${'11'.repeat(32)}`,
      expect.anything(),
      'deterministic-salt',
      {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: true,
      },
    );
  });

  it('prefers the deferred draft salt over the public slug/name auto salt', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      create2Salt: '',
      deferredCreate2Salt: 'draft/private-seed',
    };

    expect(instance.buildAutoCreate2SaltSource()).toBe('edge/deferred-group');
    expect(instance.getResolvedCreate2SaltSource()).toBe('draft/private-seed');
  });

  it('stores an explicit no-factory reason when deterministic preview cannot resolve an address', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance._isMounted = true;
    instance.state = {
      ...instance.state,
      sbtName: 'No Factory Group',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      predictableAddressEnabled: true,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {},
    }));
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue('');

    await act(async () => {
      await instance.refreshPredictedAddress();
    });

    expect(instance.state.predictedAddress).toBe('');
    expect(instance.state.predictedAddressStatus).toBe('No Group factory configured for this session.');
  });

  it('ignores older predicted-address responses after newer deterministic inputs are requested', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance._isMounted = true;
    instance.state = {
      ...instance.state,
      sbtName: 'Race Group',
      groupPassword: 'shared-secret',
      create2Salt: 'salt-one',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
      },
    }));

    let resolveFirstPrediction;
    let resolveSecondPrediction;
    const firstPrediction = new Promise((resolve) => {
      resolveFirstPrediction = resolve;
    });
    const secondPrediction = new Promise((resolve) => {
      resolveSecondPrediction = resolve;
    });

    const predictSpy = jest
      .spyOn(contractScripts, 'predictSBTAddress')
      .mockImplementationOnce(() => firstPrediction)
      .mockImplementationOnce(() => secondPrediction);

    const firstRefresh = instance.refreshPredictedAddress();
    instance.state = {
      ...instance.state,
      create2Salt: 'salt-two',
    };
    const secondRefresh = instance.refreshPredictedAddress();

    resolveSecondPrediction('0x00000000000000000000000000000000000000b2');
    await secondRefresh;
    expect(instance.state.predictedAddress).toBe('0x00000000000000000000000000000000000000b2');

    resolveFirstPrediction('0x00000000000000000000000000000000000000a1');
    await firstRefresh;

    expect(instance.state.predictedAddress).toBe('0x00000000000000000000000000000000000000b2');
    expect(predictSpy).toHaveBeenCalledTimes(2);
  });

  it('recomputes the deterministic deploy plan when the cached preview is stale', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
      deferredDeploy: true,
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt-two',
      predictedAddress: '0x00000000000000000000000000000000000000d4',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };
    instance._predictedAddressShapeSignature = 'stale-signature';
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
      },
    }));

    const freshPredictedAddress = '0x00000000000000000000000000000000000000e5';
    const predictSpy = jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(freshPredictedAddress);
    const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'55'.repeat(32)}`);

    const payload = await instance.buildDeferredDraftPayload();

    expect(predictSpy).toHaveBeenCalledTimes(1);
    expect(hashSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress: freshPredictedAddress,
    });
    expect(payload.predictedAddress).toBe(freshPredictedAddress);
    expect(payload.mintModeOnChain).toBe(2);
    expect(payload.finalGroupPasswordHash).toBe(`0x${'55'.repeat(32)}`);
  });

  it('builds a deferred draft payload with the predicted address and deterministic deploy args', async () => {
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
      deferredDeploy: true,
      onSaveDraft,
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      predictedAddress: '0x00000000000000000000000000000000000000d4',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    instance._predictedAddressShapeSignature = instance.buildPredictableDeploySignature(
      instance.buildPredictableDeployShape(),
    );
    const predictSpy = jest.spyOn(contractScripts, 'predictSBTAddress');
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'44'.repeat(32)}`);

    const payload = await instance.buildDeferredDraftPayload();

    expect(predictSpy).not.toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        predictedAddress: '0x00000000000000000000000000000000000000d4',
        displayName: 'Deferred Group',
        mintModeOnChain: 2,
        tokenURI: 'ar://metadata',
        finalGroupPasswordHash: `0x${'44'.repeat(32)}`,
        createOptions: {
          useConfiguredDeterministic: true,
          initializeGroupPasswordHash: true,
        },
      }),
    );
  });
});
