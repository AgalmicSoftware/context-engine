import { getChainById, getSessionRegistryAddress, isTestnetChain } from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { getContractDisplayName, getContractExplainer, getContractSourceFileName } from './contractMetadata.js';
import { getContractSourceDefinitions } from './contractSourceLoader.js';
import type {
  AnyRecord,
  ChainIdLike,
  ContractViewerAddressLike,
  ContractViewerContractLike,
  SessionContractLike,
  SessionContractsLike,
} from '../shellTypes';

export const getExplorerAddressUrl = (address: string, chainId: ChainIdLike): string => {
  const chain = getChainById(chainId);
  const explorerBase = chain?.blockExplorers?.default?.url;
  if (explorerBase) return `${explorerBase.replace(/\/$/, '')}/address/${address}`;

  const rpc =
    (chain?.rpcUrls?.default?.http && chain.rpcUrls.default.http[0]) ||
    (chain?.rpcUrls?.public?.http && chain.rpcUrls.public.http[0]) ||
    '';
  if (rpc) {
    try {
      const parsed = new URL(rpc);
      const host = parsed.hostname || '';
      const isBase = /base/i.test(host) || /base/i.test(rpc);
      const isSepolia = /sepolia/i.test(host) || /sepolia/i.test(rpc);
      if (isBase) {
        const baseUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';
        return `${baseUrl}/address/${address}`;
      }
    } catch {
      return `https://etherscan.io/address/${address}`;
    }
  }

  return `https://etherscan.io/address/${address}`;
};

const buildContractAddresses = ({
  address = '',
  chainId = null,
}: {
  address?: string;
  chainId?: ChainIdLike;
} = {}): ContractViewerAddressLike[] => {
  const normalizedAddress = toStr(address).trim();
  const normalizedChainId = Number(chainId || 0) || null;
  if (!normalizedAddress) return [];

  const chain = normalizedChainId ? getChainById(normalizedChainId) : null;
  return [
    {
      address: normalizedAddress,
      ...(normalizedChainId ? { id: normalizedChainId } : {}),
      testnet: chain ? isTestnetChain(chain) : false,
      explorerUrl: normalizedChainId ? getExplorerAddressUrl(normalizedAddress, normalizedChainId) : '',
    },
  ];
};

export const buildContractViewerContracts = ({
  sessionContracts = {},
  chainId = null,
  includeSessionRegistry = true,
  includeCustomSBT = true,
}: {
  sessionContracts?: SessionContractsLike | null;
  chainId?: ChainIdLike;
  includeSessionRegistry?: boolean;
  includeCustomSBT?: boolean;
} = {}): ContractViewerContractLike[] => {
  const sourceDefinitions = getContractSourceDefinitions() as Record<string, AnyRecord>;
  const normalizedContracts = sessionContracts && typeof sessionContracts === 'object' ? sessionContracts : {};
  const entries: ContractViewerContractLike[] = Object.entries(normalizedContracts).map(
    ([contractKey, contractInfo]) => {
      const info = (contractInfo && typeof contractInfo === 'object' ? contractInfo : {}) as SessionContractLike;
      const contractChainId = Number(info.chainId || chainId || 0) || null;
      const sourceDefinition = sourceDefinitions[contractKey] || {};

      return {
        key: contractKey,
        name: getContractDisplayName(contractKey),
        addresses: buildContractAddresses({
          address: info.address || info.contractAddress || '',
          chainId: contractChainId,
        }),
        explainer: getContractExplainer(contractKey),
        sourceFile: sourceDefinition.file || getContractSourceFileName(contractKey),
        source: sourceDefinition.source || '',
      };
    },
  );

  const firstContract = Object.values(normalizedContracts)[0] as SessionContractLike | undefined;
  const resolvedChainId = Number(chainId || firstContract?.chainId || 0) || null;

  if (includeSessionRegistry && resolvedChainId && !entries.some((entry) => entry.key === 'sessionRegistry')) {
    const registryAddress = toStr(getSessionRegistryAddress(resolvedChainId)).trim();
    if (registryAddress) {
      const sourceDefinition = sourceDefinitions.sessionRegistry || {};
      entries.push({
        key: 'sessionRegistry',
        name: getContractDisplayName('sessionRegistry'),
        addresses: buildContractAddresses({
          address: registryAddress,
          chainId: resolvedChainId,
        }),
        explainer: getContractExplainer('sessionRegistry'),
        sourceFile: sourceDefinition.file || getContractSourceFileName('sessionRegistry'),
        source: sourceDefinition.source || '',
      });
    }
  }

  if (includeCustomSBT && !entries.some((entry) => entry.key === 'customSBT')) {
    const sourceDefinition = sourceDefinitions.customSBT || {};
    entries.push({
      key: 'customSBT',
      name: getContractDisplayName('customSBT'),
      addresses: [],
      explainer: getContractExplainer('customSBT'),
      sourceFile: sourceDefinition.file || getContractSourceFileName('customSBT'),
      source: sourceDefinition.source || '',
    });
  }

  return entries;
};
