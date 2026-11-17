#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

  const validLane = (lane) => lane === undefined || (typeof lane === 'string' && lane.trim() !== '');
  for (const [gateName, gate] of Object.entries(manifest.gates)) {
    if (!isRecord(gate) || !Array.isArray(gate.commands) || gate.commands.length === 0) {
      failures.push(`gate "${gateName}" must contain at least one command`);
      continue;
    }
    if (!validLane(gate.lane)) failures.push(`gate "${gateName}" lane must be a non-empty string`);
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
      if (!validLane(entry.lane)) failures.push(`${prefix} lane must be a non-empty string`);
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

export function resolveGates(manifest, { gateName, profileName } = {}) {
  if (Boolean(gateName) === Boolean(profileName)) {
    throw new Error('select exactly one gate or profile');
  }

  const gateNames = gateName ? [gateName] : manifest.profiles[profileName];
  if (!gateNames) {
    throw new Error(`unknown CI gate selection: ${gateName || profileName}`);
  }

  return gateNames.map((name) => {
    const gate = manifest.gates[name];
    if (!gate) throw new Error(`unknown CI gate: ${name}`);
    return { name, lane: gate.lane, commands: gate.commands.map((entry) => ({ ...entry, gate: name })) };
  });
}

export function resolveGateCommands(manifest, selection) {
  return resolveGates(manifest, selection).flatMap((gate) => gate.commands);
}

/**
 * Runs items that name the same lane one after another, in manifest order,
 * and different lanes side by side. A lane stops at its first failure; the
 * other lanes still finish, so one run reports every lane that fails.
 */
async function runLanes(items, laneOf, runItem) {
  const lanes = new Map();
  for (const item of items) {
    const lane = laneOf(item);
    lanes.set(lane, [...(lanes.get(lane) || []), item]);
  }
  const statuses = await Promise.all([...lanes.values()].map(async (laneItems) => {
    for (const item of laneItems) {
      const status = await runItem(item);
      if (status !== 0) return status;
    }
    return 0;
  }));
  return statuses.find((status) => status !== 0) ?? 0;
}

const liveCommands = new Set();
const activeRuns = new Set();

/**
 * Stops the commands in flight and starts no more; each still prints what it
 * had written. Commands stay in this runner's process group, so stopping the
 * group (Ctrl-C, or a timeout that kills the group) stops everything they
 * started. A signal sent to the runner alone reaches each command, and npm
 * passes it to its script, but processes further down can run on to their own
 * end: stop a run by its process group.
 */
export function stopRuns() {
  for (const run of activeRuns) run.stopping = true;
  for (const child of liveCommands) child.kill('SIGTERM');
}

/** Runs one command. Side by side, its output is held back and printed whole when it ends. */
function runCommand(entry, { cwd, env, output, sideBySide }) {
  const logPath = sideBySide
    ? path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-')), 'output.log')
    : null;
  const log = logPath ? fs.openSync(logPath, 'w') : 'inherit';
  // The output comes when the command ends; until then this says it is under way and where to read it.
  if (logPath) output.write(`[ci-gate:${entry.gate}] started: ${entry.label} (output so far: ${logPath})\n`);
  return new Promise((resolve) => {
    const child = spawn(entry.command, entry.args, {
      cwd,
      env: { ...env, ...(entry.env || {}) },
      stdio: ['ignore', log, log],
    });
    liveCommands.add(child);
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      liveCommands.delete(child);
      if (logPath) {
        fs.closeSync(log);
        output.write(`\n[ci-gate:${entry.gate}] ${entry.label}\n${fs.readFileSync(logPath, 'utf8')}`);
        fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
      }
      resolve(result);
    };
    child.on('error', (error) => finish({ error }));
    child.on('exit', (status) => finish({ status }));
  });
}

