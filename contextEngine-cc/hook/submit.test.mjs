import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBMIT_SCRIPT = resolve(__dirname, 'submit.mjs');

function runSubmit({ stateDir, meta, additionalFile, answer }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      SUBMIT_SCRIPT,
      '--meta',
      JSON.stringify(meta),
      '--additional-file',
      additionalFile,
    ], {
      env: {
        ...process.env,
        CE_CC_STATE_DIR: stateDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
    child.stdin.end(answer);
  });
}

test('submit wrapper posts stdin answer and additional file to /api/respond', async () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), 'ce-hook-submit-state-'));
  mkdirSync(stateDir, { recursive: true });

  let seenRequest = null;
  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      seenRequest = {
        method: req.method,
        url: req.url,
        auth: req.headers.authorization || '',
        body: JSON.parse(data || '{}'),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, stored: true }));
    });
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  writeFileSync(resolve(stateDir, 'config.json'), JSON.stringify({
    serverUrl: `http://127.0.0.1:${port}`,
  }, null, 2));
  writeFileSync(resolve(stateDir, 'token.jwt'), 'wrapper-token');

  const additionalFile = resolve(stateDir, 'additional.txt');
  writeFileSync(additionalFile, 'second line comment\n');

  try {
    const out = await runSubmit({
      stateDir,
      meta: {
        questionId: '0x1111111111111111111111111111111111111111111111111111111111111111',
        session: 'alpha',
        questionType: 'freeform',
        conviction: 'high',
        encrypt: true,
      },
      additionalFile,
      answer: 'First answer line\n',
    });

    assert.equal(out.code, 0);
    assert.equal(JSON.parse(out.stdout).ok, true);
    assert.equal(out.stderr, '');
    assert.deepEqual(seenRequest, {
      method: 'POST',
      url: '/api/respond',
      auth: 'Bearer wrapper-token',
      body: {
        questionId: '0x1111111111111111111111111111111111111111111111111111111111111111',
        session: 'alpha',
        questionType: 'freeform',
        conviction: 'high',
        encrypt: true,
        answer: 'First answer line',
        additional: 'second line comment',
      },
    });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
