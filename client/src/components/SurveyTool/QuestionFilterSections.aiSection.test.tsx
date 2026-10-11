import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuestionFilterAiSection } from './QuestionFilterSections';

jest.mock('../Shared/AudioInput/AudioInput', () => () => null);

const renderAiSection = (overrides: Partial<React.ComponentProps<typeof QuestionFilterAiSection>> = {}) =>
  render(
    <QuestionFilterAiSection
      activeAiTopN={0}
      aiAccessEnabled={false}
      aiApplyButtonLabel="Apply AI filter"
      aiApplyError=""
      aiApplying={false}
      aiCombineWithOtherFilters={false}
      aiControlsDisabled={true}
      aiDraftQuery=""
      aiRankingCount={10}
      aiSearchQuery=""
      aiSectionDisabled={false}
      expandedSections={{ ai: true }}
      isAiFilterApplied={false}
      isTopQuestionsModeActive={false}
      onAiCombineWithFiltersChange={jest.fn()}
      onAiDraftQueryChange={jest.fn()}
      onAiTopNChange={jest.fn()}
      onApplyAiFilter={jest.fn()}
      onToggleSection={jest.fn()}
      {...overrides}
    />,
  );

describe('QuestionFilterAiSection access hint', () => {
  it('asks signed-out visitors to sign in when AI is for participants only', () => {
    renderAiSection({ aiAccessNeedsSignIn: true });
    expect(screen.getByText('Sign in to use the AI filter.')).toBeInTheDocument();
    expect(screen.queryByText(/Configure AI access/)).not.toBeInTheDocument();
  });

  it('keeps the setup hint when no AI access is configured', () => {
    renderAiSection();
    expect(
      screen.getByText('AI filter unavailable. Configure AI access for this session or add a local API key.'),
    ).toBeInTheDocument();
  });

  it('shows no access hint once AI is available', () => {
    renderAiSection({ aiAccessEnabled: true, aiControlsDisabled: false });
    expect(screen.queryByText('Sign in to use the AI filter.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Configure AI access/)).not.toBeInTheDocument();
  });
});
