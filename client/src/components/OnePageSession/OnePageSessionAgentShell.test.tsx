import React from 'react';
import { render, screen } from '@testing-library/react';
import OnePageSessionAgentShell from './OnePageSessionAgentShell';

jest.mock('./agent/AgentQuestionPile', () => ({
  __esModule: true,
  default: () => <div data-testid="agent-question-pile" />,
}));
jest.mock('./agent/AgentBucketCards', () => ({
  __esModule: true,
  default: () => <div data-testid="agent-bucket-cards" />,
}));
jest.mock('./WorkerGroupMembershipPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="worker-group-membership-panel" />,
}));

const baseProps = {
  account: '0xabc',
  blockLimits: {},
  contracts: {},
  defaultTags: [],
  disclaimersActive: true,
  displaySessionSlug: 'agent-session',
  filterState: {},
  loginComplete: true,
  network: { id: 11155420 },
  networkChainId: 11155420,
  provider: 'wagmi',
  questionResponsesNonce: 0,
  questionScanProgress: null,
  resultsViewMode: 'polis',
  sessionHeader: 'Agent Session',
  sessionInfo: 'Agent shell',
  sessionName: 'Agent Session',
  agentQuestions: [],
  agentQuestionsStatus: 'ready',
  agentResults: null,
  agentResultsStatus: 'ready',
  agentClientEnvelope: {
    v: 3 as const,
    sessionSlug: 'agent-session',
    expiresAt: '2099-01-01T00:00:00.000Z',
    address: '0xabc',
    workerCredential: { kind: 'worker', token: 'worker-jwt' },
    agentCredential: { kind: 'bridge', token: 'bridge-token' },
    capabilities: { submitAnswers: true },
  },
  agentPolisDataset: null,
  agentQuestionPileIndex: 0,
  agentQuestionSubmitError: '',
  agentSessionMeta: {},
  agentSubmittedQuestionIds: [],
  agentSubmittingQuestionIds: new Set<string>(),
  workerGroupSessionId: '0x11111111111111111111111111111111',
  workerGroupWorkerUrl: 'https://worker.example',
  titleText: 'Agent Session',
  onLogout: jest.fn(),
  onOpenLoginModal: jest.fn(),
  onQuestionPileIndexChange: jest.fn(),
  onRefresh: jest.fn(),
  onResultsModeChange: jest.fn(),
  onSubmitAnswer: jest.fn(),
};

describe('OnePageSessionAgentShell', () => {
  it('attaches the pending Report target when authentication reveals its results section', async () => {
    const resultsSectionRef = jest.fn();
    const view = render(
      <OnePageSessionAgentShell {...baseProps} agentClientEnvelope={null} resultsSectionRef={resultsSectionRef} />,
    );
    expect(resultsSectionRef).not.toHaveBeenCalled();
    view.rerender(<OnePageSessionAgentShell {...baseProps} resultsSectionRef={resultsSectionRef} />);
    expect(resultsSectionRef).toHaveBeenLastCalledWith(screen.getByTestId('ce-session-agent-results'));
    expect(screen.getByTestId('ce-session-agent-results')).toHaveAttribute('id', 'report');
    await screen.findByTestId('agent-question-pile');
    view.unmount();
    expect(resultsSectionRef).toHaveBeenLastCalledWith(null);
  });

  it('states generated AI results are unsupported in the agent shell', async () => {
    render(<OnePageSessionAgentShell {...baseProps} />);

    expect(screen.getByTestId('ce-session-agent-generated-results-unsupported')).toHaveTextContent(
      'AI-generated Circles, Breakdown, and Risk Matrix views are not available in the agent web shell yet.',
    );
    await screen.findByTestId('agent-question-pile');
    expect(screen.queryByTestId('ce-session-generated-results-generate')).not.toBeInTheDocument();
  });
});
