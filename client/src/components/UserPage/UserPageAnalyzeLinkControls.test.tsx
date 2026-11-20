import { act, fireEvent, render, screen } from '@testing-library/react';

import { ANALYZE_LINK_SETTLE_MS, AnalyzeLinkArrival, AnalyzeUserButton } from './UserPageAnalyzeLinkControls';
import { openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

jest.mock('./userPageAnalyzeLink', () => ({
  openAnalyzeLink: jest.fn(),
  takeAnalyzeLinkArrival: jest.fn(),
}));

const take = takeAnalyzeLinkArrival as jest.Mock;

describe('Analyze user button and arrival', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    take.mockReset();
    (openAnalyzeLink as jest.Mock).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the link it was given', () => {
    render(<AnalyzeUserButton href="/u/0xaa?session=demo-one&analyze=1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze user' }));
    expect(openAnalyzeLink).toHaveBeenCalledWith('/u/0xaa?session=demo-one&analyze=1');
  });

  it("shows the site's AI icon, not a search icon", () => {
    render(<AnalyzeUserButton href="/u/0xaa?analyze=1" />);
    const row = screen.getByRole('button', { name: 'Analyze user' });
    expect(row.querySelector('svg')).toHaveAttribute('data-icon', 'robot');
  });

  it('starts Analyze once, after the page has stayed ready', () => {
    take.mockReturnValue(60_000);
    const onStart = jest.fn();
    const { rerender } = render(<AnalyzeLinkArrival ready={false} onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(5000));
    expect(onStart).not.toHaveBeenCalled();

    // Ready, then not: the wait starts over.
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS - 1));
    rerender(<AnalyzeLinkArrival ready={false} onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(onStart).not.toHaveBeenCalled();

    const later = jest.fn();
    rerender(<AnalyzeLinkArrival ready onStart={later} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(later).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();

    rerender(<AnalyzeLinkArrival ready={false} onStart={later} />);
    rerender(<AnalyzeLinkArrival ready onStart={later} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(later).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('starts nothing where the button was not pressed', () => {
    take.mockReturnValue(0);
    const onStart = jest.fn();
    render(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts nothing where the page became ready too late', () => {
    take.mockReturnValue(12_000);
    const onStart = jest.fn();
    const { rerender } = render(<AnalyzeLinkArrival ready={false} onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(3000));
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(onStart).not.toHaveBeenCalled();
  });
});
