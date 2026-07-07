import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsJsonRouteSection from './SurveyQuestionsJsonRouteSection';

describe('SurveyQuestionsJsonRouteSection', () => {
  it('forwards JSON display descriptors and callbacks to the JSON controls', () => {
    const onCopySurveyJson = jest.fn();
    const onToggleSurveyJson = jest.fn();
    const renderJsonTree = jest.fn((json) => <pre data-testid="json-tree">{JSON.stringify(json)}</pre>);

    render(
      <SurveyQuestionsJsonRouteSection
        jsonPanelDisplayState={{
          showFullSurveyJsonControls: true,
          showSurveyJson: true,
          showSurveyJsonPanel: true,
        }}
        onCopySurveyJson={onCopySurveyJson}
        onToggleSurveyJson={onToggleSurveyJson}
        renderJsonTree={renderJsonTree}
        surveyJson={{ id: 'survey-1' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide Survey .json' }));
    fireEvent.click(screen.getByTitle('Copy Survey Definition JSON'));

    expect(screen.getByTestId('json-tree')).toHaveTextContent('survey-1');
    expect(onToggleSurveyJson).toHaveBeenCalledTimes(1);
    expect(onCopySurveyJson).toHaveBeenCalledTimes(1);
    expect(renderJsonTree).toHaveBeenCalledWith({ id: 'survey-1' });
  });

  it('does not render JSON controls when hidden', () => {
    render(<SurveyQuestionsJsonRouteSection hidden jsonPanelDisplayState={{ showFullSurveyJsonControls: true }} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
