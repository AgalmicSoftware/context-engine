import { act, render, screen } from '@testing-library/react';
import ElapsedLoadingLabel from './ElapsedLoadingLabel';

it('counts seconds without changing the accessible label and cleans up on unmount', () => {
  jest.useFakeTimers();
  try {
    const { unmount } = render(
      <button>
        <ElapsedLoadingLabel label="Loading session data…" />
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Loading session data…' })).toHaveTextContent('0s');
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Loading session data…' })).toHaveTextContent('3s');
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('counts from the start it is given, for a task that began before it appeared', () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(50_000);
    render(<ElapsedLoadingLabel label="Building" since={20_000} />);
    expect(screen.getByText(/· 30s/)).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/· 32s/)).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
