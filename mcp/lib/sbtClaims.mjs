import { createTestEthRequester } from './testEth.mjs';
import { ethers } from 'ethers';
import groupPasswordDerivation from '../../client/src/utilities/crypto/groupPasswordDerivation.cjs';
import rpcDefaults from '../../shared/rpcDefaults.cjs';

// Claims a session SBT to the agent's own address, the way the web client
// does for a passkey participant (contracts/CustomSBT.sol mint modes). The
// agent pays gas; a session whose Worker grants the faucet scope can send
// test ETH first.

const { createGroupPasswordDerivation } = groupPasswordDerivation;

export const DEFAULT_CHAIN_ID = 11155420;
export const MINT_MODES = Object.freeze(['public', 'password', 'group_password', 'invite']);

const SBT_ABI = [
  'function name() view returns (string)',
  'function mintMode() view returns (uint8)',
  'function maxTokens() view returns (uint256)',
  'function mintedTokens() view returns (uint256)',
  'function mintingEndTime() view returns (uint256)',
  'function groupPasswordHash() view returns (bytes32)',
  'function usedInviteSlots(uint256) view returns (bool)',
  'function isPasswordValid(bytes32) view returns (bool)',
  'function getTokenIdByOwner(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function claim()',
  'function startClaim(bytes32)',
  'function claimWithPassword(string)',
  'function mintWithGroupSignature(bytes)',
  'function claimWithInvite(uint256,bytes)',
];

// Agents claim only on test networks; 31337 is a local chain during development.
const TESTNET_CHAIN_IDS = Object.freeze([11155420, 84532]);
const LOCAL_CHAIN_ID = 31337;
const MAX_CLAIM_COST = ethers.utils.parseEther('0.005');
const TX_WAIT_MS = 180_000;
const PASSWORD_REVEAL_DELAY_SECONDS = 5;
const REVEAL_WAIT_MS = 90_000;
const POLL_MS = 2_000;
const GAS_HEADROOM_PERCENT = 130;
// Budget for the commit-reveal claim, which cannot be estimated before its commit lands.
const PASSWORD_CLAIM_GAS_BUDGET = 400_000;

const trim = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { deriveGroupPasswordWallet } = createGroupPasswordDerivation(ethers);

/** Same normalization as client/src/utilities/crypto/cryptography.ts normalizeGroupPasswordInput. */
export const normalizeGroupPasswordInput = (raw) => {
  const compact = trim(raw).replace(/\s+/g, '');
  if (!compact) return '';
  if (ethers.utils.isHexString(compact)) {
    try {
      return ethers.utils.toUtf8String(compact);
    } catch {
      return compact;
    }
  }
  return compact;
};

/** Decodes an invite code ({c,a,n,s} base64url JSON); null when malformed. */
export const decodeInviteCode = (raw) => {
  let code = trim(raw);
  const lower = code.toLowerCase();
  if (lower.startsWith('inv:')) code = code.slice(4).trim();
  else if (lower.startsWith('invite:')) code = code.slice(7).trim();
  if (!code || code.length > 4096) return null;
  try {
    const parsed = JSON.parse(Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!isRecord(parsed) || Object.keys(parsed).sort().join(',') !== 'a,c,n,s') return null;
    const chainId = ethers.BigNumber.from(String(parsed.c));
    const slot = ethers.BigNumber.from(String(parsed.n));
    const sbtAddress = ethers.utils.getAddress(String(parsed.a));
    if (chainId.lte(0) || slot.lte(0) || sbtAddress === ethers.constants.AddressZero) return null;
    if (!ethers.utils.isHexString(parsed.s, 65)) return null;
    return {
      chainId: chainId.toNumber(),
      sbtAddress,
      slot: slot.toString(),
      signature: ethers.utils.joinSignature(ethers.utils.splitSignature(String(parsed.s))),
    };
  } catch {
    return null;
  }
};

const accessConditionsOf = (config) =>
  [
    config?.sessionModeProfile?.storage?.payloadAccessControl?.accessConditions,
    config?.sessionModeProfile?.encryption?.accessConditions,
    config?.storageProfile?.payloadAccessControl?.accessConditions,
  ].flatMap((document) => (Array.isArray(document?.conditions) ? document.conditions : []));

const conditionAddresses = (condition) =>
  [condition?.contract, condition?.address, ...(Array.isArray(condition?.sbtAddresses) ? condition.sbtAddresses : [])]
    .map((value) => trim(value).toLowerCase())
    .filter(Boolean);

const positiveChainId = (value) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

