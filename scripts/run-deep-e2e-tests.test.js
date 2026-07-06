'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildDeepE2eSteps,
  isLocalBaseUrl,
  resolveDeepE2eEnv,
} = require('./run-deep-e2e-tests');

test('resolveDeepE2eEnv fills missing session target from the active session artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-deep-e2e-'));
  const activeSessionFile = path.join(dir, 'active-ai-test-session.json');
  fs.writeFileSync(activeSessionFile, JSON.stringify({
    slug: 'e2e-active',
    workerUrl: 'https://session-worker.example.test',
  }), 'utf8');

  const result = resolveDeepE2eEnv({}, { activeSessionFile });

  assert.equal(result.env.SESSION_SLUG, 'e2e-active');
  assert.equal(result.env.SESSION_WORKER_URL, 'https://session-worker.example.test');
  assert.deepEqual(result.missing, []);
});

test('resolveDeepE2eEnv preserves explicit env and prefers CE_SESSION_WORKER_BASE_URL for session worker URL', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-deep-e2e-'));
  const activeSessionFile = path.join(dir, 'active-ai-test-session.json');
  fs.writeFileSync(activeSessionFile, JSON.stringify({
    slug: 'e2e-active',
    workerUrl: 'https://active-worker.example.test',
  }), 'utf8');

  const result = resolveDeepE2eEnv({
    SESSION_SLUG: 'explicit-session',
    CE_SESSION_WORKER_BASE_URL: 'https://configured-session-worker.example.test',
  }, { activeSessionFile });

  assert.equal(result.env.SESSION_SLUG, 'explicit-session');
  assert.equal(result.env.SESSION_WORKER_URL, 'https://configured-session-worker.example.test');
  assert.deepEqual(result.missing, []);
});

test('isLocalBaseUrl limits automatic app-server startup to local targets', () => {
  assert.equal(isLocalBaseUrl('http://127.0.0.1:3000'), true);
  assert.equal(isLocalBaseUrl('http://localhost:3000'), true);
  assert.equal(isLocalBaseUrl('https://contextengine.xyz'), false);
  assert.equal(isLocalBaseUrl('not a url'), false);
});

test('buildDeepE2eSteps only includes private bridge checks when the root script is available', () => {
  const baseScripts = {
    'ai:test-worker-scopes:matrix': 'npm run -s ai:node -- scripts/test-worker-scopes-matrix.js',
    'ai:test-gated-decrypt:all-types': 'npm run -s ai:node -- scripts/test-session-gated-decrypt-all-types.js',
    'ai:test-survey-response:encryption-matrix': 'npm run -s ai:node -- scripts/test-survey-response-encryption-matrix.js',
    'ai:test-doc-library:session:filetypes': 'npm run -s ai:node -- scripts/test-doc-library-session-filetypes.js',
  };

  assert.deepEqual(
    buildDeepE2eSteps({}).map(([label]) => label),
    [],
  );

  assert.deepEqual(
    buildDeepE2eSteps(baseScripts).map(([label]) => label),
    [
      'worker scope matrix',
      'gated decrypt all types',
      'survey response encryption matrix',
      'doc library session filetypes',
    ],
  );

  assert.deepEqual(
    buildDeepE2eSteps({
      ...baseScripts,
      'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
    })
      .map(([label]) => label),
    [
      'worker scope matrix',
      'gated decrypt all types',
      'survey response encryption matrix',
      'doc library session filetypes',
      'agent bridge worker',
    ],
  );
});

test('Cloudflare envelope package scripts point to tracked runner files', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const scriptNames = [
    'ai:test-cf-envelope:worker',
    'ai:test-cf-envelope:groups',
    'ai:test-cf-envelope:group-gates',
    'ai:test-cf-envelope:key-lifecycle',
  ];

  if (!Object.prototype.hasOwnProperty.call(scripts, 'ai:test-cf-envelope:all')) {
    assert.equal(
      buildDeepE2eSteps(scripts).find(([label]) => label === 'Cloudflare envelope and groups'),
      undefined,
    );
    return;
  }

  assert.deepEqual(
    buildDeepE2eSteps(scripts).find(([label]) => label === 'Cloudflare envelope and groups'),
    ['Cloudflare envelope and groups', ['run', '-s', 'ai:test-cf-envelope:all']],
  );

  const tracked = new Set(
    execFileSync('git', ['ls-files'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
      .split('\n')
      .filter(Boolean),
  );

  for (const name of scriptNames) {
    const command = scripts[name] || '';
    const match = command.match(/--\s+(scripts\/\S+\.js)\b/);
    assert.ok(match, `${name} should call a script file`);
    const scriptPath = match[1];
    assert.equal(fs.existsSync(path.join(__dirname, '..', scriptPath)), true, `${name} target must exist`);
    assert.equal(tracked.has(scriptPath), true, `${name} target must be tracked`);
  }
});
