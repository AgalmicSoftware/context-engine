import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import styles from './SurveyTool.module.scss';

describe('SurveyQuestionsLockAudienceControl', () => {
  it('renders the pile lock button pressed state and forwards lock clicks', () => {
    const onLockClick = jest.fn();
    render(
      <SurveyQuestionsLockAudienceControl
        qid="q1"
        effectiveFieldKey="answer"
        buttonTitle="Choose encryption audience"
        hasAudienceMenu
        menuOpen
        isPileVisualContext
        pileMenuPressed
        normalizedSelfAudienceLabel="only me"
        onLockClick={onLockClick}
      />,
    );

    const lockButton = screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);
    expect(lockButton).toHaveClass(styles.pileLockButton);
    expect(lockButton).toHaveClass(styles.pileLockButtonMenuOpen);

    fireEvent.click(lockButton);

    expect(onLockClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('only me')).toBeInTheDocument();
  });

  it('forwards gate audience selection and detail expansion', () => {
    const onSelectAudience = jest.fn();
    const onToggleGateDetails = jest.fn();
    render(
      <SurveyQuestionsLockAudienceControl
        qid="q1"
        effectiveFieldKey="answer"
        buttonTitle="Choose encryption audience"
        hasAudienceMenu
        menuOpen
        normalizedSelfAudienceLabel="only me"
        gateOptions={[
          {
            gateId: 'gate-1',
            label: 'Session Gate',
            sbtItems: [
              {
                address: '0x1111111111111111111111111111111111111111',
                href: '/sbt/0x1111111111111111111111111111111111111111',
                label: 'Participant Pass',
                meta: '1 required',
              },
            ],
          },
        ]}
        onSelectAudience={onSelectAudience}
        onToggleGateDetails={onToggleGateDetails}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE));
    fireEvent.click(screen.getByRole('button', { name: /show session gate/i }));

    expect(onSelectAudience).toHaveBeenCalledWith('gate', 'gate-1');
    expect(onToggleGateDetails).toHaveBeenCalledWith('q1', 'gate-1', 'answer');
  });

  it('does not add a plaintext menu option for additional comments', () => {
    render(
      <SurveyQuestionsLockAudienceControl
        qid="q1"
        effectiveFieldKey="additional"
        buttonTitle="Choose encryption audience"
        hasAudienceMenu
        menuOpen
        fieldState={{ encrypted: true }}
        showFollowOption
        normalizedSelfAudienceLabel="only me"
      />,
    );

    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_FOLLOW)).toHaveTextContent('Match Answer');
  });
});
