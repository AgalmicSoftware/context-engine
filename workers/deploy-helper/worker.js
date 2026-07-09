// deploy-helper worker (trusted) for one-click ContextEngineSessionCorsWorker deploys

import {
  DEPLOY_HELPER_ORIGINS_KEY,
  executeDeployHelperRequest,
  lookupCloudflareAccount,
  normalizeOriginList,
  toStr,
} from '../shared/deployHelperCore.mjs';
import {
  resolveDeployHelperAllowList,
  resolveDeployHelperFallbackAllowList,
} from '../shared/deployHelperOrigins.mjs';
const isAdminAuthorized = (request, env) => {
  const adminSecret = toStr(env?.ADMIN_SECRET).trim();
  const authHeader = toStr(request.headers.get('Authorization')).trim();
  if (!adminSecret || !authHeader.startsWith('Bearer ')) return false;
  return authHeader.slice(7).trim() === adminSecret;
};

const originAllowed = (origin, allowList) => {
  if (!origin) return true;
  return allowList.includes(origin);
};

const corsHeaders = (origin, allowList) => new Headers({
  'Access-Control-Allow-Origin': origin && allowList.includes(origin) ? origin : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

const json = (data, status, baseHeaders) => {
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowListInfo = await resolveDeployHelperAllowList(env);
    const url = new URL(request.url);
    const allowList = url.pathname === '/admin/origins'
      ? normalizeOriginList([...allowListInfo.origins, ...resolveDeployHelperFallbackAllowList(env)])
      : allowListInfo.origins;
    const headers = corsHeaders(origin, allowList);
    if (request.method === 'OPTIONS') {
      if (!originAllowed(origin, allowList)) {
        return json({ error: 'Origin not allowed.' }, 403, headers);
      }
      return new Response(null, { status: 204, headers });
    }

    if (!originAllowed(origin, allowList)) {
      return json({ error: 'Origin not allowed.' }, 403, headers);
    }

    if (url.pathname === '/admin/origins') {
      if (!isAdminAuthorized(request, env)) {
        return json({ error: 'Admin authorization failed.' }, 401, headers);
      }
      if (request.method === 'GET') {
        return json(allowListInfo, 200, headers);
      }
      if (request.method === 'POST') {
        if (!env?.DEPLOY_HELPER_KV || typeof env.DEPLOY_HELPER_KV.put !== 'function' || typeof env.DEPLOY_HELPER_KV.delete !== 'function') {
          return json({ error: 'DEPLOY_HELPER_KV binding not configured.' }, 500, headers);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON.' }, 400, headers);
        }
        if (!Array.isArray(body?.origins)) {
          return json({ error: 'Invalid origins payload.' }, 400, headers);
        }
        const nextOrigins = normalizeOriginList(body.origins);
        if (nextOrigins.length) {
          await env.DEPLOY_HELPER_KV.put(DEPLOY_HELPER_ORIGINS_KEY, JSON.stringify(nextOrigins));
          return json({ origins: nextOrigins, source: 'kv' }, 200, headers);
        }
        await env.DEPLOY_HELPER_KV.delete(DEPLOY_HELPER_ORIGINS_KEY);
        const fallbackAllowList = await resolveDeployHelperAllowList(env);
        return json(fallbackAllowList, 200, headers);
      }
      return json({ error: 'Not found.' }, 404, headers);
    }

    if (url.pathname === '/account' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON.' }, 400, headers);
      }
      const apiToken = toStr(body?.apiToken || body?.token).trim();
      if (!apiToken) return json({ error: 'Missing apiToken.' }, 400, headers);
      const accountLookup = await lookupCloudflareAccount({ apiToken, env });
      if (!accountLookup.ok) {
        return json({
          error: accountLookup.error,
          detail: accountLookup.detail,
        }, 502, headers);
      }
      return json({
        accountId: accountLookup.accountId,
        accountName: accountLookup.accountName,
      }, 200, headers);
    }

    if (url.pathname !== '/deploy' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON.' }, 400, headers);
    }
    const deployResult = await executeDeployHelperRequest({
      body,
      env,
      requestOrigin: origin,
      consoleImpl: console,
    });
    return json(deployResult.body, deployResult.status, headers);
  },
};
