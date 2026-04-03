import { ethers } from 'ethers';
import { resolveTxGasOverrides, sendContractWriteViaProvider } from './contractWrites.js';

describe('contractWrites gas override fallbacks', () => {
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
      waitForTransaction: jest.fn().mockResolvedValue({ status: 1, transactionHash: '0xtxhash' }),
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
      params: [expect.objectContaining({
        from: '0x00000000000000000000000000000000000000aa',
        to: '0x00000000000000000000000000000000000000bb',
        data: '0xdeadbeef',
        gas: ethers.BigNumber.from('550000').toHexString(),
        value: ethers.BigNumber.from('123').toHexString(),
        gasPrice: ethers.BigNumber.from('3000000000').toHexString(),
        maxFeePerGas: ethers.BigNumber.from('4000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
        nonce: ethers.BigNumber.from('9').toHexString(),
      })],
    });
    expect(ethersProvider.waitForTransaction).toHaveBeenCalledWith('0xtxhash');
    expect(result).toEqual({
      txHash: '0xtxhash',
      receipt: { status: 1, transactionHash: '0xtxhash' },
    });
  });

  it('continues waiting for the receipt when onBroadcastTxHash throws', async () => {
    const signingProvider = {
      request: jest.fn().mockResolvedValue('0xtxhash'),
    };
    const ethersProvider = {
      waitForTransaction: jest.fn().mockResolvedValue({ status: 1, transactionHash: '0xtxhash' }),
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
      receipt: { status: 1, transactionHash: '0xtxhash' },
    });
  });
});
