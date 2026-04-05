import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CorpusViewer from './CorpusViewer.jsx';

describe('CorpusViewer', () => {
  it('maps legacy tweet debate tags into atlas issue links', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    const issueLink = screen.getAllByRole('link', { name: 'Exponential Progress Debate' })[0];
    const tweetCard = issueLink.closest('article');

    expect(tweetCard).toBeTruthy();
    expect(within(tweetCard).getByText('Debate Map')).toBeInTheDocument();
    expect(issueLink).toHaveAttribute(
      'href',
      '/atlas/0x2110000000000000000000000000000000000000000000000000000000000000?demo=1'
    );
  });
});
