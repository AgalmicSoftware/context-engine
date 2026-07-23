import SBTPage from './SBTPage';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as sbtEncryptedRecoveryUi from './SbtEncryptedRecoveryControl';
import {
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  clearAllSbtPasswordRecoveryMemory,
  upsertSbtPasswordRecoveryCodes,
} from '../../utilities/sbt/sbtPasswordRecoveryStore.js';

const mockIsCryptoMode = jest.fn(() => true);

jest.mock('../../utilities/ui/terminology.js', () => {
  const actual = jest.requireActual('../../utilities/ui/terminology.js');
  return {
    __esModule: true,
    ...actual,
    isCryptoMode: (...args) => mockIsCryptoMode(...args),
  };
});

jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: jest.fn(() => ''),
}));

const createSubject = (props = {}) => {
  const subject = new SBTPage({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock',
    ...props,
  });
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

describe('SBTPage scoped password recovery store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearAllSbtPasswordRecoveryMemory();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads codes from the scoped tab-memory recovery store', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000201';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    upsertSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress, passwords: ['scoped-code'] });

    await subject.loadCachedPasswords();

    expect(subject.state.cachedPasswords).toEqual(['scoped-code']);
    expect(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it('prefers the viewed SBT chain over the connected network when loading tab-memory codes', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000203';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 11155420, name: 'OP Sepolia' },
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        chainID: 84532,
      },
    };
    upsertSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress, passwords: ['base-only-code'] });

    await subject.loadCachedPasswords();

    expect(subject.state.cachedPasswords).toEqual(['base-only-code']);
  });

  it('keeps admin-generated invite codes export-only by default', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000202';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    subject.state = {
      ...subject.state,
      passwordGenerationCount: 2,
    };
    jest.spyOn(subject, 'generateRandomPasswords').mockReturnValue(['admin-one', 'admin-two']);
    jest.spyOn(subject, 'cacheTransactionHash').mockImplementation(() => {});
    jest.spyOn(contractScripts, 'addHashedPasswords').mockResolvedValue({
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000202',
    });

    await subject.handleGenerateAdminInvites();

    expect(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(subject.state.adminGeneratedPasswords).toEqual(['admin-one', 'admin-two']);
    expect(subject.state.cachedPasswords).toEqual([]);
  });

  it('keeps admin-generated invite codes in tab memory when recovery is opted in', async () => {
    const subject = createSubject({
      SBTAddress: '0x0000000000000000000000000000000000000204',
      network: { id: 84532, name: 'Base Sepolia' },
    });
    subject.state = {
      ...subject.state,
      encryptedRecoveryEnabled: true,
      passwordGenerationCount: 1,
    };
    jest.spyOn(subject, 'generateRandomPasswords').mockReturnValue(['admin-encrypted']);
    jest.spyOn(subject, 'cacheTransactionHash').mockImplementation(() => {});
    const persist = jest
      .spyOn(sbtEncryptedRecoveryUi, 'appendEncryptedSbtRecovery')
      .mockResolvedValue({ ok: true, status: 'ok' });
    jest.spyOn(contractScripts, 'addHashedPasswords').mockResolvedValue({ transactionHash: '0x204' });

    await subject.handleGenerateAdminInvites();

    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ passwords: ['admin-encrypted'] }));
    expect(subject.state.encryptedRecoveryStatus).toBe('saved');
  });

  it('applies the tab-memory recovery snapshot', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000205';
    const subject = createSubject({ SBTAddress: sbtAddress, network: { id: 84532 } });
    jest.spyOn(sbtEncryptedRecoveryUi, 'loadSbtRecoverySnapshot').mockResolvedValue({
      cachedPasswords: ['memory-code'],
      encryptedRecoveryEnabled: true,
      encryptedRecoveryStatus: 'saved',
    });

    await subject.loadCachedPasswords();

    expect(subject.state.cachedPasswords).toEqual(['memory-code']);
    expect(subject.state.encryptedRecoveryEnabled).toBe(true);
    expect(subject.state.encryptedRecoveryStatus).toBe('saved');
  });
});
