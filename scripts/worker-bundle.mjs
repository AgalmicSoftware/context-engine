import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  assertWorkerDependencyVersions,
} from './worker-dependency-guard.mjs';

export const WORKER_BUNDLE_TARGETS = Object.freeze({
  sessionCorsWorker: Object.freeze({
    key: 'sessionCorsWorker',
    label: 'sessionCorsWorker',
    entryRelativePath: 'workers/sessionCorsWorker/worker.js',
    outputRelativePath: 'dist/sessionCorsWorker.bundle.js',
    enforceWorkerDependencyGuard: true,
  }),
  deployHelper: Object.freeze({
    key: 'deployHelper',
    label: 'deploy-helper',
    entryRelativePath: 'workers/deploy-helper/worker.js',
    outputRelativePath: 'dist/deployHelper.bundle.js',
    enforceWorkerDependencyGuard: false,
  }),
  agentBridgeWorker: Object.freeze({
    key: 'agentBridgeWorker',
    label: 'agentBridgeWorker',
    entryRelativePath: 'workers/agentBridgeWorker/worker.js',
    outputRelativePath: 'dist/agentBridgeWorker.bundle.js',
    enforceWorkerDependencyGuard: false,
    target: 'es2022',
    legalComments: 'eof',
    mainFields: ['browser', 'module', 'main'],
  }),
});

export const resolveWorkerBundleTargets = ({
  rootDir = process.cwd(),
  targetKeys = Object.keys(WORKER_BUNDLE_TARGETS),
} = {}) => (
  targetKeys.map((targetKey) => {
    const target = WORKER_BUNDLE_TARGETS[targetKey];
    if (!target) {
      throw new Error(`Unknown worker bundle target: ${targetKey}`);
    }
    return {
      ...target,
      entryPoint: resolve(rootDir, target.entryRelativePath),
      outputFile: resolve(rootDir, target.outputRelativePath),
    };
  })
);

export const normalizeWorkerBundleText = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+$/gm, '');

export const buildWorkerBundles = async ({
  rootDir = process.cwd(),
  targetKeys = Object.keys(WORKER_BUNDLE_TARGETS),
  assertWorkerDeps = assertWorkerDependencyVersions,
  esbuildImpl = build,
  mkdirSyncImpl = mkdirSync,
  readFileSyncImpl = readFileSync,
  writeFileSyncImpl = writeFileSync,
} = {}) => {
  const targets = resolveWorkerBundleTargets({ rootDir, targetKeys });
  if (targets.some((target) => target.enforceWorkerDependencyGuard)) {
    assertWorkerDeps({ rootDir });
  }

  const results = [];
  for (const target of targets) {
    mkdirSyncImpl(dirname(target.outputFile), { recursive: true });
    await esbuildImpl({
      entryPoints: [target.entryPoint],
      outfile: target.outputFile,
      bundle: true,
      platform: 'browser',
      format: 'esm',
      preserveSymlinks: true,
      target: [target.target || 'es2020'],
      ...(target.legalComments ? { legalComments: target.legalComments } : {}),
      ...(target.mainFields ? { mainFields: target.mainFields } : {}),
    });
    const bundle = readFileSyncImpl(target.outputFile, 'utf8');
    const normalizedBundle = normalizeWorkerBundleText(bundle);
    if (normalizedBundle !== bundle) {
      writeFileSyncImpl(target.outputFile, normalizedBundle);
    }
    results.push(target);
  }
  return results;
};

const parseArgs = (argv = process.argv.slice(2)) => {
  const parsedTargets = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) continue;
    if (token === '--target') {
      const value = String(argv[index + 1] || '').trim();
      if (!value) {
        throw new Error('Flag --target requires a value.');
      }
      parsedTargets.push(value);
      index += 1;
      continue;
    }
    if (token === '--help') {
      return { help: true, targetKeys: [] };
    }
    throw new Error(`Unexpected argument: ${token}`);
  }
  return {
    help: false,
    targetKeys: parsedTargets.length ? parsedTargets : Object.keys(WORKER_BUNDLE_TARGETS),
  };
};

const printUsage = () => {
  console.log([
    'Usage:',
    '  npm run worker:bundle',
    '  node scripts/worker-bundle.mjs --target sessionCorsWorker',
    '  node scripts/worker-bundle.mjs --target deployHelper',
    '  node scripts/worker-bundle.mjs --target agentBridgeWorker',
    '',
    'Output:',
    '  dist/sessionCorsWorker.bundle.js',
    '  dist/deployHelper.bundle.js',
    '  dist/agentBridgeWorker.bundle.js',
  ].join('\n'));
};

const isEntrypoint = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return current === invoked;
};

if (isEntrypoint()) {
  const { help, targetKeys } = parseArgs();
  if (help) {
    printUsage();
  } else {
    const builtTargets = await buildWorkerBundles({ targetKeys });
    builtTargets.forEach((target) => {
      console.log(`${target.label} bundle written to ${target.outputFile}`);
    });
  }
}
