/** @file GreetingModal.tsx */
import React, { Component } from 'react';
import { createLogger } from '../../utilities/logging';

// CSS and images
import 'assets/css/contextEngine.scss';
import styles from './Modals.module.scss';
import modalImage from 'assets/img/rules_modal.png';

// Reactstrap components
import { Button, Card, CardHeader, CardBody, CardFooter, Form, FormGroup, Label, Modal, Input } from 'reactstrap';

// Components
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWindowClose, faCheck, faCheckSquare } from '@fortawesome/free-solid-svg-icons';

const log = createLogger('ui');

const buildClassName = (classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type GreetingModalProps = {
  visible?: boolean;
  optOutAndEmailBottom?: boolean;
  closeExplainerFunction: () => void;
};

type GreetingModalState = {
  userOptsOutMetrics: boolean;
  emailInput: string;
};

class GreetingModal extends Component<GreetingModalProps, GreetingModalState> {
  state: GreetingModalState = {
    userOptsOutMetrics: false,
    emailInput: '',
  };

  optOutChanged = () => {
    this.setState({ userOptsOutMetrics: !this.state.userOptsOutMetrics });

    if (!this.state.userOptsOutMetrics) {
    } else {
    }
  };

  emailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const latestEmail = e.target.value;
    this.setState({ emailInput: latestEmail });
  };

  closeRulesModal = () => {
    this.props.closeExplainerFunction();
  };

  render() {
    // Explanation modal (only seen on first site-load)

    const modalPicture = modalImage;

    const closeModalIcon = this.state.emailInput === '' ? faWindowClose : faCheckSquare;

    const formBottomVisibleClassName = this.props.optOutAndEmailBottom ? styles.updatesPanel : styles.isHidden;

    const modalVisibleClassName = this.props.visible ? styles.rulesModal : styles.isClosed;

    const explainModal = (
      <>
        <Modal
          isOpen={!!this.props.visible}
          modalClassName={buildClassName(['modal-rules transparentModal', modalVisibleClassName])}
        >
          <Card className={styles.rulesModalCard}>
            <CardBody
              className={styles.rulesModalCardBody}
              style={{
                backgroundImage: 'url(' + modalPicture + ')',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            ></CardBody>
            <div className={formBottomVisibleClassName}>
              <FormGroup check className={styles.optOutMetrics}>
                <Label check className={styles.optOutLabel}>
                  <Input
                    type="radio"
                    name="radio1"
                    checked={this.state.userOptsOutMetrics}
                    className={styles.optOutSelect}
                    onChange={this.optOutChanged}
                  />{' '}
                  <div className={styles.optOutMainText}>
                    {' '}
                    Opt out metrics <div className={styles.optOutDetailText}> (tracks UI use) </div>{' '}
                  </div>
                </Label>
              </FormGroup>

              <CardFooter className={styles.rulesModalFooter}>
                <div className={styles.exitButton}></div>

                <div className={styles.emailAndOptOut}>
                  <Label className={styles.emailFormLabel}> Get updates</Label>
                  <div className={styles.emailSubjects}>
                    <div className={styles.emailSubject}>— Beta Info</div>

                    <div className={styles.emailSubject}>— Feature updates</div>

                    <div className={styles.emailSubject}>— Launch</div>
                  </div>

                  <FormGroup className={styles.enterEmail}>
                    <Input
                      type="email"
                      name="emailInput"
                      onChange={this.emailInputChange}
                      className={styles.emailInput}
                      placeholder="[redacted-email]"
                    />
                  </FormGroup>
                </div>
              </CardFooter>
            </div>

            <button
              className={buildClassName([styles.closeExplainerModalButton, 'close'])}
              aria-label="Close"
              data-dismiss="modal"
              type="button"
              onClick={this.closeRulesModal}
            >
              <FontAwesomeIcon className={styles.closeModalIcon} icon={closeModalIcon} />
            </button>
          </Card>
        </Modal>
      </>
    );

    return explainModal;
  }
}

export default GreetingModal;
