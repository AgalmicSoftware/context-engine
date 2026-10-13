#!/usr/bin/env node
// Exercise the browser's signing implementation against fresh local contracts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { ethers } = require('ethers');
const esbuild = require('esbuild');
const { createGroupPasswordDerivation } = require('../client/src/utilities/crypto/groupPasswordDerivation.cjs');

const root = path.resolve(__dirname, '..');
const chainId = 11155420;
const password = 'local-invite-fixture';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-sbt-authorization-'));
  let anvil;
  let provider;
  try {
    const signingModule = path.join(temporary, 'signing.cjs');
    esbuild.buildSync({
      entryPoints: [path.join(root, 'client/src/utilities/crypto/sbtAuthorization.ts')],
      outfile: signingModule, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { signInvites, signGroupMintAuthorization } = require(signingModule);
    const port = await freePort();
    let startupError;
    anvil = spawn('anvil', ['--silent', '--host', '127.0.0.1', '--port', String(port), '--chain-id', String(chainId)], {
      stdio: 'ignore',
    });
    anvil.on('error', (error) => { startupError = error; });
    provider = new ethers.providers.JsonRpcProvider({ url: `http://127.0.0.1:${port}`, timeout: 1500 }, chainId);
    provider.pollingInterval = 50;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (startupError) throw startupError;
      if (anvil.exitCode !== null) throw new Error(`Local Anvil exited with ${anvil.exitCode}`);
      try { await provider.getBlockNumber(); ready = true; break; } catch { await pause(50); }
    }
    assert.ok(ready, 'local Anvil must start');
    const [admin, first, second, third, newAdmin] = Array.from({ length: 5 }, (_, i) => provider.getSigner(i));
    const firstAddress = await first.getAddress();
    const secondAddress = await second.getAddress();
    const factoryArtifact = JSON.parse(fs.readFileSync(path.join(root, 'out/SBTFactory.sol/SBTFactory.json'), 'utf8'));
    const sbtAbi = JSON.parse(fs.readFileSync(path.join(root, 'client/src/contractsABI/CUSTOM_SBT_ABI.json'), 'utf8'));
    const factory = await new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode.object, admin).deploy();
    await factory.deployed();
    // Group password hashes are scoped to the collection address, so predict it before deploying.
    const { computeGroupPasswordHash } = createGroupPasswordDerivation(ethers);
    const signerHashes = new Map();
    const create = async (label, count, limited) => {
      const shape = [ethers.utils.id(`sbt-authorization-smoke/${label}`), 'Local membership', 'LOCAL', count,
        await admin.getAddress(), 0, limited, 3, []];
      const predicted = await factory.predictConfiguredSBTAddress(...shape, true);
      const signerHash = await computeGroupPasswordHash({ password, sbtAddress: predicted });
      const receipt = await (await factory.createSBTDeterministicConfigured(...shape, 'ar://local-smoke', signerHash,
        true)).wait();
      const event = receipt.events.find((entry) => entry.event === 'SBTCreated');
      assert.ok(event, 'factory must identify the created collection');
      assert.equal(event.args.sbtAddress, predicted, 'the collection must deploy to its predicted address');
      const collection = new ethers.Contract(event.args.sbtAddress, sbtAbi, admin);
      assert.equal(await collection.groupPasswordHash(), signerHash, 'the factory sets the scoped signer hash once');
      signerHashes.set(collection.address, signerHash);
      return collection;
    };
    const group = await create('group', 0, false);
    const slots = await create('slots', 3, true);
    // Signing checks the on-chain signer hash first, as the browser does.
    const signingInput = { password, chainId };
    const groupHash = signerHashes.get(group.address);
    const groupSignature = await signGroupMintAuthorization({ ...signingInput, sbtAddress: group.address,
      userAddress: firstAddress, groupPasswordHash: groupHash });
    await assert.rejects(group.connect(second).callStatic.mintWithGroupSignature(groupSignature));
    const wrongChainGroup = await signGroupMintAuthorization({ ...signingInput, chainId: chainId + 1,
      sbtAddress: group.address, userAddress: firstAddress, groupPasswordHash: groupHash });
    await assert.rejects(group.connect(first).callStatic.mintWithGroupSignature(wrongChainGroup));
    await (await group.connect(first).mintWithGroupSignature(groupSignature)).wait();

    const signSlot = async (nonce, { sbtAddress = slots.address, ...overrides } = {}) =>
      (await signInvites({ ...signingInput, sbtAddress, nonces: [nonce], groupPasswordHash: signerHashes.get(sbtAddress),
        ...overrides }))[0];
    const slotTwo = await signSlot('2');
    await assert.rejects(slots.connect(first).callStatic.claimWithInvite('2', await signSlot('2', { chainId: chainId + 1 })));
    await assert.rejects(slots.connect(first).callStatic.claimWithInvite('1', slotTwo));
    await assert.rejects(slots.connect(first).callStatic.claimWithInvite('2', await signSlot('2', { sbtAddress: group.address })));
    await (await slots.connect(first).claimWithInvite('2', slotTwo)).wait();
    assert.equal((await group.balanceOf(firstAddress)).toString(), '1');
    assert.equal((await slots.balanceOf(firstAddress)).toString(), '1', 'another collection does not prevent joining');
    await assert.rejects(slots.connect(third).callStatic.claimWithInvite('2', slotTwo));
    await assert.rejects(slots.connect(first).callStatic.claimWithInvite('1', await signSlot('1')));
    await (await slots.connect(second).claimWithInvite('1', await signSlot('1'))).wait();
    assert.equal((await slots.balanceOf(secondAddress)).toString(), '1');
    await (await slots.connect(third).claimWithInvite('3', await signSlot('3'))).wait();
    for (const slot of [1, 2, 3]) assert.equal(await slots.usedInviteSlots(slot), true);
    assert.equal((await slots.mintedTokens()).toString(), '3');

    const rotation = await (await slots.changeAdmin(await newAdmin.getAddress())).wait();
    assert.ok(rotation.events.some((event) => event.event === 'AdminChanged'));
    await assert.rejects(slots.callStatic.changeAdmin(await admin.getAddress()));
    await (await slots.connect(newAdmin).changeAdmin(ethers.constants.AddressZero)).wait();
    assert.equal(await slots.admin(), ethers.constants.AddressZero);
    await assert.rejects(slots.connect(newAdmin).callStatic.changeAdmin(await newAdmin.getAddress()));
    await assert.rejects(slots.connect(first).callStatic.burn(await slots.getTokenIdByOwner(firstAddress)));
    assert.equal(sbtAbi.some((entry) => entry.type === 'function' && ['owner', 'transferOwnership', 'renounceOwnership'].includes(entry.name)), false);
    console.log('SBT authorization smoke passed: address-scoped v4 group passwords, client signatures, chain/collection/claimant binding, independent one-use slots, collection-local membership and admin retirement.');
  } finally {
    if (provider) provider.removeAllListeners();
    if (anvil && anvil.exitCode === null && anvil.pid) {
      const exited = once(anvil, 'exit');
      anvil.kill('SIGTERM');
      await exited;
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`SBT authorization smoke failed: ${error.message}`);
  process.exitCode = 1;
});
