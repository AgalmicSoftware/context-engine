import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_WORKER_SCRIPT_NAME_LENGTH, buildDeploymentWorkerName } from './workerScriptName.mjs';

const deploymentId = 'e9d0566ef26a8859da3b0371e70d631b44d121a24865a1090f18ef4f856fcf67';
const previousRule = (prefix) => `${prefix.slice(0, 50) || 'fallback'}-${deploymentId.slice(0, 12)}`;

test('deployment Worker names fit Cloudflare version-preview hostnames', () => {
  // The live run that found the limit used this 50-character prefix.
  const name = buildDeploymentWorkerName('ce-p652-two-key-two-key-claude-merge-1792530552627', deploymentId, 'fallback');
  assert.equal(name, 'ce-p652-two-key-two-key-claude-merge-1792-e9d0566ef26a');
  assert.equal(name.length, MAX_WORKER_SCRIPT_NAME_LENGTH);
  // An 8-character version prefix and its dash must still fit one 63-character DNS label.
  assert.ok(`0123abcd-${name}`.length <= 63);
});

test('deployment Worker names that already fit keep their exact previous form', () => {
  for (let length = 1; length <= 41; length += 1) {
    const prefix = 'a'.repeat(length);
    assert.equal(buildDeploymentWorkerName(prefix, deploymentId, 'fallback'), previousRule(prefix));
  }
  assert.equal(buildDeploymentWorkerName('a'.repeat(42), deploymentId, 'fallback'), `${'a'.repeat(41)}-e9d0566ef26a`);
});

test('a shortened deployment Worker name never ends its prefix with a dash', () => {
  assert.equal(
    buildDeploymentWorkerName(`${'a'.repeat(39)}--tail`, deploymentId, 'fallback'),
    `${'a'.repeat(39)}-e9d0566ef26a`,
  );
  assert.equal(buildDeploymentWorkerName('', deploymentId, 'fallback'), 'fallback-e9d0566ef26a');
});
