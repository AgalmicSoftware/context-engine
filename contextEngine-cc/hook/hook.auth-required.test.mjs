import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_SCRIPT = resolve(__dirname, 'hook.mjs');

function assertSecureMode(filePath) {
  if (process.platform === 'win32') return;
  assert.equal(statSync(filePath).mode & 0o777, 0o600);
}

function runHook({ stateDir, hookInput }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [HOOK_SCRIPT], {
      env: {
        ...process.env,
        CE_CC_STATE_DIR: stateDir,
        CE_CC_DISABLE_OPEN: '1',
        CE_CC_DISABLE_NOTIFY: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(hookInput));
  });
}

test('auth-required path returns hook context instead of silently swallowing ReferenceError', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-hook-state-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: 'http://localhost:7391',
    defaultSession: 'alpha',
    selectedSessions: ['alpha'],
  }, null, 2));

  const out = await runHook({
    stateDir,
    hookInput: {
      tool_name: 'Task',
      tool_input: { timeout: 60000 },
    },
  });

  assert.equal(out.code, 0);
  assert.ok(out.stdout.trim().length > 0, 'expected hook JSON output for auth-required path');
  const payload = JSON.parse(out.stdout);
  assert.equal(payload?.hookSpecificOutput?.permissionDecision, 'allow');
  assert.match(
    String(payload?.hookSpecificOutput?.additionalContext || ''),
    /auth required/i,
  );
  assertSecureMode(resolve(stateDir, 'last-auth-ts'));
  assertSecureMode(resolve(stateDir, 'dashboard.json'));
  const dashboard = JSON.parse(readFileSync(resolve(stateDir, 'dashboard.json'), 'utf8'));
  assert.equal(dashboard.phase, 'auth-required');
});

test('save command honors server-provided encrypt defaults without injecting conviction defaults', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-hook-state-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'token.jwt'), 'test-token');

  const server = createServer((req, res) => {
    if (!req.url?.startsWith('/api/hook/question')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      question: {
        id: 'q-defaults',
        prompt: 'Prompt from test server',
        type: 'binary',
      },
      wallet: '0x1111111111111111111111111111111111111111',
      stats: { total: 3, answered: 1, remaining: 2, pending: 3 },
      cooldownMs: 45000,
      defaults: {
        encrypt: true,
      },
    }));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: `http://127.0.0.1:${port}`,
    defaultSession: 'alpha',
    selectedSessions: ['alpha'],
    questionSurfacingMode: 'ambient',
    ambientInterruptions: true,
  }, null, 2));

  try {
    const out = await runHook({
      stateDir,
      hookInput: {
        tool_name: 'Task',
        tool_input: { timeout: 60000 },
      },
    });

    assert.equal(out.code, 0);
    assert.ok(out.stdout.trim().length > 0);
    const payload = JSON.parse(out.stdout);
    const ctx = String(payload?.hookSpecificOutput?.additionalContext || '');
    assert.match(ctx, /"encrypt":true/);
    assert.doesNotMatch(ctx, /"conviction":/);
    assert.match(ctx, /3 pending/);
    const submitScriptMatch = ctx.match(/node '([^']+submit\.mjs)'/);
    assert.ok(submitScriptMatch, 'expected save command to reference submit.mjs');
    assert.equal(existsSync(submitScriptMatch[1]), true, 'expected save command submit.mjs path to exist');
    assertSecureMode(resolve(stateDir, 'last-ts'));
    assertSecureMode(resolve(stateDir, 'dashboard.json'));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test('explicit default-session selections do not fall back to waiting-config', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-hook-default-session-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: 'http://localhost:7391',
    defaultSession: '',
  }, null, 2));

  const out = await runHook({
    stateDir,
    hookInput: {
      tool_name: 'Task',
      tool_input: { timeout: 60000 },
    },
  });

  assert.equal(out.code, 0);
  const payload = JSON.parse(out.stdout);
  assert.equal(payload?.hookSpecificOutput?.permissionDecision, 'allow');
  assert.match(
    String(payload?.hookSpecificOutput?.additionalContext || ''),
    /auth required/i,
  );
  const dashboard = JSON.parse(readFileSync(resolve(stateDir, 'dashboard.json'), 'utf8'));
  assert.equal(dashboard.phase, 'auth-required');
  assert.deepEqual(dashboard.selectedSessions, ['']);
});

test('statusline hint mode does not refetch during hint cooldown', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-hook-hint-cooldown-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'token.jwt'), 'test-token');

  let requestCount = 0;
  const server = createServer((req, res) => {
    if (!req.url?.startsWith('/api/hook/question')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    requestCount += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      question: {
        id: '0x' + 'ab'.repeat(32),
        prompt: 'Hint-only prompt',
        type: 'binary',
      },
      wallet: '0x1111111111111111111111111111111111111111',
      stats: { total: 3, answered: 1, remaining: 2, pending: 0 },
      cooldownMs: 45000,
      defaults: {},
    }));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: `http://127.0.0.1:${port}`,
    defaultSession: 'alpha',
    selectedSessions: ['alpha'],
    questionSurfacingMode: 'manual',
    statuslineQuestionHints: true,
  }, null, 2));

  try {
    const hookInput = {
      tool_name: 'Task',
      tool_input: { timeout: 60000 },
    };

    const first = await runHook({ stateDir, hookInput });
    assert.equal(first.code, 0);
    assert.equal(first.stdout.trim(), '');
    assert.equal(requestCount, 1);

    const dashboard = JSON.parse(readFileSync(resolve(stateDir, 'dashboard.json'), 'utf8'));
    assert.equal(dashboard.phase, 'question-ready');
    assertSecureMode(resolve(stateDir, 'last-hint-ts'));

    const second = await runHook({ stateDir, hookInput });
    assert.equal(second.code, 0);
    assert.equal(second.stdout.trim(), '');
    assert.equal(requestCount, 1);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
