import { act, fireEvent, render, screen } from '@testing-library/react';

import { ANALYZE_LINK_SETTLE_MS, AnalyzeLinkArrival, AnalyzeMeButton } from './UserPageAnalyzeLinkControls';
import { openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

jest.mock('./userPageAnalyzeLink', () => ({
  ANALYZE_LINK_EVENT: 'ce:analyze-link',
  openAnalyzeLink: jest.fn(),
  takeAnalyzeLinkArrival: jest.fn(),
}));

const take = takeAnalyzeLinkArrival as jest.Mock;

describe('Analyze me button and arrival', () => {
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
    render(<AnalyzeMeButton href="/u/0xaa?session=demo-one&analyze=1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze me' }));
    expect(openAnalyzeLink).toHaveBeenCalledWith('/u/0xaa?session=demo-one&analyze=1');
  });

  it('closes the dialog only where my page opened inside the app', () => {
    const onOpened = jest.fn();
    render(<AnalyzeMeButton href="/u/0xaa?analyze=1" onOpened={onOpened} />);
    for (const outcome of ['new-tab', 'same-tab', 'none']) {
      (openAnalyzeLink as jest.Mock).mockReturnValue(outcome);
      fireEvent.click(screen.getByRole('button', { name: 'Analyze me' }));
    }
    expect(onOpened).not.toHaveBeenCalled();
    (openAnalyzeLink as jest.Mock).mockReturnValue('in-app');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze me' }));
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it("shows the site's AI wand, not a search icon", () => {
    render(<AnalyzeMeButton href="/u/0xaa?analyze=1" />);
    const row = screen.getByRole('button', { name: 'Analyze me' });
    expect(row.querySelector('svg')).toHaveAttribute('data-icon', 'magic');
  });

  it('starts Analyze at once on a page that is ready as it opens', () => {
    take.mockReturnValue(60_000);
    const onStart = jest.fn();
    const { rerender } = render(<AnalyzeLinkArrival ready onStart={onStart} />);
    expect(onStart).toHaveBeenCalledTimes(1);

    rerender(<AnalyzeLinkArrival ready={false} arriving onStart={onStart} />);
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('starts as soon as a page with its answers loaded has drawn its lists', () => {
    take.mockReturnValue(60_000);
    const onStart = jest.fn();
    const { rerender } = render(<AnalyzeLinkArrival ready={false} onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(5000));
    expect(onStart).not.toHaveBeenCalled();
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('waits for the page to stay ready where answers were still arriving', () => {
    take.mockReturnValue(60_000);
    const onStart = jest.fn();
    const { rerender } = render(<AnalyzeLinkArrival ready={false} arriving onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(5000));
    expect(onStart).not.toHaveBeenCalled();

    // Ready, then not: the wait starts over.
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS - 1));
    rerender(<AnalyzeLinkArrival ready={false} arriving onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(onStart).not.toHaveBeenCalled();

    const later = jest.fn();
    rerender(<AnalyzeLinkArrival ready onStart={later} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS - 1));
    expect(later).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(1));
    expect(later).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();

    rerender(<AnalyzeLinkArrival ready={false} arriving onStart={later} />);
    rerender(<AnalyzeLinkArrival ready onStart={later} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(later).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('tells the button a press is waiting, until Analyze starts, is pressed by hand, or the time is up', () => {
    const draw = (starting: boolean, startedByHand: () => void) => (
      <button onClick={startedByHand}>{starting ? 'Starting' : 'Analyze'}</button>
    );
    const arrive = (onStart: () => void) =>
      render(
        <AnalyzeLinkArrival ready={false} arriving onStart={onStart}>
          {draw}
        </AnalyzeLinkArrival>,
      );

    // No press: the button is its usual self.
    take.mockReturnValue(0);
    const none = arrive(jest.fn());
    expect(screen.getByRole('button')).toHaveTextContent('Analyze');
    none.unmount();

    // Waiting, then started.
    take.mockReturnValue(60_000);
    const started = jest.fn();
    const first = arrive(started);
    expect(screen.getByRole('button')).toHaveTextContent('Starting');
    first.rerender(
      <AnalyzeLinkArrival ready onStart={started}>
        {draw}
      </AnalyzeLinkArrival>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Starting');
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(started).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveTextContent('Analyze');
    first.unmount();

    // Pressed by hand while waiting: the press by hand is the only start.
    const byItself = jest.fn();
    const second = arrive(byItself);
    fireEvent.click(screen.getByRole('button', { name: 'Starting' }));
    expect(screen.getByRole('button')).toHaveTextContent('Analyze');
    second.rerender(
      <AnalyzeLinkArrival ready onStart={byItself}>
        {draw}
      </AnalyzeLinkArrival>,
    );
    act(() => void jest.advanceTimersByTime(60_000));
    expect(byItself).not.toHaveBeenCalled();
    second.unmount();

    // Never ready in time: the button stops saying it will start.
    take.mockReturnValue(Date.now() + 2000);
    const late = jest.fn();
    arrive(late);
    expect(screen.getByRole('button')).toHaveTextContent('Starting');
    act(() => void jest.advanceTimersByTime(2001));
    expect(screen.getByRole('button')).toHaveTextContent('Analyze');
    expect(late).not.toHaveBeenCalled();
  });

  it('starts again from a press made while the page is on screen', () => {
    take.mockReturnValue(0);
    const onStart = jest.fn();
    render(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(onStart).not.toHaveBeenCalled();

    for (const starts of [1, 2]) {
      take.mockReturnValue(Date.now() + 60_000);
      act(() => void window.dispatchEvent(new Event('ce:analyze-link')));
      expect(onStart).toHaveBeenCalledTimes(starts);
    }
    expect(take).toHaveBeenCalledTimes(3);
  });

  it('leaves the note to the page that opens, where the press replaces this one', () => {
    take.mockReturnValue(0);
    const { unmount } = render(<AnalyzeLinkArrival ready onStart={jest.fn()} />);
    expect(take).toHaveBeenCalledTimes(1);
    // The press and the page swap land in one update, as they do in the app.
    act(() => {
      window.dispatchEvent(new Event('ce:analyze-link'));
      unmount();
    });
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('drops the press where the page has loaded and Analyze cannot be pressed', () => {
    take.mockReturnValue(60_000);
    const onStart = jest.fn();
    const draw = (starting: boolean) => <button>{starting ? 'Starting' : 'Analyze'}</button>;
    const page = (props: { ready?: boolean; stuck?: boolean }) => (
      <AnalyzeLinkArrival ready={!!props.ready} stuck={!!props.stuck} onStart={onStart}>
        {draw}
      </AnalyzeLinkArrival>
    );
    const { rerender } = render(page({}));
    // Stuck for a moment, as a page is between its lists: the press still waits.
    rerender(page({ stuck: true }));
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS - 1));
    rerender(page({}));
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(screen.getByRole('button')).toHaveTextContent('Starting');
    // Stuck for good: nothing to analyze. The button is itself again and nothing starts later.
    rerender(page({ stuck: true }));
    act(() => void jest.advanceTimersByTime(ANALYZE_LINK_SETTLE_MS));
    expect(screen.getByRole('button')).toHaveTextContent('Analyze');
    rerender(page({ ready: true }));
    act(() => void jest.advanceTimersByTime(60_000));
    expect(onStart).not.toHaveBeenCalled();
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
    const { rerender } = render(<AnalyzeLinkArrival ready={false} arriving onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(3000));
    rerender(<AnalyzeLinkArrival ready onStart={onStart} />);
    act(() => void jest.advanceTimersByTime(60_000));
    expect(onStart).not.toHaveBeenCalled();
  });
});
