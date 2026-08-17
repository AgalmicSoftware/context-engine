import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';

const DEFAULT_DEPENDENCY_NAMES = ['ethers'];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const isExactVersion = (value) => /^\d+\.\d+\.\d+$/.test(String(value || '').trim());

const findPackageJsonPath = (startPath, dependencyName) => {
  let currentDir = dirname(startPath);
  while (currentDir && currentDir !== dirname(currentDir)) {
    const candidate = resolve(currentDir, 'package.json');
    if (existsSync(candidate)) {
      try {
        const pkg = readJson(candidate);
        if (pkg?.name === dependencyName) {
          return candidate;
        }
      } catch (_) {
        // Keep walking up until we find the dependency package root.
      }
    }
    currentDir = dirname(currentDir);
  }
  return null;
};

const getPaths = (rootDir) => ({
  workerEntry: resolve(rootDir, 'workers/sessionCorsWorker/worker.js'),
  workerPackageJson: resolve(rootDir, 'workers/sessionCorsWorker/package.json'),
  workerPackageLockJson: resolve(rootDir, 'workers/sessionCorsWorker/package-lock.json'),
});
const resolveWorkerPackageDir = (rootDir) => resolve(rootDir, 'workers/sessionCorsWorker');

export const getWorkerDependencyVersionReport = ({
  rootDir = process.cwd(),
  dependencyName = 'ethers',
} = {}) => {
  const paths = getPaths(rootDir);
  const expectedWorkerPackageJsonPath = resolve(
    resolveWorkerPackageDir(rootDir),
    'node_modules',
    dependencyName,
    'package.json',
  );
  const workerPackage = readJson(paths.workerPackageJson);
  const workerLock = existsSync(paths.workerPackageLockJson)
    ? readJson(paths.workerPackageLockJson)
    : null;
  const manifestSpec = workerPackage.dependencies?.[dependencyName]
    || workerPackage.devDependencies?.[dependencyName]
    || null;
  const lockRootSpec = workerLock?.packages?.['']?.dependencies?.[dependencyName]
    || workerLock?.packages?.['']?.devDependencies?.[dependencyName]
    || null;
  const lockInstalledVersion = workerLock?.packages?.[`node_modules/${dependencyName}`]?.version || null;

  let resolvedPackageJsonPath = null;
  let installedVersion = null;
  let resolveError = null;
  if (existsSync(expectedWorkerPackageJsonPath)) {
    resolvedPackageJsonPath = expectedWorkerPackageJsonPath;
    try {
      installedVersion = readJson(resolvedPackageJsonPath).version || null;
    } catch (error) {
      resolveError = error instanceof Error ? error.message : String(error);
    }
  } else {
    try {
      const workerRequire = createRequire(paths.workerEntry);
      try {
        resolvedPackageJsonPath = workerRequire.resolve(`${dependencyName}/package.json`);
      } catch (error) {
        const resolvedEntry = workerRequire.resolve(dependencyName);
        resolvedPackageJsonPath = findPackageJsonPath(resolvedEntry, dependencyName);
        if (!resolvedPackageJsonPath) {
          throw error;
        }
      }
      resolveError = `expected worker-local install at ${expectedWorkerPackageJsonPath}, but resolved ${dependencyName} to ${resolvedPackageJsonPath}`;
      installedVersion = readJson(resolvedPackageJsonPath).version || null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      resolveError = `expected worker-local install at ${expectedWorkerPackageJsonPath}: ${detail}`;
    }
  }

  const issues = [];
  if (!manifestSpec) {
    issues.push(`worker package.json does not declare ${dependencyName}`);
  }
  if (!workerLock) {
    issues.push(`worker package-lock.json is missing for ${dependencyName}`);
  }
  if (workerLock && manifestSpec && lockRootSpec !== manifestSpec) {
    issues.push(
      `worker lockfile root spec for ${dependencyName} is ${JSON.stringify(lockRootSpec)} but package.json declares ${JSON.stringify(manifestSpec)}`,
    );
  }
  if (workerLock && !lockInstalledVersion) {
    issues.push(`worker package-lock.json does not resolve an installed version for ${dependencyName}`);
  }
  if (manifestSpec && isExactVersion(manifestSpec) && lockInstalledVersion && lockInstalledVersion !== manifestSpec) {
    issues.push(
      `worker package-lock.json resolves ${dependencyName}@${lockInstalledVersion} but package.json pins ${manifestSpec}`,
    );
  }
  if (resolveError) {
    issues.push(`unable to resolve ${dependencyName} from workers/sessionCorsWorker/worker.js: ${resolveError}`);
  }
  if (lockInstalledVersion && installedVersion && installedVersion !== lockInstalledVersion) {
    issues.push(
      `resolved install for ${dependencyName} is ${installedVersion} at ${resolvedPackageJsonPath}, but worker package-lock.json expects ${lockInstalledVersion}`,
    );
  }

  return {
    dependencyName,
    manifestSpec,
    lockRootSpec,
    lockInstalledVersion,
    resolvedPackageJsonPath,
    installedVersion,
    resolveError,
    issues,
    paths,
  };
};

export const assertWorkerDependencyVersions = ({
  rootDir = process.cwd(),
  dependencyNames = DEFAULT_DEPENDENCY_NAMES,
} = {}) => {
  const reports = dependencyNames.map((dependencyName) => getWorkerDependencyVersionReport({ rootDir, dependencyName }));
  const failures = reports.filter((report) => report.issues.length > 0);
  if (!failures.length) {
    return reports;
  }

  const lines = failures.flatMap((report) => [
    `sessionCorsWorker dependency drift detected for ${report.dependencyName}:`,
    ...report.issues.map((issue) => `- ${issue}`),
    `- fix: cd workers/sessionCorsWorker && npm ci`,
  ]);

  throw new Error(lines.join('\n'));
};
