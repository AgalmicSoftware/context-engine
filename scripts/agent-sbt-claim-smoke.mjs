#!/usr/bin/env node
// Claims every SBT mint mode with the MCP agent claimer against fresh local
// contracts. A stand-in session faucet funds the agent's empty address.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { createSbtClaimer } from '../mcp/lib/sbtClaims.mjs';

const require = createRequire(import.meta.url);
const { createGroupPasswordDerivation } = require('../client/src/utilities/crypto/groupPasswordDerivation.cjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chainId = 11155420;
const groupPassword = 'agent-claim-fixture';
const claimPassword = 'agent-claim-password';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { computeGroupPasswordHash, deriveGroupPasswordWallet } = createGroupPasswordDerivation(ethers);

const freePort = async () => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
};

const inviteCode = async (sbtAddress, slot) => {
  const groupWallet = await deriveGroupPasswordWallet({ password: groupPassword, sbtAddress });
  const hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256', 'address', 'uint256'],
      [ethers.utils.id('ContextEngine.SBT.Invite:1'), chainId, sbtAddress, slot],
    ),
  );
  const signature = await groupWallet.signMessage(ethers.utils.arrayify(hash));
  return Buffer.from(JSON.stringify({ c: String(chainId), a: sbtAddress, n: String(slot), s: signature })).toString('base64url');
};

const main = async () => {
  let anvil;
  let provider;
  try {
    const port = await freePort();
    // Interval mining lets the password reveal wait for a later block.
    anvil = spawn('anvil', ['--silent', '--host', '127.0.0.1', '--port', String(port), '--chain-id', String(chainId), '--block-time', '1'], {
      stdio: 'ignore',
    });
    let startupError;
    anvil.on('error', (error) => {
      startupError = error;
    });
    provider = new ethers.providers.JsonRpcProvider({ url: `http://127.0.0.1:${port}`, timeout: 5000 }, chainId);
    provider.pollingInterval = 100;
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
      if (startupError) throw startupError;
      try {
        await provider.getBlockNumber();
        ready = true;
      } catch {
        await pause(100);
      }
    }
    assert.ok(ready, 'local Anvil must start');

    const admin = provider.getSigner(0);
    const adminAddress = await admin.getAddress();
    const artifact = JSON.parse(fs.readFileSync(path.join(root, 'out/SBTFactory.sol/SBTFactory.json'), 'utf8'));
    const factory = await new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, admin).deploy();
    await factory.deployed();
    const create = async (label, { limited = 0, hasPasswordMint = false, hashedPasswords = [], groupSigner = false }) => {
      const shape = [ethers.utils.id(`agent-sbt-claim-smoke/${label}`), `Agent ${label}`, 'AGENT', limited, adminAddress, 0, hasPasswordMint, 3, hashedPasswords];
      const predicted = await factory.predictConfiguredSBTAddress(...shape, groupSigner);
      const signerHash = groupSigner ? await computeGroupPasswordHash({ password: groupPassword, sbtAddress: predicted }) : ethers.constants.HashZero;
      await (await factory.createSBTDeterministicConfigured(...shape, 'ar://agent-smoke', signerHash, groupSigner)).wait();
      return predicted;
    };
    const sbts = {
      public: await create('public', {}),
      password: await create('password', { hasPasswordMint: true, hashedPasswords: [ethers.utils.id(claimPassword)] }),
      group_password: await create('group', { groupSigner: true }),
      invite: await create('invite', { limited: 2, hasPasswordMint: true, groupSigner: true }),
    };

    let faucetCalls = 0;
    const sessionFor = (scopes, networkChainId = chainId) => ({
      info: { slug: 'agent-town' },
      client: {
        config: { networkChainId },
        tokenClaims: { scopes },
        refreshConfig: async () => {},
        ensureToken: async () => {},
        // Stands in for the Worker's request_test_eth action.
        request: async (route, { body }) => {
          assert.equal(route, '/');
          assert.equal(body.action, 'request_test_eth');
          faucetCalls += 1;
          const tx = await admin.sendTransaction({ to: body.to, value: ethers.utils.parseEther('0.005') });
          return { txHash: tx.hash, amountEth: '0.005', chainId: networkChainId };
        },
      },
    });
    const ctx = sessionFor({ faucet: true });
    const agent = ethers.Wallet.createRandom();
    const claimer = createSbtClaimer({ wallet: agent, createProvider: () => provider, sleep: (ms) => pause(Math.min(ms, 250)) });
    const holds = async (sbt, address = agent.address) =>
      (await new ethers.Contract(sbt, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address)).toString();

    const invite = await inviteCode(sbts.invite, 1);
    const claims = [
      ['public', {}],
      ['password', { claimPassword }],
      ['group_password', { groupPassword: `  ${groupPassword}  ` }],
      ['invite', { inviteCode: `inv:${invite}` }],
    ];
    for (const [mode, codes] of claims) {
      const result = await claimer.claim({ ctx, sbtAddress: sbts[mode], ...codes });
      assert.equal(result.status, 'claimed', `${mode} claim must succeed`);
      assert.equal(result.mode, mode);
      assert.equal(result.chainId, chainId);
      assert.equal(await holds(sbts[mode]), '1', `${mode} token must belong to the agent`);
    }
    assert.ok(faucetCalls >= 1, 'the empty agent address must be funded by the session faucet');
    assert.equal((await claimer.claim({ ctx, sbtAddress: sbts.public })).status, 'already_held');

    const other = ethers.Wallet.createRandom();
    const otherClaimer = createSbtClaimer({ wallet: other, createProvider: () => provider, sleep: (ms) => pause(Math.min(ms, 250)) });
    await assert.rejects(otherClaimer.claim({ ctx, sbtAddress: sbts.invite, inviteCode: invite }), /already been used/);
    await assert.rejects(otherClaimer.claim({ ctx, sbtAddress: sbts.group_password, groupPassword: 'wrong password' }), /does not match/);
    await assert.rejects(otherClaimer.claim({ ctx, sbtAddress: sbts.password, claimPassword }), /not valid/);
    await assert.rejects(
      otherClaimer.claim({ ctx: sessionFor({}), sbtAddress: sbts.public }),
      /does not grant its faucet/,
      'without the faucet scope an unfunded agent is told to fund its address',
    );
    const stopped = new AbortController();
    stopped.abort();
    await assert.rejects(otherClaimer.claim({ ctx, sbtAddress: sbts.public, signal: stopped.signal }), /Stopped before finishing/);
    await assert.rejects(otherClaimer.claim({ ctx: sessionFor({ faucet: true }, 8453), sbtAddress: sbts.public }), /only on test networks/);
    await assert.rejects(otherClaimer.claim({ ctx: sessionFor({ faucet: true }, 84532), sbtAddress: sbts.public }), /reports chain 11155420/);
    assert.equal(await holds(sbts.public, other.address), '0');
    console.log('Agent SBT claim smoke passed: public, password commit-reveal, group password and invite claims from an empty agent address funded by the session faucet.');
  } finally {
    if (provider) provider.removeAllListeners();
    if (anvil && anvil.exitCode === null && anvil.pid) {
      const exited = once(anvil, 'exit');
      anvil.kill('SIGTERM');
      await exited;
    }
  }
};

main().catch((error) => {
  console.error(`Agent SBT claim smoke failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