/** Chooses the chain an SBT lives on from the session's public config. */
export const resolveSbtChainId = (config, sbtAddress) => {
  const target = trim(sbtAddress).toLowerCase();
  const condition = accessConditionsOf(config).find(
    (entry) => entry?.kind === 'sbt_onchain' && conditionAddresses(entry).includes(target) && positiveChainId(entry.chainId),
  );
  return (
    positiveChainId(condition?.chainId) ||
    positiveChainId(config?.networkChainId) ||
    positiveChainId(config?.sessionModeProfile?.evm?.registryChainId) ||
    positiveChainId(config?.registryChainId) ||
    DEFAULT_CHAIN_ID
  );
};

/** Lists the SBTs a session's access rules name, so an agent can discover them. */
export const listSessionSbts = (config) => {
  const seen = new Map();
  accessConditionsOf(config)
    .filter((entry) => entry?.kind === 'sbt_onchain')
    .forEach((entry) =>
      conditionAddresses(entry).forEach((address) => {
        if (ethers.utils.isAddress(address) && !seen.has(address)) {
          seen.set(address, { sbt: ethers.utils.getAddress(address), chainId: resolveSbtChainId(config, address) });
        }
      }),
    );
  return [...seen.values()];
};

const defaultCreateProvider = (rpcOverride) => (chainId) => {
  const url = trim(rpcOverride) || rpcDefaults.getPublicRpcUrls(chainId)[0] || rpcDefaults.getPathRpcUrl(chainId);
  if (!url) throw new Error(`No public RPC is known for chain ${chainId}; set CE_MCP_RPC_URL.`);
  return new ethers.providers.StaticJsonRpcProvider(url, chainId);
};

/** An error whose message is safe to show: it never carries call data or secrets. */
class ClaimError extends Error {}

