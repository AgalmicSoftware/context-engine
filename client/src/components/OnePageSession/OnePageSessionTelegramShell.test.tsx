import React from 'react';
import { render, screen } from '@testing-library/react';
import OnePageSessionTelegramShell from './OnePageSessionTelegramShell';

jest.mock('./telegram/TelegramQuestionPile', () => ({ __esModule: true, default: () => <div data-testid="telegram-question-pile" /> }));
jest.mock('./telegram/TelegramBucketCards', () => ({ __esModule: true, default: () => <div data-testid="telegram-bucket-cards" /> }));
jest.mock('./WorkerGroupMembershipPanel', () => ({ __esModule: true, default: () => <div data-testid="worker-group-membership-panel" /> }));

const baseProps = {
  account: '0xabc',
  blockLimits: {},
  contracts: {},
  defaultTags: [],
  disclaimersActive: true,
  displaySessionSlug: 'telegram-session',
  filterState: {},
  loginComplete: true,
  network: { id: 11155420 },
  networkChainId: 11155420,
  provider: 'wagmi',
  questionResponsesNonce: 0,
  questionScanProgress: null,
  resultsViewMode: 'polis',
  sessionHeader: 'Telegram Session',
  sessionInfo: 'Telegram shell',
  sessionName: 'Telegram Session',
  telegramAgentQuestions: [],
  telegramAgentQuestionsStatus: 'ready',
  telegramAgentResults: null,
  telegramAgentResultsStatus: 'ready',
  telegramClientEnvelope: {
    workerCredential: { token: 'worker-jwt' },
    bridgeCredential: { token: 'bridge-token' },
    capabilities: { submitAnswers: true },
  },
  telegramPolisDataset: null,
  telegramQuestionPileIndex: 0,
  telegramQuestionSubmitError: '',
  telegramSessionMeta: {},
  telegramSubmittedQuestionIds: [],
  telegramSubmittingQuestionId: '',
  workerGroupSessionId: '0x11111111111111111111111111111111',
  workerGroupWorkerUrl: 'https://worker.example',
  titleText: 'Telegram Session',
  onLogout: jest.fn(),
  onOpenLoginModal: jest.fn(),
  onQuestionPileIndexChange: jest.fn(),
  onRefresh: jest.fn(),
  onResultsModeChange: jest.fn(),
  onSubmitAnswer: jest.fn(),
};

describe('OnePageSessionTelegramShell', () => {
  it('states generated AI results are unsupported in the Telegram shell', () => {
    render(<OnePageSessionTelegramShell {...baseProps} />);

    expect(screen.getByTestId('ce-session-telegram-generated-results-unsupported')).toHaveTextContent(
      'AI-generated Circles, Breakdown, and Risk Matrix views are not available in the Telegram web shell yet.',
    );
    expect(screen.queryByTestId('ce-session-generated-results-generate')).not.toBeInTheDocument();
  });
});
