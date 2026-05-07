#!/usr/bin/env node

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { writeSecureFile } from '../lib/keyEncryption.mjs';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(process.env.CE_CC_STATE_DIR || resolve(__dirname, '..', '.state'));
const TOKEN_PATH = resolve(STATE_DIR, 'token.jwt');
const CONFIG_PATH = resolve(STATE_DIR, 'config.json');
const COOLDOWN_PATH = resolve(STATE_DIR, 'last-ts');
const DASHBOARD_PATH = resolve(STATE_DIR, 'dashboard.json');
const CACHE_PATH = resolve(STATE_DIR, 'status-cache.json');

const DEFAULT_SERVER_URL = 'http://localhost:7391';
const DEFAULT_COOLDOWN_MS = 45_000;
const CACHE_TTL_MS = 4_000;
const REQUEST_TIMEOUT_MS = 1_500;
const BAR_WIDTH = 12;

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const SYMBOLS = {
  line1Leader: '╭─',
  line2Leader: '╰─',
  line1Separator: ' ▸ ',
  line2Separator: ' · ',
  wallet: '◉',
  sessions: '▪',
  cooldown: '⏱',
  submitReady: '✔',
  localOnly: '✗',
};

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function saveJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeSecureFile(path, JSON.stringify(data, null, 2));
}

