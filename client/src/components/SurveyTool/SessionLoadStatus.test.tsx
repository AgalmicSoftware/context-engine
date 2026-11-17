import { act, render, screen } from '@testing-library/react';
import { SESSION_LOAD_GIVE_UP_MS, SessionLoadStatus } from './SessionLoadStatus';

describe('SessionLoadStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops saying "Loading session..." and offers a way back when the session never arrives', () => {
    render(<SessionLoadStatus />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading session...');
    act(() => {
      jest.advanceTimersByTime(SESSION_LOAD_GIVE_UP_MS);
    });
    expect(screen.queryByText('Loading session...')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent("This session hasn't loaded");
    expect(screen.getByRole('link', { name: 'Return to session selection' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/new$/),
    );
  });
});
