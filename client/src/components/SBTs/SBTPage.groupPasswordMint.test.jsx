import { ethers } from 'ethers';
import SBTPage from './SBTPage';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import {
  createReadCachePayload,
  createSubject as createLoadingSubject,
  setupSBTPageTestLifecycle,
} from './SBTPage.testUtils';
import { notify } from '../../utilities/ui/notify.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { useFastGroupPasswordKdf } from '../../utilities/crypto/groupPasswordKdf.testUtils';
import { SBT_GROUP_PASSWORD_MISMATCH_MESSAGE } from './sbtClaimUrlSafety';

const SBT_ADDRESS = '0x0000000000000000000000000000000000000114';
const ACCOUNT = '0x0000000000000000000000000000000000000abc';

const createSubject = (props = {}) => {
  const subject = new SBTPage({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock',
    SBTAddress: SBT_ADDRESS,
    account: ACCOUNT,
    loginComplete: true,
    sessionSlug: 'edge',
    ...props,
  });
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  subject.isMintTargetContextCurrent = jest.fn(() => true);
  subject.completeMintSuccessForTarget = jest.fn();
  return subject;
};

describe('SBTPage group-password mint', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks the password and signs in one derivation while showing a busy state', async () => {
    const subject = createSubject();
    const onchainHash = `0x${'22'.repeat(32)}`;
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(onchainHash);
    const checkingDuringSign = [];
    const sign = jest.spyOn(contractScripts, 'signGroupMintAuthorization').mockImplementation(async () => {
      checkingDuringSign.push(subject.state.groupPasswordChecking);
      return '0xsig';
    });
    const mint = jest.spyOn(contractScripts, 'mintWithGroupSignature').mockResolvedValue({ transactionHash: '0xmint' });

    await expect(
      subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'orbit-maple-signal-tunnel-quartz' }),
    ).resolves.toBe(true);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'orbit-maple-signal-tunnel-quartz',
        sbtAddress: SBT_ADDRESS,
        userAddress: ACCOUNT,
        groupPasswordHash: onchainHash,
      }),
    );
    expect(checkingDuringSign).toEqual([true]);
    expect(subject.state.groupPasswordChecking).toBe(false);
    expect(mint).toHaveBeenCalledWith('mock', SBT_ADDRESS, '0xsig');
  });

  it('explains the pre-0.6.8 password format when the password does not match', async () => {
    useFastGroupPasswordKdf();
    const subject = createSubject();
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(`0x${'33'.repeat(32)}`);
    const mint = jest.spyOn(contractScripts, 'mintWithGroupSignature');
    const toast = jest.spyOn(notify, 'error');

    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'wrong-password' })).resolves.toBe(false);

    expect(mint).not.toHaveBeenCalled();
    expect(subject.state).toMatchObject({
      error: SBT_GROUP_PASSWORD_MISMATCH_MESSAGE,
      mintingStatus: 'failure',
      groupPasswordChecking: false,
    });
    // A plain typo must not read as "this group needs recreating".
    expect(SBT_GROUP_PASSWORD_MISMATCH_MESSAGE).toMatch(
      /^Incorrect group password\. If this group was created before Context Engine 0\.6\.8, /,
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('raises the mismatch hint as a toast on mini cards, which only show "failed"', async () => {
    useFastGroupPasswordKdf();
    const subject = createSubject({ miniaturized: true });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(`0x${'33'.repeat(32)}`);
    const toast = jest.spyOn(notify, 'error').mockImplementation(() => undefined);

    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'wrong-password' })).resolves.toBe(false);

    expect(toast).toHaveBeenCalledWith(SBT_GROUP_PASSWORD_MISMATCH_MESSAGE);
  });

  it('shows the WebCrypto message when this origin cannot check group passwords', async () => {
    const subject = createSubject();
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(`0x${'22'.repeat(32)}`);
    const mint = jest.spyOn(contractScripts, 'mintWithGroupSignature');
    const original = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true, writable: true });
    try {
      await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'any-password' })).resolves.toBe(false);
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', original);
    }

    expect(mint).not.toHaveBeenCalled();
    expect(subject.state.mintingStatus).toBe('failure');
    expect(subject.state.error).toMatch(/Group passwords need WebCrypto/);
  });

  it('reports an unreadable password check as a read failure that can be retried', async () => {
    const { importKey } = useFastGroupPasswordKdf();
    const password = 'orbit-maple-signal-tunnel-quartz';
    const subject = createSubject();
    const read = jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValueOnce(null);
    const mint = jest.spyOn(contractScripts, 'mintWithGroupSignature').mockResolvedValue({ transactionHash: '0xmint' });

    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: password })).resolves.toBe(false);

    expect(subject.state).toMatchObject({
      error: "Could not read this group's password check from the chain. Check the network and try again.",
      mintingStatus: 'failure',
    });
    expect(importKey).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();

    read.mockResolvedValueOnce(await cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: SBT_ADDRESS }));
    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: password })).resolves.toBe(true);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('still says a group with a zero hash does not support group-password joins', async () => {
    const subject = createSubject();
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(`0x${'00'.repeat(32)}`);
    const sign = jest.spyOn(contractScripts, 'signGroupMintAuthorization');

    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'any-password' })).resolves.toBe(false);

    expect(sign).not.toHaveBeenCalled();
    expect(subject.state.error).toMatch(/does not support group-password signature/);
  });

  it('keeps other signing failures on the generic claim message', async () => {
    const subject = createSubject();
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(`0x${'22'.repeat(32)}`);
    jest.spyOn(contractScripts, 'signGroupMintAuthorization').mockRejectedValue(new Error('provider detail'));

    await expect(subject.mintUnlimitedWithGroupPassword({ passwordOverride: 'any-password' })).resolves.toBe(false);

    expect(subject.state.error).not.toBe(SBT_GROUP_PASSWORD_MISMATCH_MESSAGE);
    expect(subject.state.groupPasswordChecking).toBe(false);
  });
});

describe('SBTPage group-password check on load', () => {
  setupSBTPageTestLifecycle();

  it('keeps a failed hash read unknown, never open, and reads it again on Retry', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000c1';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(
      createReadCachePayload({
        sbtAddress,
        countsLoaded: true,
        sbtInfoOverrides: { name: 'Password Badge', sessionSlug: 'edge', sessionSlugExplicit: true },
      }),
    );
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(null);
    const read = jest
      .spyOn(contractScripts, 'getGroupPasswordHash')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ethers.constants.HashZero);
    const subject = createLoadingSubject({
      SBTAddress: sbtAddress,
      isSBTCacheReady: true,
      refreshSbtData: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
    });
    subject.state = { ...subject.state, network: { id: 84532, name: 'Base Sepolia' } };
    subject.fetchHolderAddressesByTokenOwnership = jest.fn();

    await subject.loadSBTInfo({ preferCountsOnly: true });

    expect(subject.state).toMatchObject({
      groupPasswordCheckUnreadable: true,
      groupPasswordHashLoaded: false,
      hasGroupPasswordMint: true,
    });

    await subject.retryGroupPasswordCheck();

    expect(read).toHaveBeenCalledTimes(2);
    expect(subject.state).toMatchObject({
      groupPasswordCheckUnreadable: false,
      groupPasswordHashLoaded: true,
      hasGroupPasswordMint: false,
    });
  });
});
