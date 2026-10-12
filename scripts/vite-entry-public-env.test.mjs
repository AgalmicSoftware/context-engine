import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import viteConfig from '../client/vite.config.mjs';

const clientDir = fileURLToPath(new URL('../client/', import.meta.url));
const { build } = createRequire(new URL('../client/package.json', import.meta.url))('vite');
const workerReleasePin = JSON.parse(fs.readFileSync(path.join(clientDir, 'src/variables/workerReleasePin.json'), 'utf8'));
const releaseAsset = (commit, asset) =>
  `https://github.com/AgalmicSoftware/context-engine/releases/download/worker-bundles-${commit}/${asset}`;
const deploymentEnvKeys = [
  'REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT',
  'REACT_APP_CE_DEPLOY_HELPER_URL',
  'REACT_APP_CE_SHARED_WORKER_URL',
  'REACT_APP_CE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_AGENT_BRIDGE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL',
  'REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED',
  'REACT_APP_CE_DEFAULT_THEME',
];

// Evaluate the actual browser chunks in a fresh realm, including their static
// import order. The surrounding Node runner must not lend the app its process.
const browserEvaluator = `
  import fs from 'node:fs';
  import vm from 'node:vm';
  const { chunks, entry } = JSON.parse(fs.readFileSync(0, 'utf8'));
  let resolveBoot;
  const boot = new Promise(resolve => { resolveBoot = resolve; });
  const root = { dataset: {}, style: {} };
  const document = {
    documentElement: root,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ relList: { supports: () => true } }),
  };
  root.ownerDocument = document;
  const browser = {
    document,
    console,
    URL,
    setTimeout,
    clearTimeout,
    location: { href: 'https://browser.example.test/' },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    addEventListener: () => {},
    dispatchEvent: () => true,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    __ceReportBoot: resolveBoot,
  };
  browser.window = browser;
  const context = vm.createContext(browser);
  if (vm.runInContext('typeof process', context) !== 'undefined') throw new Error('Process leaked into browser realm');
  const modules = new Map();
  const getModule = (file) => {
    if (!modules.has(file)) {
      if (!(file in chunks)) throw new Error('Unexpected browser import: ' + file);
      modules.set(file, new vm.SourceTextModule(chunks[file], {
        context,
        identifier: 'https://browser.example.test/' + file,
        initializeImportMeta(meta, module) { meta.url = module.identifier; },
        async importModuleDynamically(specifier, parent) {
          const module = resolveModule(specifier, parent);
          if (module.status === 'unlinked') await module.link(resolveModule);
          if (module.status === 'linked') await module.evaluate();
          return module;
        },
      }));
    }
    return modules.get(file);
  };
  const resolveModule = (specifier, parent) => getModule(new URL(specifier, parent.identifier).pathname.slice(1));
  const entryModule = getModule(entry);
  await entryModule.link(resolveModule);
  await entryModule.evaluate();
  const timer = setTimeout(() => { throw new Error('Browser bootstrap did not reach the app'); }, 2000);
  const result = await boot;
  clearTimeout(timer);
  process.stdout.write(JSON.stringify(result));
`;

