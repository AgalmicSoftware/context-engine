import test from 'node:test';
import assert from 'node:assert/strict';
import { describeTestEthOffer } from '../../shared/sessions/testEthOffer.mjs';

const hosted = {
  networkChainId: 11155420,
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  workerAuthority: { participantScopes: ['storage', 'faucet'] },
};
const resourcePresence = { txGas: true };

test('hosted offers require a testnet, a faucet participant scope and a configured key', () => {
  assert.deepEqual(describeTestEthOffer({ config: hosted, resourcePresence }), {
    offered: true, audience: 'participants', chainId: 11155420, network: 'OP Sepolia', amountEth: '0.0002', maxBalanceEth: '0.001',
  });
  for (const config of [
    { ...hosted, networkChainId: 1 },
    { ...hosted, networkChainId: undefined, registryChainId: 11155420 },
    { ...hosted, networkChainId: undefined, sessionModeProfile: { ...hosted.sessionModeProfile, evm: { registryChainId: 11155420 } } },
    { ...hosted, workerAuthority: { participantScopes: ['storage'] } },
    { ...hosted, workerAuthority: { participantScopes: 'faucet' } },
  ]) assert.equal(describeTestEthOffer({ config, resourcePresence }).offered, false);
  assert.equal(describeTestEthOffer({ config: hosted }).offered, false);
  assert.equal(describeTestEthOffer({ config: hosted, resourcePresence: { txGas: false } }).offered, false);
  const guarded = { ...hosted, get scopes() { throw new Error('Do not inspect config scopes'); } };
  assert.equal(describeTestEthOffer({ config: guarded, resourcePresence }).offered, true);
});

test('the self-service scope advertises the hosted offer while retaining legacy config compatibility', () => {
  for (const scope of ['faucet_self', 'faucet']) {
    assert.equal(describeTestEthOffer({ config: { ...hosted, workerAuthority: { participantScopes: [scope] } }, resourcePresence }).offered, true);
  }
});

test('registry offers report gas-gate eligibility and keep private amounts unknown', () => {
  for (const config of [
    { networkChainId: 84532, sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } } },
    { networkChainId: 84532, registryChainId: 84532 },
  ]) assert.deepEqual(describeTestEthOffer({ config, resourcePresence }), {
    offered: true, audience: 'gas-gate', chainId: 84532, network: 'Base Sepolia', amountEth: null, maxBalanceEth: null,
  });
  for (const config of [null, {}, { networkChainId: 1 }, { networkChainId: 84532, sessionModeProfile: { authority: { mode: 'unknown' } } }]) {
    const offer = describeTestEthOffer({ config, resourcePresence });
    assert.equal(offer.offered, false);
    assert.ok(offer.reason);
  }
});
