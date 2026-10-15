/** @file MainAreaTabs.tsx */

import React, { Component, Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompass, faGlobe, faTools } from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging';

import styles from './MainContent.module.scss';

import { TabContent, TabPane, Card, CardHeader, CardBody, Nav, NavItem, NavLink } from 'reactstrap';

import LazyFallback from '../Shared/LazyFallback';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const log = createLogger('ui');

// Lazy tabs: load on first activation.
const ToolExplorer = React.lazy(() => import('./ToolExplorer'));
const OnboardingWalkthrough = React.lazy(() => import('./OnboardingWalkthrough'));
const CommunityTab = React.lazy(() => import('../CommunityTab/CommunityTab'));

export const MAIN_AREA_TABS = Object.freeze({
  COMMUNITY: 3,
  TOOLS: 4,
  WELCOME: 5,
});

// Keep the remaining tab IDs stable; a retained Latest selection opens the default Tools view.
const resolveFocusedTab = (focusedTab: number) => (focusedTab === 1 ? MAIN_AREA_TABS.TOOLS : focusedTab);

const MAIN_AREA_TAB_TITLES = Object.freeze({
  [MAIN_AREA_TABS.COMMUNITY]: 'Stats',
  [MAIN_AREA_TABS.TOOLS]: 'Tools',
  [MAIN_AREA_TABS.WELCOME]: 'Welcome',
} as Record<number, string>);
type MainAreaTabsProps = {
  focusedTab: number;
  changeFocusedTab: (tabIndex: number) => void;
  toggleLoginModal: (loginModalIsOpen: boolean) => void;
  toggleDemoMode: (demoModeOn: boolean) => void;
  demoMode?: unknown;
  demoSurfaceMode?: unknown;
  provider?: unknown;
  network?: unknown;
  networkChainId?: unknown;
  sessionConfig?: unknown;
  sessionLoadingView?: React.ReactNode;
  cacheInitializationError?: unknown;
  account?: string;
  litHooks?: unknown;
  activeSessionSlug?: string;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  sbtCacheRevision?: number;
  sbtRealtimeCoverageBySlug?: unknown;
  questionResponsesNonce?: unknown;
  questionScanProgress?: unknown;
  ensureLightSbtDiscovery?: (...args: unknown[]) => unknown;
  ensureLightSbtUniverse?: (...args: unknown[]) => unknown;
};

type MainAreaTabsState = {
  mountedTabs: Record<number, boolean>;
};

class MainAreaTabs extends Component<MainAreaTabsProps, MainAreaTabsState> {
  state: MainAreaTabsState = {
    mountedTabs: {},
  };

  componentDidMount() {
    this.setState((prevState) => ({
      mountedTabs: {
        ...(prevState.mountedTabs || {}),
        [resolveFocusedTab(this.props.focusedTab)]: true,
      },
    }));
  }

  shouldComponentUpdate(_nextProps: MainAreaTabsProps, _nextState: MainAreaTabsState) {
    return true;
  }

  componentDidUpdate(prevProps: MainAreaTabsProps) {
    if (this.props.focusedTab !== prevProps.focusedTab) {
      this.setState((prevState) => ({
        mountedTabs: {
          ...(prevState.mountedTabs || {}),
          [resolveFocusedTab(this.props.focusedTab)]: true,
        },
      }));
    }
  }

  changeTabs = (nextTabIndex: number) => {
    this.props.changeFocusedTab(nextTabIndex);

    this.setState((prevState) => ({
      mountedTabs: {
        ...(prevState.mountedTabs || {}),
        [nextTabIndex]: true,
      },
    }));
  };

