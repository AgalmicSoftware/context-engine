import {
  arweaveUpload as arweaveUploadBoundary,
} from './arweaveUploadExecution.js';

export const createArweaveUploadWithWorkerDeps = ({
  deps,
} = {}) => (
  async (value = {}) => (
    (deps?.arweaveUpload || arweaveUploadBoundary)({
      ...value,
      deps: {
        json: deps?.json,
        log: typeof deps?.log === 'function' ? deps.log : () => {},
        toStr: deps?.toStr,
        readArweaveUploadRequestPayload: deps?.readArweaveUploadRequestPayload,
        resolveArweaveUploadJwk: deps?.resolveArweaveUploadJwk,
        normalizeArweaveCeTags: deps?.normalizeArweaveCeTags,
        normalizeArweaveAssociationTags: deps?.normalizeArweaveAssociationTags,
        rpcRequest: deps?.rpcRequest,
        callContractFunction: deps?.callContractFunction,
        readSessionBySlugOnChain: deps?.readSessionBySlugOnChain,
        getErc721Interface: deps?.getErc721Interface,
        getSbtAdminInterface: deps?.getSbtAdminInterface,
        isAddress: deps?.isAddress,
        isPositiveBalance: deps?.isPositiveBalance,
        normalizeSessionIdHex: deps?.normalizeSessionIdHex,
        resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
        resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
        toChainId: deps?.toChainId,
        toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      },
    })
  )
);
