import { corsProxyUtils as defaultCorsProxyUtils } from '../../utilities/worker/corsProxy.js';
import * as defaultWorkerCorsOrigins from '../../utilities/worker/workerCorsOrigins.js';
import * as defaultWorkerAuth from '../../utilities/worker/workerAuth.js';
import {
  createWorkerAuthRemoteError,
  getWorkerAuthRemoteErrorMessage,
} from '../../utilities/worker/workerAuthRemoteError.js';
import {
  bindWorkerAuthPublishAdapter,
  type WorkerAdminActionAuthInput,
  type WorkerBootstrapAdminAuthInput,
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
  resolveCorsProxyUrl: (input?: AdminResolveCorsProxyUrlInput) => Promise<AdminResolvedCorsProxyUrl>;
};

export type AdminBuildWorkerAllowOriginsInput = {
  currentOrigin?: unknown;
  extraOrigins?: unknown;
};

export type AdminWorkerCorsOriginsModule = {
  buildWorkerAllowOrigins: (input?: AdminBuildWorkerAllowOriginsInput) => string[];
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
  buildSiweMessage: (input: AdminBuildSiweMessageInput) => string;
  fetchWorkerWithAuth: (
    url: string,
    options?: AdminWorkerFetchOptions,
    context?: AdminWorkerFetchContext,
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
  sessionId?: string;
  chainId: number;
  statement?: string;
};

export type AdminPrepareSiweLoginResult = {
  nonce: string;
  nonceData: AdminWorkerRecord;
  message: string;
};

export type AdminWorkerUrlPort = {
  resolveCorsProxyUrl: (input?: AdminResolveCorsProxyUrlInput) => Promise<AdminResolvedCorsProxyUrl>;
  buildWorkerAllowOrigins: (input?: AdminBuildWorkerAllowOriginsInput) => string[];
  normalizeWorkerUrl: (value: unknown) => string;
};

export type WorkerAdminAuthPort = {
  buildSignedBootstrapAdminAuth: (input: WorkerBootstrapAdminAuthInput) => Promise<AdminWorkerRecord>;
  buildSignedAdminActionAuth: (input: WorkerAdminActionAuthInput) => Promise<AdminWorkerRecord>;
  fetchWorkerWithAuth: (
    url: string,
    options?: AdminWorkerFetchOptions,
    context?: AdminWorkerFetchContext,
  ) => Promise<AdminWorkerFetchResponse>;
};

export type WorkerSiweLoginPort = {
  createRemoteError: (input: {
    kind: 'admin_nonce' | 'worker_nonce' | 'worker_login';
    payload: unknown;
    status: unknown;
  }) => Error & { reason: string; status: number };
  getRemoteErrorMessage: (error: unknown) => string;
  prepareSiweLogin: (input: AdminPrepareSiweLoginInput) => Promise<AdminPrepareSiweLoginResult>;
};

export type AdminWorkerPorts = {
  workerUrl: AdminWorkerUrlPort;
  adminAuth: WorkerAdminAuthPort;
  siweLogin: WorkerSiweLoginPort;
};

type FetchLike = (
  input: string,
  init?: RequestInit,
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

const readResponseJson = async (response: { json?: () => Promise<unknown> }): Promise<AdminWorkerRecord> => {
  if (typeof response.json !== 'function') return {};
  const data = await response.json().catch(() => ({}));
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as AdminWorkerRecord) : {};
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
      normalizeWorkerUrl: (value) => workerAuthPublishAdapter.normalizeWorkerUrl(value),
    },
    adminAuth: {
      buildSignedBootstrapAdminAuth: (input) => workerAuthPublishAdapter.buildSignedBootstrapAdminAuth(input),
      buildSignedAdminActionAuth: (input) => workerAuthPublishAdapter.buildSignedAdminActionAuth(input),
      fetchWorkerWithAuth: (url, options, context) => readWorkerAuth().fetchWorkerWithAuth(url, options, context),
    },
    siweLogin: {
      createRemoteError: (input) => createWorkerAuthRemoteError(input),
      getRemoteErrorMessage: (error) => getWorkerAuthRemoteErrorMessage(error),
      prepareSiweLogin: async ({
        workerUrl,
        address,
        sessionSlug,
        sessionId,
        chainId,
        statement = 'Sign in to Context Engine.',
      }) => {
        const nonceResp = await fetchImpl()(`${workerUrl}/auth/nonce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, sessionSlug, ...(sessionId ? { sessionId } : {}) }),
        });
        const nonceData = await readResponseJson(nonceResp);
        if (!nonceResp.ok) {
          throw createWorkerAuthRemoteError({ kind: 'admin_nonce', payload: nonceData, status: nonceResp.status });
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
