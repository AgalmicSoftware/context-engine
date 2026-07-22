import { ethers } from 'ethers';
import { TESTNET_AUTO_SEND_THRESHOLD_ETH } from '../../variables/appConfig.js';
import { createLogger } from '../../utilities/logging.js';

const accountLog = createLogger('account');

type AutoSendState = {
  autoRequestTestnetFundsEnabled: boolean;
  autoSendTriggered: boolean;
  sendingTestFunds: boolean;
  walletBalanceWei: ethers.BigNumber | null;
};

type AutoSendDeps = {
  autoSendTestFunds: () => void;
  getActiveSessionConfig: () => unknown;
  loginComplete: boolean;
  setState: (patch: Partial<AutoSendState>) => void;
  state: AutoSendState;
  syncWalletBalance: () => Promise<{ balance: ethers.BigNumber | null; stale: boolean }>;
  walletAccount: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const isWorkerCanonicalSessionConfig = (sessionConfig: unknown): boolean => {
  const sessionModeProfile = asRecord(asRecord(sessionConfig).sessionModeProfile);
  return asRecord(sessionModeProfile.authority).mode === 'worker_canonical';
};

const clearAutoSendState = (state: AutoSendState, setState: AutoSendDeps['setState']) => {
  const resetState: Partial<AutoSendState> = {};
  if (state.autoSendTriggered) resetState.autoSendTriggered = false;
  if (state.walletBalanceWei !== null) resetState.walletBalanceWei = null;
  if (Object.keys(resetState).length) setState(resetState);
};

export const runLoginTestFundsAutoSend = async ({
  autoSendTestFunds,
  getActiveSessionConfig,
  loginComplete,
  setState,
  state,
  syncWalletBalance,
  walletAccount,
}: AutoSendDeps): Promise<void> => {
  if (!loginComplete || !walletAccount) {
    clearAutoSendState(state, setState);
    return;
  }
  if (isWorkerCanonicalSessionConfig(getActiveSessionConfig())) {
    clearAutoSendState(state, setState);
    return;
  }

  const { balance: currentBalance, stale } = await syncWalletBalance();
  if (stale) return;
  if (!state.autoRequestTestnetFundsEnabled) {
    if (state.autoSendTriggered) setState({ autoSendTriggered: false });
    return;
  }

  let shouldTrigger = false;
  try {
    if (currentBalance != null) {
      shouldTrigger = currentBalance.lte(ethers.utils.parseEther(TESTNET_AUTO_SEND_THRESHOLD_ETH));
    }
  } catch (error) {
    accountLog.error('Error parsing wallet balance in auto-send check:', error);
  }

  if (shouldTrigger && !state.sendingTestFunds && !state.autoSendTriggered) autoSendTestFunds();
  if (state.autoSendTriggered !== shouldTrigger) setState({ autoSendTriggered: shouldTrigger });
};
