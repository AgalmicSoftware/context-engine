import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const STARTUP_PATH = resolve(ROOT_DIR, 'hook', 'startup.sh');
const PROTOCOL_PATH = resolve(ROOT_DIR, 'CLAUDE_EXTENSION.md');

function makePluginDir({ withProtocol = true, serverUrl = 'http://127.0.0.1:9', ceDir = '' } = {}) {
  const pluginDir = mkdtempSync(resolve(tmpdir(), 'ce-startup-plugin-'));
  mkdirSync(resolve(pluginDir, 'hook'), { recursive: true });
  mkdirSync(resolve(pluginDir, '.state'), { recursive: true });

  copyFileSync(STARTUP_PATH, resolve(pluginDir, 'hook', 'startup.sh'));
  chmodSync(resolve(pluginDir, 'hook', 'startup.sh'), 0o755);
  writeFileSync(
    resolve(pluginDir, '.state', 'config.json'),
    JSON.stringify({
      serverUrl,
      ...(ceDir ? { ceDir } : {}),
    }, null, 2),
  );

  if (withProtocol) {
    copyFileSync(PROTOCOL_PATH, resolve(pluginDir, 'CLAUDE_EXTENSION.md'));
  }

  return pluginDir;
}

function makeCeDir() {
  const ceDir = mkdtempSync(resolve(tmpdir(), 'ce-startup-server-'));
  writeFileSync(
    resolve(ceDir, 'package.json'),
    JSON.stringify({
      name: 'ce-startup-test',
      private: true,
      type: 'module',
      scripts: {
        start: 'node touch-started.mjs',
      },
    }, null, 2),
  );
  writeFileSync(resolve(ceDir, 'server.mjs'), 'export {};\n');
  writeFileSync(
    resolve(ceDir, 'touch-started.mjs'),
    "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('./started.txt', import.meta.url), 'started');\n",
  );
  return ceDir;
}

function makeSlowCeDir() {
  const ceDir = mkdtempSync(resolve(tmpdir(), 'ce-startup-slow-server-'));
  writeFileSync(
    resolve(ceDir, 'package.json'),
    JSON.stringify({
      name: 'ce-startup-slow-test',
      private: true,
      type: 'module',
      scripts: {
        start: 'node slow-start.mjs',
      },
    }, null, 2),
  );
  writeFileSync(resolve(ceDir, 'server.mjs'), 'export {};\n');
  writeFileSync(
    resolve(ceDir, 'slow-start.mjs'),
    [
      "import { appendFileSync } from 'node:fs';",
      "appendFileSync(new URL('./launches.log', import.meta.url), 'launch\\n');",
      "await new Promise((resolve) => setTimeout(resolve, 4000));",
    ].join('\n'),
  );
  return ceDir;
}

function waitForFile(pathname, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(pathname)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  return false;
}

function makeStartupLockDir() {
  return mkdtempSync(resolve(tmpdir(), 'ce-startup-locks-'));
}

function runStartupHook({
  pluginDir,
  ceDir = '',
  serverUrl = 'http://127.0.0.1:9',
  startupLockDir = '',
} = {}) {
  return execFileSync('bash', [resolve(pluginDir, 'hook', 'startup.sh')], {
    cwd: pluginDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(ceDir ? { CE_DIR: ceDir } : {}),
      ...(startupLockDir ? { CE_CC_STARTUP_LOCK_DIR: startupLockDir } : {}),
      SERVER_URL: serverUrl,
    },
  });
}

test('startup hook emits additionalContext from the plugin protocol file', () => {
  const pluginDir = makePluginDir();
  const startupLockDir = makeStartupLockDir();
  const output = runStartupHook({ pluginDir, startupLockDir });

  const payload = JSON.parse(output);
  assert.equal(payload?.hookSpecificOutput?.hookEventName, 'SessionStart');
  assert.equal(payload?.hookSpecificOutput?.additionalContext, readFileSync(PROTOCOL_PATH, 'utf8'));
});

