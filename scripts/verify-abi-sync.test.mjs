import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const scriptPath = path.resolve('scripts/verify-abi-sync.mjs');

const withFixture = (run) => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-abi-sync-'));
  try {
    const artifactDir = path.join(repoDir, 'out/SessionRegistry.sol');
    const abiDir = path.join(repoDir, 'client/src/contractsABI');
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.mkdirSync(abiDir, { recursive: true });
    return run({ repoDir, artifactDir, abiDir });
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
};

const runVerifier = (repoDir) => spawnSync(process.execPath, [
  scriptPath,
  '--repo',
  repoDir,
  '--contract',
  'SessionRegistry.sol/SessionRegistry.json:SESSION_REGISTRY_ABI.json',
], { encoding: 'utf8' });

test('passes when the tracked ABI exactly matches deterministic artifact extraction', () => {
  withFixture(({ repoDir, artifactDir, abiDir }) => {
    const abi = [{ type: 'function', name: 'owner', inputs: [], outputs: [] }];
    fs.writeFileSync(path.join(artifactDir, 'SessionRegistry.json'), JSON.stringify({ abi }));
    fs.writeFileSync(path.join(abiDir, 'SESSION_REGISTRY_ABI.json'), `${JSON.stringify(abi, null, 2)}\n`);

    const result = runVerifier(repoDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ABI parity check passed/);
  });
});

test('fails on drift without rewriting the tracked ABI', () => {
  withFixture(({ repoDir, artifactDir, abiDir }) => {
    const generatedAbi = [{ type: 'event', name: 'Created', inputs: [] }];
    const trackedPath = path.join(abiDir, 'SESSION_REGISTRY_ABI.json');
    const trackedContent = '[]\n';
    fs.writeFileSync(path.join(artifactDir, 'SessionRegistry.json'), JSON.stringify({ abi: generatedAbi }));
    fs.writeFileSync(trackedPath, trackedContent);

    const result = runVerifier(repoDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ABI drift/);
    assert.match(result.stderr, /npm run abi:sync/);
    assert.equal(fs.readFileSync(trackedPath, 'utf8'), trackedContent);
  });
});

test('fails closed when a generated artifact or tracked ABI is missing', () => {
  withFixture(({ repoDir }) => {
    const result = runVerifier(repoDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing generated artifact/);
  });
});
