#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL('./ci-gates.json', import.meta.url));

function commandKey(command) {
  return [command.command, ...(command.args || [])].join(' ');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateGateManifest(manifest) {
  const failures = [];
  if (!isRecord(manifest)) {
    return ['gate manifest must be a JSON object'];
  }
  if (manifest.schemaVersion !== 1) {
    failures.push('gate manifest schemaVersion must be 1');
  }
  if (!isRecord(manifest.profiles)) {
    failures.push('gate manifest profiles must be an object');
  }
  if (!isRecord(manifest.gates)) {
    failures.push('gate manifest gates must be an object');
  }
  if (failures.length) return failures;

  for (const [gateName, gate] of Object.entries(manifest.gates)) {
    if (!isRecord(gate) || !Array.isArray(gate.commands) || gate.commands.length === 0) {
      failures.push(`gate "${gateName}" must contain at least one command`);
      continue;
    }
    gate.commands.forEach((entry, index) => {
      const prefix = `gate "${gateName}" command ${index + 1}`;
      if (!isRecord(entry)) {
        failures.push(`${prefix} must be an object`);
        return;
      }
      if (typeof entry.label !== 'string' || !entry.label.trim()) {
        failures.push(`${prefix} must have a non-empty label`);
      }
      if (typeof entry.command !== 'string' || !entry.command.trim()) {
        failures.push(`${prefix} must have a non-empty command`);
      }
      if (!Array.isArray(entry.args) || entry.args.some((arg) => typeof arg !== 'string')) {
        failures.push(`${prefix} args must be an array of strings`);
      }
      if (entry.env !== undefined && (
        !isRecord(entry.env) ||
        Object.values(entry.env).some((value) => typeof value !== 'string')
      )) {
        failures.push(`${prefix} env must map names to strings`);
      }
    });
  }

  for (const [profileName, gateNames] of Object.entries(manifest.profiles)) {
    if (!Array.isArray(gateNames) || gateNames.length === 0) {
      failures.push(`profile "${profileName}" must list at least one gate`);
      continue;
    }

    const seenGates = new Set();
    gateNames.forEach((gateName) => {
      if (typeof gateName !== 'string' || !gateName) {
        failures.push(`profile "${profileName}" contains an invalid gate name`);
        return;
      }
      if (seenGates.has(gateName)) {
        failures.push(`profile "${profileName}" lists gate "${gateName}" more than once`);
      }
      seenGates.add(gateName);
      if (!Object.prototype.hasOwnProperty.call(manifest.gates, gateName)) {
        failures.push(`profile "${profileName}" references unknown gate "${gateName}"`);
      }
    });

    const seenCommands = new Set();
    gateNames.forEach((gateName) => {
      const gate = manifest.gates[gateName];
      if (!gate || !Array.isArray(gate.commands)) return;
      gate.commands.forEach((entry) => {
        if (!isRecord(entry) || typeof entry.command !== 'string' || !Array.isArray(entry.args)) return;
        const key = commandKey(entry);
        if (seenCommands.has(key)) {
          failures.push(`profile "${profileName}" executes duplicate command: ${key}`);
        }
        seenCommands.add(key);
      });
    });
  }

  return failures;
}

export function loadGateManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const failures = validateGateManifest(manifest);
  if (failures.length) {
    throw new Error(`invalid CI gate manifest:\n- ${failures.join('\n- ')}`);
  }
  return manifest;
}

export function resolveGateCommands(manifest, { gateName, profileName } = {}) {
  if (Boolean(gateName) === Boolean(profileName)) {
    throw new Error('select exactly one gate or profile');
  }

  const gateNames = gateName ? [gateName] : manifest.profiles[profileName];
  if (!gateNames) {
    throw new Error(`unknown CI gate selection: ${gateName || profileName}`);
  }

  return gateNames.flatMap((name) => {
    const gate = manifest.gates[name];
    if (!gate) throw new Error(`unknown CI gate: ${name}`);
    return gate.commands.map((entry) => ({ ...entry, gate: name }));
  });
}

export function runGateCommands(commands, options = {}) {
  const spawn = options.spawn || spawnSync;
  const output = options.output || process.stdout;
  const cwd = options.cwd || path.resolve(path.dirname(DEFAULT_MANIFEST_PATH), '..');
  const baseEnv = options.env || process.env;

  for (const entry of commands) {
    output.write(`\n[ci-gate:${entry.gate || 'test'}] ${entry.label}\n`);
    if (options.dryRun) {
      output.write(`  ${commandKey(entry)}\n`);
      continue;
    }

    const result = spawn(entry.command, entry.args, {
      cwd,
      env: { ...baseEnv, ...(entry.env || {}) },
      stdio: 'inherit',
    });
    if (result.error) {
      output.write(`CI gate command could not start: ${result.error.message}\n`);
      return 1;
    }
    if (result.status !== 0) {
      const status = Number.isInteger(result.status) ? result.status : 1;
      output.write(`CI gate failed at "${entry.label}" (exit ${status})\n`);
      return status;
    }
  }
  return 0;
}

export function checkProfileResults(manifest, profileName, results) {
  const gateNames = manifest.profiles[profileName];
  if (!gateNames) return [`unknown result profile "${profileName}"`];
  if (!isRecord(results)) return ['CI_GATE_RESULTS_JSON must decode to an object'];

  const failures = [];
  gateNames.forEach((gateName) => {
    if (!Object.prototype.hasOwnProperty.call(results, gateName)) {
      failures.push(`hosted gate "${gateName}" has no reported result`);
    } else if (results[gateName] !== 'success') {
      failures.push(`hosted gate "${gateName}" completed with "${results[gateName]}"`);
    }
  });
  Object.keys(results).forEach((gateName) => {
    if (!gateNames.includes(gateName)) {
      failures.push(`reported result "${gateName}" is not in profile "${profileName}"`);
    }
  });
  return failures;
}

function parseArgs(argv) {
  const parsed = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--gate' || arg === '--profile' || arg === '--check-results') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      parsed[arg.slice(2).replace('-', '')] = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const manifest = loadGateManifest();
    if (args.checkresults) {
      let results;
      try {
        results = JSON.parse(process.env.CI_GATE_RESULTS_JSON || '');
      } catch (_error) {
        throw new Error('CI_GATE_RESULTS_JSON must contain valid JSON');
      }
      const failures = checkProfileResults(manifest, args.checkresults, results);
      if (failures.length) {
        failures.forEach((failure) => process.stderr.write(`CI aggregate failed: ${failure}\n`));
        return 1;
      }
      process.stdout.write(`CI aggregate passed for profile "${args.checkresults}"\n`);
      return 0;
    }

    const commands = resolveGateCommands(manifest, {
      gateName: args.gate,
      profileName: args.profile,
    });
    return runGateCommands(commands, { dryRun: args.dryRun });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main();
}

export { main };
