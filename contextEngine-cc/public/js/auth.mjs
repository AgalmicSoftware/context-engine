import { derivePortoWalletFromCredential } from '/porto-derivation.mjs';
import { apiLocal } from '/js/api.mjs';
import { normalizeConfiguredSessions } from '/js/sessionSlugs.mjs';
import {
  buildLocalJwtRequestBody,
  clearPrivateKey,
  getToken,
  setToken,
  signMessageWithAuthWallet,
  state,
} from '/js/state.mjs';
import { setStatus, show } from '/js/ui.mjs';

export function pluginDir() {
  return '~/.claude/plugins/contextEngine-cc';
}

export async function createPasskey() {
  if (!navigator.credentials) {
    throw new Error('WebAuthn not available. Use Chrome or Safari on localhost.');
  }
  setStatus('auth-status', 'Creating passkey...', '');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
    .replace(/[:\s]/g, '');
  const uniqueName = `ContextEngine-claude-code-${month}${day}-${year}-${time}`;

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Context Engine', id: window.location.hostname },
      user: {
        id: Uint8Array.from(uniqueName, (char) => char.charCodeAt(0)),
        name: uniqueName,
        displayName: uniqueName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
      },
      attestation: 'none',
      timeout: 60000,
    },
  });

  return derivePortoWalletFromCredential(credential);
}

export async function loginPasskey() {
  if (!navigator.credentials) {
    throw new Error('WebAuthn not available. Use Chrome or Safari on localhost.');
  }
  setStatus('auth-status', 'Signing in...', '');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      userVerification: 'preferred',
      allowCredentials: [],
      timeout: 60000,
    },
  });

  return derivePortoWalletFromCredential(assertion);
}

export function buildSessionAuthMessage({ address, nonce, chainId, domain, uri }) {
  const now = new Date();
  const issuedAt = now.toISOString();
  const exp = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Context Engine.',
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${exp}`,
  ].join('\n');
}

export async function signIntoSession(workerUrl, sessionSlug) {
  const normalizedWorkerUrl = String(workerUrl || '').replace(/\/+$/, '');
  const address = state.walletAddress;
  if (!address) {
    throw new Error('Wallet not connected. Sign in again.');
  }

  setStatus('session-auth-status', 'Preparing session sign-in...', '');
  const nonceRes = await fetch(`${normalizedWorkerUrl}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, sessionSlug, groupSlug: sessionSlug }),
  });
  const nonceData = await nonceRes.json();
  if (!nonceData.nonce) throw new Error(nonceData.error || 'Failed to get nonce');

  setStatus('session-auth-status', 'Confirming session sign-in...', '');
  const runtimeChainId = Number(state.hookConfig?.chainId || 11155420) || 11155420;
  const message = buildSessionAuthMessage({
    address,
    nonce: nonceData.nonce,
    chainId: runtimeChainId,
    domain: new URL(normalizedWorkerUrl).host,
    uri: normalizedWorkerUrl,
  });
  const signature = await signMessageWithAuthWallet(message);

  setStatus('session-auth-status', 'Completing session sign-in...', '');
  const loginRes = await fetch(`${normalizedWorkerUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature, sessionSlug, groupSlug: sessionSlug }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) throw new Error(loginData.error || 'Login failed');

  return { token: loginData.token, exp: loginData.exp };
}

function formatAutoInstallFallbackMessage(authResult) {
  const fallbackPath = authResult?.autoInstallPath || `${pluginDir()}/.state/token.jwt`;
  const extra = String(authResult?.autoInstallError || '').trim();
  if (/EPERM|EACCES|operation not permitted|permission denied/i.test(extra)) {
    return `Claude Code couldn't save the token automatically at ${fallbackPath}. Use Copy, Download, or CLI below.`;
  }
  return `Claude Code token install needs a manual fallback at ${fallbackPath}.${extra ? ` ${extra}` : ''}`;
}

export async function ensureLocalToken() {
  if (getToken()) {
    try {
      state.hookConfig = await apiLocal('/api/config');
      state.selectedSessions = normalizeConfiguredSessions({
        selectedSessions: state.hookConfig?.selectedSessions,
        defaultSession: state.hookConfig?.defaultSession,
      });
    } catch {
      state.hookConfig = {};
    }
    return state.localJwtResult || null;
  }
  const response = await apiLocal('/api/auth/local-jwt', {
    method: 'POST',
    body: buildLocalJwtRequestBody(),
  });
  if (response.token) {
    setToken(response.token);
    clearPrivateKey();
  }
  state.localJwtResult = response;
  try {
    state.hookConfig = await apiLocal('/api/config');
    state.selectedSessions = normalizeConfiguredSessions({
      selectedSessions: state.hookConfig?.selectedSessions,
      defaultSession: state.hookConfig?.defaultSession,
    });
  } catch {
    state.hookConfig = {};
  }
  return response;
}

export async function showSessionSelect({ loadSessionOptions }) {
  document.getElementById('wallet-preview').textContent = state.walletAddress || '';
  show('screen-session-select');
  await ensureLocalToken();
  if (typeof loadSessionOptions === 'function') {
    await loadSessionOptions();
  }
}

export async function showTokenScreen({ updatePendingBadge, notice = '', noticeType = 'success' } = {}) {
  const authResult = await ensureLocalToken();
  document.getElementById('wallet-display').textContent = state.walletAddress || 'unknown';
  document.getElementById('token-display').textContent = getToken();

  if (notice) {
    setStatus('link-status', notice, noticeType);
  } else if (authResult?.autoInstallConfigured) {
    if (authResult.autoInstalled) {
      setStatus('link-status', '✓ Linked to Claude Code. Return to Claude and press q for question.', 'success');
    } else {
      setStatus('link-status', formatAutoInstallFallbackMessage(authResult), 'error');
    }
  } else if (state.hookConfig?.autoCli === false) {
    setStatus('link-status', 'Auto-install is off. Use the manual fallback buttons if needed.', '');
  }

  show('screen-token');
  if (typeof updatePendingBadge === 'function') {
    updatePendingBadge().catch(() => {});
  }
}
