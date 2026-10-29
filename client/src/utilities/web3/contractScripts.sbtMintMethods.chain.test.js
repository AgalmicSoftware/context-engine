import { ethers } from 'ethers';
import { createContractScriptsSbtMintMethods } from './contractScripts.sbtMintMethods';
import { sendContractWriteViaProvider } from './contractWrites';

const address = '0x00000000000000000000000000000000000000a1';
const account = '0x00000000000000000000000000000000000000b2';
const hash = `0x${'11'.repeat(32)}`;
const writes = [
  ['startClaim', [hash]],
  ['claimWithPassword', ['fixture-password']],
  ['claimWithInvite', ['1', '0x1234']],
  ['mintWithGroupSignature', ['0x1234']],
  ['claim', []],
  ['addHashedPasswords', [[hash]]],
  ['burnToken', ['1']],
];
const setup = (walletChainId) => {
  const iface = new ethers.utils.Interface([
    'function startClaim(bytes32)',
    'function claimWithPassword(string)',
    'function claimWithInvite(uint256,bytes)',
    'function mintWithGroupSignature(bytes)',
    'function claim()',
    'function addHashedPasswords(bytes32[])',
    'function burn(uint256)',
    'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
  ]);
  const log = iface.encodeEventLog(iface.getEvent('Transfer'), [ethers.constants.AddressZero, account, 1]);
  const receipt = { status: 1, to: address, transactionHash: hash, logs: [{ ...log, address }] };
  const wallet = { request: jest.fn().mockResolvedValue(hash) };
  const signer = { getAddress: jest.fn().mockResolvedValue(account) };
  const provider = {
    getNetwork: jest.fn().mockResolvedValue({ chainId: walletChainId }),
    getCode: jest.fn().mockResolvedValue('0x6000'),
    send: jest.fn().mockResolvedValue(ethers.utils.hexValue(walletChainId)),
    getSigner: () => signer,
    waitForTransaction: jest.fn().mockResolvedValue(receipt),
  };
  const methods = createContractScriptsSbtMintMethods({
    ethers: {
      ...ethers,
      providers: { ...ethers.providers, Web3Provider: jest.fn(() => provider) },
      Contract: jest.fn(() => ({
        address,
        interface: iface,
        callStatic: { claimWithInvite: jest.fn().mockResolvedValue(true) },
      })),
    },
    GAS_FALLBACKS: { addHashedPasswords: () => 100000 },
    resolveTxGasOverrides: jest.fn().mockResolvedValue({ gasLimit: 100000 }),
    sendContractWriteViaProvider,
    rpcLog: jest.fn(),
  });
  return {
    methods: { ...methods, getProviderLocation: () => wallet, getBigNumber: ethers.BigNumber.from },
    wallet,
    signer,
    provider,
    receipt,
  };
};

describe('SBT writes use the session chain', () => {
  it.each(writes)('%s refuses a wallet on another chain even when the target bytecode exists', async (method, args) => {
    const { methods, wallet, provider } = setup(2);
    await expect(methods[method]('injected', address, ...args, 1)).rejects.toThrow(/expected.*1|session.*1/i);
    expect(wallet.request).not.toHaveBeenCalled();
    expect(provider.waitForTransaction).not.toHaveBeenCalled();
  });

  it.each(writes)('%s sends matching-chain writes with the session chain in the transaction', async (method, args) => {
    const { methods, wallet, receipt } = setup(1);
    await expect(methods[method]('injected', address, ...args, 1)).resolves.toEqual(receipt);
    expect(wallet.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [expect.objectContaining({ chainId: '0x01', to: address })],
    });
  });

  it.each(writes)('%s refuses a missing session chain before any wallet prompt', async (method, args) => {
    const { methods, wallet, signer } = setup(1);
    await expect(methods[method]('injected', address, ...args)).rejects.toThrow(/chain|network/i);
    expect(wallet.request).not.toHaveBeenCalled();
    expect(signer.getAddress).not.toHaveBeenCalled();
  });
});
