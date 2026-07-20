import { build } from 'esbuild';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { getWorkerDependencyVersionReport } from './worker-dependency-guard.mjs';
import { normalizeWorkerBundleText, resolveWorkerBundleTargets } from './worker-bundle.mjs';

const getPaths = (rootDir) => {
  const targets = resolveWorkerBundleTargets({ rootDir });
  return {
    rootDir,
    sessionCorsWorker: targets.find((target) => target.key === 'sessionCorsWorker'),
    deployHelper: targets.find((target) => target.key === 'deployHelper'),
    targets,
  };
};

export const compareWorkerBundleSync = async ({ rootDir = process.cwd() } = {}) => {
  const paths = getPaths(rootDir);
  const mismatches = [];
  const workerDependencyReport = getWorkerDependencyVersionReport({
    rootDir,
    dependencyName: 'ethers',
  });

  if (workerDependencyReport.issues.length) {
    workerDependencyReport.issues.forEach((issue) => {
      mismatches.push({
        file: workerDependencyReport.resolvedPackageJsonPath || workerDependencyReport.paths.workerPackageJson,
        reason: issue,
      });
    });
    return { mismatches, paths, dependencyReports: [workerDependencyReport] };
  }

  for (const target of paths.targets) {
    if (!existsSync(target.outputFile)) {
      mismatches.push({
        file: target.outputFile,
        reason: `${target.outputRelativePath} is missing; run "npm run worker:bundle"`,
      });
      continue;
    }

    const buildResult = await build({
      entryPoints: [target.entryPoint],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: [target.target || 'es2020'],
      ...(target.legalComments ? { legalComments: target.legalComments } : {}),
      ...(target.mainFields ? { mainFields: target.mainFields } : {}),
      write: false,
    });

    const generatedBundled = normalizeWorkerBundleText(
      buildResult.outputFiles?.find((file) => file?.path?.endsWith('.js'))?.text
        || buildResult.outputFiles?.[0]?.text
    );
    const expectedBundled = normalizeWorkerBundleText(readFileSync(target.outputFile, 'utf8'));

    if (generatedBundled !== expectedBundled) {
      mismatches.push({
        file: target.outputFile,
        reason: `${target.outputRelativePath} is out of sync with ${target.entryRelativePath}`,
      });
    }
  }

  return { mismatches, paths, dependencyReports: [workerDependencyReport] };
};

const isEntrypoint = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return current === invoked;
};

if (isEntrypoint()) {
  const result = await compareWorkerBundleSync();
  if (result.mismatches.length) {
    result.mismatches.forEach((mismatch) => {
      console.error(`worker bundle sync check failed: ${mismatch.reason}: ${mismatch.file}`);
    });
    process.exit(1);
  }
  console.log('worker bundles are in sync');
}
