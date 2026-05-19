'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const ccRoot = path.join(repoRoot, 'contextEngine-cc');
const ccPackagePath = path.join(ccRoot, 'package.json');
const targetPath = path.join(ccRoot, 'public', 'ethers.umd.min.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveInstalledEthersPackage() {
  const candidates = [
    path.join(ccRoot, 'node_modules', 'ethers'),
    path.join(repoRoot, 'node_modules', 'ethers'),
    path.join(repoRoot, 'client', 'node_modules', 'ethers'),
  ];
  for (const packageRoot of candidates) {
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const bundlePath = path.join(packageRoot, 'dist', 'ethers.umd.min.js');
    if (fs.existsSync(packageJsonPath) && fs.existsSync(bundlePath)) {
      return {
        packageRoot,
        packageJson: readJson(packageJsonPath),
        bundlePath,
      };
    }
  }
  throw new Error('Unable to find an installed ethers package with dist/ethers.umd.min.js');
}

function vendorContextEngineCcEthersBundle() {
  const ccPackage = readJson(ccPackagePath);
  const expectedVersion = ccPackage.dependencies?.ethers;
  if (!expectedVersion) {
    throw new Error('contextEngine-cc/package.json must declare dependencies.ethers');
  }

  const installed = resolveInstalledEthersPackage();
  if (installed.packageJson.version !== expectedVersion) {
    throw new Error(
      `Installed ethers ${installed.packageJson.version} at ${installed.packageRoot} does not match ` +
        `contextEngine-cc package pin ${expectedVersion}`
    );
  }

  const header =
    `/*! Vendored ethers UMD bundle v${expectedVersion} from the ethers npm package dist/ethers.umd.min.js */\n`;
  const source = fs.readFileSync(installed.bundlePath, 'utf8');
  fs.writeFileSync(targetPath, header + source);
  return targetPath;
}

if (require.main === module) {
  const writtenPath = vendorContextEngineCcEthersBundle();
  console.log(`Wrote ${path.relative(repoRoot, writtenPath)}`);
}

module.exports = {
  vendorContextEngineCcEthersBundle,
};
