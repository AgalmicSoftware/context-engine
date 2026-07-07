/*
 * @module chainEventStreams
 * @description SBT and survey chain event stream wiring extracted from contractScripts.
 *              Keeps long listener setup/teardown logic out of the main contract API surface.
 *
 * Key exports: createContractEventListenerMethods
 */

import { ethers } from 'ethers';
import { extractChainId } from './chainIdResolution.js';

type LogFn = (message?: unknown, detail?: unknown, extra?: unknown) => void;
type AddressMapEntry = { address?: string | null; chainId?: string | number | null };
type SessionContractMap = {
  sbtFactory?: AddressMapEntry;
  surveys?: AddressMapEntry;
};
type SessionConfigLike = {
  slug?: string | null;
  networkChainId?: string | number | null;
  contracts?: SessionContractMap;
};
type SessionAddresses = SessionContractMap;
type ProviderRpcMeta = {
  providerMode?: string | null;
  providerLabel?: string | null;
  preferredUrls?: unknown[];
  skipGlobalPreferred?: boolean;
};
type EventReadProvider = ethers.providers.Provider & {
  __CE_RPC_META?: ProviderRpcMeta | null;
};
type EventMetadata = {
  transactionHash?: string;
  blockNumber?: number;
  transactionIndex?: number | string;
  logIndex?: number | string;
};
type EventIdValue = { toString: () => string };
type ContractEventPayload = {
  type: string;
  address?: string;
  sbtAddress?: unknown;
  creator?: unknown;
  responder?: unknown;
  surveyId?: string;
  questionIds?: string[];
  surveyIds?: string[];
  args?: {
    account?: string;
    tokenId?: string;
    burned?: boolean;
  };
  transactionHash?: string;
  blockNumber?: number;
  transactionIndex: number;
  logIndex: number;
  eventSignature?: string;
};
type ContractEventHandler = (event: ContractEventPayload) => void;
type SbtActivityListener = (account: unknown, tokenId: unknown, burned: unknown, event: EventMetadata) => void;
type AbiLike = ethers.ContractInterface;

type ContractEventListenerDeps = {
  resolveSession: (groupKeyOrCfg: unknown) => SessionConfigLike;
  getSessionAddresses: (cfg: SessionConfigLike) => SessionAddresses;
  contractsLog: {
    log: LogFn;
    warn: LogFn;
    error: LogFn;
  };
  sbtListenerMap: Map<string, ethers.Contract>;
  surveyListenerMap: Map<string, ethers.Contract>;
  getReadProviderForChain:
    ((chainId: number | string | undefined) => EventReadProvider | null | undefined) | null | undefined;
  getReadProviderForGroup:
    | ((groupKeyOrCfg: unknown, opts?: { contractKey?: string }) => EventReadProvider | null | undefined)
    | null
    | undefined;
  SBT_FACTORY_ABI: AbiLike;
  CUSTOM_SBT_ABI: AbiLike;
  SURVEYS: AbiLike;
  shouldLog: (category: string, level?: string) => boolean;
};

type SBTInstanceRegistryEntry = {
  contract?: ethers.Contract;
  onActivity?: SbtActivityListener;
};

type ListenForSBTInstanceEventsMethod = ((
  providerName: unknown,
  sbtAddresses?: unknown,
  handler?: ContractEventHandler | null,
  groupKeyOrCfg?: unknown,
) => Promise<void>) & {
  _registry?: Map<string, SBTInstanceRegistryEntry>;
};

type ContractEventListenerMethods = {
  listenForSBTEvents: (
    providerName: unknown,
    handleNewEvent: ContractEventHandler,
    groupKeyOrCfg?: unknown,
  ) => Promise<void>;
  removeSBTEventListener: (providerName: unknown, groupKeyOrCfg?: unknown) => void;
  listenForSBTInstanceEvents: ListenForSBTInstanceEventsMethod;
  removeSBTInstanceEventsListener: (
    providerName: unknown,
    sbtAddresses?: unknown,
    groupKeyOrCfg?: unknown,
  ) => Promise<void>;
  listenForSurveyEvents: (
    providerName: unknown,
    handleNewEvent: ContractEventHandler,
    groupKeyOrCfg?: unknown,
  ) => Promise<void>;
  removeSurveyEventsListener: (providerName: unknown, groupKeyOrCfg?: unknown) => void;
};

