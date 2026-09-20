import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from '../store';
import { LOGIN_ACCOUNT } from '../actions/types';
import SurveyResults from '../components/SurveyTool/SurveyResults';
import PolisReport from '../components/PolisReport/PolisReport';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../utilities/session/sessionModeProfile';
import { upsertWorkerCanonicalSessionBootstrap } from '../utilities/session/sessionWorkerConfigCache';
import { buildTokenCacheEnvelope, buildTokenCacheKey, writeTokenCache } from '../utilities/worker/workerAuthTokenCache';
import { initCacheManager, writeCache } from '../utilities/cache/cacheScripts';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../utilities/survey/workerCanonicalCacheIdentity';
import { dispatchWorkerGroupsChanged } from '../utilities/worker/workerGroupChangeEvents';
import 'assets/css/contextEngine.scss';
const slug = 'group-results-smoke',
  sessionId = '0x' + '4'.repeat(32),
  workerUrl = 'https://group-results-worker.example';
const member = '0x' + 'a'.repeat(40),
  outsider = '0x' + 'b'.repeat(40);
const config = {
  slug,
  sessionId,
  configRevision: 'smoke-1',
  corsWorkerUrl: workerUrl,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  contracts: {},
  blockLimits: {},
};
const questions = {
  q1: { id: 'q1', type: 'freeform', prompt: 'Session feedback', creator: member, sessionSlug: slug },
};
const answer = (value: string) => ({
  type: 'freeform',
  questionID: 'q1',
  sessionSlug: slug,
  sessionId,
  answer: { value, encrypted: false },
  timestamp: 1,
});
const responses = { q1: { [member]: answer('Member-only feedback'), [outsider]: answer('Outside feedback') } };
const aggregator = { q1: Object.entries(responses.q1).map(([responder, response]) => ({ responder, response })) };
function Smoke() {
  const [filterState, setFilterState] = useState<Record<string, unknown>>({});
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Question results</button>
      <button onClick={() => dispatchWorkerGroupsChanged({ sessionSlug: slug, sessionId })}>Refresh membership</button>
      <SurveyResults
        isOpen={open}
        toggle={() => setOpen(false)}
        viewMode="questions"
        sessionSlug={slug}
        sessionConfig={config}
        account={member}
        provider="passkey_eoa"
        network={{ id: 1 }}
        isQuestionCacheReady
        isResponsesCacheReady
        isSBTCacheReady
        filterState={filterState}
        onFilterChange={setFilterState}
        preventUrlChange
        questionResponsesNonce={1}
        questionsCacheNonce={1}
      />
      <PolisReport
        questionResponses={aggregator}
        account={member}
        provider="passkey_eoa"
        network={null}
        slug={slug}
        sessionConfig={config}
        filterState={filterState}
        isQuestionCacheReady
        isResponsesCacheReady
      />
    </>
  );
}
async function boot() {
  upsertWorkerCanonicalSessionBootstrap({ slug, sessionIdHex: sessionId, workerOrigin: workerUrl, config });
  store.dispatch({
    type: LOGIN_ACCOUNT,
    payload: { account: member, provider: 'passkey_eoa', network: { id: 1, chainId: 1 } },
  });
  writeTokenCache(
    buildTokenCacheKey({ workerUrl, slug, sessionId, address: member }),
    buildTokenCacheEnvelope({
      token: 'synthetic-viewer-token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      workerUrl,
      sessionId,
      sessionSlug: slug,
      address: member,
    }),
  );
  await initCacheManager();
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: slug });
  await writeCache('questionsCache', slug, {
    worker: withWorkerCanonicalCacheIdentity({ questions, questionResponses: responses }, identity),
  });
  createRoot(document.getElementById('root') as HTMLElement).render(
    <Provider store={store}>
      <BrowserRouter>
        <Smoke />
      </BrowserRouter>
    </Provider>,
  );
}
void boot();
