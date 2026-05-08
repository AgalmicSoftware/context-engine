import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname, relative, isAbsolute, sep } from 'path';
import { fileURLToPath } from 'url';
import { handleRoute } from './lib/router.mjs';
import { debug, info } from './lib/log.mjs';
import { resolveCorsAllowOrigin } from './lib/localRequest.mjs';
import { DEFAULT_HOST, DEFAULT_PORT, formatReadyMessage } from './lib/startup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
})();

const PORT = DEFAULT_PORT;
const HOST = DEFAULT_HOST;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

export function corsHeaders(req) {
  const allowOrigin = resolveCorsAllowOrigin(req);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  return headers;
}

function isPathInsideDirectory(rootDir, targetPath) {
  const relativePath = relative(rootDir, targetPath);
  const traversesParent = relativePath === '..' || relativePath.startsWith(`..${sep}`);
  return relativePath === '' || (!traversesParent && !isAbsolute(relativePath));
}

function serveStatic(req, res) {
  let filePath = resolve(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.slice(1));

  // Security: prevent directory traversal
  if (!isPathInsideDirectory(PUBLIC_DIR, filePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!existsSync(filePath)) {
    // SPA fallback
    filePath = resolve(PUBLIC_DIR, 'index.html');
    if (!existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not Found');
    }
  }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX = 1024 * 1024; // 1MB
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

export function createContextEngineServer() {
  return createServer(async (req, res) => {
    const headers = corsHeaders(req);
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const method = req.method.toUpperCase();

    // API routes
    if (url.pathname.startsWith('/api/')) {
      let body = {};
      if (method === 'POST') {
        try {
          body = await readBody(req);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      }

      const handled = await handleRoute(req, res, { url, method, body });
      if (handled !== null) return;

      // Unmatched API route
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Not found.' }));
    }

    // Static files
    serveStatic(req, res);
  });
}

export function startContextEngineServer({ port = PORT, host = HOST } = {}) {
  const server = createContextEngineServer();
  server.listen(port, host, () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    info(formatReadyMessage({ port: boundPort }));
    debug(`[contextEngine-cc] v${VERSION} listening on http://${host}:${boundPort}`);
    debug(`[contextEngine-cc] RP_ID=${process.env.RP_ID || 'localhost'}`);
  });
  return server;
}

function isMainModule() {
  try {
    const entry = process.argv[1] ? resolve(process.argv[1]) : '';
    return entry === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  startContextEngineServer();
}
