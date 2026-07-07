import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageMoreDetailsSection from './SbtPageMoreDetailsSection';

describe('SbtPageMoreDetailsSection', () => {
  it('renders relevant info when open and forwards toggle clicks', () => {
    const onToggle = jest.fn();

    render(
      <SbtPageMoreDetailsSection
        onToggle={onToggle}
        relevantInfo={<div data-testid="relevant-info">Details</div>}
        sectionHeaderClassName="section-header"
        toggleState={{ isOpen: true, shouldRenderOpenIcon: true }}
      />,
    );

    fireEvent.click(screen.getByRole('heading', { name: /MORE/i }));

    expect(screen.getByTestId('relevant-info')).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('hides relevant info when closed', () => {
    render(
      <SbtPageMoreDetailsSection
        relevantInfo={<div data-testid="relevant-info">Details</div>}
        toggleState={{ isOpen: false, shouldRenderClosedIcon: true }}
      />,
    );

    expect(screen.queryByTestId('relevant-info')).not.toBeInTheDocument();
  });
});
