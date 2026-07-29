import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyTool from './SurveyTool';

jest.mock('./SurveyPileViewMode', () => ({
  __esModule: true,
  PileViewMode: () => <div data-testid="mock-pure-worker-question-pile">Question pile</div>,
}));

jest.mock('./SurveySelector', () => ({
  SurveySelector: () => <div data-testid="mock-survey-selector">Survey selector</div>,
}));

jest.mock('./SurveyResults', () => ({
  __esModule: true,
  default: () => null,
}));

const pureWorkerProfile = {
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'none' },
  surfaces: {
    web: true,
    telegram: false,
    miniApp: false,
    agentHttp: false,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: 'public_full_if_storage_public',
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: 'all_session' },
};

describe('SurveyTool survey-index discovery lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not start SurveySelector discovery for a pure Worker question pile', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <SurveyTool
        minifiedMode="pile"
        sessionSlug="demo-sh"
        sessionSlugPinned={true}
        sessionConfig={{
          slug: 'demo-sh',
          networkChainId: 11155420,
          sessionModeProfile: pureWorkerProfile,
        }}
      />,
    );

    expect(await screen.findByTestId('mock-pure-worker-question-pile')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalledWith('[surveys]', 'SurveySelector: Network ID is undefined in fetchSurveys.');
  });
});
