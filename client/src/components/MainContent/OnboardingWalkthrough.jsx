/** @file OnboardingWalkthrough.jsx */

import React, { Component } from "react";

import { createLogger } from '../../utilities/logging';

import 'assets/css/contextEngine.scss';
import styles from "./MainContent.module.scss";

import { Container } from "reactstrap";

import SiteLoadOptions from '../InformationModals/SiteLoadOptions.jsx';
import { WELCOME_SLIDES, getWelcomeSlide } from './welcomeSlides.js';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const log = createLogger('ui');

class OnboardingWalkthrough extends Component {
    state = {
      openSidebar: false,
      arrowIndex: 0,
      numSlides: WELCOME_SLIDES.length,
    }

  componentDidMount() {}

  componentDidUpdate() {}

  clickRightArrow = () => {
    this.setState({ arrowIndex: this.state.arrowIndex + 1 });
  }

  clickLeftArrow = () => {
    this.setState({ arrowIndex: this.state.arrowIndex - 1 });
  }

  clickFinalButton = () => {
    this.props.changeTabFunction(4);
  }

  toggleSidebar = () => {
    this.setState({ openSidebar: !this.state.openSidebar });
  }

  getOnboardingHeadline = () => {
    const title = getWelcomeSlide(this.state.arrowIndex)?.title || '';
  
    return title ? (
      <div id={styles.onboardingInfo}>
        <div id={styles.onboardingTitleArea}>
          <h2 id={styles.onboardingTitle}>{title}</h2>
        </div>
      </div>
    ) : null;
  };
  
  getLeftButton = () => {
    if (this.state.arrowIndex > 0) {
      return (
        <button id={styles.takeSurveyButton} onClick={this.clickLeftArrow} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon id={styles.takeSurveyIcon} icon={faArrowLeft} />
        </button>
      );
    }
    else {
      return (
        <button id={styles.openSidebarButton}>
        </button>
      );
    }
  }
  
  getRightButton = () => {
    if (this.state.arrowIndex < this.state.numSlides - 1) {
      return (
        <button id={styles.takeSurveyButton} onClick={this.clickRightArrow} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon id={styles.takeSurveyIcon} icon={faArrowRight} />
        </button>
      );
    } else {
      return (
        <button onClick={this.clickFinalButton} id={styles.openSidebarButton} className={styles.getStartedButton}>
          See Tools
        </button>
      );
    }
  }
     

  render() {

    const onboardingHeadline = this.getOnboardingHeadline();

    const leftButton = this.getLeftButton();
    const rightButton = this.getRightButton();

    return (
      <div className="block-gradient-slow">
        <Container id={styles.onboardingWalkthrough}>

        <div id={styles.onboardingInfo}>
         { onboardingHeadline }
            <SiteLoadOptions
              arrowIndex={this.state.arrowIndex}
              sidebarOpen={this.state.openSidebar}
              closeSidebarFunction={this.toggleSidebar}
              clickRightArrow={this.clickRightArrow}
              clickLeftArrow={this.clickLeftArrow} />
        </div>

           <div id={styles.onboardingControls}>
            <div id={styles.sidebarOpen}>
               {  leftButton  }
            </div>

              { rightButton }

            </div>

        </Container>
      </div>
    );
  }
}

export default OnboardingWalkthrough;
