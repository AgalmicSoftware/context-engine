export const DEFAULT_PORT = 7391;
export const DEFAULT_HOST = '127.0.0.1';

export function resolvePort(rawPort = process.env.PORT) {
  const parsed = Number(rawPort);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

export function resolveHost(rawHost = process.env.HOST) {
  const value = String(rawHost || '').trim();
  return value || DEFAULT_HOST;
}

export function getSignInUrl({ port = DEFAULT_PORT } = {}) {
  return `http://localhost:${port}`;
}

export function formatReadyMessage({ port = DEFAULT_PORT } = {}) {
  return `[contextEngine-cc] Ready. Sign in with passkey: ${getSignInUrl({ port })}`;
}

export function formatAlreadyRunningMessage({ port = DEFAULT_PORT } = {}) {
  return `[contextEngine-cc] Already running. Sign in with passkey: ${getSignInUrl({ port })}`;
}

export function formatPortInUseMessage({ port = DEFAULT_PORT } = {}) {
  return `[contextEngine-cc] Port ${port} is already in use by another process. If Context Engine CC is already running, open ${getSignInUrl({ port })}.`;
}

export async function probeContextEngineServer({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  fetchImpl = globalThis.fetch,
  timeoutMs = 1500,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`http://${host}:${port}/`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    const html = await response.text();
    return response.ok && /<title>\s*Context Engine CC\s*<\/title>/i.test(html);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