  render() {
    const focusedTab = resolveFocusedTab(this.props.focusedTab);
    const activeClassName = (isActive: boolean) => (isActive ? 'active' : '');
    return (
      <div className={styles.mainAreaTabsAlt}>
        <Card className={styles.mainTabsCard}>
          <CardHeader className={styles.mainTabsCardHeader}>
            <Nav className="nav-tabs-info" role="tablist" tabs>
              <NavItem>
                <NavLink
                  className={activeClassName(focusedTab === MAIN_AREA_TABS.COMMUNITY)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.COMMUNITY)}
                  role="tab"
                  aria-label={MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.COMMUNITY]}
                  aria-selected={focusedTab === MAIN_AREA_TABS.COMMUNITY}
                  data-testid={E2E_TESTIDS.MAIN_STATS_TAB}
                >
                  <FontAwesomeIcon icon={faGlobe} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.COMMUNITY]} </div>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeClassName(focusedTab === MAIN_AREA_TABS.TOOLS)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.TOOLS)}
                  role="tab"
                  aria-label={MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.TOOLS]}
                  aria-selected={focusedTab === MAIN_AREA_TABS.TOOLS}
                >
                  <FontAwesomeIcon icon={faTools} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.TOOLS]} </div>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeClassName(focusedTab === MAIN_AREA_TABS.WELCOME)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.WELCOME)}
                  role="tab"
                  aria-label={MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.WELCOME]}
                  aria-selected={focusedTab === MAIN_AREA_TABS.WELCOME}
                >
                  <FontAwesomeIcon icon={faCompass} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.WELCOME]} </div>
                </NavLink>
              </NavItem>
            </Nav>
          </CardHeader>
          <CardBody className={styles.mainAreaCardBody}>
            <TabContent className="tab-space" activeTab={'link' + focusedTab}>
              <TabPane tabId={'link' + MAIN_AREA_TABS.COMMUNITY}>
                {this.state.mountedTabs[MAIN_AREA_TABS.COMMUNITY] ? (
                  <Suspense fallback={<LazyFallback label="Loading..." />}>
                    <CommunityTab
                      demoMode={this.props.demoMode}
                      provider={this.props.provider}
                      network={this.props.network}
                      networkChainId={this.props.networkChainId}
                      account={this.props.account}
                      activeSessionSlug={this.props.activeSessionSlug}
                      sessionConfig={this.props.sessionConfig}
                      sessionLoadingView={this.props.sessionLoadingView}
                      cacheInitializationError={this.props.cacheInitializationError}
                      loginComplete={this.props.loginComplete}
                      loginInProgress={this.props.loginInProgress}
                      toggleLoginModal={(loginModalIsOpen: boolean) => this.props.toggleLoginModal(loginModalIsOpen)}
                      //
                      isQuestionCacheReady={this.props.isQuestionCacheReady}
                      isResponsesCacheReady={this.props.isResponsesCacheReady}
                      isSurveyCacheReady={this.props.isSurveyCacheReady}
                      isSBTCacheReady={this.props.isSBTCacheReady}
                      questionResponsesNonce={this.props.questionResponsesNonce}
                      sbtCacheRevision={this.props.sbtCacheRevision}
                      sbtRealtimeCoverageBySlug={this.props.sbtRealtimeCoverageBySlug}

                      ensureLightSbtDiscovery={this.props.ensureLightSbtDiscovery}
                      ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
                    />
                  </Suspense>
                ) : null}
              </TabPane>
              <TabPane tabId={'link' + MAIN_AREA_TABS.TOOLS}>
                {this.state.mountedTabs[MAIN_AREA_TABS.TOOLS] ? (
                  <Suspense fallback={<LazyFallback label="Loading..." />}>
                    <ToolExplorer
                      toggleLoginModal={(loginModalIsOpen: boolean) => this.props.toggleLoginModal(loginModalIsOpen)}
                      //
                      account={this.props.account}
                      provider={this.props.provider}
                      litHooks={this.props.litHooks}
                      activeSessionSlug={this.props.activeSessionSlug}
                      sessionConfig={this.props.sessionConfig}
                      sessionLoadingView={this.props.sessionLoadingView}
                      cacheInitializationError={this.props.cacheInitializationError}
                      network={this.props.network}
                      networkChainId={this.props.networkChainId}
                      loginComplete={this.props.loginComplete}
                      loginInProgress={this.props.loginInProgress}
                      demoMode={this.props.demoMode}
                      demoSurfaceMode={this.props.demoSurfaceMode}
                      isQuestionCacheReady={this.props.isQuestionCacheReady}
                      isResponsesCacheReady={this.props.isResponsesCacheReady}
                      isSurveyCacheReady={this.props.isSurveyCacheReady}
                      isSBTCacheReady={this.props.isSBTCacheReady}
                      questionResponsesNonce={this.props.questionResponsesNonce}
                      questionScanProgress={this.props.questionScanProgress}
                    />
                  </Suspense>
                ) : null}
              </TabPane>
              <TabPane tabId={'link' + MAIN_AREA_TABS.WELCOME}>
                {this.state.mountedTabs[MAIN_AREA_TABS.WELCOME] ? (
                  <Suspense fallback={<LazyFallback label="Loading..." />}>
                    <OnboardingWalkthrough
                      changeTabFunction={(newTab: number) => this.changeTabs(newTab)}
                      //
                      toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode(demoModeOn)}
                      demoMode={this.props.demoMode}
                    />
                  </Suspense>
                ) : null}
              </TabPane>
            </TabContent>
          </CardBody>
        </Card>
      </div>
    );
  }
}

export default MainAreaTabs;
