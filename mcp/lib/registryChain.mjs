export const compareChainOrder = (a, b) =>
  Number(a.blockNumber || 0) - Number(b.blockNumber || 0) ||
  Number(a.transactionIndex || 0) - Number(b.transactionIndex || 0) ||
  Number(a.logIndex || 0) - Number(b.logIndex || 0);

export const checkRegistryChain = async (provider, chainId) => {
  const actual = Number(await provider.send('eth_chainId', []));
  if (actual !== chainId) throw new Error(`The RPC is on a different chain (${actual}); expected ${chainId}.`);
};

export const findStartBlock = async (provider, createdAt, head) => {
  let low = 0;
  let high = head;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    if (!block || !Number.isFinite(Number(block.timestamp))) throw new Error('Could not locate the session creation block.');
    if (Number(block.timestamp) < createdAt) low = mid + 1;
    else high = mid;
  }
  return low;
};

/** An intra-block offset makes capped scans resumable even when one block contains many logs. */
export const scanRegistryLogs = async ({
  provider, filter, cursor, toBlock, fromBlock = 0, descending = false, maxLogs = 10000, maxRequests = 100,
  deadline = Date.now() + 60000, now = Date.now, signal,
}) => {
  const logs = [];
  let block = cursor.block;
  let offset = cursor.offset || 0;
  let range = 9500;
  let requests = 0;
  while (descending ? block >= fromBlock : block <= toBlock) {
    if (now() >= deadline || signal?.aborted || requests >= maxRequests) return { logs, cursor: { block, offset }, complete: false, requests };
    const begin = descending ? Math.max(fromBlock, block - range + 1) : block;
    const end = descending ? block : Math.min(toBlock, block + range - 1);
    let batch;
    requests += 1;
    try { batch = await provider.getLogs({ ...filter, fromBlock: begin, toBlock: end }); }
    catch (error) {
      if (range > 1 && /range|too many|limit|response size|query returned/i.test(`${error?.message || ''} ${error?.error?.message || ''}`)) {
        range = Math.max(1, Math.floor((end - begin + 1) / 2));
        continue;
      }
      throw error;
    }
    batch = batch.sort((a, b) => descending ? compareChainOrder(b, a) : compareChainOrder(a, b));
    let skipped = 0;
    let inBlock = offset;
    let lastBlock = block;
    for (const entry of batch) {
      if (entry.blockNumber === block && skipped++ < offset) continue;
      if (entry.blockNumber !== lastBlock) { lastBlock = entry.blockNumber; inBlock = 0; }
      if (logs.length >= maxLogs) return { logs, cursor: { block: lastBlock, offset: inBlock }, complete: false, requests };
      logs.push(entry);
      inBlock += 1;
    }
    block = descending ? begin - 1 : end + 1;
    offset = 0;
  }
  return { logs, cursor: { block, offset }, complete: true, requests };
};
