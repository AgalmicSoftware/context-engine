import { corsProxyUtils as defaultCorsProxyUtils } from '../../utilities/worker/corsProxy.js';
import * as defaultWorkerCorsOrigins from '../../utilities/worker/workerCorsOrigins.js';
import * as defaultWorkerAuth from '../../utilities/worker/workerAuth.js';
import {
  bindWorkerAuthPublishAdapter,
  type WorkerAdminActionAuthInput,
  type WorkerAuthPublishModule,
} from '../sessions/publish/sessionPublishAdapters.js';

export type AdminWorkerRecord = Record<string, unknown>;

export type AdminResolveCorsProxyUrlInput = {
  sessionSlug?: string;
  sessionConfig?: AdminWorkerRecord | null;
  context?: AdminWorkerRecord | null;
  allowDemoFallback?: unknown;
};

export type AdminResolvedCorsProxyUrl = AdminWorkerRecord & {
  url?: string;
  status?: string;
  source?: string;
};

export type AdminWorkerCorsProxyModule = {
  resolveCorsProxyUrl: (
    input?: AdminResolveCorsProxyUrlInput
  ) => Promise<AdminResolvedCorsProxyUrl>;
};

export type AdminBuildWorkerAllowOriginsInput = {
  currentOrigin?: unknown;
  extraOrigins?: unknown;
};

export type AdminWorkerCorsOriginsModule = {
  buildWorkerAllowOrigins: (
    input?: AdminBuildWorkerAllowOriginsInput
  ) => string[];
};

export type AdminWorkerFetchOptions = RequestInit;

export type AdminWorkerFetchContext = {
  sessionSlug?: string;
  context?: AdminWorkerRecord;
  workerUrl?: string;
};

export type AdminWorkerFetchResponse = {
  ok?: boolean;
  status?: number;
  json: () => Promise<AdminWorkerRecord>;
};

export type AdminWorkerAuthModule = WorkerAuthPublishModule & {
  buildSiweMessage: (
    input: AdminBuildSiweMessageInput
  ) => string;
  fetchWorkerWithAuth: (
    url: string,
    options?: AdminWorkerFetchOptions,
    context?: AdminWorkerFetchContext
  ) => Promise<AdminWorkerFetchResponse>;
};

export type AdminBuildSiweMessageInput = {
  address: string;
  nonce?: unknown;
  chainId: number;
  statement?: string;
};

export type AdminPrepareSiweLoginInput = {
  workerUrl: string;
  address: string;
  sessionSlug: string;
  chainId: number;
  statement?: string;
};

export type AdminPrepareSiweLoginResult = {
  nonce: string;
  nonceData: AdminWorkerRecord;
  message: string;
};

export type AdminWorkerUrlPort = {
  resolveCorsProxyUrl: (
    input?: AdminResolveCorsProxyUrlInput
  ) => Promise<AdminResolvedCorsProxyUrl>;
  buildWorkerAllowOrigins: (
    input?: AdminBuildWorkerAllowOriginsInput
  ) => string[];
};

export type WorkerAdminAuthPort = {
  buildSignedAdminActionAuth: (
    input: WorkerAdminActionAuthInput
  ) => Promise<AdminWorkerRecord>;
  fetchWorkerWithAuth: (
    url: string,
    options?: AdminWorkerFetchOptions,
    context?: AdminWorkerFetchContext
  ) => Promise<AdminWorkerFetchResponse>;
};

export type WorkerSiweLoginPort = {
  prepareSiweLogin: (
    input: AdminPrepareSiweLoginInput
  ) => Promise<AdminPrepareSiweLoginResult>;
};

export type AdminWorkerPorts = {
  workerUrl: AdminWorkerUrlPort;
  adminAuth: WorkerAdminAuthPort;
  siweLogin: WorkerSiweLoginPort;
};

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}>;

export type BindAdminWorkerPortsArgs = {
  corsProxy: () => AdminWorkerCorsProxyModule;
  corsOrigins: () => AdminWorkerCorsOriginsModule;
  workerAuth: () => AdminWorkerAuthModule;
  fetchImpl?: () => FetchLike;
};

const defaultFetchImpl = (): FetchLike => fetch;

const readResponseJson = async (response: {
  json?: () => Promise<unknown>;
}): Promise<AdminWorkerRecord> => {
  if (typeof response.json !== 'function') return {};
  const data = await response.json().catch(() => ({}));
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as AdminWorkerRecord
    : {};
};

export const bindAdminWorkerPorts = ({
  corsProxy: readCorsProxy,
  corsOrigins: readCorsOrigins,
  workerAuth: readWorkerAuth,
  fetchImpl = defaultFetchImpl,
}: BindAdminWorkerPortsArgs): AdminWorkerPorts => {
  const workerAuthPublishAdapter = bindWorkerAuthPublishAdapter({
    workerAuth: readWorkerAuth,
  });

  return {
    workerUrl: {
      resolveCorsProxyUrl: (input) => readCorsProxy().resolveCorsProxyUrl(input),
      buildWorkerAllowOrigins: (input) => readCorsOrigins().buildWorkerAllowOrigins(input),
    },
    adminAuth: {
      buildSignedAdminActionAuth: (input) => (
        workerAuthPublishAdapter.buildSignedAdminActionAuth(input)
      ),
      fetchWorkerWithAuth: (url, options, context) => (
        readWorkerAuth().fetchWorkerWithAuth(url, options, context)
      ),
    },
    siweLogin: {
      prepareSiweLogin: async ({
        workerUrl,
        address,
        sessionSlug,
        chainId,
        statement = 'Sign in to Context Engine.',
      }) => {
        const nonceResp = await fetchImpl()(`${workerUrl}/auth/nonce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, sessionSlug }),
        });
        const nonceData = await readResponseJson(nonceResp);
        if (!nonceResp.ok) {
          throw new Error(String(nonceData.error || `Nonce request failed (${nonceResp.status}).`));
        }
        const nonce = String(nonceData.nonce);
        return {
          nonce,
          nonceData,
          message: readWorkerAuth().buildSiweMessage({
            address,
            nonce,
            chainId,
            statement,
          }),
        };
      },
    },
  };
};

export const adminWorkerPorts = bindAdminWorkerPorts({
  corsProxy: () => defaultCorsProxyUtils,
  corsOrigins: () => defaultWorkerCorsOrigins,
  workerAuth: () => defaultWorkerAuth,
});
