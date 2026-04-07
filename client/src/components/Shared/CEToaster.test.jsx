import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CEToaster from './CEToaster.jsx';
import { showToast } from '../../utilities/ui/toastBus.js';

describe('CEToaster', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders emitted toasts and auto-dismisses them after their duration', () => {
    render(<CEToaster toastOptions={{ style: { background: '#111', color: '#fff' } }} />);

    act(() => {
      showToast('Saved locally', { kind: 'success', duration: 1000 });
    });

    expect(screen.getByText('Saved locally')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Saved locally')).not.toBeInTheDocument();
  });

  it('lets the user dismiss an active toast immediately', () => {
    render(<CEToaster />);

    act(() => {
      showToast('Dismiss me', { kind: 'info', duration: 5000 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification: Dismiss me' }));

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });
});
