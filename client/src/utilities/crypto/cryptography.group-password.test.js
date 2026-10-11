import { pbkdf2Sync } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography.js';
import groupPasswordDerivation from './groupPasswordDerivation.cjs';
import { useFastGroupPasswordKdf as useFastKdf } from './groupPasswordKdf.testUtils';

const PASSWORD = 'shared-secret';
const SBT_A = '0x00000000000000000000000000000000000000a1';
const SBT_B = '0x00000000000000000000000000000000000000b2';
const USER = '0x00000000000000000000000000000000000000c3';
const CHAIN_ID = 11155420;

// Known answer for the real 600,000-iteration PBKDF2-SHA256 derivation.
const KAT_PASSWORD = 'orbit-maple-signal-tunnel-quartz';
const KAT_SIGNER = '0xf49eCc54682aa8B38c45D571922fF284170e1AeB';
const KAT_HASH = ethers.utils.solidityKeccak256(['address'], [KAT_SIGNER]);

const signerHashOf = (messageHash, signature) =>
  ethers.utils.solidityKeccak256(
    ['address'],
    [ethers.utils.verifyMessage(ethers.utils.arrayify(messageHash), signature)],
  );

afterEach(() => {
  jest.restoreAllMocks();
});

describe('group password derivation v4 (real KDF)', () => {
  it('derives the pinned signer, matching an independent PBKDF2 computation', async () => {
    const salt = ethers.utils.arrayify(
      ethers.utils.solidityKeccak256(['string', 'address'], ['sbt-group-password-v4', ethers.utils.getAddress(SBT_A)]),
    );
    const bits = pbkdf2Sync(Buffer.from(KAT_PASSWORD, 'utf8'), Buffer.from(salt), 600000, 32, 'sha256');
    expect(new ethers.Wallet(ethers.utils.keccak256(bits)).address).toBe(KAT_SIGNER);

    await expect(cryptoUtils.computeGroupPasswordHash({ password: KAT_PASSWORD, sbtAddress: SBT_A })).resolves.toBe(
      KAT_HASH,
    );
  });

  it('signs group mints and invites with the v4 signer', async () => {
    const mintSignature = await cryptoUtils.signGroupMintAuthorization({
      password: KAT_PASSWORD,
      sbtAddress: SBT_A,
      userAddress: USER,
      chainId: CHAIN_ID,
      groupPasswordHash: KAT_HASH,
    });
    const [inviteSignature] = await cryptoUtils.signInvites({
      password: KAT_PASSWORD,
      sbtAddress: SBT_A,
      nonces: ['1'],
      chainId: CHAIN_ID,
    });

    expect(signerHashOf(cryptoUtils.computeGroupMintMessageHash(SBT_A, USER, CHAIN_ID), mintSignature)).toBe(KAT_HASH);
    expect(
      cryptoUtils.verifyInviteSignature({
        sbtAddress: SBT_A,
        nonce: '1',
        chainId: CHAIN_ID,
        signature: inviteSignature,
        groupPasswordHash: KAT_HASH,
      }),
    ).toEqual({ ok: true, signer: KAT_SIGNER });
  });
});

describe('group password derivation v4 inputs', () => {
  it.each([
    '',
    undefined,
    null,
    ethers.constants.AddressZero,
    'not-an-address',
    '0xF49eCc54682aa8B38c45D571922fF284170e1AeB',
  ])('requires a valid non-zero SBT address scope (%s)', async (sbtAddress) => {
    const { importKey } = useFastKdf();
    await expect(cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress })).rejects.toThrow(
      'needs the SBT contract address',
    );
    expect(importKey).not.toHaveBeenCalled();
  });

  it.each(['', undefined, 42])('rejects an empty or non-text password (%s)', async (password) => {
    const { importKey } = useFastKdf();
    await expect(cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: SBT_A })).rejects.toThrow(
      'A group password is required.',
    );
    expect(importKey).not.toHaveBeenCalled();
  });

  it('treats NFKC-equivalent passwords as the same password', async () => {
    useFastKdf();
    const hash = (password) => cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: SBT_A });

    expect(await hash('café-pass')).toBe(await hash('café-pass'));
    expect(await hash('ｐａｓｓｗｏｒｄ')).toBe(await hash('password'));
    expect(await hash('password')).not.toBe(await hash('passw0rd'));
  });

  it('scopes the same password to each SBT and accepts any address casing', async () => {
    useFastKdf();
    const hashA = await cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });

    expect(await cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_B })).not.toBe(hashA);
    expect(
      await cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: ethers.utils.getAddress(SBT_A) }),
    ).toBe(hashA);
  });

  it('derives again on every call instead of caching keys', async () => {
    const { deriveBits } = useFastKdf();
    await cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });
    await cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A });

    expect(deriveBits).toHaveBeenCalledTimes(2);
    expect(deriveBits.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }),
    );
  });

  it('fails clearly when WebCrypto is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true, writable: true });
    try {
      await expect(cryptoUtils.computeGroupPasswordHash({ password: PASSWORD, sbtAddress: SBT_A })).rejects.toThrow(
        'WebCrypto',
      );
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', original);
    }
  });

  it('exposes only the v4 derivation from the shared CommonJS module', () => {
    const derivation = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

    expect(derivation.derivation).toBe('sbt-group-password-v4');
    expect(Object.keys(derivation).sort()).toEqual([
      'computeGroupPasswordHash',
      'derivation',
      'deriveGroupPasswordWallet',
    ]);
  });
});

