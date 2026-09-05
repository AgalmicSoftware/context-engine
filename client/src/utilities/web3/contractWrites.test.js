import { ethers } from 'ethers';
import { resolveTxGasOverrides, sendContractWriteViaProvider } from './contractWrites.js';

const mockRpcLog = jest.fn();
jest.mock('../logging.js', () => ({
  createLogger: (category) => ({
    debug: jest.fn(),
    error: jest.fn(),
    log: category === 'rpc' ? (...args) => mockRpcLog(...args) : jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('contractWrites gas override fallbacks', () => {
  beforeEach(() => {
    mockRpcLog.mockClear();
  });

  it('uses the fallback gas limit directly when preferFallbackGasLimit is enabled', async () => {
    const estimateFn = jest.fn().mockResolvedValue(ethers.BigNumber.from('123456'));
    const contract = {
      estimateGas: {
        createThing: estimateFn,
      },
    };

    const overrides = await resolveTxGasOverrides({
      contract,
      method: 'createThing',
      fallbackGasLimit: '555000',
      preferFallbackGasLimit: true,
    });

    expect(estimateFn).not.toHaveBeenCalled();
    expect(overrides.gasLimit.toString()).toBe('555000');
  });

  it('hex-encodes gas, value, fee overrides, and nonce for raw provider writes', async () => {
    const signingProvider = {
      request: jest.fn().mockResolvedValue('0xtxhash'),
    };
    const ethersProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn().mockResolvedValue({
        status: 1,
        to: '0x00000000000000000000000000000000000000bb',
        transactionHash: '0xtxhash',
      }),
    };
    const signer = {
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contract = {
      address: '0x00000000000000000000000000000000000000bb',
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue('0xdeadbeef'),
      },
      callStatic: {
        mintThing: jest.fn().mockRejectedValue(new Error('Max tokens reached')),
      },
    };

    const result = await sendContractWriteViaProvider({
      signingProvider,
      ethersProvider,
      signer,
      contract,
      method: 'setThing',
      args: ['value'],
      txOverrides: {
        gasLimit: 550000,
        value: ethers.BigNumber.from('123'),
        gasPrice: ethers.BigNumber.from('3000000000'),
        maxFeePerGas: ethers.BigNumber.from('4000000000'),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000'),
        nonce: 9,
      },
      rpcFunction: 'setThing',
      revertMessage: 'setThing reverted.',
    });

    expect(signingProvider.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [
        expect.objectContaining({
          from: '0x00000000000000000000000000000000000000aa',
          to: '0x00000000000000000000000000000000000000bb',
          data: '0xdeadbeef',
          gas: ethers.BigNumber.from('550000').toHexString(),
          value: ethers.BigNumber.from('123').toHexString(),
          gasPrice: ethers.BigNumber.from('3000000000').toHexString(),
          maxFeePerGas: ethers.BigNumber.from('4000000000').toHexString(),
          maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
          nonce: ethers.BigNumber.from('9').toHexString(),
        }),
      ],
    });
    expect(ethersProvider.waitForTransaction).toHaveBeenCalledWith('0xtxhash');
    expect(result).toEqual({
      txHash: '0xtxhash',
      receipt: { status: 1, to: '0x00000000000000000000000000000000000000bb', transactionHash: '0xtxhash' },
    });
  });

  it('continues waiting for the receipt when onBroadcastTxHash throws', async () => {
    const signingProvider = {
      request: jest.fn().mockResolvedValue('0xtxhash'),
    };
    const ethersProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn().mockResolvedValue({
        status: 1,
        to: '0x00000000000000000000000000000000000000bb',
        transactionHash: '0xtxhash',
      }),
    };
    const signer = {
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contract = {
      address: '0x00000000000000000000000000000000000000bb',
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue('0xdeadbeef'),
      },
    };
    const onBroadcastTxHash = jest.fn(() => {
      throw new Error('progress update failed');
    });

    const result = await sendContractWriteViaProvider({
      signingProvider,
      ethersProvider,
      signer,
      contract,
      method: 'setThing',
      args: ['value'],
      onBroadcastTxHash,
    });

    expect(onBroadcastTxHash).toHaveBeenCalledWith('0xtxhash');
    expect(ethersProvider.waitForTransaction).toHaveBeenCalledWith('0xtxhash');
    expect(result).toEqual({
      txHash: '0xtxhash',
      receipt: { status: 1, to: '0x00000000000000000000000000000000000000bb', transactionHash: '0xtxhash' },
    });
  });

  it('surfaces the recovered revert reason when the on-chain receipt fails', async () => {
    const signingProvider = {
      request: jest.fn().mockResolvedValue('0xtxhash'),
    };
    const ethersProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn().mockResolvedValue({ status: 0, blockNumber: 123, transactionHash: '0xtxhash' }),
      call: jest.fn().mockRejectedValue(new Error('Max tokens reached')),
    };
    const signer = {
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contract = {
      address: '0x00000000000000000000000000000000000000bb',
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue('0xdeadbeef'),
      },
      callStatic: {
        mintThing: jest.fn().mockRejectedValue(new Error('Max tokens reached')),
      },
    };

    await expect(
      sendContractWriteViaProvider({
        signingProvider,
        ethersProvider,
        signer,
        contract,
        method: 'mintThing',
        args: ['value'],
        revertMessage: 'mintThing transaction reverted on-chain.',
      }),
    ).rejects.toThrow('Max tokens reached');

    expect(ethersProvider.call).not.toHaveBeenCalled();
    expect(contract.callStatic.mintThing).toHaveBeenCalledWith('value', {
      from: '0x00000000000000000000000000000000000000aa',
    });
  });

  it('never logs sensitive calldata or copies provider errors into sensitive write failures', async () => {
    const rawCredential = 'claim-secret-sentinel';
    const encodedCredential = `0x${Array.from(new TextEncoder().encode(rawCredential))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
    const signingProvider = {
      request: jest.fn().mockResolvedValue('0xtxhash'),
    };
    const ethersProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn().mockResolvedValue({ status: 0, blockNumber: 123, transactionHash: '0xtxhash' }),
      call: jest.fn().mockRejectedValue(new Error(`provider echoed ${rawCredential} ${encodedCredential}`)),
    };
    const signer = {
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contract = {
      address: '0x00000000000000000000000000000000000000bb',
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue(encodedCredential),
      },
      callStatic: {
        claimWithPassword: jest.fn().mockRejectedValue(new Error(`provider echoed ${rawCredential}`)),
      },
    };

    await expect(
      sendContractWriteViaProvider({
        signingProvider,
        ethersProvider,
        signer,
        contract,
        method: 'claimWithPassword',
        args: [rawCredential],
        revertMessage: 'claimWithPassword transaction reverted on-chain.',
        sensitiveArgs: true,
      }),
    ).rejects.toThrow('claimWithPassword transaction reverted on-chain.');

    const serializedLogs = JSON.stringify(mockRpcLog.mock.calls);
    expect(serializedLogs).not.toContain(rawCredential);
    expect(serializedLogs).not.toContain(encodedCredential);
    expect(contract.callStatic.claimWithPassword).not.toHaveBeenCalled();
    expect(ethersProvider.call).not.toHaveBeenCalled();
  });

  it('replaces provider broadcast errors for writes with sensitive arguments', async () => {
    const rawCredential = 'claim-broadcast-secret-sentinel';
    const encodedCredential = `0x${Array.from(new TextEncoder().encode(rawCredential))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
    const signingProvider = {
      request: jest.fn().mockRejectedValue(new Error(`provider echoed ${rawCredential} ${encodedCredential}`)),
    };
    const ethersProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn(),
    };
    const signer = {
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
    };
    const contract = {
      address: '0x00000000000000000000000000000000000000bb',
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue(encodedCredential),
      },
    };

    await expect(
      sendContractWriteViaProvider({
        signingProvider,
        ethersProvider,
        signer,
        contract,
        method: 'claimWithPassword',
        args: [rawCredential],
        revertMessage: 'claimWithPassword transaction failed.',
        sensitiveArgs: true,
      }),
    ).rejects.toThrow('claimWithPassword transaction failed.');

    expect(ethersProvider.waitForTransaction).not.toHaveBeenCalled();
    expect(JSON.stringify(mockRpcLog.mock.calls)).not.toContain(rawCredential);
    expect(JSON.stringify(mockRpcLog.mock.calls)).not.toContain(encodedCredential);
  });
});

