import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkProfileResults,
  loadGateManifest,
  resolveGateCommands,
  resolveGates,
  runGates,
  stopRuns,
  validateGateManifest,
} from './run-ci-gates.mjs';

const command = (label, script) => ({
  label,
  command: 'npm',
  args: ['run', script],
});

function fixtureManifest() {
  return {
    schemaVersion: 1,
    profiles: {
      ci: ['wiring', 'client', 'node'],
      hosted: ['wiring', 'client', 'node', 'e2e'],
      release: ['release'],
    },
    gates: {
      wiring: { commands: [command('wiring', 'test:wiring')] },
      client: { commands: [command('client', 'test:client')] },
      node: { commands: [command('node', 'test:node')] },
      e2e: { commands: [command('e2e', 'test:e2e:smoke')] },
      release: {
        commands: [
          command('release client', 'test:release:client'),
          command('release node', 'test:node:tracked'),
        ],
      },
    },
  };
}

test('CI installs the MCP lockfile dependencies before running its packed executable gate', () => {
  const manifest = loadGateManifest();
  const source = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const [name, gate] of Object.entries(manifest.gates)) {
    if (!gate.commands.some(({ args }) => args.includes('test:mcp:pack'))) continue;
    const job = source.split(`\n  ${name}:\n`)[1]?.split(/\n  [\w-]+:\n/)[0];
    if (!job) continue;
    const install = job.indexOf('run: npm --prefix mcp ci');
    assert.ok(install >= 0, `${name} must install the MCP lockfile dependencies`);
    assert.ok(install < job.indexOf(`run: npm run ci:gate -- ${name}`));
    assert.match(job, /mcp\/package-lock\.json/);
  }
});

test('the contracts job installs isolated Worker ethers before importing the registry smoke', () => {
  const source = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = source.split('\n  contracts:\n')[1].split(/\n  [\w-]+:\n/)[0];
  const install = job.indexOf('run: npm --prefix workers/sessionCorsWorker ci');
  assert.ok(install >= 0, 'the registry smoke imports the Session Worker and requires its isolated package');
  assert.ok(install < job.indexOf('run: npm run ci:gate -- contracts'));
  assert.match(job, /workers\/sessionCorsWorker\/package-lock\.json/);
});

test('manifest validation accepts explicit local, hosted, and release profiles', () => {
  assert.deepEqual(validateGateManifest(fixtureManifest()), []);
});

test('manifest validation rejects unknown gates and duplicate commands in a profile', () => {
  const manifest = fixtureManifest();
  manifest.profiles.ci = ['wiring', 'client', 'client', 'missing'];

  assert.deepEqual(validateGateManifest(manifest), [
    'profile "ci" lists gate "client" more than once',
    'profile "ci" references unknown gate "missing"',
    'profile "ci" executes duplicate command: npm run test:client',
  ]);
});

test('CI and release profiles resolve disjoint full test universes', () => {
  const manifest = fixtureManifest();
  const ciCommands = resolveGateCommands(manifest, { profileName: 'ci' });
  const releaseCommands = resolveGateCommands(manifest, { profileName: 'release' });

  assert.deepEqual(
    ciCommands.map(({ args }) => args.at(-1)),
    ['test:wiring', 'test:client', 'test:node'],
  );
  assert.deepEqual(
    releaseCommands.map(({ args }) => args.at(-1)),
    ['test:release:client', 'test:node:tracked'],
  );
});

const gate = (name, commands, lane) => ({
  name,
  lane,
  commands: commands.map((entry) => ({ ...entry, gate: name })),
});

// A fake command runner: records starts and ends, and lets the test decide when each command finishes.
function recordingRunner(failing = []) {
  const events = [];
  const waiting = new Map();
  return {
    events,
    finish(label) { waiting.get(label)(); },
    run(entry) {
      events.push(`start ${entry.label}`);
      return new Promise((resolve) => {
        waiting.set(entry.label, () => {
          events.push(`end ${entry.label}`);
          resolve({ status: failing.includes(entry.label) ? 9 : 0 });
        });
      });
    },
  };
}
const settle = () => new Promise((resolve) => { setImmediate(resolve); });
const quiet = { write() {} };

