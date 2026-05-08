import assert from 'node:assert/strict';
import test from 'node:test';
import { renderStatusLine } from '../status/statusline.mjs';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '');
}

test('renderStatusLine shows progress, cooldown, and an explicit phase summary when enabled', () => {
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

  assert.match(output, /context-engine/);
  assert.match(output, /0x1111\.\.\.1111/);
  assert.match(output, /2 sessions/);
  assert.match(output, /3 pending/);
  assert.doesNotMatch(output, /submit ready/);
  assert.match(output, /12\/20/);
  assert.doesNotMatch(output, /60%/);
  assert.match(output, /1m 15s/);
  assert.match(output, /freeform: What changed this week\?/);
  assert.match(output, /press q for question/);
  assert.doesNotMatch(output, /\n/);
});

test('renderStatusLine keeps compact progress visible without passive ready noise', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: true,
    wallet: '0x1111111111111111111111111111111111111111',
    config: {
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha'],
    },
    totals: {
      sessions: 1,
      pending: 0,
      answered: 3,
      total: 5,
    },
    cooldown: {
      active: false,
      remainingMs: 0,
    },
  }, {
    cwd: '/tmp/context-engine',
  }));

  assert.match(output, /context-engine/);
  assert.match(output, /3\/5/);
  assert.match(output, /[█░]{4,}/);
  assert.match(output, /press q for question/);
  assert.doesNotMatch(output, /0 pending/);
  assert.doesNotMatch(output, /⏱ ready/);
  assert.doesNotMatch(output, /\n/);
});

test('renderStatusLine keeps only the actionable session sign-in warning', () => {
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

  assert.match(output, /session sign-in needed/);
  assert.doesNotMatch(output, /submit ready/);
});

test('renderStatusLine does not show automatic ready-question hints by default', () => {
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

  assert.match(output, /press q for question/);
  assert.doesNotMatch(output, /binary ready in alpha/);
  assert.doesNotMatch(output, /This prompt should not be rendered/);
  assert.doesNotMatch(output, /\n/);
});

test('renderStatusLine suppresses passive offline and stale cache labels', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: true,
    wallet: '0x1111111111111111111111111111111111111111',
    config: {
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha'],
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
    offline: true,
    stale: true,
  }));

  assert.doesNotMatch(output, /offline/);
  assert.doesNotMatch(output, /showing cache/);
  assert.doesNotMatch(output, /stale/);
});

test('renderStatusLine shows auth-required guidance when token is unavailable', () => {
  const output = stripAnsi(renderStatusLine({
    hasToken: false,
    serverUrl: 'http://localhost:7391',
    config: {
      selectedSessions: [],
    },
  }));

  assert.match(output, /context-engine/);
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
  assert.match(output, /authenticate and select a session/i);
});
