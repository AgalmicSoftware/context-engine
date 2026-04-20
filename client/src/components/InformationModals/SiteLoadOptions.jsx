/** @file SiteLoadOptions.jsx */
import React, { Component } from "react";
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { fetchSessionState } from '../../actions/sessionStateActions.js';
import { getWelcomeSlide } from '../MainContent/welcomeSlides.js';

// CSS and images
import "assets/css/contextEngine.scss";
import styles from "./Modals.module.scss";

// Reactstrap components
import { Card, CardFooter } from "reactstrap";

// Components
import GreetingModal from './GreetingModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWindowClose, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { createLogger } from 'utilities/logging.js';

const uiLog = createLogger('ui');



class SiteLoadOptions extends Component {
  state = {
    explainerModalOpen: false,
    sidebarNotClosed: false,
    userOptsOutMetrics: true,
    metricsDetailsSelected: false,
  }

  componentDidMount() {
    this.setState({ sidebarNotClosed: true });
  };

  componentWillUnmount() {
  };

  componentDidUpdate() {
    if (this.state.sidebarNotClosed !== this.props.sidebarOpen) {
      this.setState({ sidebarNotClosed: this.props.sidebarOpen });
    }
  };

  toggleSidebar = () => {
    this.setState({ sidebarNotClosed: !this.state.sidebarNotClosed });
  };

  optOutChanged = () => {
    uiLog.log("metrics opt-out state changed to: " + !this.state.userOptsOutMetrics)
    this.setState({ userOptsOutMetrics: !this.state.userOptsOutMetrics });

    if (!this.state.userOptsOutMetrics) {
    }

    else {
    }
  };

  closeBetaSidebar = () => {
    this.setState({ sidebarNotClosed: false });

    if (this.props.sidebarOpen) {
      this.props.closeSidebarFunction();
    }
  };

  toggleExplainerModal = (arrowIndex) => {
  };

  openExplainerModal = () => {
    this.setState({ explainerModalOpen: true });
  }

  closeExplainerModal = () => {
    this.setState({ explainerModalOpen: false })
  };

  // If someone clicks question mark next to metrics tracking option,
  // they will see the details of what data is being tracked or used
  toggleMetricsDetails = () => {
    uiLog.log("METRICS TOGGLED:" + this.state.metricsDetailsSelected)
    this.setState({ metricsDetailsSelected: !this.state.metricsDetailsSelected });
  }

  getExplainerText = () => {
    const currentSlide = getWelcomeSlide(this.props.arrowIndex);
    const isTitlelessSlide = !String(currentSlide?.title || '').trim();

    // Create an empty array to hold JSX elements
    let bulletPointElements = [];
    let allEmpty = true;

    // Loop through bulletPoints and create JSX elements
    if (currentSlide?.bulletPoints) {
      for (let i = 0; i < currentSlide.bulletPoints.length; i++) {
        const point = currentSlide.bulletPoints[i];

        if (point.bold !== '' || point.text !== '') {
          allEmpty = false;
        }

        const displayStyle = point.bold === '' && point.text === '' ? 'none' : 'list-item';
        const element = (
          <li key={i} style={{ display: displayStyle }}>
            <h4 id={styles.betaExplainerBulletText}>
              {point.bold ? <strong>{point.bold}</strong> : null}
              {point.bold && point.text ? ' ' : null}
              {point.text ? (
                <span className={styles.betaExplainerBulletTrailingText}>
                  {point.text}
                </span>
              ) : null}
            </h4>
          </li>
        );
        bulletPointElements.push(element);
      }
    }

    const listDisplayStyle = allEmpty ? 'none' : 'flex';

    // Log the resulting JSX to the console for inspection
    uiLog.log("Bullet Point JSX Elements:", bulletPointElements);

    // Return JSX
    return (
      <>
        <div
          id={styles.betaExaplainerList}
          className={isTitlelessSlide ? styles.titlelessBulletListContainer : ''}
          style={{ display: listDisplayStyle }}
        >
          <ul id={styles.betaExplainerBulletpoint}>
            { bulletPointElements }
          </ul>
        </div>
      </>
    );
  };