export async function runGates(gates, options = {}) {
  const output = options.output || process.stdout;
  const laneOf = (item) => (options.serial ? undefined : item.lane);
  const commands = gates.flatMap((gate) => gate.commands);
  if (options.dryRun) {
    for (const gate of gates) {
      for (const entry of gate.commands) {
        const lane = [laneOf(gate), laneOf(entry)].filter(Boolean).join(' / ');
        output.write(`\n[ci-gate:${entry.gate}] ${entry.label}${lane ? ` (lane ${lane})` : ''}\n  ${commandKey(entry)}\n`);
      }
    }
    return 0;
  }

  const sideBySide = new Set(gates.map(laneOf)).size > 1
    || gates.some((gate) => new Set(gate.commands.map(laneOf)).size > 1);
  const context = {
    cwd: options.cwd || path.resolve(path.dirname(DEFAULT_MANIFEST_PATH), '..'),
    env: options.env || process.env,
    output,
    sideBySide,
  };
  const run = options.run || runCommand;
  const thisRun = { stopping: false };
  const results = new Map();
  const startedAt = Date.now();
  activeRuns.add(thisRun);

  // Tests that wait on timers fail on a machine that is busy with other work, and the log of such a run
  // should say so itself: the one-minute load average is printed at both ends, with a warning at the start.
  const cores = options.cores || os.availableParallelism();
  const loadAverage = options.loadAverage || (() => os.loadavg()[0]);
  const loadAtStart = loadAverage();
  output.write(`CI gates starting: load average ${loadAtStart.toFixed(1)} on ${cores} cores\n`);
  if (loadAtStart >= cores) {
    output.write('This machine is already busy. A timeout in this run may be the load and not the code; rerun it alone before believing one.\n');
  }

  const status = await runLanes(gates, laneOf, (gate) => runLanes(gate.commands, laneOf, async (entry) => {
    if (thisRun.stopping) return 1;
    if (!sideBySide) output.write(`\n[ci-gate:${entry.gate}] ${entry.label}\n`);
    const commandStartedAt = Date.now();
    const result = await run(entry, context);
    const seconds = Math.round((Date.now() - commandStartedAt) / 100) / 10;
    const exit = result.error ? 1 : (Number.isInteger(result.status) ? result.status : 1);
    results.set(entry, { seconds, status: exit });
    if (result.error) {
      output.write(`CI gate command could not start: ${result.error.message}\n`);
    } else if (exit !== 0) {
      output.write(`CI gate failed at "${entry.label}" (exit ${exit})\n`);
    }
    return exit;
  }));
  activeRuns.delete(thisRun);

  // Every command of the selection, in manifest order; one a failed or stopped lane never reached is "not run".
  const timings = commands.map((entry) => ({
    gate: entry.gate,
    label: entry.label,
    ...(results.get(entry) || { seconds: null, status: null }),
  }));
  const wallSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
  output.write('\nCI gate timings\n');
  for (const { gate, label, seconds, status: exit } of timings) {
    const time = seconds === null ? '-' : seconds.toFixed(1);
    const state = { null: 'not run', 0: 'ok' }[exit] || 'FAILED';
    output.write(`${time.padStart(8)} s  ${state.padEnd(7)}  ${gate}: ${label}\n`);
  }
  const loadAtEnd = loadAverage();
  output.write(`${wallSeconds.toFixed(1).padStart(8)} s  wall time${sideBySide ? ', lanes side by side' : ''}\n`);
  output.write(`load average ${loadAtStart.toFixed(1)} at the start, ${loadAtEnd.toFixed(1)} at the end, on ${cores} cores\n`);
  if (thisRun.stopping) output.write('CI gate run stopped before it finished\n');
  if (options.timingsPath) {
    fs.writeFileSync(options.timingsPath, `${JSON.stringify({ wallSeconds, sideBySide, cores, loadAtStart, loadAtEnd, commands: timings }, null, 2)}\n`);
  }
  // A stopped run has not run everything, whatever the commands it cut short returned.
  return thisRun.stopping && status === 0 ? 1 : status;
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
  const parsed = { dryRun: false, serial: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--serial') {
      parsed.serial = true;
    } else if (arg === '--gate' || arg === '--profile' || arg === '--check-results' || arg === '--timings') {
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

async function main(argv = process.argv.slice(2)) {
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

    const gates = resolveGates(manifest, {
      gateName: args.gate,
      profileName: args.profile,
    });
    process.on('exit', stopRuns);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.on(signal, () => {
        // The stopped commands end, their output and the timings print, and the run fails.
        stopRuns();
        // A command that ignores the signal is killed, so its output still prints.
        setTimeout(() => liveCommands.forEach((child) => child.kill('SIGKILL')), 10000).unref();
        setTimeout(() => process.exit(1), 15000).unref();
      });
    }
    return await runGates(gates, { dryRun: args.dryRun, serial: args.serial, timingsPath: args.timings });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then((status) => { process.exitCode = status; });
}

export { main };
