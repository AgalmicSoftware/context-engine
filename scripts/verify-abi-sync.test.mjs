import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const scriptPath = path.resolve('scripts/verify-abi-sync.mjs');
const syncScriptPath = path.resolve('scripts/sync-abis.mjs');
const contractMapPath = path.resolve('scripts/abi-contracts.mjs');

test('sync and verify share one immutable side-effect-free ABI contract map', async () => {
  const expectedContracts = [
    { artifact: 'SessionRegistry.sol/SessionRegistry.json', abi: 'SESSION_REGISTRY_ABI.json' },
    { artifact: 'Surveys.sol/Surveys.json', abi: 'SURVEYS_ABI.json' },
    { artifact: 'CustomSBT.sol/MySBT.json', abi: 'CUSTOM_SBT_ABI.json' },
    { artifact: 'SBTFactory.sol/SBTFactory.json', abi: 'SBT_FACTORY_ABI.json' },
  ];
  const contractMapSource = fs.readFileSync(contractMapPath, 'utf8');
  const syncSource = fs.readFileSync(syncScriptPath, 'utf8');
  const verifierSource = fs.readFileSync(scriptPath, 'utf8');
  const { ABI_CONTRACTS } = await import(pathToFileURL(contractMapPath).href);

  assert.deepEqual(ABI_CONTRACTS, expectedContracts);
  assert.ok(Object.isFrozen(ABI_CONTRACTS));
  assert.ok(ABI_CONTRACTS.every(Object.isFrozen));
  assert.doesNotMatch(contractMapSource, /node:fs|node:child_process|console\.|process\.|\bfetch\s*\(/);
  assert.match(syncSource, /import \{ ABI_CONTRACTS \} from ['"]\.\/abi-contracts\.mjs['"]/);
  assert.match(verifierSource, /import \{ ABI_CONTRACTS \} from ['"]\.\/abi-contracts\.mjs['"]/);
  assert.doesNotMatch(syncSource, /const CONTRACTS\s*=\s*\[/);
  assert.doesNotMatch(verifierSource, /ABI_CONTRACTS\s*=\s*Object\.freeze/);
});

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
