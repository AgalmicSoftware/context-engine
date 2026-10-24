import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSessionPolicy } from './sessionPolicy.mjs';

test('normalizeSessionPolicy preserves one exact canonical Worker session id', () => {
  const sessionId = `0x${'12'.repeat(16)}`;
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'alpha',
    sessions: [{
      sessionSlug: 'alpha',
      sessionId,
      sessionIdHex: sessionId.toUpperCase(),
      sessionWorkerUrl: 'https://session-worker.example',
      sessionModeProfile: {
        authority: { mode: 'worker_canonical' },
        surfaces: { agentHttp: true },
      },
    }],
  });

  assert.equal(policy.linkedSessions[0].sessionIdHex, sessionId);
});

test('normalizeSessionPolicy drops malformed or conflicting Worker session ids so auth fails closed', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'alpha',
    sessions: [
      {
        sessionSlug: 'alpha',
        sessionId: `0x${'12'.repeat(16)}`,
        sessionIdHex: `0x${'34'.repeat(16)}`,
      },
      {
        sessionSlug: 'beta',
        sessionId: 'not-a-session-id',
      },
    ],
  });

  assert.equal(policy.linkedSessions[0].sessionIdHex, null);
  assert.equal(policy.linkedSessions[1].sessionIdHex, null);
});

test('normalizeSessionPolicy pins worker-canonical origins per session while retaining registry fallback compatibility', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'worker-missing-origin',
    sessionWorkerUrl: 'https://generic-worker.example',
    sessions: [
      {
        sessionSlug: 'worker-missing-origin',
        sessionIdHex: `0x${'12'.repeat(16)}`,
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          surfaces: { agentHttp: true },
        },
      },
      {
        sessionSlug: 'worker-pinned-origin',
        sessionIdHex: `0x${'34'.repeat(16)}`,
        sessionWorkerUrl: 'https://pinned-worker.example',
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          surfaces: { agentHttp: true },
        },
      },
      {
        sessionSlug: 'registry-compatible',
        sessionModeProfile: {
          authority: { mode: 'registry_canonical' },
          surfaces: { agentHttp: true },
        },
      },
    ],
  });
  const bySlug = new Map(policy.linkedSessions.map((session) => [session.sessionSlug, session]));

  assert.equal(bySlug.get('worker-missing-origin').sessionWorkerUrl, null);
  assert.equal(bySlug.get('worker-pinned-origin').sessionWorkerUrl, 'https://pinned-worker.example');
  assert.equal(bySlug.get('registry-compatible').sessionWorkerUrl, 'https://generic-worker.example');
});
