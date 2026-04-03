import {
  proxyAnthropic as proxyAnthropicBoundary,
  proxyCustomRPC as proxyCustomRPCBoundary,
  proxyOpenAI as proxyOpenAIBoundary,
  proxyOpenRouter as proxyOpenRouterBoundary,
} from './aiProviderExecution.js';

export const createAiProviderProxiesWithWorkerDeps = ({
  deps,
} = {}) => ({
  proxyAnthropic: async (value = {}) => (
    (deps?.proxyAnthropic || proxyAnthropicBoundary)({
      ...value,
      deps: {
        json: deps?.json,
      },
    })
  ),
  proxyOpenAI: async (value = {}) => (
    (deps?.proxyOpenAI || proxyOpenAIBoundary)({
      ...value,
      deps: {
        json: deps?.json,
      },
    })
  ),
  proxyOpenRouter: async (value = {}) => (
    (deps?.proxyOpenRouter || proxyOpenRouterBoundary)({
      ...value,
      deps: {
        json: deps?.json,
      },
    })
  ),
  proxyCustomRPC: async (value = {}) => (
    (deps?.proxyCustomRPC || proxyCustomRPCBoundary)({
      ...value,
      deps: {
        json: deps?.json,
        safeFetch: deps?.safeFetch,
        isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
      },
    })
  ),
});
