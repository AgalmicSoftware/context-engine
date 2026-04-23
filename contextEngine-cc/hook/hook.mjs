#!/usr/bin/env node

// Claude Code hook for contextEngine-cc
// Zero npm dependencies — Node built-ins only
// Only shows questions during long-running operations (Task, Bash with timeout > 30s)

import {
  appendFileSync,
  chmodSync,
  readFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile, spawn } from 'child_process';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { renderStatusLine } from '../status/statusline.mjs';
import { writeSecureFile } from '../lib/keyEncryption.mjs';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(process.env.CE_CC_STATE_DIR || resolve(__dirname, '..', '.state'));
const TOKEN_PATH = resolve(STATE_DIR, 'token.jwt');
const CONFIG_PATH = resolve(STATE_DIR, 'config.json');
const COOLDOWN_PATH = resolve(STATE_DIR, 'last-ts');
const HINT_COOLDOWN_PATH = resolve(STATE_DIR, 'last-hint-ts');
const AUTH_COOLDOWN_PATH = resolve(STATE_DIR, 'last-auth-ts');
const DASHBOARD_PATH = resolve(STATE_DIR, 'dashboard.json');

const DEFAULT_COOLDOWN_MS = 45_000;
const AUTH_COOLDOWN_MS = 5 * 60_000;
const DEFAULT_MIN_TIMEOUT_MS = 20_000; // Only show questions for tools expected to take this long
const CONTROL_CHARS_EXCEPT_NEWLINE_RE = /[\x00-\x09\x0B-\x1F]/g;
const QUESTION_SURFACING_MODES = new Set(['manual', 'idle', 'ambient']);

// --- Helpers ---

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function saveJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeSecureFile(path, JSON.stringify(data, null, 2));
}

