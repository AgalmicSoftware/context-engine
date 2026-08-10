import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OnboardingWalkthrough from './OnboardingWalkthrough';

jest.mock('../InformationModals/SiteLoadOptions', () => ({
  __esModule: true,
  default: ({
    arrowIndex,
    clickRightArrow,
    clickLeftArrow,
  }: {
    arrowIndex: number;
    clickRightArrow: () => void;
    clickLeftArrow?: () => void;
  }) => (
    <div data-testid="mock-site-load-options" data-arrow-index={arrowIndex}>
      <button type="button" onClick={clickRightArrow}>
        Advance slide
      </button>
      <button type="button" onClick={clickLeftArrow}>
        Previous slide
      </button>
    </div>
  ),
}));

describe('OnboardingWalkthrough', () => {
  it('advances through welcome slides and opens the tools tab from the final slide', () => {
    const changeTabFunction = jest.fn();

    const { container } = render(<OnboardingWalkthrough changeTabFunction={changeTabFunction} />);

    expect(screen.getByTestId('mock-site-load-options')).toHaveAttribute('data-arrow-index', '0');
    expect(container.querySelector('.welcomeArtworkStage')).toBeInTheDocument();
    expect(container.querySelector('.onboardingWalkthrough')).toBeInTheDocument();
    expect(container.querySelector('.onboardingInfo')).toBeInTheDocument();
    expect(container.querySelector('.onboardingControls')).toBeInTheDocument();
    expect(container.querySelector('.sidebarOpen')).toBeInTheDocument();
    expect(container.querySelector('.openSidebarButton')).toBeInTheDocument();
    expect(container.querySelector('.takeSurveyButton')).toBeInTheDocument();
    expect(container.querySelector('.takeSurveyIcon')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));

    expect(screen.getByTestId('mock-site-load-options')).toHaveAttribute('data-arrow-index', '2');
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(container.querySelector('.onboardingTitleArea')).toBeInTheDocument();
    expect(container.querySelector('.onboardingTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));

    const seeToolsButton = screen.getByRole('button', { name: 'See Tools' });

    expect(seeToolsButton).toHaveClass('openSidebarButton', 'getStartedButton');

    fireEvent.click(seeToolsButton);

    expect(changeTabFunction).toHaveBeenCalledWith(4);
  });
});
