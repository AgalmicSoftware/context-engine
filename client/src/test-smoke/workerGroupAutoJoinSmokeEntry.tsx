import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import store from '../store';
import { LOGIN_ACCOUNT } from '../actions/types';
import OnePageSession from '../components/OnePageSession/OnePageSession';
import WorkerGroupAutoJoin from '../components/OnePageSession/WorkerGroupAutoJoin';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../utilities/session/sessionModeProfile';
import { buildTokenCacheEnvelope, buildTokenCacheKey, writeTokenCache } from '../utilities/worker/workerAuthTokenCache';
import 'assets/css/contextEngine.scss';

const sessionSlug = 'auto-join-smoke';
const sessionId = '0x11111111111111111111111111111111';
const account = '0x0000000000000000000000000000000000000001';
const workerUrl = 'https://auto-join-worker.example';
const sessionConfig = {
  slug: sessionSlug,
  sessionId,
  sessionName: 'Auto-join smoke',
  corsWorkerUrl: workerUrl,
  defaultTags: [],
  defaultSbtTags: [],
  defaultFeaturedSBTs: [],
  contracts: {},
  blockLimits: {},
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active', responses: 'active' } },
};
const noop = () => {};

function SmokeSession() {
  const location = useLocation();
  const [signedIn, setSignedIn] = useState(false);
  const signIn = () => {
    store.dispatch({
      type: LOGIN_ACCOUNT,
      payload: { account, provider: 'passkey_eoa', network: { id: 1, chainId: 1 } },
    });
    writeTokenCache(
      buildTokenCacheKey({ workerUrl, slug: sessionSlug, sessionId, address: account }),
      buildTokenCacheEnvelope({
        token: 'synthetic-viewer-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        workerUrl,
        sessionId,
        sessionSlug,
        address: account,
      }),
    );
    setSignedIn(true);
  };
  return (
    <>
      <WorkerGroupAutoJoin
        sessionConfig={sessionConfig}
        sessionSlug={sessionSlug}
        account={signedIn ? account : ''}
        provider="passkey_eoa"
        loginComplete={signedIn}
        toggleLoginModal={signIn}
      />
      <Link to="/about">Navigate away before signing in</Link>
      {location.pathname === '/about' ? (
        <p>Another page</p>
      ) : (
        <OnePageSession
          account={signedIn ? account : ''}
          provider="passkey_eoa"
          loginComplete={signedIn}
          toggleLoginModal={signIn}
          sessionConfig={sessionConfig}
          slug={sessionSlug}
          sessionName="Auto-join smoke"
          blockLimits={{}}
          contracts={{}}
          cacheHasLoaded={true}
          defaultFilterState={{ includedSBTs: [], excludedSBTs: [], onlyVerifiedHumans: false }}
          isQuestionCacheReady={true}
          isResponsesCacheReady={true}
          isSBTCacheReady={true}
          isSurveyCacheReady={true}
          litHooks={{}}
          network={{ id: 1, chainId: 1, name: 'Worker session' }}
          questionResponsesNonce={1}
          refreshQuestionMetadata={noop}
          refreshQuestionResponses={noop}
          refreshSbtData={noop}
          refreshSurveyResponsesByID={noop}
          sbtCacheRevision={1}
          sbtScanProgressBySlug={{}}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <BrowserRouter>
      <SmokeSession />
    </BrowserRouter>
  </Provider>,
);
