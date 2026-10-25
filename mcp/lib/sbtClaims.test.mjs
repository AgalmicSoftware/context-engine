import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createSbtClaimer, decodeInviteCode, listSessionSbts, normalizeGroupPasswordInput, resolveSbtChainId } from './sbtClaims.mjs';

const SBT = '0x00000000000000000000000000000000000000aa';
const signature = ethers.utils.joinSignature({ r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}`, v: 27 });
const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

test('claim funding preserves pending transfers and distinguishes faucet balance refusals', async () => {
  const iface = new ethers.utils.Interface([
    'function getTokenIdByOwner(address) view returns(uint256)', 'function balanceOf(address) view returns(uint256)',
    'function mintMode() view returns(uint8)', 'function mintingEndTime() view returns(uint256)',
    'function maxTokens() view returns(uint256)', 'function mintedTokens() view returns(uint256)', 'function claim()',
  ]);
  const txHash = ethers.utils.id('fixture-faucet-payout');
  for (const mode of ['balance_high', 'pending', 'balance_error']) {
    const wallet = ethers.Wallet.createRandom();
    let clock = 0;
    let requests = 0;
    let reads = 0;
    const provider = {
      _isProvider: true,
      send: async () => '0xaa37dc',
      call: async (tx) => {
        const parsed = iface.parseTransaction({ ...tx, data: await tx.data });
        return iface.encodeFunctionResult(parsed.name, parsed.name === 'claim' ? [] : [0]);
      },
      estimateGas: async () => ethers.BigNumber.from(100000),
      getBlock: async () => ({}),
      getGasPrice: async () => ethers.utils.parseUnits('1', 'gwei'),
      getBalance: async () => {
        reads += 1;
        if (mode === 'balance_error' && reads >= 3) throw new Error('Balance RPC unavailable');
        return ethers.constants.Zero;
      },
    };
    const client = {
      config: { networkChainId: 11155420 }, tokenClaims: { scopes: { faucet: true } },
      refreshConfig: async () => {}, ensureToken: async () => {},
      request: async () => {
        requests += 1;
        if (mode === 'balance_high') throw Object.assign(new Error('Balance above threshold (0.001 ETH).'), { status: 403 });
        return { txHash, chainId: 11155420, amountEth: '0.0002' };
      },
    };
    const claimer = createSbtClaimer({ wallet, createProvider: () => provider, now: () => clock, sleep: async (ms) => { clock += ms; } });
    await assert.rejects(claimer.claim({ ctx: { client, info: { slug: 'example' } }, sbtAddress: SBT }), (error) => {
      assert.match(error.message, new RegExp(wallet.address));
      if (mode === 'balance_high') {
        assert.match(error.message, /refused.*above.*threshold/i);
        assert.doesNotMatch(error.message, /not supplied.*yet/i);
      } else assert.match(error.message, new RegExp(txHash));
      return true;
    });
    assert.equal(requests, 1);
  }
});

test('decodes invite codes, with or without an inv: prefix', () => {
  const code = encode({ c: '11155420', a: SBT.toLowerCase(), n: '3', s: signature });
  const decoded = decodeInviteCode(code);
  assert.deepEqual(decoded, { chainId: 11155420, sbtAddress: ethers.utils.getAddress(SBT), slot: '3', signature });
  assert.deepEqual(decodeInviteCode(`inv:${code}`), decoded);
  assert.deepEqual(decodeInviteCode(` Invite:${code} `), decoded);
});

test('rejects malformed invite codes', () => {
  assert.equal(decodeInviteCode(''), null);
  assert.equal(decodeInviteCode('not-base64-json'), null);
  assert.equal(decodeInviteCode(encode({ c: '1', a: SBT, n: '1' })), null);
  assert.equal(decodeInviteCode(encode({ c: '1', a: SBT, n: '1', s: signature, extra: 1 })), null);
  assert.equal(decodeInviteCode(encode({ c: '0', a: SBT, n: '1', s: signature })), null);
  assert.equal(decodeInviteCode(encode({ c: '1', a: SBT, n: '0', s: signature })), null);
  assert.equal(decodeInviteCode(encode({ c: '1', a: ethers.constants.AddressZero, n: '1', s: signature })), null);
  assert.equal(decodeInviteCode(encode({ c: '1', a: SBT, n: '1', s: '0x1234' })), null);
  assert.equal(decodeInviteCode('x'.repeat(4097)), null);
});

test('normalizes group passwords like the web client', () => {
  assert.equal(normalizeGroupPasswordInput('  open sesame  '), 'opensesame');
  assert.equal(normalizeGroupPasswordInput(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('hex-pass'))), 'hex-pass');
  assert.equal(normalizeGroupPasswordInput(''), '');
});

test('finds the SBT chain from session access rules before the session chain', () => {
  const config = {
    networkChainId: 84532,
    sessionModeProfile: {
      storage: {
        payloadAccessControl: {
          accessConditions: { match: 'any', conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: SBT }] },
        },
      },
    },
  };
  assert.equal(resolveSbtChainId(config, SBT.toLowerCase()), 11155420);
  assert.equal(resolveSbtChainId(config, '0x00000000000000000000000000000000000000bb'), 84532);
  assert.equal(resolveSbtChainId({}, SBT), 11155420);
  assert.deepEqual(listSessionSbts(config), [{ sbt: ethers.utils.getAddress(SBT), chainId: 11155420 }]);
  assert.deepEqual(listSessionSbts({}), []);
});