describe('SBT authorization signing', () => {
  const input = { password: PASSWORD, sbtAddress: SBT_A, chainId: CHAIN_ID };

  it('stops before signing when the password does not derive the on-chain hash', async () => {
    useFastKdf();
    const otherHash = await cryptoUtils.computeGroupPasswordHash({ password: 'another-secret', sbtAddress: SBT_A });

    const mintError = await cryptoUtils
      .signGroupMintAuthorization({ ...input, userAddress: USER, groupPasswordHash: otherHash })
      .catch((error) => error);
    const inviteError = await cryptoUtils
      .signInvites({ ...input, nonces: ['1'], groupPasswordHash: otherHash })
      .catch((error) => error);

    expect(cryptoUtils.isGroupPasswordMismatchError(mintError)).toBe(true);
    expect(cryptoUtils.isGroupPasswordMismatchError(inviteError)).toBe(true);
    expect(cryptoUtils.isGroupPasswordMismatchError(new Error('other'))).toBe(false);
  });

  it('signs every invite slot from a single derivation', async () => {
    const { deriveBits } = useFastKdf();
    const groupPasswordHash = await cryptoUtils.computeGroupPasswordHash(input);
    deriveBits.mockClear();

    const signatures = await cryptoUtils.signInvites({ ...input, nonces: ['1', 2, '3'], groupPasswordHash });

    expect(deriveBits).toHaveBeenCalledTimes(1);
    expect(signatures).toHaveLength(3);
    signatures.forEach((signature, index) => {
      expect(
        cryptoUtils.verifyInviteSignature({ ...input, nonce: String(index + 1), signature, groupPasswordHash }).ok,
      ).toBe(true);
    });
  });

  it('binds invite signatures to their chain, collection and independent slot', async () => {
    useFastKdf();
    const [signature] = await cryptoUtils.signInvites({ ...input, nonces: ['2'] });
    const groupPasswordHash = await cryptoUtils.computeGroupPasswordHash(input);
    const signed = { ...input, nonce: '2', signature, groupPasswordHash };
    expect(cryptoUtils.verifyInviteSignature(signed).ok).toBe(true);
    for (const change of [{ chainId: CHAIN_ID + 1 }, { sbtAddress: SBT_B }, { nonce: '1' }]) {
      expect(cryptoUtils.verifyInviteSignature({ ...signed, ...change }).ok).toBe(false);
    }
  });

  it('binds group signatures to chain and claimant with an explicit protocol domain', async () => {
    useFastKdf();
    const signature = await cryptoUtils.signGroupMintAuthorization({ ...input, userAddress: USER });
    const expected = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256', 'address', 'address'],
        [ethers.utils.id('ContextEngine.SBT.GroupMint:1'), CHAIN_ID, SBT_A, USER],
      ),
    );
    expect(signerHashOf(expected, signature)).toBe(await cryptoUtils.computeGroupPasswordHash(input));
  });

  it('rejects old unscoped invite signatures and separates claim kinds', async () => {
    useFastKdf();
    const wallet = await groupPasswordDerivation
      .createGroupPasswordDerivation(ethers)
      .deriveGroupPasswordWallet({ password: PASSWORD, sbtAddress: SBT_A });
    const unscoped = ethers.utils.solidityKeccak256(['address', 'uint256'], [SBT_A, '2']);
    const signature = await wallet.signMessage(ethers.utils.arrayify(unscoped));
    expect(
      cryptoUtils.verifyInviteSignature({
        ...input,
        nonce: '2',
        signature,
        groupPasswordHash: await cryptoUtils.computeGroupPasswordHash(input),
      }).ok,
    ).toBe(false);
    expect(
      cryptoUtils.computeGroupMintMessageHash(SBT_A, '0x0000000000000000000000000000000000000002', CHAIN_ID),
    ).not.toBe(cryptoUtils.buildInviteMessageHash({ ...input, nonce: '2' }));
  });

  it.each([undefined, 0, -1, 1.5, 'invalid'])('rejects invalid signing chain %s before deriving', async (chainId) => {
    const { importKey } = useFastKdf();
    await expect(cryptoUtils.signInvites({ ...input, nonces: ['2'], chainId })).rejects.toThrow();
    expect(importKey).not.toHaveBeenCalled();
  });

  it('requires at least one invite slot', async () => {
    useFastKdf();
    await expect(cryptoUtils.signInvites({ ...input, nonces: [] })).rejects.toThrow('at least one slot');
  });

  it('decodes only scoped signed invite payloads and rejects reusable secrets', async () => {
    useFastKdf();
    const [signature] = await cryptoUtils.signInvites({ ...input, nonces: ['2'] });
    const payload = { c: String(CHAIN_ID), a: SBT_A, n: '2', s: signature };
    expect(cryptoUtils.decodeInvite(cryptoUtils.encodeInvite(payload))).toEqual({
      chainId: String(CHAIN_ID),
      sbtAddress: ethers.utils.getAddress(SBT_A),
      nonce: '2',
      signature,
    });
    for (const invalid of [
      { n: '2', s: signature },
      { ...payload, c: 0 },
      { ...payload, a: ethers.constants.AddressZero },
      { ...payload, n: 0 },
      { ...payload, s: '0x00' },
      { ...payload, password: PASSWORD },
    ]) {
      expect(cryptoUtils.decodeInvite(cryptoUtils.encodeInvite(invalid))).toBeNull();
    }
    expect(cryptoUtils.decodeInvite(PASSWORD)).toBeNull();
  });
});
