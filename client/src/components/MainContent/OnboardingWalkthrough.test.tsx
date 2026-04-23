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
      <button type="button" onClick={clickRightArrow}>Advance slide</button>
      <button type="button" onClick={clickLeftArrow}>Previous slide</button>
    </div>
  ),
}));

describe('OnboardingWalkthrough', () => {
  it('advances through welcome slides and opens the tools tab from the final slide', () => {
    const changeTabFunction = jest.fn();

    render(<OnboardingWalkthrough changeTabFunction={changeTabFunction} />);

    expect(screen.getByTestId('mock-site-load-options')).toHaveAttribute('data-arrow-index', '0');

    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));

    expect(screen.getByTestId('mock-site-load-options')).toHaveAttribute('data-arrow-index', '2');
    expect(screen.getByText('Goals')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));
    fireEvent.click(screen.getByText('Advance slide'));

    fireEvent.click(screen.getByText('See Tools'));

    expect(changeTabFunction).toHaveBeenCalledWith(4);
  });
});
