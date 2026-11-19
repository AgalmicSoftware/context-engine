import React from 'react';
import { render, screen } from '@testing-library/react';

import { SurveyQuestions } from './SurveyQuestions';

describe('SurveyQuestions imperative ref', () => {
  // The All questions header calls both: without the second, its x beside Submit did nothing.
  it('exposes the submit and clear handles through a forwarded ref for dashboard hosts', async () => {
    const ref = React.createRef<any>();

    render(
      <SurveyQuestions
        ref={ref}
        networkChainId={11155420}
        runtimeStrategy={{
          render: () => <div data-testid="survey-questions-ref-smoke" />,
        }}
      />,
    );

    expect(await screen.findByTestId('survey-questions-ref-smoke')).toBeInTheDocument();
    expect(ref.current).toEqual(
      expect.objectContaining({
        handlePrimarySubmitClick: expect.any(Function),
        handleRevertPendingChanges: expect.any(Function),
        state: expect.any(Object),
      }),
    );
  });
});
