/** @file MainAreaTabs.tsx */

import React, { Component, Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompass, faGlobe, faPlay, faTools } from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging';

import styles from './MainContent.module.scss';

import { TabContent, TabPane, Card, CardHeader, CardBody, Nav, NavItem, NavLink } from 'reactstrap';

import LazyFallback from '../Shared/LazyFallback';

const log = createLogger('ui');

// Lazy tabs: load on first activation.
const ToolExplorer = React.lazy(() => import('./ToolExplorer'));
const OnboardingWalkthrough = React.lazy(() => import('./OnboardingWalkthrough'));
const CommunityTab = React.lazy(() => import('../CommunityTab/CommunityTab'));

export const MAIN_AREA_TABS = Object.freeze({
  LATEST: 1,
  COMMUNITY: 3,
  TOOLS: 4,
  WELCOME: 5,
});

const MAIN_AREA_TAB_TITLES = Object.freeze({
  [MAIN_AREA_TABS.LATEST]: 'Latest',
  [MAIN_AREA_TABS.COMMUNITY]: 'Community',
  [MAIN_AREA_TABS.TOOLS]: 'Tools',
  [MAIN_AREA_TABS.WELCOME]: 'Welcome',
} as Record<number, string>);
const getTabTitle = (tabIndex: number | null | undefined) =>
  tabIndex == null ? '' : MAIN_AREA_TAB_TITLES[tabIndex] || '';

type MainAreaTabsProps = {
  focusedTab: number;
  changeFocusedTab: (tabIndex: number) => void;
  toggleLoginModal: (loginModalIsOpen: boolean) => void;
  toggleDemoMode: (demoModeOn: boolean) => void;
  demoMode?: unknown;
  demoSurfaceMode?: unknown;
  provider?: unknown;
  network?: unknown;
  account?: string;
  litHooks?: unknown;
  activeSessionSlug?: string;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  isQuestionCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  sbtCacheRevision?: number;
  sbtRealtimeCoverageBySlug?: unknown;
  ensureLightSbtDiscovery?: (...args: unknown[]) => unknown;
  ensureLightSbtUniverse?: (...args: unknown[]) => unknown;
};

type MainAreaTabsState = {
  tabChangesSinceRefresh: number;
  currentTabIndex: number | null;
  currentTabTitle: string;
  mountedTabs: Record<number, boolean>;
};

class MainAreaTabs extends Component<MainAreaTabsProps, MainAreaTabsState> {
  state: MainAreaTabsState = {
    tabChangesSinceRefresh: 0,
    currentTabIndex: null,
    currentTabTitle: '',
    mountedTabs: {},
  };

  componentDidMount() {
    this.setState((prevState) => ({
      currentTabTitle: getTabTitle(this.props.focusedTab),
      currentTabIndex: this.props.focusedTab,
      mountedTabs: {
        ...(prevState.mountedTabs || {}),
        [this.props.focusedTab]: true,
      },
    }));
  }

  shouldComponentUpdate(_nextProps: MainAreaTabsProps, _nextState: MainAreaTabsState) {
    return true;
  }

  componentDidUpdate() {
    // Detect tab changes from outside the component (e.g. footer links)
    if (this.props.focusedTab !== this.state.currentTabIndex) {
      this.changeTabs(this.props.focusedTab);
    }
  }

  changeTabs = (nextTabIndex: number) => {
    const nextTabTitle = getTabTitle(nextTabIndex);
    this.props.changeFocusedTab(nextTabIndex);

    this.setState((prevState) => ({
      tabChangesSinceRefresh: prevState.tabChangesSinceRefresh + 1,
      currentTabTitle: nextTabTitle,
      currentTabIndex: nextTabIndex,
      mountedTabs: {
        ...(prevState.mountedTabs || {}),
        [nextTabIndex]: true,
      },
    }));
  };

  render() {
    const activeClassName = (isActive: boolean) => (isActive ? 'active' : '');
    return (
      <div className={styles.mainAreaTabsAlt}>
        <Card className={styles.mainTabsCard}>
          <CardHeader className={styles.mainTabsCardHeader}>
            <Nav className="nav-tabs-info" role="tablist" tabs>
              <NavItem>
                <NavLink
                  className={activeClassName(this.props.focusedTab === MAIN_AREA_TABS.LATEST)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.LATEST)}
                >
                  <FontAwesomeIcon icon={faPlay} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.LATEST]} </div>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeClassName(this.props.focusedTab === MAIN_AREA_TABS.COMMUNITY)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.COMMUNITY)}
                >
                  <FontAwesomeIcon icon={faGlobe} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.COMMUNITY]} </div>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeClassName(this.props.focusedTab === MAIN_AREA_TABS.TOOLS)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.TOOLS)}
                >
                  <FontAwesomeIcon icon={faTools} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.TOOLS]} </div>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeClassName(this.props.focusedTab === MAIN_AREA_TABS.WELCOME)}
                  onClick={() => this.changeTabs(MAIN_AREA_TABS.WELCOME)}
                >
                  <FontAwesomeIcon icon={faCompass} className={styles.navTabIcon} />
                  <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.WELCOME]} </div>
                </NavLink>
              </NavItem>
            </Nav>
          </CardHeader>
          <CardBody className={styles.mainAreaCardBody}>
            <TabContent className="tab-space" activeTab={'link' + this.state.currentTabIndex}>
              <TabPane tabId={'link' + MAIN_AREA_TABS.COMMUNITY}>
                {this.state.mountedTabs[MAIN_AREA_TABS.COMMUNITY] ? (
                  <Suspense fallback={<LazyFallback label="Loading..." />}>
                    <CommunityTab
                      demoMode={this.props.demoMode}
                      provider={this.props.provider}
                      network={this.props.network}
                      account={this.props.account}
                      loginComplete={this.props.loginComplete}
                      loginInProgress={this.props.loginInProgress}
                      toggleLoginModal={(loginModalIsOpen: boolean) => this.props.toggleLoginModal(loginModalIsOpen)}
                      //
                      isQuestionCacheReady={this.props.isQuestionCacheReady}
                      isSurveyCacheReady={this.props.isSurveyCacheReady}
                      isSBTCacheReady={this.props.isSBTCacheReady}
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
                      network={this.props.network}
                      loginComplete={this.props.loginComplete}
                      loginInProgress={this.props.loginInProgress}
                      demoMode={this.props.demoMode}
                      demoSurfaceMode={this.props.demoSurfaceMode}
                      isQuestionCacheReady={this.props.isQuestionCacheReady}
                      isSurveyCacheReady={this.props.isSurveyCacheReady}
                      isSBTCacheReady={this.props.isSBTCacheReady}
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