function setDashboardState(phase, extra = {}) {
  saveJson(DASHBOARD_PATH, {
    phase,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

function runFile(command, args) {
  execFile(command, args, { windowsHide: true }, () => {});
}

function runDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => {});
  child.unref();
}

function normalizeBrowserUrl(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function openBrowser(url) {
  if (String(process.env.CE_CC_DISABLE_OPEN || '').trim() === '1') return;
  const safeUrl = normalizeBrowserUrl(url);
  if (!safeUrl) return;
  const platform = process.platform;
  if (platform === 'darwin') {
    runFile('open', [safeUrl]);
    return;
  }
  if (platform === 'win32') {
    runDetached('rundll32.exe', ['url.dll,FileProtocolHandler', safeUrl]);
    return;
  }
  runDetached('xdg-open', [safeUrl]);
}

function notify(title, message) {
  if (String(process.env.CE_CC_DISABLE_NOTIFY || '').trim() === '1') return;
  if (process.platform === 'darwin') {
    const safeMessage = stripControlChars(message).replace(/\n/g, ' ');
    const safeTitle = stripControlChars(title);
    const script = 'on run argv\n'
      + 'display notification (item 1 of argv) with title (item 2 of argv)\n'
      + 'end run';
    runFile('osascript', ['-e', script, safeMessage, safeTitle]);
  }
}

function httpGet(urlStr, headers, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = reqFn(url, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function readStdin() {
  try {
    return JSON.parse(readFileSync('/dev/stdin', 'utf8'));
  } catch {
    return null;
  }
}

const shellSingleQuote = (value) => String(value || '').replace(/'/g, `'\"'\"'`);

const stripControlChars = (value) => String(value || '').replace(CONTROL_CHARS_EXCEPT_NEWLINE_RE, '');

const stripAnsi = (value) => String(value || '').replace(/\x1b\[[0-9;]*m/g, '');

const makeHereDocDelimiter = (questionId, label) => {
  const safeQuestionId = String(questionId || 'cecc').replace(/[^A-Za-z0-9]/g, '_').slice(0, 24) || 'cecc';
  const safeLabel = String(label || 'payload').replace(/[^A-Za-z0-9]/g, '_');
  return `__CE_CC_${safeLabel}_${safeQuestionId}__`;
};

const truncateHookContextText = (value, maxLength) => {
  const sanitized = stripControlChars(value);
  if (sanitized.length <= maxLength) return sanitized;
  const suffix = '...[truncated]';
  if (maxLength <= suffix.length) return sanitized.slice(0, maxLength);
  return `${sanitized.slice(0, maxLength - suffix.length)}${suffix}`;
};

function normalizeBooleanConfig(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeQuestionSurfacingMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return QUESTION_SURFACING_MODES.has(normalized) ? normalized : 'manual';
}

function shouldPresentQuestionForEvent(eventType, config = {}) {
  const mode = normalizeQuestionSurfacingMode(config.questionSurfacingMode);
  if (eventType === 'Notification') return mode === 'idle' || mode === 'ambient';
  if (eventType === 'PreToolUse') {
    return mode === 'ambient' && normalizeBooleanConfig(config.ambientInterruptions, false);
  }
  return false;
}

function shouldShowStatuslineQuestionHint(config = {}) {
  return normalizeBooleanConfig(config.statuslineQuestionHints, true);
}

function getHintCooldownMs(config = {}) {
  const configured = Number(config.cooldownMs);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(15_000, Math.min(120_000, Math.floor(configured)));
  }
  return 45_000;
}

function isHintCooldownActive(config = {}) {
  if (!existsSync(HINT_COOLDOWN_PATH)) return false;
  const lastHint = Number(readFileSync(HINT_COOLDOWN_PATH, 'utf8').trim()) || 0;
  return Date.now() - lastHint < getHintCooldownMs(config);
}

function isContextEngineInternalCommand(command) {
  return /contextEngine-cc[\\/](hook[\\/]manual-question\.mjs|hook[\\/]submit\.mjs|hook[\\/]hook\.mjs)/.test(String(command || ''));
}

// --- Check if this is a long-running tool use ---

// Short/instant commands that don't warrant a survey question
const FAST_CMD_PATTERNS = /^\s*(echo|printf|cat |head |tail |ls |pwd|date|whoami|which |true|false|curl |cp |mv |rm |mkdir |chmod |chown |touch |ln |wc |sort |uniq |diff |file |stat |realpath|basename|dirname|id |env |set |export |source |type |hash |test |tee )\b/;

function getEventType(hookInput) {
  if (!hookInput) return 'unknown';
  // Notification events have a 'type' field (e.g. 'idle_prompt') but no tool_name
  if (hookInput.type && !hookInput.tool_name) return 'Notification';
  if (hookInput.tool_name) return 'PreToolUse';
  return 'unknown';
}

function shouldShowQuestion(hookInput, minTimeoutMs) {
  if (!hookInput) return true;

  const eventType = getEventType(hookInput);

  // Notification events (idle_prompt) — user is idle, perfect time for a question
  if (eventType === 'Notification') return true;

  const toolName = hookInput.tool_name || '';

  // Read/Glob/Grep/Write/Edit/Task — all eligible (cooldown handles rate-limiting)
  if (['Task', 'Read', 'Glob', 'Grep', 'Write', 'Edit'].includes(toolName)) return true;

  // Bash: skip obviously fast commands
  if (toolName === 'Bash') {
    const cmd = hookInput.tool_input?.command || '';
    if (isContextEngineInternalCommand(cmd)) return false;
    if (FAST_CMD_PATTERNS.test(cmd)) return false;
    // Explicit short timeout → skip
    const timeout = hookInput.tool_input?.timeout;
    if (typeof timeout === 'number' && timeout < minTimeoutMs) return false;
    return true;
  }

  // Unknown tool — allow (cooldown prevents flooding)
  return true;
}

// --- Output ---

function outputAllow() {
  process.exit(0);
}

function outputQuestion(question, claudeContext, eventType) {
  notify('Context Engine Survey', question.prompt || 'New survey question');
  let response;
  if (eventType === 'Notification') {
    response = {
      hookSpecificOutput: {
        additionalContext: claudeContext,
      },
    };
  } else {
    // PreToolUse (default)
    response = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext: claudeContext,
      },
    };
  }
  process.stdout.write(JSON.stringify(response));
  process.exit(0);
}

// --- Debug ---

const DEBUG_LOG = resolve(STATE_DIR, 'hook-debug.log');
function debugLog(msg) {
  try {
    const ts = new Date().toISOString();
    appendFileSync(DEBUG_LOG, `${ts} ${msg}\n`, { mode: 0o600 });
    chmodSync(DEBUG_LOG, 0o600);
    if (process.platform !== 'win32' && (statSync(DEBUG_LOG).mode & 0o777) !== 0o600) {
      throw new Error(`Failed to secure permissions for ${DEBUG_LOG}`);
    }
  } catch { /* best-effort */ }
}

// --- Main ---

async function main() {
  try {
    // 0. Read hook input and load config (needed for threshold settings)
    const hookInput = readStdin();
    const eventType = getEventType(hookInput);
    const config = loadJson(CONFIG_PATH, {});
    const minTimeoutMs = Number(config.minTimeoutMs) || DEFAULT_MIN_TIMEOUT_MS;
    const cooldownMs = Number(config.cooldownMs) || DEFAULT_COOLDOWN_MS;

    debugLog(`invoked tool=${hookInput?.tool_name || 'none'} timeout=${hookInput?.tool_input?.timeout ?? 'unset'} cmd=${(hookInput?.tool_input?.command || '').slice(0, 80)}`);

    // 1. Skip if not eligible for question
    if (!shouldShowQuestion(hookInput, minTimeoutMs)) {
      debugLog('SKIP: fast/ineligible');
      return outputAllow();
    }

    // 2. Cooldown check
    if (existsSync(COOLDOWN_PATH)) {
      const lastTs = Number(readFileSync(COOLDOWN_PATH, 'utf8').trim()) || 0;
      if (Date.now() - lastTs < cooldownMs) {
        debugLog(`SKIP: cooldown (${Math.round((Date.now() - lastTs) / 1000)}s < ${cooldownMs / 1000}s)`);
        return outputAllow();
      }
    }

    // 3. Load sessions from config
    const serverUrl = config.serverUrl || 'http://localhost:7391';
    // Multi-session support: rotate through selectedSessions, fall back to defaultSession
    const sessions = normalizeConfiguredSessions({
      selectedSessions: config.selectedSessions,
      defaultSession: config.defaultSession,
    });
    if (sessions.length === 0) {
      setDashboardState('waiting-config', {
        serverUrl,
        selectedSessions: [],
      });
      return outputAllow();
    }
    // Pick a random session from the list
    const session = sessions[Math.floor(Math.random() * sessions.length)];

    // 4. Read token
    const hasToken = existsSync(TOKEN_PATH) && readFileSync(TOKEN_PATH, 'utf8').trim();
    if (!hasToken) {
      if (existsSync(AUTH_COOLDOWN_PATH)) {
        const lastAuth = Number(readFileSync(AUTH_COOLDOWN_PATH, 'utf8').trim()) || 0;
        if (Date.now() - lastAuth < AUTH_COOLDOWN_MS) return outputAllow();
      }
      writeSecureFile(AUTH_COOLDOWN_PATH, String(Date.now()));
      openBrowser(serverUrl);
      notify('Context Engine CC', `Auth required. Opening ${serverUrl}`);
      setDashboardState('auth-required', {
        serverUrl,
        selectedSessions: sessions,
        message: 'Authenticate in the local Context Engine UI.',
      });
      // Surface auth message to Claude so user sees it in CC
      const authMsg = `Context Engine: auth required. Opening ${serverUrl} — or paste this to re-auth:\nopen ${serverUrl}`;
      outputQuestion({ prompt: 'Auth required' }, authMsg, eventType);
      return;
    }
    const token = hasToken;
    const shouldPresentQuestion = shouldPresentQuestionForEvent(eventType, config);
    const shouldHintQuestion = shouldShowStatuslineQuestionHint(config);
    if (!shouldPresentQuestion && !shouldHintQuestion) {
      debugLog(`SKIP: surfacing disabled for event=${eventType}`);
      return outputAllow();
    }
    if (!shouldPresentQuestion && shouldHintQuestion && isHintCooldownActive(config)) {
      debugLog(`SKIP: hint cooldown active for event=${eventType}`);
      return outputAllow();
    }

    // 6. Call API — try selected session, if no question found try others
    let result = null;
    let activeSession = session;
    const shuffled = sessions.length > 1
      ? [session, ...sessions.filter(s => s !== session).sort(() => Math.random() - 0.5)]
      : [session];
    for (const slug of shuffled) {
      const params = new URLSearchParams({
        session: slug,
        presentation: 'compact',
      });
      if (!shouldPresentQuestion) params.set('peek', '1');
      const url = `${serverUrl}/api/hook/question?${params.toString()}`;
      const r = await httpGet(url, { 'Authorization': `Bearer ${token}` });
      debugLog(`  session=${slug} status=${r.status} hasQuestion=${!!r.data?.question}`);
      if (r.status === 200 && r.data?.question) {
        result = r;
        activeSession = slug;
        break;
      }
      if (!result) result = r; // keep first result for error handling
    }

    // 7. Handle 401 — surface refresh message to CC
    if (result.status === 401) {
      if (existsSync(AUTH_COOLDOWN_PATH)) {
        const lastAuth = Number(readFileSync(AUTH_COOLDOWN_PATH, 'utf8').trim()) || 0;
        if (Date.now() - lastAuth < AUTH_COOLDOWN_MS) return outputAllow();
      }
      writeSecureFile(AUTH_COOLDOWN_PATH, String(Date.now()));
      openBrowser(serverUrl);
      notify('Context Engine CC', `Token expired. Opening ${serverUrl}`);
      setDashboardState('token-expired', {
        serverUrl,
        selectedSessions: sessions,
        message: 'Refresh your local JWT in the Context Engine UI.',
      });
      const refreshMsg = `Context Engine: session token expired. Refresh at ${serverUrl} — or paste:\nopen ${serverUrl}`;
      outputQuestion({ prompt: 'Token expired' }, refreshMsg, eventType);
      return;
    }

    // 8. Show question
    if (result.status === 200 && result.data?.question) {
      debugLog(`SHOW question=${result.data.question.id?.slice(0, 18)} session=${activeSession}`);
      const q = result.data.question;

      const questionPrompt = q.prompt || '(no prompt)';
      const questionType = q.type || 'unknown';
      const questionId = q.id || '';
      const options = q.options || [];
      const contextQuestionPrompt = truncateHookContextText(questionPrompt, 2000) || '(no prompt)';
      const contextOptions = Array.isArray(options)
        ? options.map((option) => truncateHookContextText(option, 500))
        : [];
      const contextQuestionType = stripControlChars(questionType) || 'unknown';

      const isFreeform = questionType === 'freeform' || (questionType !== 'binary' && questionType !== 'multichoice' && questionType !== 'rating');

      // Keep hook output minimal — CLAUDE.md has the full instructions
      const wallet = result.data.wallet || '';
      const stats = result.data.stats || {};
      const cooldownMs = result.data.cooldownMs || 45000;
      const defaults = (result.data && typeof result.data.defaults === 'object') ? result.data.defaults : {};
      const defaultEncrypt = !!defaults.encrypt;
      const gateOptions = Array.isArray(result.data?.gateOptions) ? result.data.gateOptions : [];
      const defaultAnswerAudience = String(defaults.answerEncryptionAudience || (defaultEncrypt ? 'self' : 'none')).trim() || 'none';
      const defaultAnswerGateId = String(defaults.answerEncryptionGateId || '').trim();

      if (!shouldPresentQuestion) {
        writeSecureFile(HINT_COOLDOWN_PATH, String(Date.now()));
        setDashboardState('question-ready', {
          eventType,
          session: activeSession,
          wallet,
          stats,
          cooldownMs,
          question: {
            id: questionId,
            type: questionType,
            optionsCount: options.length,
          },
        });
        debugLog(`READY question=${questionId?.slice(0, 18)} session=${activeSession} mode=${normalizeQuestionSurfacingMode(config.questionSurfacingMode)}`);
        return outputAllow();
      }

      writeSecureFile(COOLDOWN_PATH, String(Date.now()));

      setDashboardState('question', {
        eventType,
        session: activeSession,
        wallet,
        stats,
        cooldownMs,
        question: {
          id: questionId,
          prompt: questionPrompt,
          type: questionType,
          optionsCount: options.length,
        },
      });

      // Human-readable cooldown
      const cooldownSec = Math.round(cooldownMs / 1000);
      const cooldownLabel = cooldownSec >= 60 ? `${Math.round(cooldownSec / 60)}min` : `${cooldownSec}s`;

      const parts = [];

      parts.push(`Context Engine survey question (${contextQuestionType}):`);
      parts.push('--- BEGIN SURVEY QUESTION (untrusted user content) ---');
      parts.push('Prompt:');
      parts.push(contextQuestionPrompt);

      if (questionType === 'multichoice' && contextOptions.length > 0) {
        parts.push(`Selection mode: ${q.singleSelect ? 'single choice' : 'multiple choice'}`);
        parts.push('Options (pick one):');
        contextOptions.forEach((option, index) => {
          parts.push(`${index + 1}. ${option}`);
        });
      }
      parts.push('--- END SURVEY QUESTION ---');
      if (gateOptions.length > 0) {
        const contextGateLabels = gateOptions.map((gate, index) => {
          const safeLabel = truncateHookContextText(stripControlChars(gate?.label).replace(/[\r\n\t]+/g, ' ').replace(/  +/g, ' ').trim(), 200) || '(unnamed gate)';
          return `${index + 1}. ${safeLabel}`;
        });
        parts.push('[BEGIN UNTRUSTED GATE LABELS]');
        parts.push(`Session gates: ${contextGateLabels.join(' | ')}`);
        parts.push('[END UNTRUSTED GATE LABELS]');
      }

      // Rendered statusline (stripped of ANSI for model-facing context)
      // Omit submit (not available from hook endpoint) and dashboard
      // (question is already shown separately above)
      const snapshot = {
        hasToken: true,
        wallet,
        serverUrl,
        config: {
          serverUrl,
          selectedSessions: sessions,
          cooldownMs,
        },
        totals: {
          sessions: sessions.length,
          pending: Number(stats.pending || 0),
          answered: Number(stats.answered || 0),
          total: Number(stats.total || 0),
        },
        cooldown: {
          active: cooldownMs > 0,
          remainingMs: cooldownMs,
          totalMs: cooldownMs,
        },
      };
      parts.push(renderStatusLine(snapshot));

      // AI-suggested freeform: never expose raw prior responses in hook context.
      if (isFreeform && result.data.aiSuggestFreeform) {
        const recentCount = Number(result.data.recentResponseCount || 0) || (Array.isArray(result.data.recentResponses)
          ? result.data.recentResponses.length
          : 0);
        const privacyNote = recentCount > 0
          ? `${recentCount} prior responses exist, but their text is omitted from hook context for privacy.`
          : 'Prior response text is omitted from hook context for privacy.';
        parts.push(`[AI suggest enabled] ${privacyNote}`);
        parts.push(`Generate 2-3 short suggested answers using the current question only. Do not quote or reconstruct prior responses. Present as AskUserQuestion options alongside Skip. User can always type their own via Other.`);
      }

      const saveMeta = {
        questionId,
        session: activeSession,
        questionType,
        answerEncryptionAudience: defaultAnswerAudience,
        additionalEncryptionAudience: 'follow',
      };
      if (defaultEncrypt) saveMeta.encrypt = true;
      if (defaultAnswerGateId) saveMeta.answerEncryptionGateId = defaultAnswerGateId;
      const saveMetaJson = shellSingleQuote(JSON.stringify(saveMeta));
      const submitScript = `'${shellSingleQuote(resolve(__dirname, 'submit.mjs'))}'`;
      const answerDelimiter = makeHereDocDelimiter(questionId, 'answer');
      const additionalDelimiter = makeHereDocDelimiter(questionId, 'additional');
      parts.push(`Audience fields: answerEncryptionAudience="none"|"self"|"gate"; additionalEncryptionAudience="follow"|"none"|"self"|"gate".`);
      parts.push('Legacy encrypt/encryptAdditional booleans stay wallet-only; use the audience fields above for any gate-scoped encryption.');
      if (gateOptions.length > 0) {
        parts.push(`When using a gate, set answerEncryptionGateId/additionalEncryptionGateId to one of: ${gateOptions.map((gate) => gate.gateId).join(', ')}`);
      }
      parts.push(`Save response (keep free-text out of shell args; replace ANSWER below and leave the ADDITIONAL block empty if there are no comments):`);
      parts.push('ce_cc_answer_file="$(mktemp "${TMPDIR:-/tmp}/ce-cc-answer.XXXXXX" 2>/dev/null || mktemp)"');
      parts.push('ce_cc_additional_file="$(mktemp "${TMPDIR:-/tmp}/ce-cc-additional.XXXXXX" 2>/dev/null || mktemp)"');
      parts.push('chmod 600 "$ce_cc_answer_file" "$ce_cc_additional_file"');
      parts.push(`cat > "$ce_cc_answer_file" <<'${answerDelimiter}'`);
      parts.push('ANSWER');
      parts.push(answerDelimiter);
      parts.push(`cat > "$ce_cc_additional_file" <<'${additionalDelimiter}'`);
      parts.push('');
      parts.push(additionalDelimiter);
      parts.push(`node ${submitScript} --meta '${saveMetaJson}' --additional-file "$ce_cc_additional_file" < "$ce_cc_answer_file"`);
      parts.push('ce_cc_status=$?');
      parts.push('rm -f "$ce_cc_answer_file" "$ce_cc_additional_file"');
      parts.push('exit $ce_cc_status');

      outputQuestion({ prompt: contextQuestionPrompt }, parts.join('\n'), eventType);
    }

    setDashboardState('no-question', {
      eventType,
      session: activeSession,
      wallet: result?.data?.wallet || '',
      stats: result?.data?.stats || null,
      cooldownMs: result?.data?.cooldownMs || cooldownMs,
      selectedSessions: sessions,
      message: 'No eligible questions are currently available.',
    });
    debugLog('END: no question matched, allowing');
    outputAllow();
  } catch (err) {
    setDashboardState('error', {
      message: err?.message || String(err),
    });
    debugLog(`ERROR: ${err?.message || err}`);
    outputAllow();
  }
}

main();
