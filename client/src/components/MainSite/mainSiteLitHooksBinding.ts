import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { getSessionConfigBySlugOrDefault } from '../../domains/sessions/sessionConfig.js';
import { attachLitDevTools, createLitHooks, setGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import type { AppShell } from './AppShell';
import { resolveMainSiteLitSessionConfig, resolveMainSiteLitSessionConfigSource } from './litSessionConfig.js';
import { getWorkerCanonicalRouteController } from './workerCanonicalRouteController.js';
import {
  resolveVerifiedWorkerCanonicalLitRouteConfig,
  resolveWorkerCanonicalLitRouteContext,
} from './workerCanonicalRouteResolution.js';

const readLitRoute = (host: AppShell) => {
  const path = host.getEffectiveRoutePath(host.getCurrentPathname());
  const search = (typeof window !== 'undefined' ? window.location.search : '') || '';
  const sessionTokenRaw = host.getSessionTokenFromPath(path);
  return { path, search, sessionTokenRaw };
};

export const resolveMainSiteLitRouteContextKey = (host: AppShell): string => {
  const { path, search, sessionTokenRaw } = readLitRoute(host);
  const workerRoute = resolveWorkerCanonicalLitRouteContext({ sessionTokenRaw, searchStr: search });
  return workerRoute.explicitWorkerRoute
    ? `${path}\nworker:${workerRoute.workerOrigin || 'invalid'}`
    : `${path}\nstandard`;
};

const resolveActiveLitSessionConfig = (host: AppShell) => {
  const { search, sessionTokenRaw } = readLitRoute(host);
  const workerRoute = resolveVerifiedWorkerCanonicalLitRouteConfig({
    sessionTokenRaw,
    searchStr: search,
    controller: getWorkerCanonicalRouteController(host),
  });
  if (workerRoute.explicitWorkerRoute) {
    return {
      sessionConfig: workerRoute.sessionConfig || {},
      sessionSlug: workerRoute.sessionSlug,
    };
  }

  const sessionSlug = host.getActiveSessionSlug();
  return {
    sessionConfig: resolveMainSiteLitSessionConfigSource({
      slug: sessionSlug,
      resolveRegistryConfigBySlug: (slug: string) => sessionRegistryReadsPort.getSessionConfig(slug),
      resolveStaticConfigBySlug: (slug: string) => getSessionConfigBySlugOrDefault(slug),
    }),
    sessionSlug,
  };
};

export const syncMainSiteLitHooks = (host: AppShell) => {
  if (typeof window === 'undefined') return null;
  const { sessionConfig, sessionSlug } = resolveActiveLitSessionConfig(host);
  const { chainId, litNetwork, litChain, accessControlConditions, userMaxPrice, chipotle } =
    resolveMainSiteLitSessionConfig({
      sessionConfig,
      networkChainIdFallback: host.props.network?.id || null,
    });

  const hooks = chipotle
    ? createLitHooks({
        providerLike: host.props.provider,
        account: host.props.account,
        chainId,
        litChain,
        litNetwork,
        userMaxPrice,
        accessControlConditions: accessControlConditions || undefined,
        chipotle: {
          ...chipotle,
          sessionSlug,
        },
      })
    : null;

  setGlobalLitHooks(hooks);
  attachLitDevTools({
    providerLike: host.props.provider,
    account: host.props.account,
    chainId,
    litChain,
  });
  return { hooks, routeContextKey: resolveMainSiteLitRouteContextKey(host) };
};
