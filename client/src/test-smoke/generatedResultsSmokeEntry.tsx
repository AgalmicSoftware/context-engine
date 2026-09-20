import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import store from '../store';
import { LOGIN_ACCOUNT } from '../actions/types';
import OnePageSession from '../components/OnePageSession/OnePageSession';
import {
  authorizeGeneratedResultsForHost,
  generateResultsForHost,
} from '../components/OnePageSession/onePageSessionGeneratedResultsRuntime';
import { adminWorkerPorts } from '../domains/worker/adminWorkerPorts';
import {
  readSessionResultsAnalysisStatus,
  startSessionResultsAnalysisGeneration,
} from '../domains/sessionResults/sessionResultsAnalysisWorkerClient';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../utilities/session/sessionModeProfile';
import { buildTokenCacheEnvelope, buildTokenCacheKey, writeTokenCache } from '../utilities/worker/workerAuthTokenCache';

import 'assets/css/contextEngine.scss';
import './generatedResultsSmokeEntry.css';

const sessionSlug = 'synthetic-generated-results-smoke';
const sessionId = '0x11111111111111111111111111111111';
const adminAccount = '0x0000000000000000000000000000000000000abc';
const isAnonymousViewer =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('viewer') === 'anonymous';
const account = isAnonymousViewer ? '' : adminAccount;
const workerUrl = 'https://worker.example';

const syntheticProvider = {
  isPasskeyEoa: true,
  selectedAddress: adminAccount,
  address: adminAccount,
  request: async ({ method }: { method: string; params?: unknown[] }) => {
    if (method === 'eth_accounts') return [adminAccount];
    if (method === 'personal_sign' || method === 'eth_sign' || method === 'eth_signTypedData_v4')
      return '0xsyntheticsignature';
    return null;
  },
};

if (typeof window !== 'undefined') {
  (window as Window & { __passkeyEoaProvider?: unknown }).__passkeyEoaProvider = syntheticProvider;
}

adminWorkerPorts.adminAuth.buildSignedAdminActionAuth = async ({ action, body, workerUrl: signedWorkerUrl }) => ({
  admin: adminAccount,
  action,
  bodyHash: '0xsynthetic-body-hash',
  nonce: 'synthetic-nonce',
  expiresAt: 1790000000,
  signature: '0xsyntheticsignature',
  signedWorkerUrl,
  echoedBodyKeys: Object.keys((body && typeof body === 'object' ? body : {}) as Record<string, unknown>),
});

if (!isAnonymousViewer) {
  const tokenCacheKey = buildTokenCacheKey({ workerUrl, slug: sessionSlug, sessionId, address: account });
  writeTokenCache(
    tokenCacheKey,
    buildTokenCacheEnvelope({
      token: 'synthetic-viewer-token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      workerUrl,
      sessionId,
      sessionSlug,
      address: account,
    }),
  );
}

store.dispatch({
  type: LOGIN_ACCOUNT,
  payload: {
    account,
    provider: isAnonymousViewer ? 'none' : 'passkey_eoa',
    network: { id: 11155420, chainId: 11155420, name: 'OP Sepolia' },
  },
});

const smokeAuthHeaders = async () => ({ Authorization: 'Bearer synthetic-viewer-token', 'X-Group-Slug': sessionSlug });
const smokeRuntimePorts = {
  pollAttempts: 2,
  pollIntervalMs: 100,
  readQuestionsCache: () => ({}),
  readStatus: (args: Parameters<typeof readSessionResultsAnalysisStatus>[0]) =>
    readSessionResultsAnalysisStatus({ ...args, getAuthHeaders: smokeAuthHeaders }),
  startGeneration: (args: Parameters<typeof startSessionResultsAnalysisGeneration>[0]) =>
    startSessionResultsAnalysisGeneration({
      ...args,
      signAdminAction: async ({ action, body, workerUrl: signedWorkerUrl }) => ({
        admin: adminAccount,
        action,
        bodyHash: '0xsynthetic-body-hash',
        nonce: 'synthetic-nonce',
        expiresAt: 1790000000,
        signature: '0xsyntheticsignature',
        signedWorkerUrl,
        echoedBodyKeys: Object.keys(body || {}),
      }),
    }),
};

const sessionPrototype = OnePageSession.prototype as typeof OnePageSession.prototype & {
  handleGeneratedResultsAuthorize: () => Promise<void>;
  handleGeneratedResultsGenerate: (refresh?: boolean) => Promise<void>;
};
sessionPrototype.handleGeneratedResultsAuthorize = function handleGeneratedResultsAuthorizeSmoke() {
  return authorizeGeneratedResultsForHost(this, { ports: smokeRuntimePorts });
};
sessionPrototype.handleGeneratedResultsGenerate = function handleGeneratedResultsGenerateSmoke(refresh = true) {
  return generateResultsForHost(this, { refresh, ports: smokeRuntimePorts });
};

const sessionConfig = {
  slug: sessionSlug,
  sessionId,
  sessionName: 'Synthetic Generated Results Smoke',
  sessionInfo: 'Synthetic fixture used only for browser smoke coverage.',
  defaultTags: [],
  defaultSbtTags: [],
  defaultFeaturedSBTs: [],
  contracts: {},
  blockLimits: {},
  networkChainId: 11155420,
  adminAddress: isAnonymousViewer ? '' : adminAccount,
  corsWorkerUrl: workerUrl,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
  },
  resultsAnalysis: {
    version: 1,
    generationMode: 'manual',
    views: { circles: true, breakdown: true, riskMatrix: true },
    autoAfter: { threshold: 10, unit: 'distinctParticipants' },
    inputScope: 'submitted',
    publication: 'latest_success_visible',
  },
};

const noop = () => {};

createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <BrowserRouter>
      <main className="smokePage" data-testid="ce-real-generated-results-smoke" data-provider="redux">
        <OnePageSession
          account={account}
          blockLimits={{}}
          cacheHasLoaded={true}
          contracts={{}}
          defaultFilterState={{ includedSBTs: [], excludedSBTs: [], onlyVerifiedHumans: false }}
          isQuestionCacheReady={true}
          isResponsesCacheReady={true}
          isSBTCacheReady={true}
          isSurveyCacheReady={true}
          litHooks={{}}
          loginComplete={!isAnonymousViewer}
          network={{ id: 11155420, chainId: 11155420, name: 'OP Sepolia' }}
          provider={isAnonymousViewer ? 'none' : 'passkey_eoa'}
          questionResponsesNonce={1}
          questionScanProgress={null}
          refreshQuestionMetadata={noop}
          refreshQuestionResponses={noop}
          refreshSbtData={noop}
          refreshSurveyResponsesByID={noop}
          sbtCacheRevision={1}
          sbtScanProgressBySlug={{}}
          sessionConfig={sessionConfig}
          slug={sessionSlug}
          toggleLoginModal={noop}
        />
      </main>
    </BrowserRouter>
  </Provider>,
);