function readStdinJson() {
  try {
    const raw = readFileSync('/dev/stdin', 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function withAnsi(code, text) {
  return `${code}${text}${ANSI.reset}`;
}

function bold(text) {
  return withAnsi(ANSI.bold, text);
}

function dim(text) {
  return withAnsi(ANSI.dim, text);
}

function cyan(text) {
  return withAnsi(ANSI.cyan, text);
}

function green(text) {
  return withAnsi(ANSI.green, text);
}

function yellow(text) {
  return withAnsi(ANSI.yellow, text);
}

function red(text) {
  return withAnsi(ANSI.red, text);
}

function magenta(text) {
  return withAnsi(ANSI.magenta, text);
}

function readTimestamp(path) {
  if (!existsSync(path)) return null;
  const value = Number(readFileSync(path, 'utf8').trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

function shortAddress(value) {
  const wallet = String(value || '').trim();
  if (!wallet) return 'wallet unknown';
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncate(text, maxLength) {
  const value = String(text || '').trim().replace(/\s+/g, ' ');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

function buildProgressBar(answered, total, width = BAR_WIDTH) {
  if (!Number.isFinite(total) || total <= 0) return dim('░'.repeat(width));
  const safeAnswered = clamp(Number(answered) || 0, 0, total);
  const filled = clamp(Math.round((safeAnswered / total) * width), 0, width);
  return `${green('█'.repeat(filled))}${dim('░'.repeat(width - filled))}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function deriveProjectLabel(statusInput) {
  const candidates = [
    statusInput?.worktree?.path,
    statusInput?.workspace?.current_dir,
    statusInput?.cwd,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return basename(value);
  }
  return '';
}

function getConfiguredSessions(config = {}) {
  return normalizeConfiguredSessions({
    selectedSessions: config.selectedSessions,
    defaultSession: config.defaultSession,
  });
}

function buildLocalSnapshot() {
  const config = loadJson(CONFIG_PATH, {});
  const dashboard = loadJson(DASHBOARD_PATH, null);
  const hasToken = existsSync(TOKEN_PATH) && String(readFileSync(TOKEN_PATH, 'utf8')).trim().length > 0;
  const cooldownMs = Number(config.cooldownMs) || DEFAULT_COOLDOWN_MS;
  const lastShownAt = readTimestamp(COOLDOWN_PATH);
  const remainingMs = lastShownAt ? Math.max(0, cooldownMs - (Date.now() - lastShownAt)) : 0;
  const selectedSessions = getConfiguredSessions(config);
  const answered = Number(dashboard?.stats?.answered || 0);
  const total = Number(dashboard?.stats?.total || 0);

  return {
    hasToken,
    serverUrl: String(config.serverUrl || DEFAULT_SERVER_URL).trim() || DEFAULT_SERVER_URL,
    wallet: String(dashboard?.wallet || '').trim(),
    config: {
      serverUrl: String(config.serverUrl || DEFAULT_SERVER_URL).trim() || DEFAULT_SERVER_URL,
      defaultSession: String(config.defaultSession || '').trim(),
      selectedSessions,
      cooldownMs,
      questionSurfacingMode: String(config.questionSurfacingMode || 'manual').trim() || 'manual',
      statuslineQuestionHints: config.statuslineQuestionHints !== false,
      ambientInterruptions: config.ambientInterruptions === true,
    },
    cooldown: {
      totalMs: cooldownMs,
      lastShownAt,
      remainingMs,
      active: remainingMs > 0,
    },
    dashboard,
    totals: {
      sessions: selectedSessions.length,
      pending: 0,
      answered,
      total,
      remaining: Math.max(0, total - answered),
    },
    submit: {
      ready: false,
      mode: 'batch',
      hasKey: false,
      hasContract: false,
    },
  };
}

function httpGet(urlStr, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = reqFn(url, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function getPhaseSummary(snapshot) {
  const dashboard = snapshot.dashboard || {};
  const question = dashboard.question || null;
  const questionLabel = question
    ? `${question.type || 'question'}: ${truncate(question.prompt || '(no prompt)', 52)}`
    : '';

  switch (dashboard.phase) {
    case 'question-ready': {
      const type = question?.type || 'question';
      const session = dashboard.session ? ` in ${truncate(dashboard.session, 24)}` : '';
      return `${type} ready${session}`;
    }
    case 'question':
      return `last ${questionLabel}`;
    case 'no-question':
      return 'all caught up';
    case 'waiting-config':
      return 'select a session in Context Engine';
    case 'auth-required':
      return `sign in at ${snapshot.serverUrl || DEFAULT_SERVER_URL}`;
    case 'token-expired':
      return `refresh token at ${snapshot.serverUrl || DEFAULT_SERVER_URL}`;
    case 'error':
      return truncate(`hook error: ${dashboard.message || 'unknown error'}`, 64);
    default:
      if (questionLabel) return `last ${questionLabel}`;
      return 'watching for the next survey prompt';
  }
}

export function renderStatusLine(snapshot, statusInput = null) {
  const serverUrl = snapshot.config?.serverUrl || snapshot.serverUrl || DEFAULT_SERVER_URL;
  const hasToken = snapshot.hasToken !== false;
  const wallet = String(snapshot.wallet || '').trim();
  const sessionCount = Number(snapshot.totals?.sessions ?? snapshot.config?.selectedSessions?.length ?? 0);
  const pending = Number(snapshot.totals?.pending || 0);
  const answered = Number(snapshot.totals?.answered || 0);
  const total = Number(snapshot.totals?.total || 0);
  const safeAnswered = clamp(Number.isFinite(answered) ? answered : 0, 0, total > 0 ? total : 0);
  const cooldown = snapshot.cooldown || {};
  const project = deriveProjectLabel(statusInput);
  const line1Separator = dim(SYMBOLS.line1Separator);
  const line2Separator = dim(SYMBOLS.line2Separator);
  const line1Leader = `${dim(SYMBOLS.line1Leader)} `;
  const line2Leader = `${dim(SYMBOLS.line2Leader)} `;

  const line1 = [];
  line1.push(bold(cyan('CE')));
  if (project) line1.push(dim(project));

  if (!hasToken) {
    line1.push(red('auth required'));
    line1.push(dim(serverUrl));
    const line2 = sessionCount > 0
      ? `${pluralize(sessionCount, 'session')} selected${SYMBOLS.line2Separator}sign in to load progress`
      : `Open ${serverUrl} to authenticate and select a session`;
    return `${line1Leader}${line1.join(line1Separator)}\n${line2Leader}${dim(line2)}`;
  }

  if (wallet) line1.push(green(`${SYMBOLS.wallet} ${shortAddress(wallet)}`));
  if (sessionCount === 0) {
    line1.push(yellow('no sessions selected'));
    return `${line1Leader}${line1.join(line1Separator)}\n${line2Leader}${dim(`Open ${serverUrl} to choose sessions for Context Engine.`)}`;
  }

  line1.push(dim(`${SYMBOLS.sessions} ${pluralize(sessionCount, 'session')}`));
  line1.push(yellow(`${pending} pending`));
  if (snapshot.submit) {
    line1.push(snapshot.submit.ready
      ? green(`${SYMBOLS.submitReady} submit ready`)
      : dim(`${SYMBOLS.localOnly} local only`));
    if (snapshot.submit.ready && snapshot.submit.workerTokens?.ready === false) {
      line1.push(yellow('worker auth needed'));
    }
  }
  if (snapshot.offline) line1.push(red(snapshot.stale ? 'offline, showing cache' : 'offline'));
  else if (snapshot.stale) line1.push(yellow('stale'));

  const progress = total > 0
    ? `${buildProgressBar(safeAnswered, total)} ${clamp(Math.floor((safeAnswered / total) * 100), 0, 100)}% (${safeAnswered}/${total})`
    : 'question stats syncing';
  const cooldownLabel = cooldown.active
    ? `${SYMBOLS.cooldown} ${formatDuration(cooldown.remainingMs)}`
    : `${SYMBOLS.cooldown} ready`;

  const line2Parts = [progress, cooldownLabel];
  const showPhase = snapshot.config?.showPhaseSummary === true
    || (snapshot.config?.statuslineQuestionHints !== false && snapshot.dashboard?.phase === 'question-ready');
  if (showPhase) {
    const phaseSummary = snapshot.dashboard ? getPhaseSummary(snapshot) : '';
    if (phaseSummary) line2Parts.push(dim(truncate(phaseSummary, 76)));
  }

  return `${line1Leader}${line1.join(line1Separator)}\n${line2Leader}${line2Parts.join(line2Separator)}`;
}

async function fetchRemoteSnapshot(localSnapshot) {
  const token = readFileSync(TOKEN_PATH, 'utf8').trim();
  const response = await httpGet(`${localSnapshot.serverUrl}/api/status`, {
    Authorization: `Bearer ${token}`,
  });

  if (response.status === 200) {
    return {
      ...response.data,
      hasToken: true,
      serverUrl: localSnapshot.serverUrl,
      stale: false,
      offline: false,
    };
  }

  if (response.status === 401) {
    return {
      ...localSnapshot,
      hasToken: false,
      offline: false,
      stale: false,
      dashboard: {
        ...(localSnapshot.dashboard || {}),
        phase: 'token-expired',
        message: 'Refresh your Context Engine token.',
      },
    };
  }

  throw new Error(`status ${response.status}`);
}

function mergeSnapshot(base, overlay) {
  return {
    ...base,
    ...overlay,
    config: {
      ...(base.config || {}),
      ...(overlay.config || {}),
    },
    cooldown: {
      ...(base.cooldown || {}),
      ...(overlay.cooldown || {}),
    },
    submit: {
      ...(base.submit || {}),
      ...(overlay.submit || {}),
    },
    totals: {
      ...(base.totals || {}),
      ...(overlay.totals || {}),
    },
  };
}

export async function main() {
  const statusInput = readStdinJson();
  const localSnapshot = buildLocalSnapshot();
  const cached = loadJson(CACHE_PATH, null);

  if (!localSnapshot.hasToken) {
    process.stdout.write(renderStatusLine(localSnapshot, statusInput));
    return;
  }

  if (cached?.snapshot && Number.isFinite(cached.ts) && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    process.stdout.write(renderStatusLine(mergeSnapshot(localSnapshot, cached.snapshot), statusInput));
    return;
  }

  try {
    const remoteSnapshot = await fetchRemoteSnapshot(localSnapshot);
    saveJson(CACHE_PATH, {
      ts: Date.now(),
      snapshot: remoteSnapshot,
    });
    process.stdout.write(renderStatusLine(mergeSnapshot(localSnapshot, remoteSnapshot), statusInput));
  } catch {
    if (cached?.snapshot) {
      const staleSnapshot = mergeSnapshot(localSnapshot, {
        ...cached.snapshot,
        stale: true,
        offline: true,
      });
      process.stdout.write(renderStatusLine(staleSnapshot, statusInput));
      return;
    }

    process.stdout.write(renderStatusLine({
      ...localSnapshot,
      stale: true,
      offline: true,
    }, statusInput));
  }
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
  main();
}

export const __test__statusline = {
  buildLocalSnapshot,
  buildProgressBar,
  formatDuration,
  getPhaseSummary,
  deriveProjectLabel,
};
