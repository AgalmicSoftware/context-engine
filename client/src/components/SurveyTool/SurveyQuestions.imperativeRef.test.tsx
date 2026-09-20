import React from 'react';
import { render, screen } from '@testing-library/react';

import { SurveyQuestions } from './SurveyQuestions';

describe('SurveyQuestions imperative ref', () => {
  it('exposes the submit handle through a forwarded ref for dashboard hosts', async () => {
    const ref = React.createRef<any>();

    render(
      <SurveyQuestions
        ref={ref}
        runtimeStrategy={{
          render: () => <div data-testid="survey-questions-ref-smoke" />,
        }}
      />,
    );

    expect(await screen.findByTestId('survey-questions-ref-smoke')).toBeInTheDocument();
    expect(ref.current).toEqual(
      expect.objectContaining({
        handlePrimarySubmitClick: expect.any(Function),
        state: expect.any(Object),
      }),
    );
  });
});