test('gate runner executes commands in order and stops on the first failure', async () => {
  const calls = [];
  const status = await runGates([gate('only', [
    command('first', 'first'),
    command('second', 'second'),
    command('never', 'never'),
  ])], {
    async run(entry) {
      calls.push([entry.command, ...entry.args]);
      return { status: entry.args.at(-1) === 'second' ? 9 : 0 };
    },
    output: quiet,
  });

  assert.equal(status, 9);
  assert.deepEqual(calls, [
    ['npm', 'run', 'first'],
    ['npm', 'run', 'second'],
  ]);
});

test('commands in different lanes run side by side, and a lane keeps its order', async () => {
  const runner = recordingRunner();
  const done = runGates([gate('wiring', [
    { ...command('lint', 'lint'), lane: 'lint' },
    { ...command('build', 'build'), lane: 'build' },
    { ...command('budget', 'budget'), lane: 'build' },
  ])], { run: runner.run, output: quiet });
  await settle();
  assert.deepEqual(runner.events, ['start lint', 'start build']);

  runner.finish('build');
  await settle();
  assert.deepEqual(runner.events.slice(2), ['end build', 'start budget']);
  runner.finish('budget');
  runner.finish('lint');
  assert.equal(await done, 0);
});

test('a gate starts only after every lane of the gate before it in its lane has finished', async () => {
  const runner = recordingRunner();
  const done = runGates([
    gate('shards', [{ ...command('a', 'a'), lane: 'a' }, { ...command('b', 'b'), lane: 'b' }], 'client'),
    gate('merge', [command('merge', 'merge')], 'client'),
    gate('other', [command('other', 'other')]),
  ], { run: runner.run, output: quiet });
  await settle();
  assert.deepEqual(runner.events, ['start a', 'start b', 'start other']);

  runner.finish('a');
  await settle();
  assert.equal(runner.events.includes('start merge'), false);
  runner.finish('b');
  await settle();
  assert.equal(runner.events.at(-1), 'start merge');
  runner.finish('merge');
  runner.finish('other');
  assert.equal(await done, 0);
});

test('a failing lane stops itself but not the lanes beside it, and fails the run', async () => {
  const runner = recordingRunner(['lint']);
  const done = runGates([gate('wiring', [
    { ...command('lint', 'lint'), lane: 'lint' },
    { ...command('lint workers', 'lint:workers'), lane: 'lint' },
    { ...command('build', 'build'), lane: 'build' },
    { ...command('budget', 'budget'), lane: 'build' },
  ])], { run: runner.run, output: quiet });
  await settle();
  runner.finish('lint');
  runner.finish('build');
  await settle();
  runner.finish('budget');

  assert.equal(await done, 9);
  assert.equal(runner.events.includes('start lint workers'), false);
  assert.ok(runner.events.includes('end budget'));
});

