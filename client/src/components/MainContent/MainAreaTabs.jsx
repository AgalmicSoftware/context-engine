/** @file MainAreaTabs.jsx */

import React, { Component, Suspense } from "react";
import classnames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faGlobe, faPlay, faTools } from "@fortawesome/free-solid-svg-icons";
import { createLogger } from '../../utilities/logging';

import styles from "./MainContent.module.scss";

import {
  TabContent,
  TabPane,
  Card,
  CardHeader,
  CardBody,
  Nav,
  NavItem,
  NavLink
} from "reactstrap";

import LazyFallback from "../Shared/LazyFallback.jsx";

const log = createLogger('ui');

// Lazy tabs: load on first activation.
const ToolExplorer = React.lazy(() => import("./ToolExplorer.jsx"));
const OnboardingWalkthrough = React.lazy(() => import("./OnboardingWalkthrough.jsx"));
const CommunityTab = React.lazy(() => import("../CommunityTab/CommunityTab.jsx"));

export const MAIN_AREA_TABS = Object.freeze({
  LATEST: 1,
  COMMUNITY: 3,
  TOOLS: 4,
  WELCOME: 5,
});

const MAIN_AREA_TAB_TITLES = Object.freeze({
  [MAIN_AREA_TABS.LATEST]: "Latest",
  [MAIN_AREA_TABS.COMMUNITY]: "Community",
  [MAIN_AREA_TABS.TOOLS]: "Tools",
  [MAIN_AREA_TABS.WELCOME]: "Welcome",
});
const getTabTitle = (tabIndex) => MAIN_AREA_TAB_TITLES[tabIndex] || "";


class MainAreaTabs extends Component {
  state = {
    tabChangesSinceRefresh: 0,
    currentTabIndex: null,
    currentTabTitle: "",
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

  shouldComponentUpdate(nextProps, nextState) {
    return true;
  }

  componentDidUpdate() {
    // Detect tab changes from outside the component (e.g. footer links)
    if (this.props.focusedTab !== this.state.currentTabIndex) {
      this.changeTabs(this.props.focusedTab);
    }
  }

  changeTabs = (nextTabIndex) => {
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
    return (
      <div id={styles.mainAreaTabsAlt}>
                <Card id={styles.mainTabsCard}>
              <CardHeader id={styles.mainTabsCardHeader}>
                <Nav className="nav-tabs-info" role="tablist" tabs>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: this.props.focusedTab === MAIN_AREA_TABS.LATEST
                      })}
                      onClick={() => this.changeTabs(MAIN_AREA_TABS.LATEST)}
                    >
                      <FontAwesomeIcon icon={faPlay} id={styles.navTabIcon} />
                      <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.LATEST]} </div>
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: this.props.focusedTab === MAIN_AREA_TABS.COMMUNITY
                      })}
                      onClick={() => this.changeTabs(MAIN_AREA_TABS.COMMUNITY)}
                    >
                      <FontAwesomeIcon icon={faGlobe} id={styles.navTabIcon} />
                      <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.COMMUNITY]} </div>
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: this.props.focusedTab === MAIN_AREA_TABS.TOOLS
                      })}
                      onClick={() => this.changeTabs(MAIN_AREA_TABS.TOOLS)}
                    >
                      <FontAwesomeIcon icon={faTools} id={styles.navTabIcon} />
                     <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.TOOLS]} </div>
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: this.props.focusedTab === MAIN_AREA_TABS.WELCOME
                      })}
                      onClick={() => this.changeTabs(MAIN_AREA_TABS.WELCOME)}
                    >
                      <FontAwesomeIcon icon={faCog} id={styles.navTabIcon} />
                      <div id="mainContentTabTitle"> {MAIN_AREA_TAB_TITLES[MAIN_AREA_TABS.WELCOME]} </div>
                    </NavLink>
                  </NavItem>
                </Nav>
              </CardHeader>
              <CardBody id={styles.mainAreaCardBody}>
                <TabContent
                  className="tab-space"
                  activeTab={"link" + this.state.currentTabIndex}
                >
                  <TabPane tabId={"link" + MAIN_AREA_TABS.COMMUNITY}>
                    {this.state.mountedTabs[MAIN_AREA_TABS.COMMUNITY] ? (
                      <Suspense fallback={<LazyFallback label="Loading..." />}>
                        <CommunityTab 
                          demoMode={this.props.demoMode}
                          provider={this.props.provider}
                          network={this.props.network}
                          account={this.props.account}
                          loginComplete={this.props.loginComplete}
                          loginInProgress={this.props.loginInProgress}
                          toggleLoginModal={(loginModalIsOpen) => this.props.toggleLoginModal(loginModalIsOpen)}
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
                  <TabPane tabId={"link" + MAIN_AREA_TABS.TOOLS}>
                    {this.state.mountedTabs[MAIN_AREA_TABS.TOOLS] ? (
                      <Suspense fallback={<LazyFallback label="Loading..." />}>
                        <ToolExplorer
                          toggleLoginModal={(loginModalIsOpen) => this.props.toggleLoginModal(loginModalIsOpen)}
                          //
                          account={this.props.account} 
                          provider={this.props.provider}
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
                  <TabPane tabId={"link" + MAIN_AREA_TABS.WELCOME}>
                    {this.state.mountedTabs[MAIN_AREA_TABS.WELCOME] ? (
                      <Suspense fallback={<LazyFallback label="Loading..." />}>
                        <OnboardingWalkthrough
                          changeTabFunction={(newTab) => this.changeTabs(newTab)}
                          //
                          toggleDemoMode={(demoModeOn) => this.props.toggleDemoMode(demoModeOn)} 
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
