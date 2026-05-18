import React from "react";
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { changeFocusedTab, toggleLoginModal } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';
import { PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

// CSS
import styles from "./Footer.module.scss";

// reactstrap components
import { NavLink } from "reactstrap";

type FooterProps = {
  changeFocusedTab: (tab: number) => void;
  toggleLoginModal: (isOpen: boolean) => void;
  focusedTab?: number;
  loginModalToggled?: boolean;
};

class Footer extends React.Component<FooterProps> {
  static propTypes = {
    changeFocusedTab: PropTypes.func.isRequired,
    toggleLoginModal: PropTypes.func.isRequired,
    focusedTab: PropTypes.number,
    loginModalToggled: PropTypes.bool,
  };

  clickedSettingsLink = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    this.props.toggleLoginModal(true)
  }

  clickedAboutLink = () => {
  }

  clickedBetaLink = () => {
    const betaTab = 5;
    this.props.changeFocusedTab(betaTab);
  }

  clickedContributorsLink = () => {
  }

  clickedContractsLink = () => {
  }

  render() {
    return (
      <>
        <footer id={styles.footer} className="footer footer-simple">
            <nav>
              <ul>
                <li>
                  <NavLink
                    href={buildPublicRoute('/new')}
                    target=""
                    id={styles.footerLink}
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
                    id={styles.footerLink}
                  >
                    ABOUT
                      </NavLink>
                </li>
                {/* <li>
                  <NavLink
                    href="/contributors"
                    target=""
                    onClick={this.clickedContributorsLink}
                    id={styles.footerLink}
                    >
                    CONTRIBUTORS
                  </NavLink>
                </li> */}
                <li>
                  <NavLink
                    href=""
                    target=""
                    onClick={this.clickedSettingsLink}
                    id={styles.footerLink}
                    >
                    SETTINGS
                  </NavLink>
                </li>
                {/* <li>
                  <NavLink
                    href=""
                    target="_blank"
                    className="ml-1"
                    id={styles.footerLink}
                  >
                    CONTACT
                    </NavLink>
                </li> */}
                  <li>
                  <NavLink
                    href={buildPublicRoute('/contracts')}
                    target=""
                    className="ml-1"
                    onClick={this.clickedContractsLink}
                    id={styles.footerLink}
                  >
                    CONTRACTS
                  </NavLink>
                </li>
                {/* <li>
                  <NavLink
                    href="/beta"
                    target=""
                    className="ml-1"
                    onClick={this.clickedBetaLink}
                    id={styles.footerLink}
                  >
                    BETA
                  </NavLink>
                </li> */}
              </ul>
            </nav>
            <div id={styles.copyright}>
              {/* CPAL-1.0 Attribution (Exhibit B)
                  This line serves as both org branding and the required CPAL attribution.
                  Required by LICENSE Exhibit B. Do not remove in OSS builds.
                  Commercial builds with paid CPAL exception may replace or remove.
                  To update: change text here AND in LICENSE Exhibit B. */}
              <span
                className="copyright-link"
                data-testid="ce-footer-cpal-attribution"
              >
                <span className={styles.copyrightContent}>
                  <span>Software by Agalmic</span>
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

export default connect(mapStateToProps, { changeFocusedTab, toggleLoginModal })(Footer)
