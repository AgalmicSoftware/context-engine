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
