// SPDX-License-Identifier: MPL-2.0

import React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { changeFocusedTab, toggleLoginModal } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';
import { PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { getResolvedTheme, subscribeThemeChanges } from '../../utilities/ui/themeRuntime';
import { getThemeMetadata } from '../../utilities/ui/themeRegistry';

// CSS
import styles from './Footer.module.scss';

// reactstrap components
import { NavLink } from 'reactstrap';

type FooterProps = {
  changeFocusedTab: (tab: number) => void;
  toggleLoginModal: (isOpen: boolean) => void;
  focusedTab?: number;
  flowAtDocumentEnd?: boolean;
  loginModalToggled?: boolean;
};

type FooterState = {
  isDesktopWindowTheme: boolean;
  startMenuOpen: boolean;
};

const isDesktopWindowTheme = (themeId: string): boolean =>
  getThemeMetadata(themeId).layoutProfile === 'desktop-window';

class Footer extends React.Component<FooterProps, FooterState> {
  private footerRef = React.createRef<HTMLElement>();

  private startButtonRef = React.createRef<HTMLButtonElement>();

  private unsubscribeThemeChanges: (() => void) | null = null;

  state: FooterState = {
    isDesktopWindowTheme: isDesktopWindowTheme(getResolvedTheme().id),
    startMenuOpen: false,
  };

  componentDidMount() {
    this.unsubscribeThemeChanges = subscribeThemeChanges((selection) => {
      this.setState({
        isDesktopWindowTheme: isDesktopWindowTheme(selection.id),
        startMenuOpen: false,
      });
    });
    document.addEventListener('pointerdown', this.handleDocumentPointerDown);
    document.addEventListener('keydown', this.handleDocumentKeyDown);
  }

  componentWillUnmount() {
    this.unsubscribeThemeChanges?.();
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
  }

  closeStartMenu = (restoreFocus = false) => {
    if (!this.state.startMenuOpen) return;
    this.setState({ startMenuOpen: false }, () => {
      if (restoreFocus) this.startButtonRef.current?.focus();
    });
  };

  handleDocumentPointerDown = (event: PointerEvent) => {
    if (!this.state.startMenuOpen || this.footerRef.current?.contains(event.target as Node)) return;
    this.closeStartMenu();
  };

  handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.state.startMenuOpen) return;
    event.preventDefault();
    this.closeStartMenu(true);
  };

  toggleStartMenu = () => {
    this.setState(
      ({ startMenuOpen }) => ({ startMenuOpen: !startMenuOpen }),
      () => {
        if (!this.state.startMenuOpen) return;
        this.footerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      },
    );
  };

  clickedSettingsLink = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    this.closeStartMenu();
    this.props.toggleLoginModal(true);
  };

  clickedAboutLink = () => this.closeStartMenu();

  clickedBetaLink = () => {
    const betaTab = 5;
    this.props.changeFocusedTab(betaTab);
  };

  clickedContributorsLink = () => {};

  clickedDocsLink = () => this.closeStartMenu();

  render() {
    const footerPlacement = this.props.flowAtDocumentEnd ? 'document-end' : 'theme-default';
    const { isDesktopWindowTheme, startMenuOpen } = this.state;
    const menuRole = isDesktopWindowTheme ? 'menu' : undefined;
    const menuItemRole = isDesktopWindowTheme ? 'menuitem' : undefined;

    return (
      <>
        <footer
          ref={this.footerRef}
          className={`footer footer-simple ${styles.footer} ${
            this.props.flowAtDocumentEnd ? styles.footerDocumentEnd : ''
          }`}
          data-ce-footer-placement={footerPlacement}
        >
          <button
            ref={this.startButtonRef}
            type="button"
            className={styles.startButton}
            onClick={this.toggleStartMenu}
            aria-expanded={startMenuOpen}
            aria-controls="ce-footer-start-menu"
            aria-haspopup="menu"
            aria-label="Open Start menu"
            data-testid={E2E_TESTIDS.FOOTER_START_BUTTON}
            hidden={!isDesktopWindowTheme}
          >
            <span className={styles.startIcon} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>
          <nav
            id="ce-footer-start-menu"
            className={`${styles.startMenu} ${startMenuOpen ? styles.startMenuOpen : ''}`}
            aria-label={isDesktopWindowTheme ? 'Start menu' : 'Footer navigation'}
            role={menuRole}
            data-testid={E2E_TESTIDS.FOOTER_START_MENU}
            hidden={isDesktopWindowTheme && !startMenuOpen}
          >
            <ul>
              <li>
                <NavLink
                  href={buildPublicRoute('/new')}
                  target=""
                  className={styles.footerLink}
                  role={menuItemRole}
                  onClick={() => this.closeStartMenu()}
                >
                  NEW
                </NavLink>
              </li>
              <li>
                <NavLink
                  // href="https://docsend.com/view/28x54q8ez7pccsqq"
                  // target="_blank"
                  href={buildPublicRoute('/about')}
                  target=""
                  onClick={this.clickedAboutLink}
                  className={styles.footerLink}
                  role={menuItemRole}
                >
                  ABOUT
                </NavLink>
              </li>
              <li>
                <NavLink
                  href={buildPublicRoute('/posts')}
                  target=""
                  className={styles.footerLink}
                  role={menuItemRole}
                  onClick={() => this.closeStartMenu()}
                >
                  POSTS
                </NavLink>
              </li>
              {/* <li>
                  <NavLink
                    href="/contributors"
                    target=""
                    onClick={this.clickedContributorsLink}
                    className={styles.footerLink}
                    >
                    CONTRIBUTORS
                  </NavLink>
                </li> */}
              <li>
                <NavLink
                  href=""
                  target=""
                  onClick={this.clickedSettingsLink}
                  className={styles.footerLink}
                  role={menuItemRole}
                >
                  SETTINGS
                </NavLink>
              </li>
              {/* <li>
                  <NavLink
                    href=""
                    target="_blank"
                    className={`ml-1 ${styles.footerLink}`}
                  >
                    CONTACT
                    </NavLink>
                </li> */}
              <li>
                <NavLink
                  href={buildPublicRoute('/docs')}
                  target=""
                  onClick={this.clickedDocsLink}
                  className={`ml-1 ${styles.footerLink}`}
                  role={menuItemRole}
                >
                  DOCS
                </NavLink>
              </li>
              {/* <li>
                  <NavLink
                    href="/beta"
                    target=""
                    onClick={this.clickedBetaLink}
                    className={`ml-1 ${styles.footerLink}`}
                  >
                    BETA
                  </NavLink>
                </li> */}
            </ul>
          </nav>
          <div className={styles.copyright}>
            <span className="copyright-link" data-testid="ce-footer-brand-attribution">
              <span className={styles.copyrightContent}>
                <span className={styles.copyrightText}>Software by Agalmic</span>
                <a
                  href={PUBLIC_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.githubLink}
                  data-testid="ce-footer-link-github"
                  aria-label="View Context Engine on GitHub"
                  title="View Context Engine on GitHub"
                >
                  <FontAwesomeIcon icon={faGithub} />
                </a>
              </span>
            </span>
          </div>
        </footer>
      </>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  focusedTab: state.sessionState.focusedTab,
  loginModalToggled: state.sessionState.loginModalToggled,
});

export default connect(mapStateToProps, { changeFocusedTab, toggleLoginModal })(Footer);
