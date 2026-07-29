import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkProfileResults,
  loadGateManifest,
  resolveGateCommands,
  runGateCommands,
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

test('gate runner executes commands in order and stops on the first failure', () => {
  const calls = [];
  const commands = [
    command('first', 'first'),
    command('second', 'second'),
    command('never', 'never'),
  ];
  const status = runGateCommands(commands, {
    spawn(commandName, args) {
      calls.push([commandName, ...args]);
      return { status: args.at(-1) === 'second' ? 9 : 0 };
    },
    output: { write() {} },
  });

  assert.equal(status, 9);
  assert.deepEqual(calls, [
    ['npm', 'run', 'first'],
    ['npm', 'run', 'second'],
  ]);
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
    'client',
    'root-jest',
    'workers',
    'e2e-smoke',
    'cecc-and-node',
  ]);
  assert.equal(ciCommands.filter((value) => value === 'npm run test:client').length, 1);
  assert.equal(ciCommands.filter((value) => value === 'npm run test:node:tracked').length, 1);
  assert.equal(ciCommands.some((value) => value === 'npm run test:node'), false);
  assert.equal(ciCommands.filter((value) => value === 'npm run verify:release-version').length, 1);
  assert.equal(ciCommands.some((value) => value === 'npm run verify:release'), false);
  assert.equal(ciCommands.some((value) => value.includes('test:release:client')), false);
  assert.ok(releaseCommands.includes('npm run test:release:client'));
  assert.ok(releaseCommands.includes('npm run test:node:tracked'));
});
