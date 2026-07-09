import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ethers } from 'ethers';
import { getChainBlockTimeMs, getDefaultHttpRpc } from '../../../variables/chains.js';
import { wrapEthersJsonRpcSend } from '../../../utilities/web3/rpcReadCache.js';
import { deepClone } from '../sessionWizardCoreUtils';

type DraftWithBlockLimits = {
  blockLimits?: {
    start?: unknown;
    end?: unknown;
  } | null;
};

type UpdateDraftValueRef = MutableRefObject<null | ((path: string[], value: unknown) => void)>;

export interface UseSessionWizardBlockLimitsOptions<TDraft extends DraftWithBlockLimits> {
  registryChainId: unknown;
  draftBlockLimitStart?: unknown;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  updateDraftValueRef: UpdateDraftValueRef;
}

const useSessionWizardBlockLimits = <TDraft extends DraftWithBlockLimits>({
  registryChainId,
  draftBlockLimitStart,
  setDraft,
  updateDraftValueRef,
}: UseSessionWizardBlockLimitsOptions<TDraft>) => {
  const [latestChainBlock, setLatestChainBlock] = useState<number | null>(null);
  const [latestBlockStatus, setLatestBlockStatus] = useState('');
  const [blockLimitDuration, setBlockLimitDuration] = useState('');
  const [blockLimitUnit, setBlockLimitUnit] = useState('hours');
  const blockStartManualRef = useRef(false);
  const blockEndAutoRef = useRef(false);

  useEffect(() => {
    blockStartManualRef.current = false;
    blockEndAutoRef.current = false;
  }, [registryChainId]);

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    if (!chainId) {
      setLatestChainBlock(null);
      return;
    }
    const rpcUrl = getDefaultHttpRpc(chainId);
    if (!rpcUrl) {
      setLatestChainBlock(null);
      return;
    }
    let alive = true;
    setLatestBlockStatus('Fetching latest block...');
    // Static network avoids `detectNetwork()` overhead; rpcReadCache wraps `.send()` to dedupe/cache reads.
    const providerRpc = new ethers.providers.JsonRpcProvider(rpcUrl, { chainId, name: `chain-${chainId}` });
    wrapEthersJsonRpcSend(providerRpc, {
      chainId,
      providerKey: `sessionWizard:latestBlock:${chainId}`,
      providerLabel: 'sessionWizard',
      url: rpcUrl,
    });
    providerRpc
      .getBlockNumber()
      .then((blockNumber) => {
        if (!alive) return;
        setLatestChainBlock(blockNumber);
        setLatestBlockStatus('');
      })
      .catch(() => {
        if (!alive) return;
        setLatestChainBlock(null);
        setLatestBlockStatus('Unable to load latest block.');
      });
    return () => {
      alive = false;
    };
  }, [registryChainId]);

  useEffect(() => {
    if (!latestChainBlock) return;
    if (blockStartManualRef.current) return;
    setDraft((prev) => {
      const next = deepClone(prev) as DraftWithBlockLimits;
      if (!next.blockLimits || typeof next.blockLimits !== 'object') {
        next.blockLimits = {};
      }
      const currentStart = Number(next.blockLimits.start);
      if (!Number.isFinite(currentStart) || currentStart !== latestChainBlock) {
        next.blockLimits.start = latestChainBlock;
      }
      return next as TDraft;
    });
  }, [latestChainBlock, setDraft]);

  useEffect(() => {
    const duration = Number(blockLimitDuration || 0);
    const unitMs = blockLimitUnit === 'days' ? 86400000 : blockLimitUnit === 'minutes' ? 60000 : 3600000;
    const startFromDraft = Number(draftBlockLimitStart);
    const fallbackStart = Number(latestChainBlock);
    const startBlock =
      Number.isFinite(startFromDraft) && startFromDraft > 0
        ? startFromDraft
        : Number.isFinite(fallbackStart) && fallbackStart > 0
          ? fallbackStart
          : 0;
    if (!startBlock || !Number.isFinite(duration) || duration <= 0) {
      if (blockEndAutoRef.current) {
        updateDraftValueRef.current?.(['blockLimits', 'end'], null);
        blockEndAutoRef.current = false;
      }
      return;
    }
    const blockTimeMs = getChainBlockTimeMs(registryChainId);
    const blocks = Math.max(1, Math.ceil((duration * unitMs) / blockTimeMs));
    const endBlock = startBlock + blocks;
    updateDraftValueRef.current?.(['blockLimits', 'end'], endBlock);
    blockEndAutoRef.current = true;
  }, [
    blockLimitDuration,
    blockLimitUnit,
    latestChainBlock,
    registryChainId,
    draftBlockLimitStart,
    updateDraftValueRef,
  ]);

  const markBlockStartManual = useCallback(() => {
    blockStartManualRef.current = true;
  }, []);

  return {
    latestChainBlock,
    latestBlockStatus,
    blockLimitDuration,
    setBlockLimitDuration,
    blockLimitUnit,
    setBlockLimitUnit,
    markBlockStartManual,
    setLatestChainBlock,
  };
};

export default useSessionWizardBlockLimits;