test('startup hook succeeds without CLAUDE_EXTENSION.md', () => {
  const pluginDir = makePluginDir({ withProtocol: false });
  const startupLockDir = makeStartupLockDir();
  const output = runStartupHook({ pluginDir, startupLockDir });

  assert.deepEqual(JSON.parse(output), {});
});

test('startup hook tries to start the local CE server when CE_DIR is available', () => {
  const pluginDir = makePluginDir({ withProtocol: false });
  const ceDir = makeCeDir();
  const startupLockDir = makeStartupLockDir();
  const markerPath = resolve(ceDir, 'started.txt');

  runStartupHook({ pluginDir, ceDir, startupLockDir });

  assert.equal(waitForFile(markerPath), true);
});

test('startup hook falls back to the installed ceDir from config when CE_DIR is unset', () => {
  const ceDir = makeCeDir();
  const pluginDir = makePluginDir({ withProtocol: false, ceDir });
  const startupLockDir = makeStartupLockDir();
  const markerPath = resolve(ceDir, 'started.txt');

  runStartupHook({ pluginDir, startupLockDir });

  assert.equal(waitForFile(markerPath), true);
});

test('startup hook does not relaunch npm start while a previous local startup is still in flight', () => {
  const pluginDir = makePluginDir({ withProtocol: false });
  const ceDir = makeSlowCeDir();
  const startupLockDir = makeStartupLockDir();
  const launchesPath = resolve(ceDir, 'launches.log');

  const runHook = () => runStartupHook({ pluginDir, ceDir, startupLockDir });

  runHook();
  assert.equal(waitForFile(launchesPath), true);
  assert.equal(readFileSync(launchesPath, 'utf8').trim().split('\n').filter(Boolean).length, 1);

  runHook();
  assert.equal(readFileSync(launchesPath, 'utf8').trim().split('\n').filter(Boolean).length, 1);
});

test('startup hook does not launch a second CE dir while the same local server URL is already starting', () => {
  const firstPluginDir = makePluginDir({ withProtocol: false });
  const secondPluginDir = makePluginDir({ withProtocol: false });
  const firstCeDir = makeSlowCeDir();
  const secondCeDir = makeSlowCeDir();
  const startupLockDir = makeStartupLockDir();
  const firstLaunchesPath = resolve(firstCeDir, 'launches.log');
  const secondLaunchesPath = resolve(secondCeDir, 'launches.log');

  runStartupHook({
    pluginDir: firstPluginDir,
    ceDir: firstCeDir,
    serverUrl: 'http://127.0.0.1:9',
    startupLockDir,
  });
  assert.equal(waitForFile(firstLaunchesPath), true);
  assert.equal(readFileSync(firstLaunchesPath, 'utf8').trim().split('\n').filter(Boolean).length, 1);

  runStartupHook({
    pluginDir: secondPluginDir,
    ceDir: secondCeDir,
    serverUrl: 'http://127.0.0.1:9',
    startupLockDir,
  });
  assert.equal(existsSync(secondLaunchesPath), false);
});

test('startup hook allows a different local server target to launch while another startup pid is still alive', () => {
  const pluginDir = makePluginDir({ withProtocol: false });
  const firstCeDir = makeSlowCeDir();
  const secondCeDir = makeSlowCeDir();
  const startupLockDir = makeStartupLockDir();
  const firstLaunchesPath = resolve(firstCeDir, 'launches.log');
  const secondLaunchesPath = resolve(secondCeDir, 'launches.log');

  const runHook = ({ ceDir, serverUrl }) => runStartupHook({
    pluginDir,
    ceDir,
    serverUrl,
    startupLockDir,
  });

  runHook({ ceDir: firstCeDir, serverUrl: 'http://127.0.0.1:9' });
  assert.equal(waitForFile(firstLaunchesPath), true);
  assert.equal(readFileSync(firstLaunchesPath, 'utf8').trim().split('\n').filter(Boolean).length, 1);

  runHook({ ceDir: secondCeDir, serverUrl: 'http://127.0.0.1:10' });
  assert.equal(waitForFile(secondLaunchesPath), true);
  assert.equal(readFileSync(secondLaunchesPath, 'utf8').trim().split('\n').filter(Boolean).length, 1);
});
