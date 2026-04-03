#!/usr/bin/env node

// Minimal local HTTP wrapper for the sessionCorsWorker so E2E scripts can run
// without a Cloudflare deployment (uses in-memory KV).

import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || process.env.WORKER_PORT || 8787);
const host = process.env.HOST || '127.0.0.1';

const tokenSecret = String(process.env.TOKEN_HMAC_SECRET || '').trim();
if (!tokenSecret) {
  console.error('Missing TOKEN_HMAC_SECRET. Example: TOKEN_HMAC_SECRET=dev-secret node scripts/dev-sessionCorsWorker-local.mjs');
  process.exit(1);
}

const { default: worker } = await import('../workers/sessionCorsWorker/worker.js');
if (!worker || typeof worker.fetch !== 'function') {
  console.error('Expected workers/sessionCorsWorker/worker.js to export default { fetch() }');
  process.exit(1);
}

const nowMs = () => Date.now();

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const hit = this.store.get(String(key));
    if (!hit) return null;
    if (hit.expiresAtMs && nowMs() >= hit.expiresAtMs) {
      this.store.delete(String(key));
      return null;
    }
    return hit.value;
  }

  async put(key, value, opts = {}) {
    const ttl = Number(opts?.expirationTtl || 0);
    const expiresAtMs = ttl > 0 ? nowMs() + ttl * 1000 : 0;
    this.store.set(String(key), { value: String(value), expiresAtMs });
  }

  async delete(key) {
    this.store.delete(String(key));
  }
}

const env = {
  GROUP_KV: new MemoryKv(),
  TOKEN_HMAC_SECRET: tokenSecret,
  DEFAULT_SESSION_SLUG: String(process.env.DEFAULT_SESSION_SLUG || '').trim(),
  DEFAULT_GROUP_SLUG: String(process.env.DEFAULT_GROUP_SLUG || '').trim(),
};

const ctx = { waitUntil() {} };

const readBodyBuffer = async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)));
    req.on('error', reject);
  });
};

const server = http.createServer(async (req, res) => {
  try {
    const origin = `http://${host}:${port}`;
    const url = new URL(req.url || '/', origin);
    const body = await readBodyBuffer(req);

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body,
    });

    const response = await worker.fetch(request, env, ctx);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error('[local-worker] handler error', {
      method: req.method,
      url: req.url,
      message: err?.message || String(err),
    });
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || String(err) }));
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, workerUrl: `http://${host}:${port}`, mode: 'local', kv: 'memory' }, null, 2));
});
