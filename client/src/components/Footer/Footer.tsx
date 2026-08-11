// SPDX-License-Identifier: MPL-2.0

import React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { changeFocusedTab, toggleLoginModal } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';
import { PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

// CSS
import styles from './Footer.module.scss';

// reactstrap components
import { NavLink } from 'reactstrap';

type FooterProps = {
  changeFocusedTab: (tab: number) => void;
  toggleLoginModal: (isOpen: boolean) => void;
  focusedTab?: number;
  loginModalToggled?: boolean;
};

class Footer extends React.Component<FooterProps> {
  clickedSettingsLink = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    this.props.toggleLoginModal(true);
  };

  clickedAboutLink = () => {};

  clickedBetaLink = () => {
    const betaTab = 5;
    this.props.changeFocusedTab(betaTab);
  };

  clickedContributorsLink = () => {};

  clickedDocsLink = () => {};

  render() {
    return (
      <>
        <footer className={`footer footer-simple ${styles.footer}`}>
          <nav>
            <ul>
              <li>
                <NavLink href={buildPublicRoute('/new')} target="" className={styles.footerLink}>
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
                >
                  ABOUT
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
                <NavLink href="" target="" onClick={this.clickedSettingsLink} className={styles.footerLink}>
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
