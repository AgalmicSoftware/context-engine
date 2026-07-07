/** @file OnboardingWalkthrough.tsx */

import React, { Component } from 'react';

import { createLogger } from '../../utilities/logging';

import 'assets/css/contextEngine.scss';
import styles from './MainContent.module.scss';

import { Container } from 'reactstrap';

import SiteLoadOptions from '../InformationModals/SiteLoadOptions';
import { WELCOME_SLIDES, getWelcomeSlide } from './welcomeSlides.js';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const log = createLogger('ui');

type OnboardingWalkthroughProps = {
  changeTabFunction: (tabIndex: number) => void;
  demoMode?: unknown;
  toggleDemoMode?: (demoModeOn: boolean) => void;
};

type OnboardingWalkthroughState = {
  openSidebar: boolean;
  arrowIndex: number;
  numSlides: number;
};

class OnboardingWalkthrough extends Component<OnboardingWalkthroughProps, OnboardingWalkthroughState> {
  state: OnboardingWalkthroughState = {
    openSidebar: false,
    arrowIndex: 0,
    numSlides: WELCOME_SLIDES.length,
  };

  componentDidMount() {}

  componentDidUpdate() {}

  clickRightArrow = () => {
    this.setState({ arrowIndex: this.state.arrowIndex + 1 });
  };

  clickLeftArrow = () => {
    this.setState({ arrowIndex: this.state.arrowIndex - 1 });
  };

  clickFinalButton = () => {
    this.props.changeTabFunction(4);
  };

  toggleSidebar = () => {
    this.setState({ openSidebar: !this.state.openSidebar });
  };

  getOnboardingHeadline = () => {
    const title = getWelcomeSlide(this.state.arrowIndex)?.title || '';

    return title ? (
      <div className={styles.onboardingInfo}>
        <div className={styles.onboardingTitleArea}>
          <h2 className={styles.onboardingTitle}>{title}</h2>
        </div>
      </div>
    ) : null;
  };

  getLeftButton = () => {
    if (this.state.arrowIndex > 0) {
      return (
        <button className={styles.takeSurveyButton} onClick={this.clickLeftArrow} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon className={styles.takeSurveyIcon} icon={faArrowLeft} />
        </button>
      );
    } else {
      return <button className={styles.openSidebarButton}></button>;
    }
  };

  getRightButton = () => {
    if (this.state.arrowIndex < this.state.numSlides - 1) {
      return (
        <button className={styles.takeSurveyButton} onClick={this.clickRightArrow} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon className={styles.takeSurveyIcon} icon={faArrowRight} />
        </button>
      );
    } else {
      return (
        <button onClick={this.clickFinalButton} className={`${styles.openSidebarButton} ${styles.getStartedButton}`}>
          See Tools
        </button>
      );
    }
  };

  render() {
    const onboardingHeadline = this.getOnboardingHeadline();

    const leftButton = this.getLeftButton();
    const rightButton = this.getRightButton();

    return (
      <div className="block-gradient-slow">
        <Container className={styles.onboardingWalkthrough}>
          <div className={styles.onboardingInfo}>
            {onboardingHeadline}
            <SiteLoadOptions
              arrowIndex={this.state.arrowIndex}
              sidebarOpen={this.state.openSidebar}
              closeSidebarFunction={this.toggleSidebar}
              clickRightArrow={this.clickRightArrow}
              clickLeftArrow={this.clickLeftArrow}
            />
          </div>

          <div className={styles.onboardingControls}>
            <div className={styles.sidebarOpen}>{leftButton}</div>

            {rightButton}
          </div>
        </Container>
      </div>
    );
  }
}

export default OnboardingWalkthrough;
