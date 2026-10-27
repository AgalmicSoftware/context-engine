import { json } from './httpInput.mjs';
const headers = (_request, env) => env?.AGENT_CONTEXT?.headers || {};

export const sessionMetaCorsHeaders = headers;

const corsJson = (request, env, data, init = {}) => {
  const merged = new Headers(headers(request, env));
  new Headers(init.headers).forEach((value, key) => merged.set(key, value));
  return json(data, { ...init, headers: merged });
};

export const jsonResultViewCache = corsJson;
export const jsonSessionMeta = corsJson;
