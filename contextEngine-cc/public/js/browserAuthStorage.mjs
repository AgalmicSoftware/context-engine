export const BROWSER_AUTH_STORAGE_KEY = 'contextengine-cc-browser-auth';

export function isJwtExpired(token) {
  if (!token) return true;
  try {
    const segments = String(token).split('.');
    let payloadSegment;
    if (segments.length === 2) {
      payloadSegment = segments[0];
    } else if (segments.length === 3) {
      payloadSegment = segments[1];
    } else {
      return true;
    }
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp);
    return !Number.isFinite(exp) || Date.now() / 1000 >= exp + 30;
  } catch {
    return true;
  }
}

export function loadBrowserAuthState(storage = globalThis.localStorage) {
  if (!storage) return { restored: false, token: '', walletAddress: '' };
  try {
    const raw = storage.getItem(BROWSER_AUTH_STORAGE_KEY);
    if (!raw) return { restored: false, token: '', walletAddress: '' };
    const parsed = JSON.parse(raw);
    const token = String(parsed?.token || '').trim();
    const walletAddress = String(parsed?.walletAddress || '').trim();
    if (isJwtExpired(token)) {
      storage.removeItem(BROWSER_AUTH_STORAGE_KEY);
      return { restored: false, token: '', walletAddress: '' };
    }
    return {
      restored: !!token,
      token,
      walletAddress,
    };
  } catch {
    try {
      storage.removeItem(BROWSER_AUTH_STORAGE_KEY);
    } catch {}
    return { restored: false, token: '', walletAddress: '' };
  }
}

export function saveBrowserAuthState({ token = '', walletAddress = '' } = {}, storage = globalThis.localStorage) {
  if (!storage) return;
  const normalizedToken = String(token || '').trim();
  const normalizedWallet = String(walletAddress || '').trim();

  if (!normalizedToken && !normalizedWallet) {
    storage.removeItem(BROWSER_AUTH_STORAGE_KEY);
    return;
  }

  storage.setItem(BROWSER_AUTH_STORAGE_KEY, JSON.stringify({
    token: normalizedToken,
    walletAddress: normalizedWallet,
  }));
}

export function clearBrowserAuthState(storage = globalThis.localStorage) {
  if (!storage) return;
  storage.removeItem(BROWSER_AUTH_STORAGE_KEY);
}
