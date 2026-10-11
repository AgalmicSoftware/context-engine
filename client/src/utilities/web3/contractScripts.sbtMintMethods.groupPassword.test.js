import { ethers } from 'ethers';
import { cryptoUtils } from '../crypto/cryptography.js';
import { useFastGroupPasswordKdf } from '../crypto/groupPasswordKdf.testUtils';
import { createContractScriptsSbtMintMethods } from './contractScripts.sbtMintMethods';

const SBT = '0x00000000000000000000000000000000000000a1';
const USER = '0x00000000000000000000000000000000000000c3';
const CHAIN_ID = 11155420;

const createMethods = () =>
  createContractScriptsSbtMintMethods({
    cryptoUtils,
    ethers,
    inviteLog: { log: jest.fn(), error: jest.fn() },
    rpcLog: jest.fn(),
  });

describe('contract script group-password methods', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hashes group passwords only against a real SBT address', async () => {
    useFastGroupPasswordKdf();
    const methods = createMethods();

    await expect(methods.computeGroupPasswordHash({ password: 'group-pass', sbtAddress: '' })).rejects.toThrow(
      'needs the SBT contract address',
    );
    await expect(methods.computeGroupPasswordHash({ password: 'group-pass', sbtAddress: SBT })).resolves.toBe(
      await cryptoUtils.computeGroupPasswordHash({ password: 'group-pass', sbtAddress: SBT }),
    );
  });

  it('signs every invite slot from one derivation and encodes claimable codes', async () => {
    const { deriveBits } = useFastGroupPasswordKdf();
    const methods = createMethods();
    const groupPasswordHash = await cryptoUtils.computeGroupPasswordHash({ password: 'group-pass', sbtAddress: SBT });
    deriveBits.mockClear();

    const invites = await methods.generateInvitePayloads({
      password: ' group-pass ',
      sbtAddress: SBT,
      chainId: CHAIN_ID,
      nonces: ['1', 2, '3'],
      groupPasswordHash,
    });

    expect(deriveBits).toHaveBeenCalledTimes(1);
    expect(invites.map(({ nonce }) => nonce)).toEqual(['1', '2', '3']);
    invites.forEach(({ inviteCode, nonce, signature }) => {
      expect(cryptoUtils.decodeInvite(inviteCode)).toEqual({
        chainId: String(CHAIN_ID),
        sbtAddress: ethers.utils.getAddress(SBT),
        nonce,
        signature,
      });
      expect(
        cryptoUtils.verifyInviteSignature({ sbtAddress: SBT, nonce, chainId: CHAIN_ID, signature, groupPasswordHash })
          .ok,
      ).toBe(true);
    });
  });

  it('refuses to sign for a password that does not match the group', async () => {
    useFastGroupPasswordKdf();
    const methods = createMethods();
    const otherHash = await cryptoUtils.computeGroupPasswordHash({ password: 'other-pass', sbtAddress: SBT });

    const inviteError = await methods
      .generateInvitePayloads({
        password: 'group-pass',
        sbtAddress: SBT,
        chainId: CHAIN_ID,
        nonces: ['1'],
        groupPasswordHash: otherHash,
      })
      .catch((error) => error);
    const mintError = await methods
      .signGroupMintAuthorization({
        password: 'group-pass',
        sbtAddress: SBT,
        userAddress: USER,
        chainId: CHAIN_ID,
        groupPasswordHash: otherHash,
      })
      .catch((error) => error);

    expect(cryptoUtils.isGroupPasswordMismatchError(inviteError)).toBe(true);
    expect(cryptoUtils.isGroupPasswordMismatchError(mintError)).toBe(true);
  });

  it('rejects empty invite batches and passwords before deriving', async () => {
    const { importKey } = useFastGroupPasswordKdf();
    const methods = createMethods();

    await expect(
      methods.generateInvitePayloads({ password: 'group-pass', sbtAddress: SBT, chainId: CHAIN_ID, nonces: [] }),
    ).rejects.toThrow('non-empty nonces');
    await expect(
      methods.generateInvitePayloads({ password: '  ', sbtAddress: SBT, chainId: CHAIN_ID, nonces: ['1'] }),
    ).rejects.toThrow('non-empty group password');
    expect(importKey).not.toHaveBeenCalled();
  });
});