const SAFE_REASON_RE = /^[A-Za-z][\w .,'()-]{0,119}$/;

// ethers errors quote transactions and call data, which can hold a claim
// password or an invite signature, so only short contract reasons and error
// codes are passed on.
const safeMessage = (error, fallback) => {
  if (error instanceof ClaimError) return error.message;
  const reason = [error?.reason, error?.errorName, error?.error?.reason]
    .map((value) => (typeof value === 'string' ? value.replace(/^execution reverted:?\s*/i, '').trim() : ''))
    .find((value) => SAFE_REASON_RE.test(value));
  const code = typeof error?.code === 'string' && /^[A-Z_]{3,40}$/.test(error.code) ? error.code : '';
  return [fallback, reason || code].filter(Boolean).join(': ');
};

export const createSbtClaimer = ({
  config = {},
  wallet,
  createProvider = defaultCreateProvider(config.rpcUrl),
  now = () => Date.now(),
  sleep = defaultSleep,
} = {}) => {
  const requestTestEth = createTestEthRequester({ config, wallet, createProvider, now, sleep });
  let signal = null;
  // Stops between steps once the tool call is cancelled or times out.
  const checkpoint = () => {
    if (signal?.aborted) throw new ClaimError('Stopped before finishing; no further transactions were sent.');
  };

  const waitFor = async (check, timeoutMs, message) => {
    const deadline = now() + timeoutMs;
    for (;;) {
      checkpoint();
      if (await check()) return;
      if (now() >= deadline) throw new ClaimError(message);
      await sleep(POLL_MS);
    }
  };

  // Uses the chain's suggested tip rather than ethers' fixed 1.5 gwei default,
  // so a small faucet drip covers a claim on a low-fee L2.
  const resolveFees = async (provider) => {
    const block = await provider.getBlock('latest');
    if (!block?.baseFeePerGas) {
      const gasPrice = await provider.getGasPrice();
      return { price: gasPrice, overrides: { gasPrice } };
    }
    let tip;
    try {
      tip = ethers.BigNumber.from(await provider.send('eth_maxPriorityFeePerGas', []));
    } catch {
      tip = ethers.utils.parseUnits('1.5', 'gwei');
    }
    const maxFeePerGas = block.baseFeePerGas.mul(2).add(tip);
    return { price: maxFeePerGas, overrides: { maxFeePerGas, maxPriorityFeePerGas: tip } };
  };

  const fundsFor = (gasLimit, fees) => ethers.BigNumber.from(gasLimit).mul(fees.price).mul(GAS_HEADROOM_PERCENT).div(100);

  /** Ensures the agent holds `need` wei, asking the session faucet when allowed. */
  const ensureFunds = async ({ ctx, provider, chainId, need }) => {
    checkpoint();
    if (need.gt(MAX_CLAIM_COST)) {
      throw new ClaimError(`This claim would cost about ${ethers.utils.formatEther(need)} ETH in gas, above the 0.005 ETH safety limit.`);
    }
    const balance = await provider.getBalance(wallet.address);
    if (balance.gte(need)) return { funded: false };
    const scopes = ctx.client.tokenClaims?.scopes || {};
    const shortfall = `Your address ${wallet.address} needs about ${ethers.utils.formatEther(need)} test ETH on chain ${chainId} for gas`;
    if (scopes.faucet !== true) {
      throw new ClaimError(`${shortfall}, and this session does not grant its faucet. Fund the address and retry.`);
    }
    let funding;
    try {
      funding = await requestTestEth({ ctx, provider, chainId, signal });
    } catch (error) {
      throw new ClaimError(`${shortfall}; ${String(error?.message || 'the faucet request failed').slice(0, 250)}`);
    }
    if (funding?.sent !== true) {
      throw new ClaimError(`${shortfall}; the faucet refused because the balance is above its threshold. Fund the address and retry.`);
    }
    const after = await provider.getBalance(wallet.address).catch(() => null);
    if (!after || after.lt(need)) {
      throw new ClaimError(`${shortfall}; faucet transaction ${funding.txHash} has not supplied enough test ETH yet. Check it before requesting another payout.`);
    }
    return { funded: true };
  };

  const mined = async (provider, transaction) => {
    let receipt = null;
    try {
      receipt = await provider.waitForTransaction(transaction.hash, 1, TX_WAIT_MS);
    } catch {
      receipt = null;
    }
    if (!receipt) {
      throw new ClaimError(`Transaction ${transaction.hash} has not been mined yet. Check it later and call claim_sbt again if the token did not arrive.`);
    }
    if (receipt.status === 0) throw new ClaimError(`Transaction ${transaction.hash} was reverted.`);
    return receipt;
  };

  const send = async ({ ctx, provider, chainId, contract, method, args }) => {
    try {
      await contract.callStatic[method](...args);
    } catch (error) {
      throw new ClaimError(`${safeMessage(error, 'The contract would reject this claim')}.`);
    }
    const gasLimit = (await contract.estimateGas[method](...args)).mul(GAS_HEADROOM_PERCENT).div(100);
    const fees = await resolveFees(provider);
    await ensureFunds({ ctx, provider, chainId, need: fundsFor(gasLimit, fees) });
    checkpoint();
    return mined(provider, await contract[method](...args, { gasLimit, ...fees.overrides }));
  };

  const claimWithCommitReveal = async ({ ctx, provider, chainId, contract, password }) => {
    if (!password) throw new ClaimError('This SBT needs a claim password.');
    if (!(await contract.isPasswordValid(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password))))) {
      throw new ClaimError('That claim password is not valid for this SBT (it may already be used).');
    }
    const commitment = ethers.utils.solidityKeccak256(['string', 'address'], [password, wallet.address]);
    const commitGas = (await contract.estimateGas.startClaim(commitment)).mul(GAS_HEADROOM_PERCENT).div(100);
    const fees = await resolveFees(provider);
    await ensureFunds({ ctx, provider, chainId, need: fundsFor(commitGas.add(PASSWORD_CLAIM_GAS_BUDGET), fees) });
    checkpoint();
    const commitReceipt = await mined(provider, await contract.startClaim(commitment, { gasLimit: commitGas, ...fees.overrides }));
    const committedAt = (await provider.getBlock(commitReceipt.blockNumber)).timestamp;
    // The contract accepts the reveal only in a block at least five seconds later.
    await waitFor(
      async () => (await provider.getBlock('latest')).timestamp >= committedAt + PASSWORD_REVEAL_DELAY_SECONDS,
      REVEAL_WAIT_MS,
      'The chain has not advanced far enough to reveal the password yet. Retry shortly.',
    );
    const receipt = await send({ ctx, provider, chainId, contract, method: 'claimWithPassword', args: [password] });
    return [commitReceipt.transactionHash, receipt.transactionHash];
  };

  const claimWithGroupPassword = async ({ ctx, provider, chainId, contract, sbtAddress, password }) => {
    const normalized = normalizeGroupPasswordInput(password);
    if (!normalized) throw new ClaimError('This SBT needs a group password.');
    const expectedHash = trim(await contract.groupPasswordHash()).toLowerCase();
    if (!expectedHash || expectedHash === ethers.constants.HashZero) throw new ClaimError('This SBT has no group password set.');
    const groupWallet = await deriveGroupPasswordWallet({ password: normalized, sbtAddress });
    if (ethers.utils.solidityKeccak256(['address'], [groupWallet.address]) !== expectedHash) {
      throw new ClaimError('The group password does not match this SBT.');
    }
    const messageHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256', 'address', 'address'],
        [ethers.utils.id('ContextEngine.SBT.GroupMint:1'), chainId, sbtAddress, wallet.address],
      ),
    );
    const signature = await groupWallet.signMessage(ethers.utils.arrayify(messageHash));
    const receipt = await send({ ctx, provider, chainId, contract, method: 'mintWithGroupSignature', args: [signature] });
    return [receipt.transactionHash];
  };

  const claimWithInviteCode = async ({ ctx, provider, chainId, contract, sbtAddress, code }) => {
    const invite = decodeInviteCode(code);
    if (!invite) throw new ClaimError('This SBT needs a valid invite code.');
    if (invite.sbtAddress !== sbtAddress) throw new ClaimError('That invite code is for a different SBT.');
    if (invite.chainId !== chainId) throw new ClaimError(`That invite code is for chain ${invite.chainId}, not ${chainId}.`);
    if (await contract.usedInviteSlots(invite.slot)) throw new ClaimError('That invite code has already been used.');
    const receipt = await send({ ctx, provider, chainId, contract, method: 'claimWithInvite', args: [invite.slot, invite.signature] });
    return [receipt.transactionHash];
  };

  return {
    /**
     * Claims `sbtAddress` for the agent. `ctx` is the joined session
     * ({ info, client }); codes are used according to the SBT's mint mode.
     */
    async claim({ ctx, sbtAddress, inviteCode = '', groupPassword = '', claimPassword = '', signal: callSignal = null }) {
      signal = callSignal;
      let address;
      try {
        address = ethers.utils.getAddress(trim(sbtAddress));
      } catch {
        throw new ClaimError('Pass the SBT contract address (0x…).');
      }
      if (address === ethers.constants.AddressZero) throw new ClaimError('Pass the SBT contract address (0x…).');
      const invite = decodeInviteCode(inviteCode || groupPassword);
      const chainId = invite?.sbtAddress === address ? invite.chainId : resolveSbtChainId(ctx.client.config, address);
      const allowedChains = config.allowLocalWorkers ? [...TESTNET_CHAIN_IDS, LOCAL_CHAIN_ID] : TESTNET_CHAIN_IDS;
      if (!allowedChains.includes(chainId)) {
        throw new ClaimError(`Agents claim SBTs only on test networks (${allowedChains.join(', ')}); this SBT is on chain ${chainId}.`);
      }
      try {
        const provider = createProvider(chainId);
        const reported = Number(await provider.send('eth_chainId', []));
        if (reported !== chainId) throw new ClaimError(`The RPC for chain ${chainId} reports chain ${reported}; refusing to sign.`);
        const contract = new ethers.Contract(address, SBT_ABI, wallet.connect(provider));
        const base = { sbt: address, chainId };

        let alreadyHeld = false;
        try {
          alreadyHeld = (await contract.getTokenIdByOwner(wallet.address)).gt(0);
        } catch {
          alreadyHeld = false;
        }
        if (!alreadyHeld) alreadyHeld = (await contract.balanceOf(wallet.address)).gt(0);
        if (alreadyHeld) return { ...base, status: 'already_held' };

        const mode = MINT_MODES[Number(await contract.mintMode())];
        if (!mode) throw new ClaimError('This SBT uses an unknown mint mode.');
        const [endTime, maxTokens, minted] = await Promise.all([contract.mintingEndTime(), contract.maxTokens(), contract.mintedTokens()]);
        if (endTime.gt(0) && endTime.lte(Math.floor(now() / 1000))) throw new ClaimError('Minting for this SBT has ended.');
        if (maxTokens.gt(0) && minted.gte(maxTokens)) throw new ClaimError('Every token of this SBT has been claimed.');

        const args = { ctx, provider, chainId, contract, sbtAddress: address };
        let transactions;
        if (mode === 'public') transactions = [(await send({ ...args, method: 'claim', args: [] })).transactionHash];
        // Like the SBT page, a link's gp= carries the claim password for password-mode SBTs.
        else if (mode === 'password') transactions = await claimWithCommitReveal({ ...args, password: trim(claimPassword) || trim(groupPassword) });
        else if (mode === 'group_password') transactions = await claimWithGroupPassword({ ...args, password: groupPassword });
        // The web client also carries invite codes in gp= for capped collections.
        else transactions = await claimWithInviteCode({ ...args, code: inviteCode || groupPassword });
        return { ...base, mode, status: 'claimed', transactions };
      } catch (error) {
        throw new ClaimError(safeMessage(error, `Could not claim the SBT on chain ${chainId}`));
      }
    },
  };
};
