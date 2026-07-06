'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ACTIVE_SESSION_FILE = path.join(ROOT, 'artifacts', 'session-workflows', 'active-ai-test-session.json');

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

function readActiveSession(filePath = ACTIVE_SESSION_FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function resolveDeepE2eEnv(baseEnv = process.env, options = {}) {
  const env = { ...baseEnv };
  const activeSession = readActiveSession(options.activeSessionFile || ACTIVE_SESSION_FILE);
  const activeSlug = toStr(activeSession?.slug).trim();
  const activeWorkerUrl = toStr(activeSession?.workerUrl).trim();

  if (!toStr(env.SESSION_SLUG).trim() && activeSlug) {
    env.SESSION_SLUG = activeSlug;
  }

  if (!toStr(env.SESSION_WORKER_URL).trim()) {
    const configuredSessionWorker = toStr(env.CE_SESSION_WORKER_BASE_URL).trim();
    env.SESSION_WORKER_URL = configuredSessionWorker || activeWorkerUrl;
  }

  return {
    env,
    activeSession,
    missing: [
      ['SESSION_SLUG', env.SESSION_SLUG],
      ['SESSION_WORKER_URL', env.SESSION_WORKER_URL],
    ]
      .filter(([, value]) => !toStr(value).trim())
      .map(([name]) => name),
  };
}

function runStep(label, args, env) {
  console.log(`[test:deep] ${label}`);
  const result = spawnSync('npm', args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return typeof result.status === 'number' ? result.status : 1;
}

function readPackageScripts(packageJsonPath = path.join(ROOT, 'package.json')) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  } catch (_error) {
    return {};
  }
}

function buildDeepE2eSteps(packageScripts = readPackageScripts()) {
  const steps = [
    ['worker scope matrix', ['run', '-s', 'ai:test-worker-scopes:matrix']],
    ['gated decrypt all types', ['run', '-s', 'ai:test-gated-decrypt:all-types']],
    ['survey response encryption matrix', ['run', '-s', 'ai:test-survey-response:encryption-matrix']],
    ['doc library session filetypes', ['run', '-s', 'ai:test-doc-library:session:filetypes']],
  ];

  if (Object.prototype.hasOwnProperty.call(packageScripts, 'test:worker:agent-bridge')) {
    steps.push(['agent bridge worker', ['run', '-s', 'test:worker:agent-bridge']]);
  }

  if (Object.prototype.hasOwnProperty.call(packageScripts, 'ai:test-cf-envelope:all')) {
    steps.push(['Cloudflare envelope and groups', ['run', '-s', 'ai:test-cf-envelope:all']]);
  }

  return steps;
}

function isLocalBaseUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

async function waitForHttpOk(url, { timeoutMs = 90_000, intervalMs = 750 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status < 500) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function ensureAppServer(env) {
  const baseUrl = toStr(env.BASE_URL || 'http://127.0.0.1:3000').trim().replace(/\/+$/, '');
  env.BASE_URL = baseUrl;

  try {
    await waitForHttpOk(baseUrl, { timeoutMs: 2_000, intervalMs: 250 });
    console.log(`[test:deep] app server already reachable at ${baseUrl}`);
    return { started: false, stop: async () => {} };
  } catch (_error) {
    if (!isLocalBaseUrl(baseUrl)) {
      throw new Error(`BASE_URL is not reachable and is not local: ${baseUrl}`);
    }
  }

  console.log(`[test:deep] starting local app server at ${baseUrl}`);
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(ROOT, 'client'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (/Local:|ready in|VITE/i.test(text)) process.stdout.write(`[test:deep:dev] ${text}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[test:deep:dev] ${chunk.toString()}`);
  });

  let exited = false;
  child.once('exit', (code, signal) => {
    exited = true;
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[test:deep] app server exited early with code=${code} signal=${signal || ''}`);
    }
  });

  await waitForHttpOk(baseUrl, { timeoutMs: 120_000, intervalMs: 1_000 });
  if (exited) throw new Error('App server exited before becoming usable.');

  return {
    started: true,
    stop: async () => {
      if (child.killed || exited) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5_000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}

function runDeepE2eTests(baseEnv = process.env) {
  const { env, activeSession, missing } = resolveDeepE2eEnv(baseEnv);
  if (missing.length) {
    console.error(
      `[test:deep] Missing ${missing.join(', ')}. Set the env vars directly or refresh ${path.relative(ROOT, ACTIVE_SESSION_FILE)}.`
    );
    return 1;
  }

  console.log('[test:deep] target', JSON.stringify({
    sessionSlug: env.SESSION_SLUG,
    sessionWorkerUrl: '<set>',
    activeSessionArtifact: activeSession ? path.relative(ROOT, ACTIVE_SESSION_FILE) : null,
  }));

  const steps = buildDeepE2eSteps();

  return ensureAppServer(env)
    .then(async (server) => {
      try {
        for (const [label, args] of steps) {
          const status = runStep(label, args, env);
          if (status !== 0) return status;
        }
        return 0;
      } finally {
        await server.stop();
      }
    })
    .catch((error) => {
      console.error(error?.stack || error?.message || String(error));
      return 1;
    });
}

if (require.main === module) {
  Promise.resolve(runDeepE2eTests()).then((status) => process.exit(status));
}

module.exports = {
  ACTIVE_SESSION_FILE,
  buildDeepE2eSteps,
  ensureAppServer,
  isLocalBaseUrl,
  readPackageScripts,
  readActiveSession,
  resolveDeepE2eEnv,
  runDeepE2eTests,
  waitForHttpOk,
};
