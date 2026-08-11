import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../reducers/index.js';
import 'assets/css/contextEngine.scss';
import styles from './OnboardingOverlay.module.scss';
import { WELCOME_SLIDES, getWelcomeSlide } from '../MainContent/welcomeSlides.js';
import { ONBOARDING_COMPLETE_STORAGE_KEY } from './onboardingConfig.js';

const IMAGE_CLASS_BY_SLIDE_KEY: Record<string, string> = {
  intro: styles.mediaImageIntro,
  toolkit: styles.mediaImageToolkit,
  goals: styles.mediaImageGoals,
  'built-to-help': styles.mediaImageBuiltToHelp,
  because: styles.mediaImageBecause,
  'looking-for': styles.mediaImageLookingFor,
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

  const title = String(currentSlide.title || '').trim();
  const isLastSlide = onboardingStep >= WELCOME_SLIDES.length;
  const hasBackButton = onboardingStep > 1;
  const advanceOrComplete = () => {
    if (isLastSlide) {
      completeOnboarding();
      return;
    }
    goToNextStep();
  };
  const slideClickHandler = onboardingStep === 1 ? advanceOrComplete : undefined;
  const bulletPoints = Array.isArray(currentSlide?.bulletPoints)
    ? currentSlide.bulletPoints.filter((point: { bold?: string; text?: string }) => point?.bold || point?.text)
    : [];
  const slideLayout = String(currentSlide.mediaLayout || 'default').trim() || 'default';
  const slideKey = String(currentSlide.key || '').trim();
  const mediaButtonClassName = [
    styles.mediaButton,
    slideLayout === 'flushBottom' ? styles.mediaButtonFlushBottom : null,
    slideLayout === 'centered' ? styles.mediaButtonCentered : null,
  ]
    .filter(Boolean)
    .join(' ');
  const mediaImageClassName = [styles.mediaImage, IMAGE_CLASS_BY_SLIDE_KEY[slideKey] || ''].filter(Boolean).join(' ');
  const controlsClassName = [
    styles.onboardingControls,
    hasBackButton ? styles.onboardingControlsDualArrow : styles.onboardingControlsSingleArrow,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.overlay} data-testid="ce-onboarding-overlay">
      <div className={`block-gradient-slow ${styles.panelFrame}`}>
        <div className={styles.panel} data-slide-key={slideKey} data-slide-layout={slideLayout}>
          <button type="button" className={styles.skipButton} onClick={completeOnboarding}>
            Skip
          </button>

          <div
            className={styles.onboardingWalkthrough}
            data-testid={`ce-onboarding-step-${onboardingStep}`}
            data-slide-key={slideKey}
            data-slide-layout={slideLayout}
          >
            <div className={styles.onboardingInfo}>
              {title ? (
                <div className={styles.onboardingTitleArea}>
                  <h2 className={styles.onboardingTitle} data-testid="ce-onboarding-title">
                    {title}
                  </h2>
                </div>
              ) : null}

              <div
                className={styles.deck}
                data-testid="ce-onboarding-deck"
                data-slide-key={slideKey}
                data-slide-layout={slideLayout}
              >
                <button
                  type="button"
                  className={mediaButtonClassName}
                  data-testid="ce-onboarding-media"
                  data-ce-control-appearance="frameless"
                  data-slide-key={slideKey}
                  data-slide-layout={slideLayout}
                  onClick={slideClickHandler || undefined}
                >
                  <img
                    className={mediaImageClassName}
                    src={currentSlide.image}
                    alt={currentSlide.imageAlt || title || 'Welcome slide'}
                    data-slide-key={slideKey}
                    data-slide-layout={slideLayout}
                  />
                </button>

                <div
                  className={[styles.bulletListContainer, !title ? styles.titlelessBulletListContainer : '']
                    .filter(Boolean)
                    .join(' ')}
                  data-testid="ce-onboarding-bullet-container"
                  style={{ display: bulletPoints.length > 0 ? 'flex' : 'none' }}
                >
                  <ul className={styles.bulletList} data-testid="ce-onboarding-bullets">
                    {bulletPoints.map((point: { bold?: string; text?: string }, index: number) => (
                      <li key={`${slideKey}-${index}`}>
                        <h4 className={styles.bulletText}>
                          {point.bold ? <strong>{point.bold}</strong> : null}
                          {point.bold && point.text ? ' ' : null}
                          {point.text ? <span className={styles.bulletTrailing}>{point.text}</span> : null}
                        </h4>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className={controlsClassName} data-testid="ce-onboarding-controls">
              {hasBackButton ? (
                <div className={styles.controlSlot} data-testid="ce-onboarding-control-slot">
                  <button
                    type="button"
                    className={styles.takeSurveyButton}
                    data-ce-control-appearance="frameless"
                    onClick={goToPreviousStep}
                    aria-label="Back"
                  >
                    <FontAwesomeIcon className={styles.takeSurveyIcon} icon={faArrowLeft} />
                  </button>
                </div>
              ) : (
                <div
                  className={[styles.controlSlot, styles.controlSlotPlaceholder].filter(Boolean).join(' ')}
                  data-testid="ce-onboarding-control-placeholder"
                  aria-hidden="true"
                />
              )}

              <div className={styles.controlSlot} data-testid="ce-onboarding-control-slot">
                <button
                  type="button"
                  className={styles.takeSurveyButton}
                  data-ce-control-appearance="frameless"
                  onClick={advanceOrComplete}
                  aria-label={isLastSlide ? 'Complete onboarding' : 'Next'}
                >
                  <FontAwesomeIcon className={styles.takeSurveyIcon} icon={faArrowRight} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
