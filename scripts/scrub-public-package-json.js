'use strict';

const fs = require('node:fs');
const path = require('node:path');

function referencedNpmScript(entry) {
  if (!entry || entry.command !== 'npm' || !Array.isArray(entry.args)) return null;
  const runIndex = entry.args.indexOf('run');
  if (runIndex < 0) return null;
  const scriptName = entry.args.slice(runIndex + 1).find((arg) => (
    typeof arg === 'string' && !arg.startsWith('-')
  )) || null;
  if (!scriptName) return null;

  const prefixIndex = entry.args.indexOf('--prefix');
  const prefixArg = entry.args.find((arg) => (
    typeof arg === 'string' && arg.startsWith('--prefix=')
  ));
  const packagePrefix = prefixIndex >= 0
    ? entry.args[prefixIndex + 1]
    : prefixArg?.slice('--prefix='.length);
  return { packagePrefix: packagePrefix || null, scriptName };
}

function packageScriptNames(packageJsonPath, packagePrefix, rootScripts) {
  if (!packagePrefix) return new Set(Object.keys(rootScripts || {}));

  const rootDir = path.resolve(path.dirname(packageJsonPath));
  const packageDir = path.resolve(rootDir, packagePrefix);
  if (packageDir !== rootDir && !packageDir.startsWith(`${rootDir}${path.sep}`)) {
    return new Set();
  }
  const prefixedPackagePath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(prefixedPackagePath)) return new Set();
  const prefixedPackage = JSON.parse(fs.readFileSync(prefixedPackagePath, 'utf8'));
  return new Set(Object.keys(prefixedPackage.scripts || {}));
}

function scrubPublicCiGateManifest(packageJsonPath, availableScripts) {
  const manifestPath = path.join(path.dirname(packageJsonPath), 'scripts', 'ci-gates.json');
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const removedGates = new Set();

  for (const [gateName, gate] of Object.entries(manifest.gates || {})) {
    if (!Array.isArray(gate?.commands)) continue;
    gate.commands = gate.commands.filter((entry) => {
      const reference = referencedNpmScript(entry);
      if (!reference) return true;
      return packageScriptNames(
        packageJsonPath,
        reference.packagePrefix,
        availableScripts,
      ).has(reference.scriptName);
    });
    if (gate.commands.length === 0) {
      removedGates.add(gateName);
      delete manifest.gates[gateName];
    }
  }

  for (const [profileName, gateNames] of Object.entries(manifest.profiles || {})) {
    if (!Array.isArray(gateNames)) continue;
    const retained = gateNames.filter((gateName) => !removedGates.has(gateName));
    if (retained.length === 0) delete manifest.profiles[profileName];
    else manifest.profiles[profileName] = retained;
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function scrubPublicPackageJson(packageJsonPath, referencePackageJsonPath = packageJsonPath) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const referencePackageJson = JSON.parse(fs.readFileSync(referencePackageJsonPath, 'utf8'));

  if (packageJson.scripts && typeof packageJson.scripts === 'object') {
    const scripts = packageJson.scripts;
    const referenceScripts = referencePackageJson.scripts || {};
    const removed = new Set();
    const strippedRunnerPatterns = [
      /\bscripts\/test-[^\s'"]+\.js\b/,
      /\bscripts\/test-[^\s'"]+\.ui\.js\b/,
      /\bscripts\/seed-[^\s'"]+\.js\b/,
      /\bscripts\/e2e(?:\/|\b)/,
      /\bscripts\/lib\/e2e(?:\/|\b)/,
      /\bscripts\/run-e2e-[^\s'"]+\.js\b/,
      /\bscripts\/run-ux-[^\s'"]+\.js\b/,
      /\bscripts\/capture-ux-[^\s'"]+\.js\b/,
      /\bscripts\/run-contextengine-cc-tests\.js\b/,
      /\bscripts\/vendor-cecc-ethers-bundle\.js\b/,
      /\bscripts\/restore-private-pack\.sh\b/,
      /\bclient\/src\/utilities\/web3\/contractScripts\.[^\s'"]+\.proxy\.test\.js\b/,
    ];

    for (const scriptMap of [scripts, referenceScripts]) {
      for (const [name, command] of Object.entries(scriptMap)) {
        if (strippedRunnerPatterns.some((pattern) => pattern.test(String(command)))) {
          removed.add(name);
        }
      }
    }

    const standaloneNpmRun = (segment, scriptName) => {
      const escapedName = scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^\\s*npm\\s+run(?:\\s+-s)?\\s+${escapedName}(?:\\s+--.*)?\\s*$`).test(segment);
    };

    for (const [name, command] of Object.entries(scripts)) {
      if (removed.has(name)) continue;
      const segments = String(command).split(/\s*&&\s*/);
      const retained = segments.filter((segment) => (
        ![...removed].some((removedName) => standaloneNpmRun(segment, removedName))
      ));
      if (retained.length === 0) removed.add(name);
      else scripts[name] = retained.join(' && ');
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const [name, command] of Object.entries(scripts)) {
        if (removed.has(name)) continue;
        for (const removedName of removed) {
          const escapedName = removedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\bnpm\\s+run(?:\\s+-s)?\\s+${escapedName}\\b`).test(String(command))) {
            removed.add(name);
            changed = true;
            break;
          }
        }
      }
    }

    for (const name of removed) {
      delete scripts[name];
    }

    const orderedScripts = {};
    for (const name of Object.keys(referenceScripts)) {
      if (Object.prototype.hasOwnProperty.call(scripts, name)) orderedScripts[name] = scripts[name];
    }
    for (const [name, command] of Object.entries(scripts)) {
      if (!Object.prototype.hasOwnProperty.call(orderedScripts, name)) orderedScripts[name] = command;
    }
    packageJson.scripts = orderedScripts;
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  scrubPublicCiGateManifest(packageJsonPath, packageJson.scripts);
}

if (require.main === module) {
  const packageJsonPath = process.argv[2];
  const referencePackageJsonPath = process.argv[3] || packageJsonPath;
  if (!packageJsonPath) {
    console.error('Usage: node scripts/scrub-public-package-json.js <package.json>');
    process.exitCode = 1;
  } else {
    scrubPublicPackageJson(packageJsonPath, referencePackageJsonPath);
  }
}

module.exports = {
  referencedNpmScript,
  packageScriptNames,
  scrubPublicCiGateManifest,
  scrubPublicPackageJson,
};
