import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANUAL_SCRIPT = resolve(__dirname, 'manual-question.mjs');

function runManualQuestion({ stateDir }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [MANUAL_SCRIPT], {
      env: {
        ...process.env,
        CE_CC_STATE_DIR: stateDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

test('manual question helper fetches compact questions without raw formatted output', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-manual-question-state-'));
  mkdirSync(stateDir, { recursive: true });

  let seenRequest = null;
  const server = createServer((req, res) => {
    seenRequest = {
      url: req.url,
      auth: req.headers.authorization || '',
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      presentation: 'compact',
      question: {
        id: '0x' + '12'.repeat(32),
        session: 'alpha',
        type: 'binary',
        prompt: 'A compact question?',
      },
      stats: {
        total: 2,
        answered: 1,
        pending: 0,
      },
    }));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: `http://127.0.0.1:${port}`,
    selectedSessions: ['alpha'],
  }, null, 2));
  writeFileSync(resolve(stateDir, 'token.jwt'), 'manual-token');

  try {
    const out = await runManualQuestion({ stateDir });
    assert.equal(out.code, 0);
    assert.equal(out.stderr, '');
    const body = JSON.parse(out.stdout || '{}');
    assert.equal(body.status, 'question');
    assert.equal(body.source, 'manual-question');
    assert.equal(body.presentation, 'compact');
    assert.equal(body.formatted, undefined);
    assert.equal(body.question.prompt, 'A compact question?');
    assert.match(seenRequest.url, /presentation=compact/);
    assert.match(seenRequest.url, /reason=manual/);
    assert.equal(seenRequest.auth, 'Bearer manual-token');
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test('manual question helper reports auth-required without a token', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-manual-question-no-token-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: 'http://127.0.0.1:7391',
    selectedSessions: ['alpha'],
  }, null, 2));

  const out = await runManualQuestion({ stateDir });
  assert.equal(out.code, 0);
  assert.equal(out.stderr, '');
  const body = JSON.parse(out.stdout || '{}');
  assert.equal(body.ok, false);
  assert.equal(body.status, 'auth-required');
  assert.equal(body.signInUrl, 'http://127.0.0.1:7391');
});

test('manual question helper reports server-unavailable without failing the process', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-manual-question-unavailable-'));
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: 'http://127.0.0.1:9',
    selectedSessions: ['alpha'],
  }, null, 2));
  writeFileSync(resolve(stateDir, 'token.jwt'), 'manual-token');

  const out = await runManualQuestion({ stateDir });
  assert.equal(out.code, 0);
  assert.equal(out.stderr, '');
  const body = JSON.parse(out.stdout || '{}');
  assert.equal(body.ok, false);
  assert.equal(body.status, 'server-unavailable');
});
