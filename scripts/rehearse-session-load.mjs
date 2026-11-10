import { randomBytes, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Wallet } from 'ethers';
import { consumeNonce } from '../workers/sessionCorsWorker/nonceLifecycle.js';
import { fixture, enforceKvWriteLimit, sessionId } from '../workers/sessionCorsWorker/agentTestFixture.mjs';
import { buildSiweMessage, installSessionCoordinatorBinding } from '../tests/helpers/sessionCorsWorkerTestUtils.mjs';

// In-process only: no network transport or remote override exists. Fixture fetch rejects external requests.
export function parseRehearsalArgs(args) {
  const options = { participants: 40, jitterMs: 20, enforceKvLimit: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--participants') options.participants = Number(args[++i]);
    else if (args[i] === '--kv-limit') options.enforceKvLimit = true;
    else throw new Error('Only --participants <1..100> and --kv-limit are supported; this rehearsal is in-process only.');
  }
  if (!Number.isInteger(options.participants) || options.participants < 1 || options.participants > 100) throw new Error('Participants must be an integer from 1 to 100.');
  return options;
}

const percentile = (values, percentile) => values.length ? Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * percentile) - 1] * 100) / 100 : 0;
const hash = value => createHash('sha256').update(value).digest('hex');

export async function runRehearsal({ participants = 40, jitterMs = 20, enforceKvLimit = false } = {}) {
  parseRehearsalArgs(['--participants', String(participants)]);
  if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 1000) throw new Error('Jitter must be between 0 and 1000 milliseconds.');
  const f = fixture({ consumeNonce });
  f.withCoordinator();
  const sessionBinding = f.env.CE_SESSION_COORDINATOR;
  delete f.env.CE_SESSION_COORDINATOR;
  installSessionCoordinatorBinding(f.env);
  const partitioned = f.env.CE_SESSION_COORDINATOR;
  // The focused agent fixture uses one object; load tests must preserve real per-identity partitions.
  f.env.CE_SESSION_COORDINATOR = {
    idFromName: name => name,
    get: id => id === hash('session-config:fixture') ? sessionBinding.get(id) : partitioned.get(id),
  };
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const operator = await f.credential({ scopes: ['read_questions', 'pose_questions', 'draft_answers'] });
  const created = await f.request('/api/agent/questions/create', { method: 'POST', token: operator.token,
    body: { questions: [{ prompt: 'Should a community pilot be reviewed publicly?', questionType: 'binary' }] } });
  if (!created.ok) throw new Error('Local question setup failed.');
  const catalog = await (await f.request('/api/agent/questions', { token: operator.token })).json();
  const questionId = catalog.questions[0].questionId;
  const configured = await f.request('/api/agent/admin/agent-only/config', { method: 'POST', token: operator.token,
    body: { enabledQuestionIds: [questionId] } });
  if (!configured.ok) throw new Error('Local Wrapped setup failed.');
  const agentCount = Math.ceil(participants / 2);
  const invites = Array.from({ length: agentCount }, () => randomBytes(32).toString('base64url'));
  f.config.agentHttp.invites = invites.map(value => ({ tokenHash: hash(value) }));
  const kvLimit = enforceKvLimit ? enforceKvWriteLimit(f.env.GROUP_KV) : null;
  const latencies = [], byStep = {}, storedIds = new Set();
  const errors = { total: 0, '429': 0, '409': 0, '5xx': 0, other: 0, semantic: 0 };
  const completed = { agents: 0, web: 0, wrapped: 0 };
  const delay = () => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * jitterMs)));
  async function request(step, path, options) {
    await delay();
    const started = performance.now();
    let response, body;
    try {
      response = await f.request(path, { ...options, headers: { 'CF-Connecting-IP': '192.0.2.1', ...options?.headers } });
      body = await response.json();
    } catch {
      response = { status: 500, ok: false };
    }
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    const metric = byStep[step] ||= { requests: 0, succeeded: 0, statuses: {}, latency: [] };
    metric.requests++;
    metric.statuses[response.status] = (metric.statuses[response.status] || 0) + 1;
    metric.latency.push(elapsed);
    if (!response.ok || body?.ok === false) {
      errors.total++;
      const kind = response.status === 429 ? '429' : response.status === 409 ? '409' : response.status >= 500 ? '5xx' : response.ok ? 'semantic' : 'other';
      errors[kind]++;
      throw Object.assign(new Error('Local rehearsal step failed.'), { counted: true });
    }
    metric.succeeded++;
    return body;
  }
  async function agent(index) {
    const onboard = await request('invite', '/api/agent/invite/onboard', { method: 'POST', body: { sessionSlug: 'fixture', inviteToken: invites[index] } });
    const token = onboard.token;
    await request('questions', '/api/agent/questions', { token });
    // Existing exchanges preserve the distinct user and Wrapped credential purposes.
    const login = await request('agent-browser-exchange', '/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'fixture', token } });
    const member = await request('wrapped-member-exchange', '/api/agent/wrapped/member-exchange', { method: 'POST', token: login.workerCredential.token, body: {} });
    const page = await request('wrapped-statements', '/api/agent/agent-only/statements', { token: member.token });
    await request('wrapped-predictions', '/api/agent/agent-only/answers/bulk', { method: 'POST', token: member.token, body: {
      run_id: `synthetic-run-${index}`, agent_metadata: { model: 'synthetic-fixture', scaffold_version: 'rehearsal-v1' },
      answers: page.statements.map(q => ({ statement_id: q.statement_id, statement_version: q.statement_version, answer: { value: 'agree' }, confidence: 80 })),
    } });
    completed.wrapped++;
    const submitted = await request('agent-submit', '/api/agent/preferences', { method: 'POST', token, body: {
      preferences: [{ questionId, value: 'Agree' }], submit: true, humanApproved: true,
    } });
    if (submitted.submittedCount !== 1) { errors.total++; errors.semantic++; throw Object.assign(new Error('No submitted response.'), { counted: true }); }
    completed.agents++;
  }
  async function web(index) {
    const wallet = Wallet.createRandom();
    const headers = { Origin: 'https://client.example', 'Content-Type': 'application/json', 'X-Session-Slug': 'fixture' };
    const nonce = await request('web-nonce', '/auth/nonce', { method: 'POST', headers, body: { address: wallet.address, sessionSlug: 'fixture', sessionId } });
    const message = buildSiweMessage({ domain: 'client.example', uri: 'https://client.example', address: wallet.address,
      nonce: nonce.nonce, chainId: 11155420, sessionSlug: 'fixture', sessionId,
      resources: ['https://session.example', `urn:context-engine:session:id:${sessionId}`] });
    const login = await request('web-login', '/auth/login', { method: 'POST', headers, body: {
      address: wallet.address, sessionSlug: 'fixture', sessionId, message, signature: await wallet.signMessage(message),
    } });
    const saved = await request('web-submit', '/storage/upload', { method: 'POST', headers, token: login.token, body: {
      resource: 'responses', contentType: 'application/json', requestId: `synthetic-web-${index}`,
      data: { questionID: questionId, type: 'binary', answer: { value: 'Agree', encrypted: false }, additional: { value: '', encrypted: false } },
    } });
    if (!saved.id) { errors.total++; errors.semantic++; throw Object.assign(new Error('No saved response.'), { counted: true }); }
    storedIds.add(saved.id);
    completed.web++;
  }
  const started = performance.now();
  const outcomes = await Promise.allSettled(Array.from({ length: participants }, (_, i) => i < agentCount ? agent(i) : web(i)));
  for (const outcome of outcomes) if (outcome.status === 'rejected' && !outcome.reason?.counted) { errors.total++; errors.other++; }
  // Count immutable response metadata, not journals or one duplicate payload copy per backend.
  const persisted = [...f.records.values()].flatMap(value => { try { return [JSON.parse(value)]; } catch { return []; } });
  for (const value of persisted) if (value.resource === 'responses' && value.id && value.responder) storedIds.add(value.id);
  return {
    mode: 'in-process', sharedSyntheticNetwork: true, participants, agentParticipants: agentCount, webParticipants: participants - agentCount,
    kvWriteLimitEnforced: enforceKvLimit, kvRejectedWrites: kvLimit?.rejected.length || 0, kvCheckedWrites: kvLimit?.writes.length || 0,
    durationMs: Math.round(performance.now() - started), requests: latencies.length, completed, storedResponses: storedIds.size,
    latencyMs: { p50: percentile(latencies, .5), p95: percentile(latencies, .95), max: Math.round(Math.max(0, ...latencies)) }, errors,
    steps: Object.fromEntries(Object.entries(byStep).map(([key, value]) => [key, {
      requests: value.requests, succeeded: value.succeeded, statuses: value.statuses,
      p50Ms: percentile(value.latency, .5), p95Ms: percentile(value.latency, .95),
    }])),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runRehearsal(parseRehearsalArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.total) process.exitCode = 1;
  } catch {
    console.error('Rehearsal failed. Use only --participants <1..100> and --kv-limit; no external targets are supported.');
    process.exitCode = 1;
  }
}
