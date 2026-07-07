/** @file Navbar.tsx */
import React, { Component } from 'react';

import styles from './Navbar.module.scss';
import StaticLogo from 'assets/img/context_engine_logo_static.png';
import AnimatedLogo from 'assets/img/context_engine_logo_animation.gif';
import AnimatedLogoPingPong from 'assets/img/context_engine_logo_animation_pingpong.gif';
import {
  ENABLE_CE_LOGO_ANIMATION,
  CE_LOGO_ANIMATION_MODE,
  CE_LOGO_ANIMATION_DURATION_MS_FORWARD,
  CE_LOGO_ANIMATION_DURATION_MS_PINGPONG,
} from '../../variables/appConfig.js';

import AccountSectionRaw from './AccountSection';
import withRouter from '../HooksHOC/withRouterBridge';
import { createLogger } from 'utilities/logging.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';

const uiLog = createLogger('ui');
const AccountSection = AccountSectionRaw as React.ComponentType<any>;

const getConfiguredBaseUrl = () => readPublicUrlBasePath() || '/';

const getInternalNavigationTarget = (target: string) => {
  if (!target) return null;

  if (typeof window === 'undefined') {
    return target.startsWith('/') ? target : null;
  }

  try {
    const resolvedTarget = new URL(target, window.location.origin);
    if (resolvedTarget.origin !== window.location.origin) return null;
    return `${resolvedTarget.pathname}${resolvedTarget.search}${resolvedTarget.hash}` || '/';
  } catch (_) {
    return target.startsWith('/') ? target : null;
  }
};

type NavbarProps = {
  demoMode?: unknown;
  toggleDemoMode?: (demoModeOn: boolean) => void;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  provider?: string | null;
  account?: string;
  sessionConfig?: unknown;
  sendTestETH?: (amountToSend: unknown) => void;
  navigate?: (target: string) => void;
  history?: {
    push?: (target: string) => void;
  };
};

type NavbarState = {
  showAnimatedLogo: boolean;
};

type NavbarRuntimeWindow = Window & {
  __ceLogoAnimationPlayed?: boolean;
};

export class Navbar extends Component<NavbarProps, NavbarState> {
  logoTimeoutId: number | null = null;

  constructor(props: NavbarProps) {
    super(props);
    const hasWindow = typeof window !== 'undefined';
    const shouldAnimate = ENABLE_CE_LOGO_ANIMATION && hasWindow && !(window as any).__ceLogoAnimationPlayed;
    this.state = {
      showAnimatedLogo: shouldAnimate,
    };
    if (shouldAnimate && runtimeWindow) {
      runtimeWindow.__ceLogoAnimationPlayed = true;
    }
  }

  componentDidMount() {
    if (this.state.showAnimatedLogo) {
      const animationDurationMs =
        CE_LOGO_ANIMATION_MODE === 'pingpong'
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

  componentDidUpdate(_prevProps: NavbarProps) {}

  navigateWithWindow = (target: string) => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(target);
    }
  };

  logoClicked = () => {
    uiLog.log('logo clicked');
    const baseUrl = getConfiguredBaseUrl();
    const internalTarget = getInternalNavigationTarget(baseUrl);

    if (internalTarget) {
      if (typeof this.props.navigate === 'function') {
        this.props.navigate(internalTarget);
        return;
      }
      if (this.props.history && typeof this.props.history.push === 'function') {
        this.props.history.push(internalTarget);
        return;
      }
    }

    this.navigateWithWindow(baseUrl);
  };

  handleLogoLinkClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault();
    this.logoClicked();
  };

  render() {
    const animatedLogoSrc = CE_LOGO_ANIMATION_MODE === 'pingpong' ? AnimatedLogoPingPong : AnimatedLogo;
    const logoSrc = this.state.showAnimatedLogo ? animatedLogoSrc : StaticLogo;
    const logoHref = getConfiguredBaseUrl();
    const legacyFluidImgProp = { fluid: 'true' } as Record<string, string>;

    const beforeLogin = (
      <>
        <div id={styles.navbarContainer}>
          <div id={styles.navbarLogoCol}>
            <a
              href={logoHref}
              className={styles.logoHomeLink}
              aria-label="Context Engine home"
              onClick={this.handleLogoLinkClick}
            >
              <img id={styles.mainLogo} src={logoSrc} {...legacyFluidImgProp} alt="" aria-hidden="true"></img>
            </a>
          </div>
          <div id={styles.accountSection}>
            <AccountSection
              demoMode={this.props.demoMode}
              toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode?.(demoModeOn)}
              loginComplete={this.props.loginComplete}
              loginInProgress={this.props.loginInProgress}
              provider={this.props.provider}
            />
          </div>
        </div>
      </>
    );

    const afterLogin = (
      <>
        <div id={styles.navbarContainerLoggedIn}>
          <div id={styles.navbarLogoColLoggedIn}>
            <a
              href={logoHref}
              className={styles.logoHomeLink}
              aria-label="Context Engine home"
              onClick={this.handleLogoLinkClick}
            >
              <img id={styles.mainLogoLoggedIn} src={logoSrc} {...legacyFluidImgProp} alt="" aria-hidden="true"></img>
            </a>
          </div>
          <div id={styles.accountSectionLoggedIn}>
            <AccountSection
              account={this.props.account}
              provider={this.props.provider}
              loginComplete={this.props.loginComplete}
              loginInProgress={this.props.loginInProgress}
              sendTestETH={(amountToSend: unknown) => this.props.sendTestETH?.(amountToSend)}
              demoMode={this.props.demoMode}
              toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode?.(demoModeOn)}
            />
          </div>
        </div>
      </>
    );

    var navBarDisplay = this.props.loginComplete ? afterLogin : beforeLogin;

    return navBarDisplay;
  }
}

export default withRouter(Navbar);
