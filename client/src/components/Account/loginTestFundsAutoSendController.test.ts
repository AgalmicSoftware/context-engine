import { ethers } from 'ethers';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { runLoginTestFundsAutoSend } from './loginTestFundsAutoSendController';

const buildState = () => ({
  autoRequestTestnetFundsEnabled: true,
  autoSendTriggered: false,
  sendingTestFunds: false,
  walletBalanceWei: null,
});

describe('runLoginTestFundsAutoSend', () => {
  it('does not read a balance or fund a pure Worker session with a legacy chain field', async () => {
    const state = buildState();
    const syncWalletBalance = jest.fn(async () => ({ balance: ethers.BigNumber.from(0), stale: false }));
    const autoSendTestFunds = jest.fn();

    await runLoginTestFundsAutoSend({
      autoSendTestFunds,
      getActiveSessionConfig: () => ({
        networkChainId: 11155420,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      loginComplete: true,
      setState: jest.fn(),
      state,
      syncWalletBalance,
      walletAccount: '0x00000000000000000000000000000000000000aa',
    });

    expect(syncWalletBalance).not.toHaveBeenCalled();
    expect(autoSendTestFunds).not.toHaveBeenCalled();
  });

  it('fails closed for an invalid profile that claims Worker authority', async () => {
    const syncWalletBalance = jest.fn(async () => ({ balance: ethers.BigNumber.from(0), stale: false }));

    await runLoginTestFundsAutoSend({
      autoSendTestFunds: jest.fn(),
      getActiveSessionConfig: () => ({
        sessionModeProfile: {
          profileVersion: 999,
          authority: { mode: 'worker_canonical' },
        },
      }),
      loginComplete: true,
      setState: jest.fn(),
      state: buildState(),
      syncWalletBalance,
      walletAccount: '0x00000000000000000000000000000000000000aa',
    });

    expect(syncWalletBalance).not.toHaveBeenCalled();
  });

  it('abandons a hosted funding check if faucet presence changes during the balance read', async () => {
    let finishBalance!: (value: { balance: ethers.BigNumber; stale: boolean }) => void;
    let presence = { txGas: true };
    const autoSendTestFunds = jest.fn();
    const pending = runLoginTestFundsAutoSend({
      autoSendTestFunds,
      getActiveSessionConfig: () => ({
        networkChainId: 11155420,
        workerAuthority: { participantScopes: ['faucet'] },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      getWorkerResourcePresence: () => presence,
      loginComplete: true,
      setState: jest.fn(),
      state: buildState(),
      syncWalletBalance: () =>
        new Promise((resolve) => {
          finishBalance = resolve;
        }),
      walletAccount: '0x00000000000000000000000000000000000000aa',
    });
    presence = { txGas: false };
    finishBalance({ balance: ethers.BigNumber.from(0), stale: false });
    await pending;
    expect(autoSendTestFunds).not.toHaveBeenCalled();
  });

  it('preserves automatic funding for a valid registry-canonical session', async () => {
    const state = buildState();
    const setState = jest.fn((patch) => Object.assign(state, patch));
    const autoSendTestFunds = jest.fn();
    const syncWalletBalance = jest.fn(async () => ({ balance: ethers.BigNumber.from(0), stale: false }));

    await runLoginTestFundsAutoSend({
      autoSendTestFunds,
      getActiveSessionConfig: () => ({
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      }),
      loginComplete: true,
      setState,
      state,
      syncWalletBalance,
      walletAccount: '0x00000000000000000000000000000000000000aa',
    });

    expect(syncWalletBalance).toHaveBeenCalledTimes(1);
    expect(autoSendTestFunds).toHaveBeenCalledTimes(1);
    expect(state.autoSendTriggered).toBe(true);
  });
});
