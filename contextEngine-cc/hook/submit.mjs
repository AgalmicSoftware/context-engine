#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(process.env.CE_CC_STATE_DIR || resolve(__dirname, '..', '.state'));
const TOKEN_PATH = resolve(STATE_DIR, 'token.jwt');
const CONFIG_PATH = resolve(STATE_DIR, 'config.json');

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    metaJson: '',
    additionalFile: '',
    serverUrl: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '');
    if (arg === '--meta') {
      out.metaJson = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--additional-file') {
      out.additionalFile = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--server-url') {
      out.serverUrl = String(argv[i + 1] || '');
      i += 1;
    }
  }

  return out;
}

function stripSingleTrailingNewline(value) {
  return String(value || '').replace(/\r?\n$/, '');
}

function readOptionalFile(path) {
  if (!path || !existsSync(path)) return '';
  return stripSingleTrailingNewline(readFileSync(path, 'utf8'));
}

function readAnswerFromStdin() {
  return stripSingleTrailingNewline(readFileSync(0, 'utf8'));
}

function postJson(urlStr, payload, token, timeoutMs = 10000) {
  return new Promise((resolvePost, rejectPost) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      rejectPost(new Error(`Invalid server URL: ${urlStr}`));
      return;
    }

    const body = JSON.stringify(payload);
    const reqFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = reqFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolvePost({
          status: Number(res.statusCode || 0),
          body: data,
        });
      });
    });

    req.on('error', rejectPost);
    req.on('timeout', () => {
      req.destroy();
      rejectPost(new Error('submit request timed out'));
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  const { metaJson, additionalFile, serverUrl: serverUrlOverride } = parseArgs();
  if (!metaJson) {
    throw new Error('Missing required --meta argument.');
  }

  let meta;
  try {
    meta = JSON.parse(metaJson);
  } catch {
    throw new Error('Invalid JSON passed to --meta.');
  }

  const token = existsSync(TOKEN_PATH) ? String(readFileSync(TOKEN_PATH, 'utf8') || '').trim() : '';
  if (!token) {
    throw new Error(`Missing auth token at ${TOKEN_PATH}`);
  }

  const config = loadJson(CONFIG_PATH, {});
  const serverUrl = String(serverUrlOverride || config.serverUrl || 'http://localhost:7391').trim();
  const answer = readAnswerFromStdin();
  const payload = {
    ...(meta && typeof meta === 'object' ? meta : {}),
    answer,
    additional: readOptionalFile(additionalFile),
  };

  const response = await postJson(`${serverUrl.replace(/\/+$/, '')}/api/respond`, payload, token);
  if (response.body) {
    process.stdout.write(response.body);
    if (!response.body.endsWith('\n')) process.stdout.write('\n');
  }
  if (response.status < 200 || response.status >= 300) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.exit(1);
});
