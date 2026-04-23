import assert from 'node:assert/strict';
import test from 'node:test';
import { renderStatusLine } from '../status/statusline.mjs';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '');
}

test('renderStatusLine shows progress, cooldown, and latest question summary', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: true,
    wallet: '0x1111111111111111111111111111111111111111',
    config: {
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha', 'beta'],
      showPhaseSummary: true,
    },
    totals: {
      sessions: 2,
      pending: 3,
      answered: 12,
      total: 20,
    },
    cooldown: {
      active: true,
      remainingMs: 75_000,
    },
    submit: {
      ready: true,
      mode: 'batch',
    },
    dashboard: {
      phase: 'question',
      question: {
        type: 'freeform',
        prompt: 'What changed this week?',
      },
    },
  }, {
    cwd: '/tmp/memewars',
  }));

  assert.match(output, /CE/);
  assert.match(output, /0x1111\.\.\.1111/);
  assert.match(output, /2 sessions/);
  assert.match(output, /3 pending/);
  assert.match(output, /submit ready/);
  assert.match(output, /60%/);
  assert.match(output, /12\/20/);
  assert.match(output, /1m 15s/);
  assert.match(output, /freeform: What changed this week\?/);
});

test('renderStatusLine flags worker auth gaps separately from submit readiness', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: true,
    wallet: '0x1111111111111111111111111111111111111111',
    config: {
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha'],
    },
    totals: {
      sessions: 1,
      pending: 1,
      answered: 1,
      total: 4,
    },
    cooldown: {
      active: false,
      remainingMs: 0,
    },
    submit: {
      ready: true,
      mode: 'immediate',
      workerTokens: {
        ready: false,
        missingCount: 1,
      },
    },
  }));

  assert.match(output, /submit ready/);
  assert.match(output, /worker auth needed/);
});

test('renderStatusLine shows ready-question hints without prompt text', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: true,
    wallet: '0x1111111111111111111111111111111111111111',
    config: {
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha'],
      statuslineQuestionHints: true,
    },
    totals: {
      sessions: 1,
      pending: 0,
      answered: 2,
      total: 5,
    },
    cooldown: {
      active: false,
      remainingMs: 0,
    },
    dashboard: {
      phase: 'question-ready',
      session: 'alpha',
      question: {
        type: 'binary',
        prompt: 'This prompt should not be rendered in a ready hint.',
      },
    },
  }));

  assert.match(output, /binary ready in alpha/);
  assert.doesNotMatch(output, /This prompt should not be rendered/);
});

test('renderStatusLine shows auth-required guidance when token is unavailable', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: false,
    serverUrl: 'http://localhost:7391',
    config: {
      selectedSessions: [],
    },
  }));

  assert.match(output, /CE/);
  assert.match(output, /auth required/);
  assert.match(output, /localhost:7391/);
  assert.match(output, /authenticate and select a session/i);
});

test('renderStatusLine counts an explicit general defaultSession as a configured session', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: false,
    serverUrl: 'http://localhost:7391',
    config: {
      selectedSessions: normalizeConfiguredSessions({
        defaultSession: '',
      }),
    },
  }));

  assert.match(output, /1 session selected/);
  assert.match(output, /sign in to load progress/);
});