  render() {

    // If exit button is hit, sidebar disappears
    const sidebarExited = !this.state.sidebarNotClosed;

    const sidebarVisibleClassname = sidebarExited ? styles.betaSidebarDisappeared : styles.betaTabSideBar;

    // Explanation modal (only seen on first site-load)

    const closeModalIcon = faWindowClose;

    const closeMetricsDetailsIcon = faWindowClose;
    const questionMarkMetricsIcon =
    <button id={styles.metricDetailsButton} onClick={this.toggleMetricsDetails}>
      <FontAwesomeIcon icon={faQuestionCircle} id={styles.metricsInfoIcon} />
    </button>

    const metricsDetailsID = this.state.metricsDetailsSelected ? styles.visibleMetricsDetails : styles.invisibleMetricsDetails;

    // Style here because it overlaps with another style (#siteExplainer) in .scss module
    const explainerButtonStyle = {
      marginTop: "0px",
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      padding: "0px",
    };

    const currentSlide = getWelcomeSlide(this.props.arrowIndex);
    const slideLayout = currentSlide?.mediaLayout || 'default';
    const slideButtonClickHandler = this.props.arrowIndex === 0
      ? this.props.clickRightArrow
      : () => this.toggleExplainerModal(this.props.arrowIndex);
    const siteExplainerButton = currentSlide ? (
      <button
        id={styles[currentSlide.buttonStyleId]}
        className={styles.siteExplainerButton}
        style={explainerButtonStyle}
        data-slide-key={currentSlide.key}
        data-slide-layout={slideLayout}
        onClick={slideButtonClickHandler}
      >
        <img
          src={currentSlide.image}
          alt={currentSlide.imageAlt || currentSlide.overlayTitle || currentSlide.title || 'Welcome slide'}
          id={styles[currentSlide.imageStyleId]}
          data-slide-layout={slideLayout}
        />
      </button>
    ) : null;
    uiLog.log("uiLog.log(currentSlide.bulletPoints)");
    uiLog.log(currentSlide?.bulletPoints);

    const siteExplainerText = this.getExplainerText();
    uiLog.log("uiLog.log(siteExplainerText)");
    uiLog.log(siteExplainerText);

    const explainerStyle = currentSlide?.textAlign === "right" ?  styles.explainerAndUpdates : styles.explainerAndUpdates;


    const metricsDetailExplainer =
    <Card id={metricsDetailsID}>
      <div id={styles.metricsDetailsTitle}>
        <div id={styles.emailFormLabel}>
          Web3 = control over your data

          <div id={styles.metricsDetailsSubtitle}>
          </div>
        </div>
        </div>


    <div id={styles.metricsDetailsPoints}>

      <div id={styles.emailSubjects}>

      <div id={styles.metricsCollectedText}>
                Metrics:
      </div>

        <div className={styles.emailSubject}>
        — UX Interacts
        </div>

        <div className={styles.emailSubject}>
        — Screen Size
        </div>

        <div className={styles.emailSubject}>
        — Region
        </div>

      </div>

      <div id={styles.metricsDetailsButtons}>


        <button id={styles.closeModalButton} aria-label="Close" className="close" data-dismiss="modal" type="button" onClick={this.toggleMetricsDetails}>
                <FontAwesomeIcon icon={closeMetricsDetailsIcon} id={styles.closeModalIcon}  />
        </button>

      </div>

    </div>

    </Card>

    const explainModal =
    <>
    <GreetingModal visible={this.state.explainerModalOpen} closeExplainerFunction={this.closeExplainerModal}/>
        <div id={styles.betaInfoEmbed}>

          <CardFooter id={explainerStyle}>

      <div id={sidebarVisibleClassname}>


          { metricsDetailExplainer }

          <button
            id={styles.closeModalButton}
            data-testid="ce-site-load-close-sidebar"
            aria-label="Close"
            className="close"
            data-dismiss="modal"
            type="button"
            onClick={this.closeBetaSidebar}
          >
              <FontAwesomeIcon icon={closeModalIcon} id={styles.closeModalIcon} />
          </button>

          </div>

            {siteExplainerButton}

            {siteExplainerText}

          </CardFooter>
        </div>
        </>


    return explainModal
  }
}

SiteLoadOptions.propTypes = {
  fetchSessionState: PropTypes.func.isRequired,
  account: PropTypes.string,
  provider: PropTypes.string,
};

const mapStateToProps = state => ({
  account: state.profile.account,
  provider: state.profile.provider,
});


export default connect(mapStateToProps, { fetchSessionState })(SiteLoadOptions);
