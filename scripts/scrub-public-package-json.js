'use strict';

const fs = require('node:fs');

function scrubPublicPackageJson(packageJsonPath) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.scripts && typeof packageJson.scripts === 'object') {
    const scripts = packageJson.scripts;
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

    for (const [name, command] of Object.entries(scripts)) {
      if (strippedRunnerPatterns.some((pattern) => pattern.test(String(command)))) {
        removed.add(name);
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
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

if (require.main === module) {
  const packageJsonPath = process.argv[2];
  if (!packageJsonPath) {
    console.error('Usage: node scripts/scrub-public-package-json.js <package.json>');
    process.exitCode = 1;
  } else {
    scrubPublicPackageJson(packageJsonPath);
  }
}

module.exports = { scrubPublicPackageJson };
