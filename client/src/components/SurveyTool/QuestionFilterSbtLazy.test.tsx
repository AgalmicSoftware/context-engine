import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuestionFilterSbtSection } from './QuestionFilterSections';

jest.mock('../SBTs/SBTFilter', () => ({
  __esModule: true,
  default: (props: { mode?: string; sessionSlug?: string }) => (
    <div data-testid="sbt-filter-stub">
      {props.mode}:{props.sessionSlug}
    </div>
  ),
}));
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);

const baseProps = {
  disabled: false,
  disabledReason: 'Disabled for this session',
  expandedSections: { sbts: true },
  isSBTCacheReady: true,
  items: [],
  onFilter: jest.fn(),
  onToggleSection: jest.fn(),
  sbtFilterLocalState: null,
  sessionConfig: {},
  sessionSlug: 'chain-session',
  setFilterLoading: jest.fn(),
};

describe('lazy SBTFilter in QuestionFilterSbtSection', () => {
  it('shows the lazy fallback, then the SBT filter with its props', async () => {
    render(<QuestionFilterSbtSection {...baseProps} creatorAndResponderMode />);
    expect(screen.getByText('Loading groups...')).toBeInTheDocument();
    expect(await screen.findByTestId('sbt-filter-stub')).toHaveTextContent('creatorAndResponder:chain-session');
  });

  it('never loads the SBT filter when the section is disabled', () => {
    render(<QuestionFilterSbtSection {...baseProps} disabled />);
    expect(screen.getByText('Disabled for this session')).toBeInTheDocument();
    expect(screen.queryByTestId('sbt-filter-stub')).toBeNull();
  });
});
