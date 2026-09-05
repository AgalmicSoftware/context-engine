import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography.js';
import groupPasswordDerivation from './groupPasswordDerivation.cjs';

const PASSWORD = 'shared-secret';
const SBT_A = '0x00000000000000000000000000000000000000a1';
const SBT_B = '0x00000000000000000000000000000000000000b2';
const USER = '0x00000000000000000000000000000000000000c3';

describe('cryptoUtils group password derivation', () => {
  it('matches the shared script derivation for zero and address scopes', () => {
    const sharedDerivation = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

    for (const sbtAddress of ['', SBT_A]) {
      expect(sharedDerivation.computeGroupPasswordHash({ password: PASSWORD, sbtAddress })).toBe(
        cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress }),
      );
    }
  });

  it('scopes the same password hash by SBT address and falls back to AddressZero when missing', () => {
    const zeroScopedHash = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD });
    const explicitZeroScopedHash = cryptoUtils.computeGroupPasswordHash({
      password: PASSWORD,
      sbtAddress: ethers.constants.AddressZero,
    });
    const hashA = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });
    const hashB = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_B });

    expect(explicitZeroScopedHash).toBe(zeroScopedHash);
    expect(hashA).not.toBe(zeroScopedHash);
    expect(hashA).not.toBe(hashB);
  });

  it('resolves the wallet scope against the on-chain group password hash', () => {
    const hashA = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });
    const hashB = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_B });
    const zeroScopedHash = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: '' });

    expect(
      cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password: PASSWORD,
        sbtAddress: SBT_A,
        groupPasswordHash: hashA,
      }),
    ).toBe(ethers.utils.getAddress(SBT_A));

    expect(
      cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password: PASSWORD,
        sbtAddress: SBT_A,
        groupPasswordHash: zeroScopedHash,
      }),
    ).toBe('');

    expect(
      cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password: PASSWORD,
        sbtAddress: SBT_A,
        groupPasswordHash: hashB,
      }),
    ).toBeNull();
  });

  it('uses the SBT-scoped wallet by default for group mint signatures', async () => {
    const scopedHash = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });
    const signature = await cryptoUtils.signGroupMintAuthorization({
      password: PASSWORD,
      sbtAddress: SBT_A,
      userAddress: USER,
      chainId: 11155420,
    });
    const messageHash = cryptoUtils.computeGroupMintMessageHash(SBT_A, USER, 11155420);
    const signer = ethers.utils.verifyMessage(ethers.utils.arrayify(messageHash), signature);

    expect(ethers.utils.solidityKeccak256(['address'], [signer])).toBe(scopedHash);
  });

  it('supports zero-scoped invite signing when the on-chain hash was created predeploy', async () => {
    const zeroScopedHash = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: '' });
    const scopedHash = cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });
    const signature = await cryptoUtils.signInvite({
      password: PASSWORD,
      sbtAddress: SBT_A,
      nonce: '1',
      chainId: 11155420,
      walletScopeSbtAddress: '',
    });

    expect(
      cryptoUtils.verifyInviteSignature({
        sbtAddress: SBT_A,
        nonce: '1',
      chainId: 11155420,
        signature,
        groupPasswordHash: zeroScopedHash,
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    expect(
      cryptoUtils.verifyInviteSignature({
        sbtAddress: SBT_A,
        nonce: '1',
      chainId: 11155420,
        signature,
        groupPasswordHash: scopedHash,
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });
});


describe('SBT authorization domains', () => {
  const chainId = 11155420;
  const input = { password: PASSWORD, sbtAddress: SBT_A, chainId, nonce: '2' };

  it('binds invite signatures to their chain, collection and independent slot', async () => {
    const signature = await cryptoUtils.signInvite(input);
    const groupPasswordHash = cryptoUtils.computeGroupPasswordHash(input);
    expect(cryptoUtils.verifyInviteSignature({ ...input, signature, groupPasswordHash }).ok).toBe(true);
    for (const change of [{ chainId: chainId + 1 }, { sbtAddress: SBT_B }, { nonce: '1' }]) {
      expect(cryptoUtils.verifyInviteSignature({ ...input, ...change, signature, groupPasswordHash }).ok).toBe(false);
    }
  });

  it('binds group signatures to chain and claimant with an explicit protocol domain', async () => {
    const signature = await cryptoUtils.signGroupMintAuthorization({ ...input, userAddress: USER });
    const expected = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256', 'address', 'address'],
      [ethers.utils.id('ContextEngine.SBT.GroupMint:1'), chainId, SBT_A, USER],
    ));
    const signer = ethers.utils.verifyMessage(ethers.utils.arrayify(expected), signature);
    expect(ethers.utils.solidityKeccak256(['address'], [signer])).toBe(cryptoUtils.computeGroupPasswordHash(input));
  });

  it('rejects old unscoped invite signatures and separates claim kinds', async () => {
    const wallet = groupPasswordDerivation.createGroupPasswordDerivation(ethers).deriveGroupPasswordWallet({ password: PASSWORD, sbtAddress: SBT_A });
    const unscoped = ethers.utils.solidityKeccak256(['address', 'uint256'], [SBT_A, '2']);
    const signature = await wallet.signMessage(ethers.utils.arrayify(unscoped));
    expect(cryptoUtils.verifyInviteSignature({ ...input, signature,
      groupPasswordHash: cryptoUtils.computeGroupPasswordHash(input) }).ok).toBe(false);
    expect(cryptoUtils.computeGroupMintMessageHash(SBT_A, '0x0000000000000000000000000000000000000002', chainId))
      .not.toBe(cryptoUtils.buildInviteMessageHash(input));
  });

  it.each([undefined, 0, -1, 1.5, 'invalid'])('rejects invalid signing chain %s', async (invalidChain) => {
    await expect(cryptoUtils.signInvite({ ...input, chainId: invalidChain })).rejects.toThrow();
  });

  it('decodes only scoped signed invite payloads and rejects reusable secrets', async () => {
    const signature = await cryptoUtils.signInvite(input);
    const payload = { c: String(chainId), a: SBT_A, n: '2', s: signature };
    expect(cryptoUtils.decodeInvite(cryptoUtils.encodeInvite(payload))).toEqual({
      chainId: String(chainId), sbtAddress: ethers.utils.getAddress(SBT_A), nonce: '2', signature,
    });
    for (const invalid of [
      { n: '2', s: signature }, { ...payload, c: 0 }, { ...payload, a: ethers.constants.AddressZero },
      { ...payload, n: 0 }, { ...payload, s: '0x00' }, { ...payload, password: PASSWORD },
    ]) {
      expect(cryptoUtils.decodeInvite(cryptoUtils.encodeInvite(invalid))).toBeNull();
    }
    expect(cryptoUtils.decodeInvite(PASSWORD)).toBeNull();
  });
});
