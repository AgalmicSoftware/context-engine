'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const loadModule = async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'worker-dependency-guard.mjs')).href;
  return import(moduleUrl);
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const createFixture = ({
  manifestSpec = '5.7.2',
  lockSpec = manifestSpec,
  lockInstalledVersion = manifestSpec,
  installedVersion = manifestSpec,
  exportsOnly = false,
} = {}) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-dependency-guard-'));
  writeJson(path.join(rootDir, 'workers/sessionCorsWorker/package.json'), {
    name: 'session-cors-worker',
    private: true,
    type: 'module',
    dependencies: {
      ethers: manifestSpec,
    },
  });
  writeJson(path.join(rootDir, 'workers/sessionCorsWorker/package-lock.json'), {
    name: 'session-cors-worker',
    lockfileVersion: 3,
    packages: {
      '': {
        dependencies: {
          ethers: lockSpec,
        },
      },
      'node_modules/ethers': {
        version: lockInstalledVersion,
      },
    },
  });
  fs.mkdirSync(path.join(rootDir, 'workers/sessionCorsWorker'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'workers/sessionCorsWorker/worker.js'), 'export const noop = true;\n');
  writeJson(path.join(rootDir, 'workers/sessionCorsWorker/node_modules/ethers/package.json'), {
    name: 'ethers',
    version: installedVersion,
    ...(exportsOnly ? { exports: { '.': './index.js' } } : {}),
  });
  if (exportsOnly) {
    fs.writeFileSync(path.join(rootDir, 'workers/sessionCorsWorker/node_modules/ethers/index.js'), 'module.exports = {};\n');
  }
  return rootDir;
};

test('assertWorkerDependencyVersions rejects drift between lockfile and resolved install', async () => {
  const { assertWorkerDependencyVersions, getWorkerDependencyVersionReport } = await loadModule();
  const rootDir = createFixture({
    manifestSpec: '5.7.2',
    lockSpec: '5.7.2',
    lockInstalledVersion: '5.7.2',
    installedVersion: '6.15.0',
  });

  const report = getWorkerDependencyVersionReport({ rootDir, dependencyName: 'ethers' });
  assert.equal(report.installedVersion, '6.15.0');
  assert.match(report.issues.join('\n'), /resolved install for ethers is 6\.15\.0/);
  assert.throws(
    () => assertWorkerDependencyVersions({ rootDir }),
    /fix: cd workers\/sessionCorsWorker && npm ci/,
  );
});

test('assertWorkerDependencyVersions accepts matching worker dependency versions', async () => {
  const { assertWorkerDependencyVersions } = await loadModule();
  const rootDir = createFixture();
  assert.doesNotThrow(() => assertWorkerDependencyVersions({ rootDir }));
});

test('assertWorkerDependencyVersions resolves package version from package root when package.json is not exported', async () => {
  const { assertWorkerDependencyVersions } = await loadModule();
  const rootDir = createFixture({
    manifestSpec: '6.15.0',
    lockSpec: '6.15.0',
    lockInstalledVersion: '6.15.0',
    installedVersion: '6.15.0',
    exportsOnly: true,
  });
  assert.doesNotThrow(() => assertWorkerDependencyVersions({ rootDir }));
});
