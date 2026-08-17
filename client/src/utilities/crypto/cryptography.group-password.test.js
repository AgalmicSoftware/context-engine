import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography.js';
import * as groupPasswordDerivation from './groupPasswordDerivation.cjs';

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
    });
    const messageHash = cryptoUtils.computeGroupMintMessageHash(SBT_A, USER);
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
      walletScopeSbtAddress: '',
    });

    expect(
      cryptoUtils.verifyInviteSignature({
        sbtAddress: SBT_A,
        nonce: '1',
        signature,
        groupPasswordHash: zeroScopedHash,
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    expect(
      cryptoUtils.verifyInviteSignature({
        sbtAddress: SBT_A,
        nonce: '1',
        signature,
        groupPasswordHash: scopedHash,
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });
});
