#!/usr/bin/env node
import { safeString } from './runtimePrimitives.mjs';

import { performance } from 'node:perf_hooks';

const DEFAULT_PRINCIPALS = 200;
const DEFAULT_CONCURRENCY = 25;
const DEFAULT_TIMEOUT_MS = 15000;

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = safeString(argv[index]);
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!safeString(next) || safeString(next).startsWith('--')) {
      flags[key] = 'true';
      continue;
    }
    flags[key] = safeString(next);
    index += 1;
  }
  const origin = safeString(flags.origin || env.AGENT_ONLY_LOAD_ORIGIN || env.WORKER_ORIGIN).replace(/\/+$/, '');
  return {
    origin,
    inviteToken: safeString(flags['invite-token'] || env.AGENT_ONLY_LOAD_INVITE_TOKEN),
    adminToken: safeString(flags['admin-token'] || env.AGENT_ONLY_LOAD_ADMIN_TOKEN || env.AGENT_BRIDGE_AGENT_API_TOKEN),
    sessionSlug: safeString(flags['session-slug'] || env.AGENT_ONLY_LOAD_SESSION_SLUG || 'session-wrapped'),
    principals: Math.max(1, Number(flags.principals || env.AGENT_ONLY_LOAD_PRINCIPALS || DEFAULT_PRINCIPALS) || DEFAULT_PRINCIPALS),
    concurrency: Math.max(1, Number(flags.concurrency || env.AGENT_ONLY_LOAD_CONCURRENCY || DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY),
    timeoutMs: Math.max(1000, Number(flags['timeout-ms'] || env.AGENT_ONLY_LOAD_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    userStart: Math.max(1, Number(flags['user-start'] || env.AGENT_ONLY_LOAD_USER_START || 9000000000) || 9000000000),
    requestPrefix: safeString(flags['request-prefix'] || env.AGENT_ONLY_LOAD_REQUEST_PREFIX || `ao-load-${Date.now()}`),
    statementLimit: Math.max(1, Math.min(50, Number(flags['statement-limit'] || env.AGENT_ONLY_LOAD_STATEMENT_LIMIT || 50) || 50)),
    replayPercent: Math.max(0, Math.min(100, Number(flags['replay-percent'] || env.AGENT_ONLY_LOAD_REPLAY_PERCENT || 10) || 10)),
    json: flags.json === 'true' || env.AGENT_ONLY_LOAD_JSON === '1',
  };
}

function requireConfig(config) {
  const missing = [];
  if (!config.origin) missing.push('--origin or AGENT_ONLY_LOAD_ORIGIN');
  if (!config.inviteToken) missing.push('--invite-token or AGENT_ONLY_LOAD_INVITE_TOKEN');
  if (missing.length) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchJson(config, path, {
  method = 'GET',
  token = '',
  body = null,
  expectOk = true,
} = {}) {
  const url = new URL(path, config.origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const started = performance.now();
  try {
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== null) headers['content-type'] = 'application/json';
    const response = await fetch(url, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    const elapsedMs = performance.now() - started;
    if (expectOk && (!response.ok || parsed?.ok === false)) {
      const reason = parsed?.reason || parsed?.error || response.statusText;
      throw new Error(`${method} ${url.pathname} failed ${response.status}: ${reason}`);
    }
    return { response, body: parsed, elapsedMs };
  } finally {
    clearTimeout(timeout);
  }
}

function chunk(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

function answerForStatement(statement, principalIndex, statementIndex) {
  const schema = statement.answer_schema || {};
  if ((principalIndex + statementIndex) % 20 === 0) {
    return {
      statement_id: statement.statement_id,
      skipped: true,
      skip_reason: 'privacy_protective',
    };
  }
  if (schema.kind === 'choice') {
    const values = Array.isArray(schema.values) ? schema.values : [];
    return {
      statement_id: statement.statement_id,
      answer: { value: values[(principalIndex + statementIndex) % Math.max(1, values.length)] },
      confidence: 50 + ((principalIndex + statementIndex) % 45),
      rationale: 'Synthetic prediction for load testing.',
    };
  }
  if (schema.kind === 'multichoice') {
    const options = Array.isArray(schema.options) ? schema.options : [];
    return {
      statement_id: statement.statement_id,
      answer: { values: options.slice(0, 1) },
      confidence: 62,
      rationale: 'Synthetic prediction for load testing.',
    };
  }
  if (schema.kind === 'text') {
    return {
      statement_id: statement.statement_id,
      answer: { text: `Synthetic answer ${principalIndex}-${statementIndex}` },
      confidence: 58,
      rationale: 'Synthetic prediction for load testing.',
    };
  }
  return {
    statement_id: statement.statement_id,
    skipped: true,
    skip_reason: 'privacy_protective',
  };
}

function votePayload(statements, mode, principalIndex) {
  const picked = statements.slice(0, mode === 'linear' ? 10 : 4);
  const votes = picked.map((statement, index) => ({
    statement_id: statement.statement_id,
    votes: (principalIndex + index) % 2 === 0 ? (mode === 'linear' ? 10 : 5) : (mode === 'linear' ? -10 : -5),
  }));
  return votes.filter((entry) => entry.votes !== 0);
}

async function fetchAllStatements(config, token) {
  let cursor = '';
  let windowId = '';
  const statements = [];
  do {
    const suffix = new URLSearchParams({
      sessionSlug: config.sessionSlug,
      limit: String(config.statementLimit),
      cursor,
    });
    const result = await fetchJson(config, `/telegram/agent/api/agent-only/statements?${suffix}`, { token });
    if (result.body.window_state === 'not_open') {
      throw new Error('agent_only_window_not_open');
    }
    windowId = result.body.window_id || windowId;
    statements.push(...(Array.isArray(result.body.statements) ? result.body.statements : []));
    cursor = safeString(result.body.cursor);
  } while (cursor);
  return { windowId, statements };
}

async function runPrincipal(config, index) {
  const telegramUserId = String(config.userStart + index);
  const latencies = [];
  const onboard = await fetchJson(config, '/telegram/agent/api/invite/onboard', {
    method: 'POST',
    body: {
      inviteToken: config.inviteToken,
      telegramUserId,
      sessionSlug: config.sessionSlug,
      source: 'agent-only-load-test',
      mode: 'agent_only',
    },
  });
  latencies.push(onboard.elapsedMs);
  const token = safeString(onboard.body?.token);
  if (!token) throw new Error(`principal ${telegramUserId} missing token`);

  const listed = await fetchAllStatements(config, token);
  if (!listed.windowId) throw new Error(`principal ${telegramUserId} missing window id`);
  if (!listed.statements.length) throw new Error(`principal ${telegramUserId} fetched zero statements`);

  let accepted = 0;
  let skips = 0;
  const answerRequests = [];
  const rows = listed.statements.map((statement, statementIndex) => answerForStatement(statement, index, statementIndex));
  for (const [batchIndex, batch] of chunk(rows, 50).entries()) {
    const body = {
      window_id: listed.windowId,
      request_id: `${config.requestPrefix}-p${index}-answers-${batchIndex}`,
      agent_metadata: {
        model: 'agent-only-load-test',
        scaffold_version: 'stage5-load-script',
        agent_initialized_at: '2026-06-12T15:00:00.000Z',
      },
      answers: batch,
    };
    answerRequests.push(body);
    const submitted = await fetchJson(config, '/telegram/agent/api/agent-only/answers/bulk', {
      method: 'POST',
      token,
      body,
    });
    latencies.push(submitted.elapsedMs);
    accepted += Number(submitted.body?.accepted || 0);
    skips += Number(submitted.body?.skipsRecorded || 0);
  }

  const voteBodies = [];
  for (const mode of ['linear', 'quadratic']) {
    const body = {
      window_id: listed.windowId,
      mode,
      request_id: `${config.requestPrefix}-p${index}-votes-${mode}`,
      agent_metadata: {
        model: 'agent-only-load-test',
        scaffold_version: 'stage5-load-script',
        agent_initialized_at: '2026-06-12T15:00:00.000Z',
      },
      votes: votePayload(listed.statements, mode, index),
    };
    voteBodies.push(body);
    const submitted = await fetchJson(config, '/telegram/agent/api/agent-only/token-votes/bulk', {
      method: 'POST',
      token,
      body,
    });
    latencies.push(submitted.elapsedMs);
  }

  let replays = 0;
  const replayEvery = config.replayPercent > 0 ? Math.max(1, Math.floor(100 / config.replayPercent)) : 0;
  if (replayEvery > 0 && index % replayEvery === 0) {
    const replayAnswer = await fetchJson(config, '/telegram/agent/api/agent-only/answers/bulk', {
      method: 'POST',
      token,
      body: answerRequests[0],
    });
    const replayVote = await fetchJson(config, '/telegram/agent/api/agent-only/token-votes/bulk', {
      method: 'POST',
      token,
      body: voteBodies[0],
    });
    latencies.push(replayAnswer.elapsedMs, replayVote.elapsedMs);
    if (replayAnswer.body?.replay === true) replays += 1;
    if (replayVote.body?.replay === true) replays += 1;
  }

  return {
    telegramUserId,
    windowId: listed.windowId,
    statementCount: listed.statements.length,
    accepted,
    skips,
    replays,
    latencies,
  };
}

async function runPool(config) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(config.concurrency, config.principals) }, async () => {
    while (next < config.principals) {
      const index = next;
      next += 1;
      results[index] = await runPrincipal(config, index);
      if (!config.json && (index + 1) % 10 === 0) {
        process.stderr.write(`completed principal ${index + 1}/${config.principals}\n`);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

async function optionalAdminChecks(config, summary) {
  if (!config.adminToken) return { skipped: true, reason: 'admin token not configured' };
  const metricsQuery = new URLSearchParams({ sessionSlug: config.sessionSlug, telegramUserId: String(config.userStart) });
  const metrics = await fetchJson(config, `/telegram/agent/api/admin/metrics?${metricsQuery}`, {
    token: config.adminToken,
  });
  const exportQuery = new URLSearchParams({
    sessionSlug: config.sessionSlug,
    view: 'answers',
    format: 'jsonl',
  });
  const exported = await fetchJson(config, `/telegram/agent/api/admin/agent-only/export?${exportQuery}`, {
    token: config.adminToken,
  });
  const text = safeString(exported.body?.raw || '');
  const rows = text ? text.split(/\n+/).filter(Boolean).length : (Array.isArray(exported.body?.rows) ? exported.body.rows.length : 0);
  return {
    skipped: false,
    metricsAgentOnly: metrics.body?.agentOnly || null,
    answerExportRows: rows,
    expectedAcceptedAtLeast: summary.accepted,
  };
}

async function main() {
  const config = parseArgs();
  requireConfig(config);
  const started = performance.now();
  await fetchJson(config, '/telegram/agent/api/agent-only/start');
  const results = await runPool(config);
  const latencies = results.flatMap((result) => result.latencies);
  const windows = new Set(results.map((result) => result.windowId));
  const statementCounts = new Set(results.map((result) => result.statementCount));
  const summary = {
    origin: config.origin,
    sessionSlug: config.sessionSlug,
    principals: results.length,
    concurrency: config.concurrency,
    windows: [...windows],
    statementCounts: [...statementCounts],
    accepted: results.reduce((sum, result) => sum + result.accepted, 0),
    privacySkips: results.reduce((sum, result) => sum + result.skips, 0),
    replayResponses: results.reduce((sum, result) => sum + result.replays, 0),
    latencyMs: {
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(Math.max(0, ...latencies)),
    },
    elapsedMs: Math.round(performance.now() - started),
    runFingerprint: await sha256Hex(`${config.origin}|${config.sessionSlug}|${config.requestPrefix}|${config.principals}`),
  };
  summary.admin = await optionalAdminChecks(config, summary);
  if (config.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Agent-only load test complete: ${summary.principals} principals, ${summary.accepted} accepted rows, ${summary.privacySkips} privacy skips.`);
    console.log(`Windows: ${summary.windows.join(', ')}; statement counts: ${summary.statementCounts.join(', ')}.`);
    console.log(`Latency ms p50=${summary.latencyMs.p50} p95=${summary.latencyMs.p95} max=${summary.latencyMs.max}; elapsed=${summary.elapsedMs}.`);
    if (summary.admin?.skipped) {
      console.log(`Admin export/metrics check skipped: ${summary.admin.reason}.`);
    } else {
      console.log(`Admin answer export rows=${summary.admin.answerExportRows}; expected accepted at least=${summary.admin.expectedAcceptedAtLeast}.`);
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
