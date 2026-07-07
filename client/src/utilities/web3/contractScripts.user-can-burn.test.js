import { ethers } from 'ethers';
import contractScripts from './chainGateway.js';

describe('contractScripts.userCanBurnSBTs', () => {
  const sbtAddress = '0x1111111111111111111111111111111111111111';
  const adminAddress = '0x2222222222222222222222222222222222222222';
  const holderAddress = '0x3333333333333333333333333333333333333333';
  const outsiderAddress = '0x4444444444444444444444444444444444444444';
  let contractSpy;
  let userHasSbtSpy;

  const installContractStub = (burnAuth) => {
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      admin: jest.fn().mockResolvedValue(adminAddress),
      collectionBurnAuth: jest.fn().mockResolvedValue(burnAuth),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (contractSpy) contractSpy.mockRestore();
    if (userHasSbtSpy) userHasSbtSpy.mockRestore();
    contractSpy = null;
    userHasSbtSpy = null;
  });

  it.each([
    {
      label: 'IssuerOnly only allows the admin',
      burnAuth: 0,
      userAddress: adminAddress,
      hasSBT: false,
      expected: true,
    },
    {
      label: 'IssuerOnly rejects a non-admin holder',
      burnAuth: 0,
      userAddress: holderAddress,
      hasSBT: true,
      expected: false,
    },
    {
      label: 'OwnerOnly allows a current holder',
      burnAuth: 1,
      userAddress: holderAddress,
      hasSBT: true,
      expected: true,
    },
    {
      label: 'OwnerOnly rejects the admin when they do not hold the token',
      burnAuth: 1,
      userAddress: adminAddress,
      hasSBT: false,
      expected: false,
    },
    {
      label: 'Both allows the admin without a token',
      burnAuth: 2,
      userAddress: adminAddress,
      hasSBT: false,
      expected: true,
    },
    {
      label: 'Both allows a current holder',
      burnAuth: 2,
      userAddress: holderAddress,
      hasSBT: true,
      expected: true,
    },
    {
      label: 'Both rejects a non-holder non-admin',
      burnAuth: 2,
      userAddress: outsiderAddress,
      hasSBT: false,
      expected: false,
    },
    {
      label: 'Neither rejects a current holder',
      burnAuth: 3,
      userAddress: holderAddress,
      hasSBT: true,
      expected: false,
    },
  ])('$label', async ({ burnAuth, userAddress, hasSBT, expected }) => {
    installContractStub(burnAuth);
    userHasSbtSpy = jest.spyOn(contractScripts, 'userHasSBT').mockResolvedValue(hasSBT);

    const result = await contractScripts.userCanBurnSBTs('none', sbtAddress, userAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(result).toBe(expected);
    expect(userHasSbtSpy).toHaveBeenCalledWith(
      'none',
      sbtAddress,
      userAddress,
      0,
      'latest',
      expect.objectContaining({ slug: 'edge' }),
    );
  });
});
