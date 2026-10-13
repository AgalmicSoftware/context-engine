// The session page passes a failed saved-answer load down to its pile, which must say so.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import OnePageSession from './OnePageSession';
import { createSurveyQuestionsTestStore } from '../SurveyTool/surveyQuestionsTestHarness';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

jest.mock('../SBTs/SBTsPage', () => () => null);
jest.mock('./WorkerSessionGroupsPanel', () => () => null);
jest.mock('../PolisReport/PolisReport', () => () => null);
jest.mock('../DebateMap/DebateMap', () => ({ __esModule: true, default: () => null }));
jest.mock('../MainContent/RiskMatrix', () => ({ __esModule: true, default: () => null }));
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({ __esModule: true, default: () => null }));
jest.mock('../SurveyTool/CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('../SurveyTool/SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('../SurveyTool/SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const ACCOUNT = '0x00000000000000000000000000000000000000a1';

const buildSessionConfig = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = 84532;
  return {
    slug: 'edge',
    sessionName: 'Edge Session',
    sessionInfo: 'Edge info',
    defaultTags: [],
    defaultSbtTags: [],
    defaultFeaturedSBTs: [],
    contracts: {},
    blockLimits: {},
    networkChainId: 84532,
    sessionModeProfile: profile,
    __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
  };
};

const mockQuestionCache = (sessionConfig) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? sessionConfig : null));
  const cache = () => ({
    84532: {
      questions: { q1: { id: 'q1', type: 'binary', prompt: 'Should the session continue?' } },
      questionResponses: {},
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
};

const renderSession = (overrides = {}) => {
  const sessionConfig = buildSessionConfig();
  mockQuestionCache(sessionConfig);
  return render(
    <Provider store={createSurveyQuestionsTestStore()}>
      <MemoryRouter>
        <OnePageSession
          network={{ id: 84532, name: 'Base Sepolia' }}
          provider={{ request: jest.fn() }}
          account={ACCOUNT}
          loginComplete
          toggleLoginModal={jest.fn()}
          isQuestionCacheReady
          isResponsesCacheReady={false}
          isSBTCacheReady
          isSurveyCacheReady
          cacheHasLoaded
          sbtCacheRevision={0}
          sbtScanProgressBySlug={{}}
          questionResponsesNonce={1}
          questionScanProgress={null}
          refreshSurveyResponsesByID={jest.fn()}
          refreshQuestionMetadata={jest.fn()}
          refreshQuestionResponses={jest.fn()}
          refreshSbtData={jest.fn()}
          defaultFilterState={{ includedSBTs: [], excludedSBTs: [], onlyVerifiedHumans: false }}
          sessionConfig={sessionConfig}
          {...overrides}
        />
      </MemoryRouter>
    </Provider>,
  );
};

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it('tells a signed-in responder on the session page that their saved answers did not load', async () => {
  renderSession({ cacheInitializationError: true });

  expect(await screen.findByText(/Your saved answers did not load/, {}, { timeout: 8000 })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

it('shows no saved-answer notice on the session page when the load succeeded', async () => {
  renderSession({ cacheInitializationError: false });

  expect(await screen.findByText('Should the session continue?', {}, { timeout: 8000 })).toBeInTheDocument();
  expect(screen.queryByText(/Your saved answers did not load/)).not.toBeInTheDocument();
});
