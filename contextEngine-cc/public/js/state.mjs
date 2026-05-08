import { normalizeActiveSessions } from '/js/sessionSlugs.mjs';
import {
  clearBrowserAuthState,
  isJwtExpired,
  loadBrowserAuthState,
  saveBrowserAuthState,
} from '/js/browserAuthStorage.mjs';

export const state = {
  walletAddress: null,
  selectedSessions: [],
  currentSession: null,
  seenIds: [],
  currentQuestion: null,
  currentQuestionGateOptions: [],
  currentQuestionDefaultGateId: '',
  hookConfig: {},
  _pendingResponses: [],
  localJwtResult: null,
};

let token = null;
let privateKey = null;
let wallet = null;

function syncBrowserAuthStorage() {
  try {
    saveBrowserAuthState({
      token: token || '',
      walletAddress: state.walletAddress || '',
    });
  } catch {}
}

function buildWallet(nextPrivateKey) {
  if (!nextPrivateKey) {
    return null;
  }
  const WalletCtor = globalThis.window?.ethers?.Wallet || globalThis.ethers?.Wallet;
  if (!WalletCtor) {
    throw new Error('Wallet signer unavailable. Reload and try again.');
  }
  return new WalletCtor(nextPrivateKey);
}

export function setAuthCredentials({ walletAddress, privateKey: nextPrivateKey }) {
  state.walletAddress = walletAddress || null;
  privateKey = nextPrivateKey || null;
  wallet = null;
  syncBrowserAuthStorage();
}

export function buildLocalJwtRequestBody() {
  if (!state.walletAddress || !privateKey) {
    throw new Error('Missing local auth credentials. Sign in again.');
  }
  return JSON.stringify({
    walletAddress: state.walletAddress,
    privateKey,
  });
}

export function clearPrivateKey() {
  if (!wallet && privateKey) {
    wallet = buildWallet(privateKey);
  }
  privateKey = null;
}

export function getToken() {
  if (isJwtExpired(token)) {
    token = null;
    clearBrowserAuthState();
    return '';
  }
  return token || '';
}

export function setToken(nextToken) {
  token = nextToken || null;
  syncBrowserAuthStorage();
}

export function getAuthHeaders() {
  const activeToken = getToken();
  return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
}

export async function signMessageWithAuthWallet(message) {
  if (!wallet && privateKey) {
    wallet = buildWallet(privateKey);
  }
  if (!wallet) {
    throw new Error('Passkey signer unavailable. Sign in again.');
  }
  return wallet.signMessage(message);
}

export function resetAuthState() {
  token = null;
  state.walletAddress = null;
  privateKey = null;
  wallet = null;
  state.selectedSessions = [];
  state.currentSession = null;
  state.seenIds = [];
  state.currentQuestion = null;
  state.currentQuestionGateOptions = [];
  state.currentQuestionDefaultGateId = '';
  state._pendingResponses = [];
  state.localJwtResult = null;
  try {
    clearBrowserAuthState();
  } catch {}
}

export function getActiveSessions() {
  return normalizeActiveSessions({
    selectedSessions: state.selectedSessions,
    currentSession: state.currentSession,
  });
}

export function hydrateBrowserAuthState() {
  try {
    const restored = loadBrowserAuthState();
    token = restored.token || null;
    state.walletAddress = restored.walletAddress || null;
    return restored;
  } catch {
    try {
      clearBrowserAuthState();
    } catch {}
    return { restored: false };
  }
}
