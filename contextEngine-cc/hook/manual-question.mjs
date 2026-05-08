#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(process.env.CE_CC_STATE_DIR || resolve(__dirname, '..', '.state'));
const TOKEN_PATH = resolve(STATE_DIR, 'token.jwt');
const CONFIG_PATH = resolve(STATE_DIR, 'config.json');
const DEFAULT_SERVER_URL = 'http://localhost:7391';

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function getConfiguredSessions(config = {}) {
  return normalizeConfiguredSessions({
    selectedSessions: config.selectedSessions,
    defaultSession: config.defaultSession,
  });
}

function buildSubmitMeta(payload, fallbackSession = '') {
  const question = payload?.question && typeof payload.question === 'object'
    ? payload.question
    : {};
  const defaults = payload?.defaults && typeof payload.defaults === 'object'
    ? payload.defaults
    : {};
  const session = String(question.session || fallbackSession || '').trim();
  const meta = {
    questionId: String(question.id || '').trim(),
    session,
    questionType: String(question.type || 'unknown').trim() || 'unknown',
    answerEncryptionAudience: String(
      defaults.answerEncryptionAudience || (defaults.encrypt ? 'self' : 'none')
    ).trim() || 'none',
    additionalEncryptionAudience: 'follow',
  };
  if (defaults.encrypt === true) {
    meta.encrypt = true;
  }
  const answerEncryptionGateId = String(defaults.answerEncryptionGateId || '').trim();
  if (answerEncryptionGateId) {
    meta.answerEncryptionGateId = answerEncryptionGateId;
  }
  return meta;
}

function httpGet(urlStr, headers = {}, timeoutMs = 8000) {
  return new Promise((resolveGet, rejectGet) => {
    const url = new URL(urlStr);
    const reqFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = reqFn(url, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolveGet({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolveGet({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', rejectGet);
    req.on('timeout', () => {
      req.destroy();
      rejectGet(new Error('manual question request timed out'));
    });
    req.end();
  });
}

function writeJson(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

async function main() {
  const config = loadJson(CONFIG_PATH, {});
  const serverUrl = String(config.serverUrl || DEFAULT_SERVER_URL).trim() || DEFAULT_SERVER_URL;
  const token = existsSync(TOKEN_PATH) ? String(readFileSync(TOKEN_PATH, 'utf8') || '').trim() : '';

  if (!token) {
    writeJson({
      ok: false,
      status: 'auth-required',
      signInUrl: serverUrl,
      message: `Open ${serverUrl} and sign in with passkey, then press q again.`,
    });
    return;
  }

  const sessions = getConfiguredSessions(config);
  if (sessions.length === 0) {
    writeJson({
      ok: false,
      status: 'no-session',
      signInUrl: serverUrl,
      message: `Open ${serverUrl} and select at least one session.`,
    });
    return;
  }

  let firstPayload = null;
  for (const session of sessions) {
    const params = new URLSearchParams({
      session,
      presentation: 'compact',
      reason: 'manual',
    });
    const response = await httpGet(`${serverUrl.replace(/\/+$/, '')}/api/hook/question?${params.toString()}`, {
      Authorization: `Bearer ${token}`,
    });

    const payload = response.data && typeof response.data === 'object' ? response.data : {};
    if (response.status === 401) {
      writeJson({
        ok: false,
        status: 'auth-required',
        signInUrl: serverUrl,
        message: `Open ${serverUrl} and sign in with passkey, then press q again.`,
      });
      return;
    }
    if (response.status < 200 || response.status >= 300) {
      writeJson({
        ok: false,
        status: response.status >= 500 ? 'server-unavailable' : 'error',
        httpStatus: response.status,
        error: payload.error || `Request failed with status ${response.status}`,
      });
      return;
    }
    if (!firstPayload) firstPayload = payload;
    if (payload.question) {
      writeJson({
        ...payload,
        session: String(payload?.question?.session || session || '').trim(),
        questionId: String(payload?.question?.id || '').trim(),
        questionType: String(payload?.question?.type || 'unknown').trim() || 'unknown',
        submitMeta: buildSubmitMeta(payload, session),
        ok: true,
        status: 'question',
        source: 'manual-question',
      });
      return;
    }
  }

  writeJson({
    ...(firstPayload || {}),
    ok: true,
    status: 'no-question',
    source: 'manual-question',
    message: 'No eligible questions are currently available.',
  });
}

main().catch((err) => {
  const message = err?.message || String(err);
  const operational = /timed out|connect|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH/i.test(message);
  writeJson({
    ok: false,
    status: operational ? 'server-unavailable' : 'error',
    error: message,
  }, operational ? 0 : 1);
});
