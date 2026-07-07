import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsLoadingState from './SurveyQuestionsLoadingState';
import { buildSurveyQuestionsFullLoadingProgressState } from './surveyQuestionsTypes.js';
import styles from './SurveyTool.module.scss';

describe('SurveyQuestionsLoadingState', () => {
  it('renders the loading headline without progress metadata when no work is active', () => {
    const { container } = render(
      <SurveyQuestionsLoadingState progressState={buildSurveyQuestionsFullLoadingProgressState()} />,
    );

    expect(screen.getByText('Loading questions...')).toBeInTheDocument();
    expect(container.querySelector(`.${styles.fullLoadingProgressWrap}`)).toBeNull();
  });

  it('renders scan progress labels and fill width from the display state', () => {
    const { container } = render(
      <SurveyQuestionsLoadingState
        progressState={buildSurveyQuestionsFullLoadingProgressState({
          progressSlug: 'session-a',
          questionScanProgress: {
            slug: 'session-a',
            totalBlocks: 100,
            scannedBlocks: 25,
          },
        })}
      />,
    );

    expect(screen.getByText('75 blocks left')).toBeInTheDocument();
    expect(screen.getByText('25 / 100')).toBeInTheDocument();
    expect(container.querySelector(`.${styles.fullLoadingProgressFill}`)).toHaveStyle('width: 25%');
  });
});
