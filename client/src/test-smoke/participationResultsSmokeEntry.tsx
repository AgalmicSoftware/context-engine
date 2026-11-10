import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from '../store';
import Shell from '../components/OnePageSession/OnePageSessionStandardShell';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../utilities/session/sessionModeProfile';
import { writeCache } from '../utilities/cache/cacheScripts';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../utilities/survey/workerCanonicalCacheIdentity';
import '../assets/css/contextEngine.scss';

const ShellProbe = Shell as React.ComponentType<Record<string, unknown>>;
async function main() {
  (window as Window & { CE_E2E_AI_MOCK?: boolean }).CE_E2E_AI_MOCK = true;
  const config = {
    slug: 'results-workshop',
    sessionId: '0x' + '4'.repeat(32),
    corsWorkerUrl: 'https://worker.example',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  };
  const questions = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      'q' + i,
      {
        type: 'binary',
        prompt: [
          'Public review improves decisions',
          'Release decisions need clear evidence',
          'Community input should guide priorities',
          'Independent oversight matters',
          'Open documentation supports trust',
          'People should control their own data',
        ][i],
      },
    ]),
  );
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: config.slug });
  await writeCache('questionsCache', config.slug, {
    worker: withWorkerCanonicalCacheIdentity({ questions }, identity),
  });
  const responses = Object.fromEntries(
    Object.entries(questions).map(([id, q], qi) => [
      id,
      Array.from({ length: 24 }, (_, pi) => ({
        responder: 'synthetic-' + pi,
        questionId: id,
        response: {
          type: 'binary',
          prompt: q.prompt,
          answer: { value: qi === 0 || (pi < 12 ? qi % 2 === 0 : qi % 2 !== 0) ? 'Agree' : 'Disagree' },
        },
      })),
    ]),
  );
  const noop = () => {};
  const props = {
    effectiveSlug: config.slug,
    displaySessionSlug: config.slug,
    embeddedQuestionSessionSlug: config.slug,
    resolvedSessionConfig: config,
    titleText: 'Synthetic session',
    sessionName: 'Synthetic session',
    sessionInfo: 'Local Worker-mode result fixture',
    network: null,
    networkChainId: null,
    autoMintStatuses: [],
    autoMintTargets: [],
    dismissedStatusItems: {},
    expandedImages: {},
    sbtImages: {},
    sbtNames: {},
    corpusViewerLoadState: {},
    defaultTags: [],
    defaultSbtTags: [],
    defaultFeaturedSBTs: [],
    showQuestions: true,
    showResults: true,
    resultsViewMode: 'polis',
    isDemoSlug: false,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    aggregatorData: responses,
    questionResponsesNonce: 1,
    onToggleQuestions: noop,
    onToggleResults: noop,
    onResultsModeChange: noop,
    onOpenResults: noop,
    questionsSectionRef: { current: null },
  };
  createRoot(document.getElementById('probe') as HTMLElement).render(
    <Provider store={store}>
      <BrowserRouter>
        <ShellProbe {...props} />
      </BrowserRouter>
    </Provider>,
  );
}
void main();
