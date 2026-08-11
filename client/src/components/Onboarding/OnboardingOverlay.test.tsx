import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import OnboardingOverlay from './OnboardingOverlay';
import { ONBOARDING_COMPLETE_STORAGE_KEY } from './onboardingConfig.js';
import styles from './OnboardingOverlay.module.scss';

type TestState = {
  sessionState: {
    onboardingStep: number | null;
  };
};

type TestAction = {
  type: string;
  payload?: number | null;
};

const buildStore = (initialStep = 1) =>
  createStore((state: TestState = { sessionState: { onboardingStep: initialStep } }, action: TestAction) => {
    if (action.type === 'SET_ONBOARDING_STEP') {
      return {
        ...state,
        sessionState: {
          ...state.sessionState,
          onboardingStep: action.payload ?? null,
        },
      };
    }

    return state;
  });

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
  });

  it('duplicates the full walkthrough intro layout while keeping modal-specific controls', async () => {
    const store = buildStore(1);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>,
    );

    const greetingImage = screen.getByAltText('Context Engine welcome slide');
    const mediaButton = screen.getByTestId('ce-onboarding-media');
    const deck = screen.getByTestId('ce-onboarding-deck');
    const controls = screen.getByTestId('ce-onboarding-controls');
    const controlSlots = screen.getAllByTestId('ce-onboarding-control-slot');
    const controlPlaceholder = screen.getByTestId('ce-onboarding-control-placeholder');

    expect(screen.getByTestId('ce-onboarding-step-1')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-onboarding-title')).not.toBeInTheDocument();
    expect(deck).toHaveAttribute('data-slide-key', 'intro');
    expect(deck).toHaveAttribute('data-slide-layout', 'flushBottom');
    expect(mediaButton).toHaveAttribute('data-slide-layout', 'flushBottom');
    expect(mediaButton).toHaveAttribute('data-ce-control-appearance', 'frameless');
    expect(greetingImage).toHaveAttribute('data-slide-layout', 'flushBottom');
    expect(controls.className).toContain(styles.onboardingControlsSingleArrow);
    expect(controlSlots).toHaveLength(1);
    expect(controls).toContainElement(controlPlaceholder);
    expect(controlPlaceholder.className).toContain(styles.controlSlotPlaceholder);
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();

    fireEvent.click(controlPlaceholder);

    expect(store.getState().sessionState.onboardingStep).toBe(1);
  });

  it('keeps the titleless toolkit slide and advances with the shared arrow pattern', async () => {
    const store = buildStore(2);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>,
    );

    expect(screen.getByTestId('ce-onboarding-step-2')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-onboarding-title')).not.toBeInTheDocument();

    const robotImage = screen.getByAltText('Context Engine toolkit slide');
    const mediaButton = screen.getByTestId('ce-onboarding-media');
    const bulletList = screen.getByTestId('ce-onboarding-bullets');
    const bulletContainer = screen.getByTestId('ce-onboarding-bullet-container');
    const controls = screen.getByTestId('ce-onboarding-controls');
    const controlSlots = screen.getAllByTestId('ce-onboarding-control-slot');
    const nextButton = screen.getByRole('button', { name: 'Next' });

    expect(mediaButton).toHaveAttribute('data-slide-key', 'toolkit');
    expect(mediaButton).toHaveAttribute('data-slide-layout', 'centered');
    expect(robotImage).toHaveAttribute('data-slide-layout', 'centered');
    expect(robotImage.className).toContain(styles.mediaImageToolkit);
    expect(bulletList.tagName).toBe('UL');
    expect(bulletContainer.className).toMatch(/titlelessBulletListContainer/);
    expect(controls.className).toContain(styles.onboardingControlsDualArrow);
    expect(controlSlots).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute(
      'data-ce-control-appearance',
      'frameless',
    );
    expect(nextButton).toHaveAttribute('data-ce-control-appearance', 'frameless');
    expect(screen.getByText(/A toolkit/i)).toBeInTheDocument();

    fireEvent.click(nextButton);

    expect(screen.getByTestId('ce-onboarding-step-3')).toBeInTheDocument();
    expect(screen.getByTestId('ce-onboarding-title')).toHaveTextContent('Goals');
    expect(screen.getByText(/Open-source templates/i)).toBeInTheDocument();
    expect(screen.getByAltText('Context Engine goals slide').className).toContain(styles.mediaImageGoals);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTestId('ce-onboarding-step-4')).toBeInTheDocument();
    expect(screen.getByAltText('Context Engine people helped slide').className).toContain(styles.mediaImageBuiltToHelp);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTestId('ce-onboarding-step-5')).toBeInTheDocument();
    expect(screen.getByAltText('Context Engine motivation slide').className).toContain(styles.mediaImageBecause);
  });

  it('lets the user skip the shared overlay deck from any step', async () => {
    const store = buildStore(3);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(window.localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY)).toBe('true');
    expect(store.getState().sessionState.onboardingStep).toBeNull();
    expect(screen.queryByTestId('ce-onboarding-overlay')).not.toBeInTheDocument();
  });

  it('marks onboarding complete when the final arrow is accepted', async () => {
    const store = buildStore(6);

    render(
      <Provider store={store}>
        <OnboardingOverlay />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Complete onboarding' }));

    expect(window.localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY)).toBe('true');
    expect(store.getState().sessionState.onboardingStep).toBeNull();
    expect(screen.queryByTestId('ce-onboarding-overlay')).not.toBeInTheDocument();
  });
});
