import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from 'reactstrap';
import styles from './OnboardingOverlay.module.scss';
import { WELCOME_SLIDES, getWelcomeSlide } from '../MainContent/welcomeSlides.js';
import { ONBOARDING_COMPLETE_STORAGE_KEY } from './onboardingConfig.js';

type RootState = {
  sessionState: {
    onboardingStep?: number | null;
  };
};

const OnboardingOverlay = () => {
  const dispatch = useDispatch();
  const onboardingStep = useSelector((state: RootState) => state.sessionState.onboardingStep);
  const slideIndex = onboardingStep != null ? Math.max(0, onboardingStep - 1) : 0;
  const currentSlide = getWelcomeSlide(slideIndex);

  if (onboardingStep == null || !currentSlide) {
    return null;
  }

  const completeOnboarding = () => {
    try {
      window.localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
    } catch (_) {}

    dispatch({ type: 'SET_ONBOARDING_STEP', payload: null });
  };

  const goToNextStep = () => {
    if (onboardingStep >= WELCOME_SLIDES.length) {
      completeOnboarding();
      return;
    }

    dispatch({ type: 'SET_ONBOARDING_STEP', payload: onboardingStep + 1 });
  };

  const goToPreviousStep = () => {
    if (onboardingStep <= 1) return;
    dispatch({ type: 'SET_ONBOARDING_STEP', payload: onboardingStep - 1 });
  };

  const bulletPoints = (currentSlide.bulletPoints || []).filter((point: { bold?: string; text?: string }) => (
    point.bold || point.text
  ));

  return (
    <div className={styles.overlay} data-testid='ce-onboarding-overlay'>
      <div className={styles.card}>
        <div className={styles.stepLabel}>
          Welcome Slides • {onboardingStep} of {WELCOME_SLIDES.length}
        </div>

        <div className={styles.dots}>
          {WELCOME_SLIDES.map((slide, index) => (
            <span
              key={slide.key}
              className={`${styles.dot} ${index === onboardingStep - 1 ? styles.dotActive : ''}`.trim()}
            />
          ))}
        </div>

        <div data-testid={`ce-onboarding-step-${onboardingStep}`}>
          <div className={styles.title}>{currentSlide.overlayTitle || currentSlide.title || 'Context Engine'}</div>
          <div className={styles.slideFrame}>
            <div className={styles.mediaPanel}>
              <img className={styles.slideImage} src={currentSlide.image} alt={currentSlide.imageAlt} />
            </div>
            {bulletPoints.length > 0 ? (
              <ul className={styles.bulletList}>
                {bulletPoints.map((point) => (
                  <li key={`${point.bold}-${point.text}`} className={styles.bulletItem}>
                    {point.bold ? <strong>{point.bold}</strong> : null}
                    {point.bold && point.text ? ' ' : ''}
                    {point.text}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.slideCaption}>
                Start on the Welcome tab, then page through the current Context Engine intro deck.
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttons}>
          <Button className={styles.backButton} onClick={goToPreviousStep} disabled={onboardingStep <= 1}>
            Back
          </Button>
          <Button className={styles.skipButton} onClick={completeOnboarding}>
            Skip
          </Button>
          <Button className={styles.nextButton} onClick={goToNextStep}>
            {onboardingStep === WELCOME_SLIDES.length ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
