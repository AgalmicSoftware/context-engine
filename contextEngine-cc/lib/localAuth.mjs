import { verifyJwt } from './jwt.mjs';

export function extractBearer(req = {}) {
  const auth = req.headers?.authorization || '';
  const match = String(auth).match(/^bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function requireLocalJwtAuth(req = {}, { verify = verifyJwt } = {}) {
  const token = extractBearer(req);
  if (!token) return { ok: false, status: 401, error: 'Missing Authorization header.' };

  const localResult = verify(token);
  if (localResult.ok) return { ok: true, payload: localResult.payload };
  return { ok: false, status: 401, error: localResult.error };
}
