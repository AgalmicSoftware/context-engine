/** @file SiteLoadOptions.tsx */
import React, { Component } from 'react';

// CSS and images
import 'assets/css/contextEngine.scss';
import styles from './Modals.module.scss';

// Reactstrap components
import { Card, CardFooter } from 'reactstrap';

// Components
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWindowClose, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import { createLogger } from 'utilities/logging.js';
import WelcomeSlideRenderer from './WelcomeSlideRenderer';

const uiLog = createLogger('ui');

const buildClassName = (classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type SiteLoadOptionsProps = {
  arrowIndex: number;
  sidebarOpen?: boolean;
  closeSidebarFunction: () => void;
  clickRightArrow: () => void;
  clickLeftArrow?: () => void;
};

type SiteLoadOptionsState = {
  metricsDetailsSelected: boolean;
};

class SiteLoadOptions extends Component<SiteLoadOptionsProps, SiteLoadOptionsState> {
  state: SiteLoadOptionsState = {
    metricsDetailsSelected: false,
  };

  closeBetaSidebar = () => {
    if (this.props.sidebarOpen) {
      this.props.closeSidebarFunction();
    }
  };

  // If someone clicks question mark next to metrics tracking option,
  // they will see the details of what data is being tracked or used
  toggleMetricsDetails = () => {
    uiLog.log('METRICS TOGGLED:' + this.state.metricsDetailsSelected);
    this.setState({ metricsDetailsSelected: !this.state.metricsDetailsSelected });
  };

  render() {
    // If exit button is hit, sidebar disappears
    const sidebarExited = !this.props.sidebarOpen;

    const sidebarVisibleClassName = sidebarExited ? styles.isSidebarCollapsed : styles.welcomeSlideSidebar;

    const closeModalIcon = faWindowClose;

    const closeMetricsDetailsIcon = faWindowClose;
    const questionMarkMetricsIcon = (
      <button
        className={styles.metricDetailsButton}
        data-ce-control-appearance="frameless"
        onClick={this.toggleMetricsDetails}
      >
        <FontAwesomeIcon icon={faQuestionCircle} className={styles.metricsInfoIcon} />
      </button>
    );

    const metricsDetailsClassName = this.state.metricsDetailsSelected ? styles.metricsDetailsPanel : styles.isHidden;

    const slideButtonClickHandler = this.props.arrowIndex === 0 ? this.props.clickRightArrow : undefined;

    const metricsDetailExplainer = (
      <Card className={metricsDetailsClassName}>
        <div className={styles.metricsDetailsTitle}>
          <div className={styles.emailFormLabel}>
            Web3 = control over your data
            <div className={styles.metricsDetailsSubtitle}></div>
          </div>
        </div>

        <div className={styles.metricsDetailsPoints}>
          <div className={styles.emailSubjects}>
            <div className={styles.metricsCollectedText}>Metrics:</div>

            <div className={styles.emailSubject}>— UX Interacts</div>

            <div className={styles.emailSubject}>— Screen Size</div>

            <div className={styles.emailSubject}>— Region</div>
          </div>

          <div className={styles.metricsDetailsButtons}>
            <button
              className={buildClassName([styles.closeModalButton, 'close'])}
              aria-label="Close"
              type="button"
              onClick={this.toggleMetricsDetails}
            >
              <FontAwesomeIcon icon={closeMetricsDetailsIcon} className={styles.closeModalIcon} />
            </button>
          </div>
        </div>
      </Card>
    );

    const explainModal = (
      <>
        <div className={styles.welcomeSlideEmbed}>
          <CardFooter className={styles.welcomeSlideFooter}>
            <WelcomeSlideRenderer
              slideIndex={this.props.arrowIndex}
              onSlideClick={slideButtonClickHandler}
              leadingContent={
                <div className={sidebarVisibleClassName} data-testid="ce-site-load-sidebar">
                  {metricsDetailExplainer}

                  <button
                    className={buildClassName([styles.closeModalButton, 'close'])}
                    data-testid="ce-site-load-close-sidebar"
                    aria-label="Close"
                    type="button"
                    onClick={this.closeBetaSidebar}
                  >
                    <FontAwesomeIcon icon={closeModalIcon} className={styles.closeModalIcon} />
                  </button>
                </div>
              }
            />
          </CardFooter>
        </div>
      </>
    );

    return explainModal;
  }
}

export default SiteLoadOptions;
