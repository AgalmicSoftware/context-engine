/** @file SiteLoadOptions.tsx */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { fetchSessionState } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';

// CSS and images
import 'assets/css/contextEngine.scss';
import styles from './Modals.module.scss';

// Reactstrap components
import { Card, CardFooter } from 'reactstrap';

// Components
import GreetingModal from './GreetingModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWindowClose, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import { createLogger } from 'utilities/logging.js';
import WelcomeSlideRenderer from './WelcomeSlideRenderer';

const uiLog = createLogger('ui');

const buildClassName = (classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type SiteLoadOptionsProps = {
  fetchSessionState: () => void;
  account?: string | null;
  provider?: string | null;
  arrowIndex: number;
  sidebarOpen?: boolean;
  closeSidebarFunction: () => void;
  clickRightArrow: () => void;
  clickLeftArrow?: () => void;
};

type SiteLoadOptionsState = {
  explainerModalOpen: boolean;
  sidebarNotClosed: boolean;
  userOptsOutMetrics: boolean;
  metricsDetailsSelected: boolean;
};

class SiteLoadOptions extends Component<SiteLoadOptionsProps, SiteLoadOptionsState> {
  state: SiteLoadOptionsState = {
    explainerModalOpen: false,
    sidebarNotClosed: false,
    userOptsOutMetrics: true,
    metricsDetailsSelected: false,
  };

  componentDidMount() {
    this.setState({ sidebarNotClosed: true });
  }

  componentWillUnmount() {}

  componentDidUpdate() {
    if (this.state.sidebarNotClosed !== this.props.sidebarOpen) {
      this.setState({ sidebarNotClosed: !!this.props.sidebarOpen });
    }
  }

  toggleSidebar = () => {
    this.setState({ sidebarNotClosed: !this.state.sidebarNotClosed });
  };

  optOutChanged = () => {
    uiLog.log('metrics opt-out state changed to: ' + !this.state.userOptsOutMetrics);
    this.setState({ userOptsOutMetrics: !this.state.userOptsOutMetrics });

    if (!this.state.userOptsOutMetrics) {
    } else {
    }
  };

  closeBetaSidebar = () => {
    this.setState({ sidebarNotClosed: false });

    if (this.props.sidebarOpen) {
      this.props.closeSidebarFunction();
    }
  };

  toggleExplainerModal = (_arrowIndex: number) => {};

  openExplainerModal = () => {
    this.setState({ explainerModalOpen: true });
  };

  closeExplainerModal = () => {
    this.setState({ explainerModalOpen: false });
  };

  // If someone clicks question mark next to metrics tracking option,
  // they will see the details of what data is being tracked or used
  toggleMetricsDetails = () => {
    uiLog.log('METRICS TOGGLED:' + this.state.metricsDetailsSelected);
    this.setState({ metricsDetailsSelected: !this.state.metricsDetailsSelected });
  };

  render() {
    // If exit button is hit, sidebar disappears
    const sidebarExited = !this.state.sidebarNotClosed;

    const sidebarVisibleClassName = sidebarExited ? styles.isSidebarCollapsed : styles.welcomeSlideSidebar;

    // Explanation modal (only seen on first site-load)

    const closeModalIcon = faWindowClose;

    const closeMetricsDetailsIcon = faWindowClose;
    const questionMarkMetricsIcon = (
      <button className={styles.metricDetailsButton} onClick={this.toggleMetricsDetails}>
        <FontAwesomeIcon icon={faQuestionCircle} className={styles.metricsInfoIcon} />
      </button>
    );

    const metricsDetailsClassName = this.state.metricsDetailsSelected ? styles.metricsDetailsPanel : styles.isHidden;

    const slideButtonClickHandler =
      this.props.arrowIndex === 0 ? this.props.clickRightArrow : () => this.toggleExplainerModal(this.props.arrowIndex);

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
        <GreetingModal visible={this.state.explainerModalOpen} closeExplainerFunction={this.closeExplainerModal} />
        <div className={styles.welcomeSlideEmbed}>
          <CardFooter>
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

const mapStateToProps = (state: RootState) => ({
  account: state.profile.account,
  provider: state.profile.provider,
});

export default connect(mapStateToProps, { fetchSessionState })(SiteLoadOptions);