test('--serial ignores lanes and runs everything in manifest order', async () => {
  const calls = [];
  await runGates([
    gate('one', [{ ...command('a', 'a'), lane: 'x' }, { ...command('b', 'b'), lane: 'y' }], 'p'),
    gate('two', [command('c', 'c')], 'q'),
  ], {
    serial: true,
    async run(entry) {
      calls.push(`start ${entry.label}`);
      await settle();
      calls.push(`end ${entry.label}`);
      return { status: 0 };
    },
    output: quiet,
  });
  assert.deepEqual(calls, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
});

test('every run reports how long each command took', async () => {
  const written = [];
  await runGates([gate('wiring', [command('lint', 'lint'), command('types', 'types')])], {
    async run(entry) { return { status: entry.label === 'types' ? 2 : 0 }; },
    output: { write(text) { written.push(text); } },
  });
  const report = written.join('');
  assert.match(report, /CI gate timings\n +\d+\.\d s {2}ok {7}wiring: lint\n +\d+\.\d s {2}FAILED {3}wiring: types\n +\d+\.\d s {2}wall time\n$/);
});

test('a command a failed lane never reached is reported as not run, and --timings writes the same rows', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-gate-timings-'));
  const timingsPath = path.join(dir, 'timings.json');
  const written = [];
  try {
    const status = await runGates([
      gate('first', [command('breaks', 'breaks'), command('skipped', 'skipped')], 'lane'),
      gate('second', [command('later', 'later')], 'lane'),
    ], {
      async run() { return { status: 4 }; },
      output: { write(text) { written.push(text); } },
      timingsPath,
    });
    assert.equal(status, 4);
    assert.match(written.join(''), / +- s {2}not run {2}first: skipped\n +- s {2}not run {2}second: later\n/);
    const { commands, sideBySide } = JSON.parse(readFileSync(timingsPath, 'utf8'));
    assert.equal(sideBySide, false);
    assert.deepEqual(commands.map(({ gate: name, label, status: exit }) => [name, label, exit]), [
      ['first', 'breaks', 4],
      ['first', 'skipped', null],
      ['second', 'later', null],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('when two lanes fail, the run reports the failure that comes first in the manifest', async () => {
  const status = await runGates([gate('wiring', [
    { ...command('a', 'a'), lane: 'a' },
    { ...command('b', 'b'), lane: 'b' },
  ])], {
    // The second lane fails first in time; the first lane's status is still the one reported.
    async run(entry) {
      if (entry.label === 'a') await settle();
      return { status: entry.label === 'a' ? 3 : 5 };
    },
    output: quiet,
  });
  assert.equal(status, 3);
});

test('--serial stops at the first failure, across gates', async () => {
  const calls = [];
  const status = await runGates([
    gate('one', [command('a', 'a')], 'p'),
    gate('two', [command('b', 'b')], 'q'),
  ], {
    serial: true,
    async run(entry) {
      calls.push(entry.label);
      return { status: 6 };
    },
    output: quiet,
  });
  assert.equal(status, 6);
  assert.deepEqual(calls, ['a']);
});

test('a stopped run lets commands in flight end, starts nothing new, and fails', async () => {
  const runner = recordingRunner();
  const written = [];
  const done = runGates([gate('wiring', [
    { ...command('lint', 'lint'), lane: 'lint' },
    { ...command('format', 'format'), lane: 'lint' },
    { ...command('build', 'build'), lane: 'build' },
  ])], { run: runner.run, output: { write(text) { written.push(text); } } });
  await settle();
  stopRuns();
  runner.finish('lint');
  runner.finish('build');

  assert.equal(await done, 1);
  assert.equal(runner.events.includes('start format'), false);
  assert.match(written.join(''), /not run {2}wiring: format\n/);
});

// The tests above replace the command runner. These run real processes through it.
const nodeCommand = (label, script, lane) => ({ label, command: process.execPath, args: ['-e', script], lane });

test('side by side, a real command\'s output is printed whole under its label, and failures are reported', async () => {
  const tmpBefore = process.env.TMPDIR;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-gate-run-'));
  process.env.TMPDIR = tmpDir;
  const written = [];
  try {
    const status = await runGates([gate('real', [
      nodeCommand('passes', "console.log('out from passes'); console.error('err from passes')", 'a'),
      nodeCommand('fails', "console.log('out from fails'); process.exit(7)", 'b'),
      { label: 'missing', command: path.join(tmpDir, 'no-such-command'), args: [], lane: 'c' },
    ])], { output: { write(text) { written.push(text); } }, cwd: tmpDir });
    const report = written.join('');

    assert.equal(status, 7);
    assert.match(report, /\[ci-gate:real\] started: passes \(output so far: .+ci-gate-.+output\.log\)\n/);
    assert.match(report, /\n\[ci-gate:real\] passes\nout from passes\nerr from passes\n/);
    assert.match(report, /\n\[ci-gate:real\] fails\nout from fails\nCI gate failed at "fails" \(exit 7\)\n/);
    assert.match(report, /CI gate command could not start: spawn .*no-such-command ENOENT\n/);
    assert.match(report, /FAILED {3}real: missing\n/);
    assert.deepEqual(fs.readdirSync(tmpDir), [], 'the held-back output files are removed');
  } finally {
    if (tmpBefore === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = tmpBefore;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Each waits until its process is up and listening, then ends on SIGTERM: one cleanly, one not at all cleanly.
const READY = "require('fs').writeFileSync(process.argv[1], ''); setInterval(() => {}, 1000);";
const waitForFiles = async (...files) => {
  const deadline = Date.now() + 30000;
  while (!files.every((file) => fs.existsSync(file))) {
    assert.ok(Date.now() < deadline, 'the test commands did not start');
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  }
};

test('stopping real commands prints what they wrote and runs nothing more', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-gate-stop-'));
  const ready = ['a', 'b'].map((name) => path.join(dir, name));
  const written = [];
  try {
    const done = runGates([gate('real', [
      { label: 'ends cleanly', command: process.execPath, args: ['-e', `console.log('a up'); process.on('SIGTERM', () => process.exit(0)); ${READY}`, ready[0]], lane: 'a' },
      nodeCommand('never starts', "console.log('must not run')", 'a'),
      { label: 'ends by the signal', command: process.execPath, args: ['-e', `console.log('b up'); ${READY}`, ready[1]], lane: 'b' },
    ])], { output: { write(text) { written.push(text); } } });
    await waitForFiles(...ready);
    stopRuns();
    const status = await done;
    const report = written.join('');

    assert.notEqual(status, 0);
    assert.match(report, /\n\[ci-gate:real\] ends cleanly\na up\n/);
    assert.match(report, /\n\[ci-gate:real\] ends by the signal\nb up\n/);
    assert.equal(report.includes('must not run'), false);
    assert.match(report, /not run {2}real: never starts\n/);
    assert.match(report, /\nCI gate run stopped before it finished\n/);
  } finally {
    stopRuns();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a stopped run fails even when every command it cut short ended cleanly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-gate-stop-'));
  const ready = path.join(dir, 'a');
  try {
    const done = runGates([gate('real', [
      { label: 'ends cleanly', command: process.execPath, args: ['-e', `process.on('SIGTERM', () => process.exit(0)); ${READY}`, ready] },
    ])], { output: quiet });
    await waitForFiles(ready);
    stopRuns();
    assert.equal(await done, 1);
  } finally {
    stopRuns();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--dry-run lists every command once, in manifest order, with its lanes, and runs none', async () => {
  const written = [];
  const status = await runGates([
    gate('one', [{ ...command('a', 'a'), lane: 'x' }, command('b', 'b')], 'p'),
    gate('two', [command('c', 'c')]),
  ], {
    dryRun: true,
    run() { throw new Error('a dry run must not run commands'); },
    output: { write(text) { written.push(text); } },
  });
  assert.equal(status, 0);
  assert.equal(written.join(''), [
    '\n[ci-gate:one] a (lane p / x)\n  npm run a\n',
    '\n[ci-gate:one] b (lane p)\n  npm run b\n',
    '\n[ci-gate:two] c\n  npm run c\n',
  ].join(''));
});

test('the command line rejects what it does not know and dry-runs the real manifest', () => {
  const script = fileURLToPath(new URL('./run-ci-gates.mjs', import.meta.url));
  const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

  const dryRun = cli('--profile', 'ci', '--dry-run');
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const listed = dryRun.stdout.split('\n').filter((line) => line.startsWith('[ci-gate:'));
  assert.equal(listed.length, resolveGateCommands(loadGateManifest(), { profileName: 'ci' }).length);
  assert.ok(listed.includes('[ci-gate:client] Check client coverage floor (lane client)'));

  for (const args of [['--profile', 'ci', '--unknown'], ['--profile'], ['--gate', 'no-such-gate'], []]) {
    const result = cli(...args);
    assert.equal(result.status, 1, `"${args.join(' ')}" must be refused`);
    assert.equal(result.stdout, '');
  }
});

test('a command killed by a signal fails the run', async () => {
  const status = await runGates([gate('real', [
    nodeCommand('killed', "process.kill(process.pid, 'SIGKILL')"),
  ])], { output: quiet });
  assert.equal(status, 1);
});

test('manifest validation rejects an empty lane name', () => {
  const manifest = fixtureManifest();
  manifest.gates.wiring.lane = '';
  manifest.gates.client.commands[0].lane = 7;
  assert.deepEqual(validateGateManifest(manifest), [
    'gate "wiring" lane must be a non-empty string',
    'gate "client" command 1 lane must be a non-empty string',
  ]);
});

test('the repository manifest keeps dependent commands in one lane, in order', () => {
  const manifest = loadGateManifest();
  const gates = Object.fromEntries(resolveGates(manifest, { profileName: 'ci' }).map((entry) => [entry.name, entry]));
  const inOrderInOneLane = (gateName, ...scripts) => {
    const commands = gates[gateName].commands;
    const found = scripts.map((script) => commands.findIndex(({ args }) => args.at(-1) === script));
    assert.ok(found.every((index) => index >= 0), `${gateName} must run ${scripts.join(', ')}`);
    assert.deepEqual([...found].sort((left, right) => left - right), found, `${scripts.join(' then ')} must keep that order`);
    assert.equal(new Set(found.map((index) => commands[index].lane)).size, 1, `${scripts.join(', ')} must share a lane`);
  };
  // Each of these reads what the one before it wrote.
  inOrderInOneLane('wiring-and-release', 'worker:bundle', 'verify:cloudflare-template');
  inOrderInOneLane('wiring-and-release', 'build', 'client:bundle-budget:check');
  inOrderInOneLane('client', 'test:client:merge', 'coverage-floor:check');
  // The shards must all have finished before they are merged.
  assert.ok(gates['client-tests'].lane);
  assert.equal(gates['client-tests'].lane, gates.client.lane);
  assert.ok(manifest.profiles.ci.indexOf('client-tests') < manifest.profiles.ci.indexOf('client'));
  // Contract smokes start local chains, and the history-replay tests run real git: each stays serial inside.
  for (const gateName of ['contracts', 'cecc-and-node']) {
    assert.equal(new Set(gates[gateName].commands.map((entry) => entry.lane)).size, 1, `${gateName} must stay serial`);
  }
  // The CC tests start a Jest run with a time limit: after the Node tests, the client shards beside them are done.
  const nodeGate = manifest.gates['cecc-and-node'].commands.map(({ args }) => args.at(-1));
  if (nodeGate.includes('test:cc')) {
    assert.ok(nodeGate.indexOf('test:node:tracked') < nodeGate.indexOf('test:cc'));
  }
  // Two compilers with multi-gigabyte heaps must not run at once on a small CI runner.
  inOrderInOneLane('wiring-and-release', 'typecheck:client', 'typecheck:client-tests');
});

test('only the wiring gate and the local profile use lanes; everything else runs one command at a time', () => {
  const manifest = loadGateManifest();
  for (const [name, entry] of Object.entries(manifest.gates)) {
    const commandLanes = entry.commands.filter((item) => item.lane).length;
    assert.equal(commandLanes > 0, name === 'wiring-and-release', `${name} command lanes`);
  }
  for (const name of manifest.profiles.release) {
    assert.equal(manifest.gates[name].lane, undefined, `release gate ${name} must stay serial`);
  }
});

test('hosted aggregate result check fails closed on missing, extra, or unsuccessful jobs', () => {
  const manifest = fixtureManifest();

  assert.deepEqual(
    checkProfileResults(manifest, 'hosted', {
      wiring: 'success',
      client: 'success',
      node: 'success',
      e2e: 'success',
    }),
    [],
  );
  assert.deepEqual(
    checkProfileResults(manifest, 'hosted', {
      wiring: 'success',
      client: 'failure',
      node: 'cancelled',
      unexpected: 'success',
    }),
    [
      'hosted gate "client" completed with "failure"',
      'hosted gate "node" completed with "cancelled"',
      'hosted gate "e2e" has no reported result',
      'reported result "unexpected" is not in profile "hosted"',
    ],
  );
});

test('repository manifest keeps CI full-test universes single-pass and release standalone', () => {
  const manifest = loadGateManifest();
  const ciCommands = resolveGateCommands(manifest, { profileName: 'ci' })
    .map((entry) => [entry.command, ...entry.args].join(' '));
  const releaseCommands = resolveGateCommands(manifest, { profileName: 'release' })
    .map((entry) => [entry.command, ...entry.args].join(' '));

  assert.deepEqual(manifest.profiles.hosted, [
    'wiring-and-release',
    'public-text',
    'contracts',
    'client-tests',
    'client',
    'root-jest',
    'workers',
    'e2e-smoke',
    'cecc-and-node',
  ]);
  assert.equal(ciCommands.filter((value) => value === 'npm run test:client:shards').length, 1);
  assert.equal(ciCommands.filter((value) => value === 'npm run test:client:merge').length, 1);
  assert.ok(
    ciCommands.indexOf('npm run test:client:shards') < ciCommands.indexOf('npm run test:client:merge'),
    'the shards must run before they are merged',
  );
  assert.ok(ciCommands.indexOf('npm run test:client:merge') < ciCommands.indexOf('npm run coverage-floor:check'));
  assert.equal(ciCommands.filter((value) => value === 'npm run test:node:tracked').length, 1);
  assert.equal(ciCommands.some((value) => value === 'npm run test:node'), false);
  assert.equal(ciCommands.filter((value) => value === 'npm run verify:release-version').length, 1);
  assert.equal(ciCommands.some((value) => value === 'npm run verify:release'), false);
  assert.equal(ciCommands.some((value) => value.includes('test:release:client')), false);
  assert.ok(releaseCommands.includes('npm run test:release:client'));
  assert.ok(releaseCommands.includes('npm run test:node:tracked'));
});
