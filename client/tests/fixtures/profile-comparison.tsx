// Local-only synthetic data and AI mocks: no Worker or paid provider requests.
import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/assets/css/contextEngine.scss';
import LoginThemeQuickControl from '../../src/components/Account/LoginThemeQuickControl';
import CompareAddress from '../../src/components/UserPage/CompareAddresses';
import UserPageAnalysisModal from '../../src/components/UserPage/UserPageAnalysisModal';
import WorkerCanonicalSessionBootstrapBoundary from '../../src/components/Sessions/WorkerCanonicalSessionBootstrapBoundary';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../src/utilities/session/sessionModeProfile';
import { initializeMainSiteWorkerCanonicalCaches } from '../../src/components/MainSite/mainSiteWorkerCanonicalCacheRuntime';
import type { WorkerCanonicalSessionBootstrap } from '../../src/utilities/session/sessionWorkerDiscovery';
import { writeCache } from '../../src/utilities/cache/cacheScripts';
const walletA = `0x${'1'.repeat(40)}`;
const walletB = `0x${'2'.repeat(40)}`;
localStorage.setItem('ce-e2e-ai-mock', '1');
const seedAnswers = () =>
  writeCache('questionsCache', 'comparison-fixture', {
    worker: {
      questions: { shared: { prompt: 'Should local parks be expanded?', type: 'binary' } },
      questionResponses: {
        shared: {
          [walletA]: JSON.stringify({ answer: { value: 'Agree' } }),
          [walletB]: JSON.stringify({ answer: { value: 'Disagree' } }),
        },
      },
    },
  });
const fixtureConfig = {
  slug: 'comparison-fixture',
  sessionId: '0x00112233445566778899aabbccddeeff',
  configRevision: 'fixture-1',
  corsWorkerUrl: 'https://comparison-fixture.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const fetchFixture: typeof fetch = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return new Response(JSON.stringify({ ok: true, sessionSlug: fixtureConfig.slug, config: fixtureConfig }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
function Fixture() {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [verified, setVerified] = useState<WorkerCanonicalSessionBootstrap | null>(null);
  const [ready, setReady] = useState(false);
  const loadSessionData = useCallback(async () => {
    if (!verified) throw new Error('Session is not verified.');
    await initializeMainSiteWorkerCanonicalCaches({
      sessionSlug: verified.sessionSlug,
      sessionConfig: verified.config,
      host: {
        initializeQuestionCacheForGroup: async () => {},
        initializeSbtCacheForGroup: async () => {
          throw new Error('Unexpected chain request.');
        },
        fetchQuestionResponsesChunkedForGroup: async () => {
          await new Promise((resolve) => setTimeout(resolve, 4500));
          await seedAnswers();
        },
        initializeSurveyCacheForGroup: async () => {},
        setReadinessStateIfChanged: (patch, callback) => {
          if (patch.isSurveyCacheReady) setReady(true);
          callback?.();
        },
        checkAllCachesReady: () => {},
        startSbtEventListenerForGroup: () => {},
      },
    });
  }, [verified]);
  return (
    <main style={{ maxWidth: 1100, margin: '20px auto', padding: 12 }}>
      <LoginThemeQuickControl />
      <MemoryRouter
        initialEntries={[`/compare?session=comparison-fixture&subject=wallet:${walletA}&subject=wallet:${walletB}`]}
      >
        {verified ? (
          <CompareAddress
            activeSessionSlug="unrelated-global-session"
            sessionCachesReady={ready}
            loadSessionData={loadSessionData}
          />
        ) : (
          <WorkerCanonicalSessionBootstrapBoundary
            sessionSlug={fixtureConfig.slug}
            workerQueryValue={fixtureConfig.corsWorkerUrl}
            onResolved={setVerified}
            fetchImpl={fetchFixture}
          />
        )}
      </MemoryRouter>
      <button onClick={() => setAnalysisOpen(true)}>Show fixture analysis</button>
      <UserPageAnalysisModal
        isOpen={analysisOpen}
        onToggle={() => setAnalysisOpen(false)}
        onRefreshAnalysis={() => {}}
        analysisCacheStatusState={{}}
        analysisModalDisplayState={{ shouldRenderAnalysisBody: true, shouldRenderDetails: true }}
        analysisName="Community participant"
        aiAnalysis="Supports civic participation."
        analysisDetails="Favors community input with privacy safeguards."
        analysisGeneration={{ provider: 'fixture', model: 'synthetic-model', source: 'reported' }}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
