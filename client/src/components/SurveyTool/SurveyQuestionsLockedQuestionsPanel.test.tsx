import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsLockedQuestionsPanel from './SurveyQuestionsLockedQuestionsPanel';
import styles from './SurveyTool.module.scss';

describe('SurveyQuestionsLockedQuestionsPanel', () => {
  it('renders nothing when no masked questions are hidden', () => {
    const { container } = render(<SurveyQuestionsLockedQuestionsPanel hiddenMaskedQuestionIds={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the decrypt action and forwards hidden question ids', () => {
    const onDecrypt = jest.fn();
    render(
      <SurveyQuestionsLockedQuestionsPanel
        hiddenMaskedQuestionIds={['q1', 'q2']}
        onDecrypt={onDecrypt}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_DECRYPT));

    expect(screen.getByText('2 Locked Questions')).toBeInTheDocument();
    expect(onDecrypt).toHaveBeenCalledWith(['q1', 'q2']);
  });

  it('renders expanded gate details and toggles the caret callback', () => {
    const onToggleDetails = jest.fn();
    render(
      <SurveyQuestionsLockedQuestionsPanel
        hiddenMaskedQuestionIds={['q1']}
        lockedGateDetails={[{
          id: 'gate-1',
          label: 'Session Access',
          questionCount: 1,
          sbts: [{
            address: '0x1111111111111111111111111111111111111111',
            href: '/sbt/0x1111111111111111111111111111111111111111',
            label: 'Participant Pass',
          }],
        }]}
        lockedGateDetailsExpanded
        onToggleDetails={onToggleDetails}
      />
    );

    expect(screen.getByText('Session Access')).toBeInTheDocument();
    expect(screen.getByText('Participant Pass')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toHaveClass(styles.lockedQuestionsBanner);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET));

    expect(onToggleDetails).toHaveBeenCalledTimes(1);
  });
});
