'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
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

const writeInstalledPackage = (packageDir, version, { exportsOnly = false } = {}) => {
  writeJson(path.join(packageDir, 'package.json'), {
    name: 'ethers',
    version,
    ...(exportsOnly ? { exports: { '.': './index.js' } } : {}),
  });
  fs.writeFileSync(path.join(packageDir, 'index.js'), 'module.exports = {};\n');
};

const createFixture = ({
  manifestSpec = '5.7.2',
  lockSpec = manifestSpec,
  lockInstalledVersion = manifestSpec,
  installedVersion = manifestSpec,
  includeWorkerInstall = true,
  rootInstalledVersion = null,
  exportsOnly = false,
} = {}) => {
  const fixturesRoot = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(fixturesRoot, { recursive: true });
  const rootDir = fs.mkdtempSync(path.join(fixturesRoot, 'worker-dependency-guard-'));
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
  if (includeWorkerInstall) {
    writeInstalledPackage(
      path.join(rootDir, 'workers/sessionCorsWorker/node_modules/ethers'),
      installedVersion,
      { exportsOnly },
    );
  }
  if (rootInstalledVersion) {
    writeInstalledPackage(path.join(rootDir, 'node_modules/ethers'), rootInstalledVersion);
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
    (error) => {
      assert.equal(
        error.message.split('\n').at(-1),
        '- fix: cd workers/sessionCorsWorker && npm ci',
      );
      return true;
    },
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

test('getWorkerDependencyVersionReport flags missing worker-local install when only root node_modules has ethers', async () => {
  const { assertWorkerDependencyVersions, getWorkerDependencyVersionReport } = await loadModule();
  const rootDir = createFixture({
    manifestSpec: '5.7.2',
    lockSpec: '5.7.2',
    lockInstalledVersion: '5.7.2',
    includeWorkerInstall: false,
    rootInstalledVersion: '5.7.2',
  });

  const report = getWorkerDependencyVersionReport({ rootDir, dependencyName: 'ethers' });
  assert.equal(report.resolvedPackageJsonPath, path.join(rootDir, 'node_modules/ethers/package.json'));
  assert.equal(report.installedVersion, '5.7.2');
  assert.match(
    report.issues.join('\n'),
    /unable to resolve ethers from workers\/sessionCorsWorker\/worker\.js: expected worker-local install at .*workers\/sessionCorsWorker\/node_modules\/ethers\/package\.json, but resolved ethers to .*node_modules\/ethers\/package\.json/,
  );
  assert.throws(
    () => assertWorkerDependencyVersions({ rootDir }),
    /fix: cd workers\/sessionCorsWorker && npm ci/,
  );
});
