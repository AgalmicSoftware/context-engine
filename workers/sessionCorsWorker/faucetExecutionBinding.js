import {
  faucet as faucetBoundary,
} from './faucetExecution.js';

export const createFaucetWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => (
  async (value = {}) => (
    (deps?.faucet || faucetBoundary)({
      ...value,
      deps: {
        json: deps?.json,
        log: typeof deps?.log === 'function' ? deps.log : () => {},
        normalizeFaucetRequest: deps?.normalizeFaucetRequest,
        validateFaucetEligibilityRequest: deps?.validateFaucetEligibilityRequest,
        Wallet: deps?.Wallet,
        rpcRequest: deps?.rpcRequest,
        toStr: deps?.toStr,
        toChainId: deps?.toChainId,
        toBigInt: deps?.toBigInt,
        formatEther: deps?.formatEther,
        maskRpcUrl: deps?.maskRpcUrl,
        isAddress: deps?.isAddress,
        parseEther: deps?.parseEther,
        resolveFaucetRpcUrls: deps?.resolveFaucetRpcUrls,
        isBytes32Hex: deps?.isBytes32Hex,
        normalizeAddressLower: deps?.normalizeAddressLower,
        resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
        toRegistrySessionSlug: deps?.toRegistrySessionSlug,
        readSessionExistsOnChain: deps?.readSessionExistsOnChain,
        readResourceGateOnChain: deps?.readResourceGateOnChain,
        resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
        checkSbtGate: deps?.checkSbtGate,
        findSessionGateForSbt: deps?.findSessionGateForSbt,
        readSbtFaucetValidationState: deps?.readSbtFaucetValidationState,
        validateSbtPasswordForFaucet: deps?.validateSbtPasswordForFaucet,
        verifyGroupSignatureForFaucet: deps?.verifyGroupSignatureForFaucet,
      },
      constants: {
        anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
        zeroBytes32: constants?.zeroBytes32,
      },
      defaults: {
        defaultRpcUrl: defaults?.defaultRpcUrl,
        defaultAmountEth: defaults?.defaultAmountEth,
        defaultThresholdEth: defaults?.defaultThresholdEth,
      },
    })
  )
);
