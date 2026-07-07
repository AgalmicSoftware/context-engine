import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import CETooltip from './CETooltip';

jest.mock('reactstrap', () => ({
  UncontrolledTooltip: ({ children, target }: { children: React.ReactNode; target: string }) => (
    <div data-testid="mock-ce-tooltip" data-target={target}>
      {children}
    </div>
  ),
}));

type TooltipState = {
  sessionState: {
    tooltipsEnabled: boolean;
  };
};

type TooltipAction = {
  type: string;
  payload: boolean;
};

const createTooltipStore = (tooltipsEnabled: boolean) =>
  createStore((state: TooltipState = { sessionState: { tooltipsEnabled } }, action: TooltipAction): TooltipState => {
    if (action.type === 'SET_TOOLTIPS') {
      return {
        sessionState: {
          tooltipsEnabled: action.payload,
        },
      };
    }

    return state;
  });

const renderWithTooltipsEnabled = (tooltipsEnabled: boolean) => {
  const store = createTooltipStore(tooltipsEnabled);

  return render(
    <Provider store={store}>
      <CETooltip target="provider-target">provider tooltip</CETooltip>
    </Provider>,
  );
};

describe('CETooltip', () => {
  it('falls back to rendering when no Redux provider is mounted', () => {
    render(<CETooltip target="fallback-target">fallback tooltip</CETooltip>);

    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-target', 'fallback-target');
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveTextContent('fallback tooltip');
  });

  it('does not render the tooltip when the preference is disabled', () => {
    renderWithTooltipsEnabled(false);

    expect(screen.queryByTestId('mock-ce-tooltip')).toBeNull();
  });

  it('renders the tooltip when the preference is enabled', () => {
    renderWithTooltipsEnabled(true);

    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-target', 'provider-target');
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveTextContent('provider tooltip');
  });

  it('removes orphan tooltip DOM nodes when the preference is disabled', async () => {
    const store = createTooltipStore(true);

    render(
      <Provider store={store}>
        <CETooltip target="provider-target">provider tooltip</CETooltip>
      </Provider>,
    );

    const visibleTooltip = document.createElement('div');
    visibleTooltip.className = 'tooltip show';
    document.body.appendChild(visibleTooltip);

    const fadingTooltip = document.createElement('div');
    fadingTooltip.className = 'tooltip fade';
    document.body.appendChild(fadingTooltip);

    act(() => {
      store.dispatch({ type: 'SET_TOOLTIPS', payload: false });
    });

    await waitFor(() => {
      expect(document.querySelector('.tooltip.show')).toBeNull();
      expect(document.querySelector('.tooltip.fade')).toBeNull();
    });
    expect(screen.queryByTestId('mock-ce-tooltip')).toBeNull();
  });
});
