/** @file Navbar.tsx */
import React, { Component } from 'react';

import styles from './Navbar.module.scss';
import Logo from 'assets/img/context_engine_logo.svg';

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

export class Navbar extends Component<NavbarProps> {
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
    const logoHref = getConfiguredBaseUrl();

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
              <img id={styles.mainLogo} src={Logo} alt="" aria-hidden="true" />
            </a>
          </div>
          <div id={styles.accountSection}>
            <AccountSection
              demoMode={this.props.demoMode}
              toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode?.(demoModeOn)}
              loginComplete={this.props.loginComplete}
              loginInProgress={this.props.loginInProgress}
              provider={this.props.provider}
              sessionConfig={this.props.sessionConfig}
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
              <img id={styles.mainLogoLoggedIn} src={Logo} alt="" aria-hidden="true" />
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
              sessionConfig={this.props.sessionConfig}
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
