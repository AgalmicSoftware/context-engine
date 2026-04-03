/** @file Navbar.jsx */
import React, { Component } from "react";

import styles from "./Navbar.module.scss";
import StaticLogo from "assets/img/context_engine_logo_static.png";
import AnimatedLogo from "assets/img/context_engine_logo_animation.gif";
import AnimatedLogoPingPong from "assets/img/context_engine_logo_animation_pingpong.gif";
import {
  ENABLE_CE_LOGO_ANIMATION,
  CE_LOGO_ANIMATION_MODE,
  CE_LOGO_ANIMATION_DURATION_MS_FORWARD,
  CE_LOGO_ANIMATION_DURATION_MS_PINGPONG,
} from "../../variables/appConfig.js";

import AccountSection from "./AccountSection.jsx";
import withRouter from "../HooksHOC/withRouterBridge.jsx";
import { createLogger } from 'utilities/logging.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';

const uiLog = createLogger('ui');

const getConfiguredBaseUrl = () => readPublicUrlBasePath() || "/";

const getInternalNavigationTarget = (target) => {
  if (!target) return null;

  if (typeof window === "undefined") {
    return target.startsWith("/") ? target : null;
  }

  try {
    const resolvedTarget = new URL(target, window.location.origin);
    if (resolvedTarget.origin !== window.location.origin) return null;
    return `${resolvedTarget.pathname}${resolvedTarget.search}${resolvedTarget.hash}` || "/";
  } catch (_) {
    return target.startsWith("/") ? target : null;
  }
};

export class Navbar extends Component {
  logoTimeoutId = null;

  constructor(props) {
    super(props);
    const hasWindow = typeof window !== "undefined";
    const shouldAnimate =
      ENABLE_CE_LOGO_ANIMATION &&
      hasWindow &&
      !window.__ceLogoAnimationPlayed;
    this.state = {
      showAnimatedLogo: shouldAnimate,
    };
    if (shouldAnimate && hasWindow) {
      window.__ceLogoAnimationPlayed = true;
    }
  }

  componentDidMount() {
    if (this.state.showAnimatedLogo) {
      const animationDurationMs =
        CE_LOGO_ANIMATION_MODE === "pingpong"
          ? CE_LOGO_ANIMATION_DURATION_MS_PINGPONG
          : CE_LOGO_ANIMATION_DURATION_MS_FORWARD;
      this.logoTimeoutId = window.setTimeout(() => {
        this.setState({ showAnimatedLogo: false });
      }, animationDurationMs);
    }
  }

  componentWillUnmount() {
    if (this.logoTimeoutId) {
      window.clearTimeout(this.logoTimeoutId);
    }
  }

  componentDidUpdate(prevProps) {}

  navigateWithWindow = (target) => {
    if (typeof window !== "undefined" && window.location) {
      window.location.assign(target);
    }
  }

  logoClicked = () => {
    uiLog.log("logo clicked");
    const baseUrl = getConfiguredBaseUrl();
    const internalTarget = getInternalNavigationTarget(baseUrl);

    if (internalTarget) {
      if (typeof this.props.navigate === "function") {
        this.props.navigate(internalTarget);
        return;
      }
      if (this.props.history && typeof this.props.history.push === "function") {
        this.props.history.push(internalTarget);
        return;
      }
    }

    this.navigateWithWindow(baseUrl);
  }

  render() {
    const animatedLogoSrc =
      CE_LOGO_ANIMATION_MODE === "pingpong"
        ? AnimatedLogoPingPong
        : AnimatedLogo;
    const logoSrc = this.state.showAnimatedLogo ? animatedLogoSrc : StaticLogo;

  const beforeLogin = (
    <>
        <div id={styles.navbarContainer}>
          <div id={styles.navbarLogoCol}>
            <img id={styles.mainLogo} src={logoSrc} fluid="true" alt="logo" onClick={this.logoClicked}>
            </img>
          </div>
          <div id={styles.accountSection}>
              <AccountSection
                demoMode={this.props.demoMode}
                toggleDemoMode={(demoModeOn) => this.props.toggleDemoMode(demoModeOn)}
                loginComplete={this.props.loginComplete}
                loginInProgress={this.props.loginInProgress}
                provider={this.props.provider}
              />
          </div>
        </div>
    </>
  )

  const afterLogin = (
    <>
        <div id={styles.navbarContainerLoggedIn}>
            <div id={styles.navbarLogoColLoggedIn}>
              <img id={styles.mainLogoLoggedIn} src={logoSrc} fluid="true" alt="ce_logo" onClick={this.logoClicked}></img>
            </div>
            <div id={styles.accountSectionLoggedIn}>
              <AccountSection
                account={this.props.account}
                provider={this.props.provider}
                loginComplete={this.props.loginComplete}
                loginInProgress={this.props.loginInProgress}
                sendTestETH={(amountToSend) => this.props.sendTestETH(amountToSend)}
                demoMode={this.props.demoMode}
                toggleDemoMode={(demoModeOn) => this.props.toggleDemoMode(demoModeOn)}
                />
            </div>
          </div>
    </>
  )

  var navBarDisplay = this.props.loginComplete ? afterLogin : beforeLogin;

  return (
    navBarDisplay
    );
  }
}

export default withRouter(Navbar);
