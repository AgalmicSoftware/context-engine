import { ethers } from 'ethers';
import rpcDefaults from '../../shared/rpcDefaults.cjs';
import { describeTestEthOffer } from '../../shared/sessions/testEthOffer.mjs';
import { chainRequest } from './chainErrors.mjs';

const amount = (value) => typeof value === 'string' && /^\d+(?:\.\d{1,18})?$/.test(value) ? value : null;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const createTestEthProvider = (rpcUrl) => (chainId) => {
  const url = rpcUrl || rpcDefaults.getPublicRpcUrls(chainId)[0] || rpcDefaults.getPathRpcUrl(chainId);
  if (!url) throw new Error(`No public RPC is known for chain ${chainId}; set CE_MCP_RPC_URL.`);
  return new ethers.providers.StaticJsonRpcProvider({ url, timeout: 8000 }, chainId);
};

export const createTestEthRequester = ({
  config = {}, wallet, createProvider = createTestEthProvider(config.rpcUrl),
  now = () => Date.now(), sleep = pause,
}) => async ({ ctx, provider: suppliedProvider, chainId: requestedChain, signal }) => {
  const checkpoint = () => {
    if (signal?.aborted) throw new Error('Stopped before finishing; no further faucet requests were sent.');
  };
  checkpoint();
  await ctx.client.refreshConfig();
  const sessionConfig = ctx.client.config;
  const { chainId } = describeTestEthOffer({ config: sessionConfig });
  const allowed = config.allowLocalWorkers ? [11155420, 84532, 31337] : [11155420, 84532];
  if (!allowed.includes(chainId)) throw new Error('Agents request test ETH only on OP Sepolia or Base Sepolia (or an explicitly enabled local chain).');
  if (requestedChain && requestedChain !== chainId) throw new Error(`The session faucet pays on chain ${chainId}, but gas is needed on chain ${requestedChain}.`);
  await ctx.client.ensureToken();
  if (ctx.client.tokenClaims?.scopes?.faucet !== true) throw new Error('This session does not offer test ETH to you.');
  const provider = suppliedProvider || createProvider(chainId);
  const reported = Number(await chainRequest(() => provider.send('eth_chainId', [])));
  if (reported !== chainId) throw new Error(`The RPC for chain ${chainId} reports chain ${reported}; refusing the faucet request.`);
  const before = await chainRequest(() => provider.getBalance(wallet.address));
  checkpoint();
  let paid;
  try {
    paid = await ctx.client.request('/', {
      method: 'POST', auth: true, signal, headers: { 'X-Session-Slug': ctx.info.slug },
      body: { action: 'request_test_eth', to: wallet.address },
    });
  } catch (error) {
    if (error.status === 403 && /balance above threshold/i.test(error.message)) {
      return {
        sent: false, reason: 'balance_high',
        balanceEth: amount(error.details?.balanceEth) || ethers.utils.formatEther(before),
        thresholdEth: amount(error.details?.thresholdEth),
      };
    }
    if (error.status === 429) throw new Error("Today's test-ETH limit for this address is used up.");
    if (/Session secrets not configured|faucetPrivateKey is missing/i.test(error.message)) throw new Error("This session's faucet is not set up.");
    if (error.status === 403) throw new Error('This session does not offer test ETH to you.');
    if (error.status === 502) throw new Error('The faucet could not reach the chain; try later.');
    throw error;
  }
  if (Number(paid?.chainId) !== chainId) throw new Error(`The session faucet reported chain ${paid?.chainId ?? 'unknown'}, not ${chainId}. Check the transfer before retrying.`);
  if (typeof paid?.txHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(paid.txHash)) throw new Error('The faucet did not return a valid transaction hash. Check your balance before retrying.');
  const deadline = now() + 60_000;
  let balance = before;
  // Cancellation can stop polling, but must not discard a transfer already sent.
  while (now() < deadline && !signal?.aborted) {
    let timer;
    let observed;
    try {
      // A slow or unavailable RPC must not hide an already-broadcast transfer.
      observed = await Promise.race([
        chainRequest(() => provider.getBalance(wallet.address)).catch(() => null),
        new Promise((resolve) => { timer = setTimeout(() => resolve(null), Math.max(0, deadline - now())); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!observed) break;
    balance = observed;
    if (balance.gt(before)) break;
    await sleep(Math.max(0, Math.min(2000, deadline - now())));
  }
  return {
    sent: true, txHash: paid.txHash, amountEth: amount(paid.amountEth),
    chainId, balanceEth: ethers.utils.formatEther(balance),
    ...(!balance.gt(before) ? { pending: true } : {}),
  };
};