describe('raw contract write target checks', () => {
  const to = '0x00000000000000000000000000000000000000bb';
  const from = '0x00000000000000000000000000000000000000aa';
  const makeOptions = () => ({
    signer: { getAddress: jest.fn().mockResolvedValue(from) },
    signingProvider: { request: jest.fn().mockResolvedValue('0xtxhash') },
    ethersProvider: {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420 }),
      getCode: jest.fn().mockResolvedValue('0x6000'),
      send: jest.fn().mockResolvedValue('0xaa37dc'),
      waitForTransaction: jest.fn().mockResolvedValue({ status: 1, to, transactionHash: '0xtxhash', logs: [] }),
    },
    contract: {
      address: to,
      interface: new ethers.utils.Interface([
        'function claim()',
        'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
      ]),
    },
    method: 'claim',
    expectedChainId: 11155420,
  });

  it.each(['0x', '0x0', 'garbage'])('never broadcasts to absent or malformed deployed code %s', async (code) => {
    const options = makeOptions();
    options.ethersProvider.getCode.mockResolvedValue(code);
    await expect(sendContractWriteViaProvider(options)).rejects.toThrow(/contract.*deployed|bytecode/i);
    expect(options.signingProvider.request).not.toHaveBeenCalled();
  });

  it('rejects a different chain before broadcasting', async () => {
    const options = makeOptions();
    options.ethersProvider.send.mockResolvedValue('0x2105');
    await expect(sendContractWriteViaProvider(options)).rejects.toThrow(/chain|network/i);
    expect(options.signingProvider.request).not.toHaveBeenCalled();
  });

  it.each([{ status: undefined, to }, { status: 1, to: from }, { status: 1 }])(
    'rejects an unverified receipt %j',
    async (receipt) => {
      const options = makeOptions();
      options.ethersProvider.waitForTransaction.mockResolvedValue(receipt);
      await expect(sendContractWriteViaProvider(options)).rejects.toThrow();
    },
  );

  it('requires the expected event to originate from the destination contract', async () => {
    const options = { ...makeOptions(), expectedEvent: 'Transfer' };
    const log = options.contract.interface.encodeEventLog(options.contract.interface.getEvent('Transfer'), [
      ethers.constants.AddressZero,
      from,
      1,
    ]);
    options.ethersProvider.waitForTransaction.mockResolvedValue({ status: 1, to, logs: [{ ...log, address: from }] });
    await expect(sendContractWriteViaProvider(options)).rejects.toThrow(/Transfer/);
    options.ethersProvider.waitForTransaction.mockResolvedValue({ status: 1, to, logs: [{ ...log, address: to }] });
    await expect(sendContractWriteViaProvider(options)).resolves.toEqual(
      expect.objectContaining({ txHash: '0xtxhash' }),
    );
    expect(options.signingProvider.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: [expect.objectContaining({ chainId: '0xaa37dc', to })],
      }),
    );
  });
});
