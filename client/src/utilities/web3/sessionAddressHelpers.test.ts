import { getSessionAddresses } from './sessionAddressHelpers.js';

describe('sessionAddressHelpers', () => {
  it('hydrates empty display session contracts from OP Sepolia chain defaults', () => {
    const addresses = getSessionAddresses({
      slug: 'demo',
      networkChainId: 11155420,
      contracts: {},
    });

    expect(addresses.surveys).toEqual({
      address: '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
      chainId: 11155420,
    });
    expect(addresses.sbtFactory).toEqual({
      address: '0x8CBeE1EE46603b446b499cb32F63fa9860a50478',
      chainId: 11155420,
    });
  });

  it('keeps explicit session contracts ahead of chain defaults', () => {
    const addresses = getSessionAddresses({
      slug: 'demo',
      networkChainId: 11155420,
      contracts: {
        sbtFactory: {
          address: '0x1111111111111111111111111111111111111111',
          chainId: 31337,
        },
      },
    });

    expect(addresses.sbtFactory).toEqual({
      address: '0x1111111111111111111111111111111111111111',
      chainId: 31337,
    });
    expect(addresses.surveys).toEqual({
      address: '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
      chainId: 11155420,
    });
  });
});