export function createContractEventListenerMethods(deps: ContractEventListenerDeps): ContractEventListenerMethods {
  const {
    resolveSession,
    getSessionAddresses,
    contractsLog,
    sbtListenerMap,
    surveyListenerMap,
    getReadProviderForChain,
    getReadProviderForGroup,
    SBT_FACTORY_ABI,
    CUSTOM_SBT_ABI,
    SURVEYS,
    shouldLog,
  } = deps;

  const resolveChainIdForContract = (cfg: SessionConfigLike, contractKey: string = ''): number | null | undefined =>
    extractChainId(cfg, { contractKey, strict: true }) as number | null | undefined;

  const buildProviderScopeKey = (
    provider: EventReadProvider | null | undefined,
    fallbackScope: string = 'default',
  ): string => {
    const providerMeta = provider && typeof provider === 'object' ? provider.__CE_RPC_META : null;
    const preferredUrls = Array.isArray(providerMeta?.preferredUrls)
      ? providerMeta.preferredUrls
          .map((url) => String(url || '').trim())
          .filter(Boolean)
          .join(',')
      : '';
    return [
      String(providerMeta?.providerMode || 'mode-default').trim() || 'mode-default',
      String(providerMeta?.providerLabel || 'provider-default').trim() || 'provider-default',
      preferredUrls || String(fallbackScope || 'default').trim() || 'default',
      providerMeta?.skipGlobalPreferred ? 'skip-global' : 'with-global',
    ].join('|');
  };

  const buildListenerKey = ({
    address,
    chainId,
    provider,
    fallbackScope = 'default',
  }: {
    address?: string | null;
    chainId?: string | number | null;
    provider?: EventReadProvider | null;
    fallbackScope?: string;
  }): string =>
    [
      String(address || '').toLowerCase(),
      String(chainId || 'unknown'),
      buildProviderScopeKey(provider, fallbackScope),
    ].join('||');

  const parseListenerKey = (rawKey: unknown): { address: string; chainId: string } => {
    const [address = '', chainId = ''] = String(rawKey || '').split('||');
    return {
      address: String(address || '').toLowerCase(),
      chainId: String(chainId || ''),
    };
  };

  const toEventId = (value: EventIdValue): string => value.toString();
  const toEventIds = (values: EventIdValue[]): string[] => values.map((id) => toEventId(id));

  const listenForSBTInstanceEvents: ListenForSBTInstanceEventsMethod = async function (
    this: ContractEventListenerMethods,
    providerName: unknown,
    sbtAddresses: unknown = [],
    handler: ContractEventHandler | null = null,
    groupKeyOrCfg: unknown = null,
  ): Promise<void> {
    void providerName;
    const provider =
      typeof getReadProviderForGroup === 'function' &&
      getReadProviderForGroup(groupKeyOrCfg, { contractKey: 'sbtFactory' });

    if (!provider || typeof provider.on !== 'function') {
      contractsLog.error('[listenForSBTInstanceEvents] Invalid read provider resolved for group:', groupKeyOrCfg);
      return;
    }

    const input: unknown[] = Array.isArray(sbtAddresses) ? sbtAddresses : [sbtAddresses];
    const uniqueAddresses: string[] = Array.from(
      new Set(
        input
          .filter(Boolean)
          .map((address) => {
            try {
              return ethers.utils.getAddress(String(address));
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      ),
    ) as string[];

    if (uniqueAddresses.length === 0) {
      if (shouldLog('rpc', 'log')) {
        contractsLog.log('[listenForSBTInstanceEvents] No valid SBT addresses provided.');
      }
      return;
    }

    const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const derivedChainId = resolveChainIdForContract(cfg, 'sbtFactory');
    const chainId = derivedChainId ? String(derivedChainId) : 'unknown';
    const providerScope = buildProviderScopeKey(provider, `group:${cfg?.slug || 'general'}:sbtFactory`);

    const registry = (this.listenForSBTInstanceEvents._registry ||= new Map<string, SBTInstanceRegistryEntry>());
    const keyOf = (address: string): string => [address.toLowerCase(), chainId, providerScope].join('||');

    for (const addr of uniqueAddresses) {
      const regKey = keyOf(addr);
      if (registry.has(regKey)) {
        if (shouldLog('rpc', 'log')) {
          contractsLog.log('[listenForSBTInstanceEvents] Already listening for SBT', { addr, chainId });
        }
        continue;
      }

      try {
        const contract = new ethers.Contract(addr, CUSTOM_SBT_ABI, provider);

        const onActivity: SbtActivityListener = (account, tokenId, burned, event): void => {
          try {
            handler &&
              handler({
                type: 'SBTActivity',
                address: addr,
                args: {
                  account: String(account).toLowerCase(),
                  tokenId: tokenId?.toString?.() || String(tokenId || ''),
                  burned: burned === true,
                },
                transactionHash: event?.transactionHash,
                blockNumber: event?.blockNumber,
                transactionIndex: Number(event?.transactionIndex || 0),
                logIndex: Number(event?.logIndex || 0),
                eventSignature: 'SBTActivity(address,uint256,bool)',
              });
          } catch (error) {
            contractsLog.error('[listenForSBTInstanceEvents] handler(SBTActivity) threw:', error);
          }
        };

        contract.on('SBTActivity', onActivity);

        registry.set(regKey, { contract, onActivity });

        if (shouldLog('rpc', 'log')) {
          contractsLog.log('[listenForSBTInstanceEvents] Listening on SBT instance', {
            address: addr,
            chainId,
          });
        }
      } catch (error) {
        contractsLog.error('[listenForSBTInstanceEvents] Failed to attach listeners for', addr, error);
      }
    }
  };

  const methods: ContractEventListenerMethods = {
    async listenForSBTEvents(
      providerName: unknown,
      handleNewEvent: ContractEventHandler,
      groupKeyOrCfg: unknown = null,
    ): Promise<void> {
      void providerName;
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      const chId = resolveChainIdForContract(cfg, 'sbtFactory');
      if (!addr || !chId) {
        contractsLog.log('listenForSBTEvents: missing address/chain; skipping listener setup.');
        return;
      }
      const provider =
        (typeof getReadProviderForGroup === 'function'
          ? getReadProviderForGroup(groupKeyOrCfg, { contractKey: 'sbtFactory' })
          : null) ||
        (typeof getReadProviderForChain === 'function' ? getReadProviderForChain(chId) : null) ||
        undefined;
      const listenerKey = buildListenerKey({
        address: addr,
        chainId: chId,
        provider,
        fallbackScope: `group:${cfg?.slug || 'general'}:sbtFactory`,
      });

      if (sbtListenerMap.has(listenerKey)) {
        contractsLog.log(`listenForSBTEvents: listener already attached for ${listenerKey}, skipping.`);
        return;
      }
      const contract = new ethers.Contract(addr, SBT_FACTORY_ABI, provider);

      contract.on('SBTCreated', (sbtAddress: unknown, event: EventMetadata) => {
        contractsLog.log('New SBT created:', sbtAddress);
        handleNewEvent({
          type: 'SBTCreated',
          sbtAddress,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          transactionIndex: Number(event?.transactionIndex || 0),
          logIndex: Number(event?.logIndex || 0),
        });
      });

      sbtListenerMap.set(listenerKey, contract);
      contractsLog.log(`Listening for SBT Factory events on ${addr} (chain ${chId})...`);
    },

    removeSBTEventListener(providerName: unknown, groupKeyOrCfg: unknown = null): void {
      void providerName;
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      const chId = resolveChainIdForContract(cfg, 'sbtFactory');
      if (!addr || !chId) {
        contractsLog.log('No SBT Factory listener to remove (missing address/chain).');
        return;
      }

      let removed = 0;
      for (const [listenerKey, contract] of Array.from(sbtListenerMap.entries())) {
        const parsed = parseListenerKey(listenerKey);
        if (parsed.address !== addr.toLowerCase()) continue;
        if (parsed.chainId !== String(chId)) continue;
        contract.removeAllListeners('SBTCreated');
        sbtListenerMap.delete(listenerKey);
        removed += 1;
      }

      if (removed > 0) {
        contractsLog.log(`Removed SBT Factory event listener for ${addr.toLowerCase()} on chain ${chId}.`);
      }
    },

    listenForSBTInstanceEvents,

    async removeSBTInstanceEventsListener(
      this: ContractEventListenerMethods,
      providerName: unknown,
      sbtAddresses: unknown = [],
      groupKeyOrCfg: unknown = null,
    ): Promise<void> {
      void providerName;
      const registry = (this.listenForSBTInstanceEvents && this.listenForSBTInstanceEvents._registry) || null;
      if (!registry || registry.size === 0) {
        if (shouldLog('rpc', 'log')) {
          contractsLog.log('[removeSBTInstanceEventsListener] No instance listeners registered.');
        }
        return;
      }

      const list: unknown[] = Array.isArray(sbtAddresses) ? sbtAddresses : [sbtAddresses];
      const targets: string[] = Array.from(
        new Set(
          list
            .filter((value) => value && value !== '*')
            .map((address) => {
              try {
                return ethers.utils.getAddress(String(address));
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .map((address) => String(address).toLowerCase()),
        ),
      ) as string[];

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const derivedChainId = resolveChainIdForContract(cfg, 'sbtFactory');
      const chainIdFilter = derivedChainId ? String(derivedChainId) : null;

      const shouldRemove = (regKey: string): boolean => {
        const parsed = parseListenerKey(regKey);
        const addrLower = parsed.address;
        const keyChain = parsed.chainId;
        if (chainIdFilter && keyChain !== chainIdFilter) return false;
        if (targets.length === 0) return true;
        return targets.includes(addrLower);
      };

      let removed = 0;
      for (const [regKey, entry] of Array.from(registry.entries())) {
        if (!shouldRemove(regKey)) continue;
        try {
          const { contract, onActivity } = entry || {};
          if (contract) {
            if (onActivity) contract.off('SBTActivity', onActivity);
          }
        } catch (error) {
          contractsLog.warn('[removeSBTInstanceEventsListener] Cleanup error for', regKey, error);
        }
        registry.delete(regKey);
        removed += 1;
      }

      if (shouldLog('rpc', 'log')) {
        contractsLog.log('[removeSBTInstanceEventsListener] Done.', {
          removed,
          remaining: registry.size,
          chainIdFilter,
          targets,
        });
      }
    },

    async listenForSurveyEvents(
      providerName: unknown,
      handleNewEvent: ContractEventHandler,
      groupKeyOrCfg: unknown = null,
    ): Promise<void> {
      void providerName;
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = resolveChainIdForContract(cfg, 'surveys');
      if (!addr || !chId) {
        contractsLog.log('listenForSurveyEvents: missing address/chain; skipping listener setup.');
        return;
      }
      const provider =
        (typeof getReadProviderForGroup === 'function'
          ? getReadProviderForGroup(groupKeyOrCfg, { contractKey: 'surveys' })
          : null) ||
        (typeof getReadProviderForChain === 'function' ? getReadProviderForChain(chId) : null) ||
        undefined;
      const listenerKey = buildListenerKey({
        address: addr,
        chainId: chId,
        provider,
        fallbackScope: `group:${cfg?.slug || 'general'}:surveys`,
      });

      if (surveyListenerMap.has(listenerKey)) {
        contractsLog.log(`listenForSurveyEvents: listener already attached for ${listenerKey}, skipping.`);
        return;
      }
      const contract = new ethers.Contract(addr, SURVEYS, provider);

      contract.on('SurveyAdded', (creator: unknown, surveyId: EventIdValue, event: EventMetadata) => {
        contractsLog.log('New survey added:', { creator, surveyId: toEventId(surveyId) });
        handleNewEvent({
          type: 'SurveyAdded',
          creator,
          surveyId: toEventId(surveyId),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          transactionIndex: Number(event?.transactionIndex || 0),
          logIndex: Number(event?.logIndex || 0),
        });
      });

      contract.on(
        'QuestionsAdded',
        (creator: unknown, questionIds: EventIdValue[], surveyIds: EventIdValue[], event: EventMetadata) => {
          contractsLog.log('New questions added:', {
            creator,
            questionIds: toEventIds(questionIds),
            surveyIds: toEventIds(surveyIds),
          });
          handleNewEvent({
            type: 'QuestionsAdded',
            creator,
            questionIds: toEventIds(questionIds),
            surveyIds: toEventIds(surveyIds),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            transactionIndex: Number(event?.transactionIndex || 0),
            logIndex: Number(event?.logIndex || 0),
          });
        },
      );

      contract.on(
        'ResponsesSubmitted',
        (responder: unknown, questionIds: EventIdValue[], surveyId: EventIdValue, event: EventMetadata) => {
          contractsLog.log('New responses submitted:', {
            responder,
            questionIds: toEventIds(questionIds),
            surveyId: toEventId(surveyId),
          });
          handleNewEvent({
            type: 'ResponsesSubmitted',
            responder,
            questionIds: toEventIds(questionIds),
            surveyId: toEventId(surveyId),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            transactionIndex: Number(event?.transactionIndex || 0),
            logIndex: Number(event?.logIndex || 0),
          });
        },
      );

      surveyListenerMap.set(listenerKey, contract);
      contractsLog.log(`Listening for Survey events on ${addr} (chain ${chId})...`);
    },

    removeSurveyEventsListener(providerName: unknown, groupKeyOrCfg: unknown = null): void {
      void providerName;
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = resolveChainIdForContract(cfg, 'surveys');
      if (!addr || !chId) {
        contractsLog.log('No Survey listener to remove (missing address/chain).');
        return;
      }

      let removed = 0;
      for (const [listenerKey, contract] of Array.from(surveyListenerMap.entries())) {
        const parsed = parseListenerKey(listenerKey);
        if (parsed.address !== addr.toLowerCase()) continue;
        if (parsed.chainId !== String(chId)) continue;
        contract.removeAllListeners('SurveyAdded');
        contract.removeAllListeners('QuestionsAdded');
        contract.removeAllListeners('ResponsesSubmitted');
        surveyListenerMap.delete(listenerKey);
        removed += 1;
      }

      if (removed > 0) {
        contractsLog.log(`Removed Survey event listeners for ${addr.toLowerCase()} on chain ${chId}.`);
      }
    },
  };

  return methods;
}