const evaluateBuiltEntry = async (overrides = {}) => {
  const previous = new Map(Object.entries(process.env).filter(([key]) => /^(REACT_APP_|NEXT_PUBLIC_|PUBLIC_URL$)/.test(key)));
  // Empty public values intentionally select the defaults and also override a
  // developer's local .env file, keeping this build regression reproducible.
  const buildEnv = { ...Object.fromEntries(deploymentEnvKeys.map((key) => [key, ''])), PUBLIC_URL: '/', ...overrides };
  let config;
  try {
    for (const key of previous.keys()) delete process.env[key];
    Object.assign(process.env, buildEnv);
    config = viteConfig({ mode: 'production' });
  } finally {
    for (const key of Object.keys(buildEnv)) delete process.env[key];
    for (const [key, value] of previous) process.env[key] = value;
  }

  const result = await build({
    ...config,
    configFile: false,
    root: clientDir,
    logLevel: 'silent',
    plugins: [
      {
        name: 'ce-test-deferred-app-probe',
        enforce: 'pre',
        load(id) {
          // Keep viteEntry, themeRuntime and their real static dependency graph.
          // Only the deferred app body is replaced to observe startup values.
          if (id === path.join(clientDir, 'src/index.tsx')) {
            return `
              import * as deployment from './variables/publicDeploymentConfig';
              import { CE_DEFAULT_THEME } from './variables/appConfig';
              globalThis.__ceReportBoot({
                ...deployment,
                CE_DEFAULT_THEME,
                processReady: typeof process !== 'undefined',
                bufferReady: typeof globalThis.Buffer === 'function',
                globalReady: globalThis.global === globalThis,
              });
            `;
          }
          return null;
        },
      },
      ...config.plugins,
    ],
    build: { ...config.build, write: false, modulePreload: false },
  });
  const chunks = Object.fromEntries(result.output.filter((item) => item.type === 'chunk').map((item) => [item.fileName, item.code]));
  const entry = result.output.find((item) => item.type === 'chunk' && item.isEntry).fileName;
  const evaluated = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', browserEvaluator], {
    input: JSON.stringify({ chunks, entry }),
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(evaluated.status, 0, evaluated.stderr || String(evaluated.error || 'Browser evaluation failed'));
  return JSON.parse(evaluated.stdout);
};

const assertRelease = (config, commit) => {
  assert.equal(config.CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT, commit);
  assert.equal(config.WORKER_BUNDLE_URL, releaseAsset(commit, 'sessionCorsWorker.bundle.js'));
  assert.equal(config.AGENT_BRIDGE_WORKER_BUNDLE_URL, releaseAsset(commit, 'agentBridgeWorker.bundle.js'));
  assert.equal(config.WORKER_RELEASE_MANIFEST_URL, releaseAsset(commit, 'worker-release-manifest.json'));
  assert.ok(decodeURIComponent(config.CLOUDFLARE_NATIVE_DEPLOY_URL).includes(`/tree/${commit}/deploy/cloudflare/session-worker`));
  assert.equal(config.processReady, true);
  assert.equal(config.bufferReady, true);
  assert.equal(config.globalReady, true);
};

test('built browser entry reads hosted release and self-hosted deployment overrides before the app starts', async () => {
  const commit = '0123456789abcdef0123456789abcdef01234567';
  const config = await evaluateBuiltEntry({
    // This is the public variable to which netlify.toml passes COMMIT_REF.
    REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT: commit,
    REACT_APP_CE_DEPLOY_HELPER_URL: 'https://deploy.self-host.example.test/',
    REACT_APP_CE_SHARED_WORKER_URL: 'https://worker.self-host.example.test/',
    REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED: 'false',
    REACT_APP_CE_DEFAULT_THEME: 'classic-95',
  });
  assertRelease(config, commit);
  assert.equal(config.DEPLOY_HELPER_URL, 'https://deploy.self-host.example.test/');
  assert.equal(config.DEFAULT_SHARED_WORKER_URL, 'https://worker.self-host.example.test/');
  assert.equal(config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED, false);
  assert.equal(config.CE_DEFAULT_THEME, 'classic-95');
});

test('built browser entry keeps the pinned release and normal deployment defaults without overrides', async () => {
  const config = await evaluateBuiltEntry();
  assertRelease(config, workerReleasePin.commit);
  assert.equal(config.DEPLOY_HELPER_URL, 'https://ce-deploy-helper.agalmic.workers.dev/');
  assert.equal(config.DEFAULT_SHARED_WORKER_URL, 'https://demo-worker-030226.agalmic.workers.dev');
  assert.equal(config.DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED, true);
  assert.equal(config.CE_DEFAULT_THEME, 'civic');
});
