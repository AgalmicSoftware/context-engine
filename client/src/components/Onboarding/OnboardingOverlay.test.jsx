import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import OnboardingOverlay from './OnboardingOverlay.jsx';
import { ONBOARDING_COMPLETE_STORAGE_KEY } from './onboardingConfig.js';

const buildStore = (initialStep = 1) =>
  createStore((state = { sessionState: { onboardingStep: initialStep } }, action) => {
    if (action.type === 'SET_ONBOARDING_STEP') {
      return {
        ...state,
        sessionState: {
          ...state.sessionState,
          onboardingStep: action.payload,
        },
      };
    }

    return state;
  });

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
  });

  it('renders the shared Welcome slide deck and advances between slides', async () => {
    const store = buildStore(2);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>
    );

    expect(screen.getByTestId('ce-onboarding-step-2')).toBeInTheDocument();
    expect(screen.getByText('What Is Context Engine?')).toBeInTheDocument();
    expect(screen.getByText(/A toolkit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTestId('ce-onboarding-step-3')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText(/Creating open-source templates/i)).toBeInTheDocument();
  });

  it('marks onboarding complete when the final slide is accepted', async () => {
    const store = buildStore(6);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(window.localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY)).toBe('true');
    expect(store.getState().sessionState.onboardingStep).toBeNull();
    expect(screen.queryByTestId('ce-onboarding-overlay')).not.toBeInTheDocument();
  });
});
