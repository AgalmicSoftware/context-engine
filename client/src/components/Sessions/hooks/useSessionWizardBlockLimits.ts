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
    startDefault?: { chainId: number; blockNumber: number };
  } | null;
};

type UpdateDraftValueRef = MutableRefObject<null | ((path: string[], value: unknown) => void)>;

export interface UseSessionWizardBlockLimitsOptions<TDraft extends DraftWithBlockLimits> {
  enabled?: boolean;
  registryChainId: unknown;
  draftBlockLimitStart?: unknown;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  updateDraftValueRef: UpdateDraftValueRef;
  readLatestBlockNumber?: (args: { chainId: number; rpcUrl: string }) => Promise<number>;
}

const readLatestBlockNumberWithEthers = async ({
  chainId,
  rpcUrl,
}: {
  chainId: number;
  rpcUrl: string;
}): Promise<number> => {
  // Static network avoids `detectNetwork()` overhead; rpcReadCache wraps `.send()` to dedupe/cache reads.
  const providerRpc = new ethers.providers.JsonRpcProvider(rpcUrl, { chainId, name: `chain-${chainId}` });
  wrapEthersJsonRpcSend(providerRpc, {
    chainId,
    providerKey: `sessionWizard:latestBlock:${chainId}`,
    providerLabel: 'sessionWizard',
    url: rpcUrl,
  });
  return providerRpc.getBlockNumber();
};

const useSessionWizardBlockLimits = <TDraft extends DraftWithBlockLimits>({
  enabled = true,
  registryChainId,
  draftBlockLimitStart,
  setDraft,
  updateDraftValueRef,
  readLatestBlockNumber = readLatestBlockNumberWithEthers,
}: UseSessionWizardBlockLimitsOptions<TDraft>) => {
  const chainId = Number(registryChainId || 0) || 0;
  const [latestBlockRecord, setLatestBlockRecord] = useState<{ chainId: number; blockNumber: number } | null>(null);
  const latestChainBlock = latestBlockRecord?.chainId === chainId ? latestBlockRecord.blockNumber : null;
  const setLatestChainBlock = useCallback(
    (blockNumber: number | null) => {
      setLatestBlockRecord(blockNumber === null ? null : { chainId, blockNumber });
    },
    [chainId],
  );
  const [latestBlockStatus, setLatestBlockStatus] = useState('');
  const [blockLimitDuration, setBlockLimitDuration] = useState('');
  const [blockLimitUnit, setBlockLimitUnit] = useState('hours');
  const blockStartManualRef = useRef(false);
  const blockEndAutoRef = useRef(false);

  useEffect(() => {
    blockStartManualRef.current = false;
    blockEndAutoRef.current = false;
  }, [enabled, registryChainId]);

  useEffect(() => {
    if (!enabled) {
      setLatestChainBlock(null);
      setLatestBlockStatus('');
      return;
    }
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
    readLatestBlockNumber({ chainId, rpcUrl })
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
  }, [enabled, readLatestBlockNumber, registryChainId, setLatestChainBlock]);

  useEffect(() => {
    if (!enabled) return;
    if (!latestChainBlock) return;
    if (blockStartManualRef.current) return;
    setDraft((prev) => {
      const start = prev.blockLimits?.start;
      const startDefault = prev.blockLimits?.startDefault;
      const unset = start == null || start === '';
      // Older drafts have no provenance and are explicit. A saved default may
      // follow a chain change only while its value still matches that default.
      const followsChain =
        startDefault && Number(start) === startDefault.blockNumber && startDefault.chainId !== chainId;
      if (!unset && !followsChain) return prev;
      const next = deepClone(prev) as DraftWithBlockLimits;
      if (!next.blockLimits || typeof next.blockLimits !== 'object') {
        next.blockLimits = {};
      }
      next.blockLimits.start = latestChainBlock;
      next.blockLimits.startDefault = { chainId, blockNumber: latestChainBlock };
      return next as TDraft;
    });
  }, [chainId, enabled, latestChainBlock, setDraft]);

  useEffect(() => {
    if (!enabled) {
      blockEndAutoRef.current = false;
      return;
    }
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
    enabled,
    latestChainBlock,
    registryChainId,
    draftBlockLimitStart,
    updateDraftValueRef,
  ]);

  const markBlockStartManual = useCallback(() => {
    blockStartManualRef.current = true;
    setDraft((prev) => {
      if (!prev.blockLimits?.startDefault) return prev;
      const next = deepClone(prev);
      delete next.blockLimits!.startDefault;
      return next;
    });
  }, [setDraft]);

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
