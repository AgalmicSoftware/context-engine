import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsJsonControls from './SurveyQuestionsJsonControls';

describe('SurveyQuestionsJsonControls', () => {
  const renderJsonTree = jest.fn((json) => <pre data-testid="json-tree">{JSON.stringify(json)}</pre>);
  const buildJsonPanelDisplayState = (overrides = {}) => ({
    showFullSurveyJsonControls: false,
    showQuestionJsonControls: false,
    showQuestionsJson: false,
    showResponseJson: false,
    showSurveyJsonPanel: false,
    showQuestionsJsonPanel: false,
    showResponseJsonPanel: false,
    showSurveyJson: false,
    surveyJsonRowClassName: undefined,
    surveyJsonToggleClassName: undefined,
    questionJsonToggleClassName: undefined,
    responseJsonToggleClassName: undefined,
    surveyJsonPanelClassName: undefined,
    ...overrides,
  });

  const baseProps = {
    jsonPanelDisplayState: buildJsonPanelDisplayState(),
    onCopyQuestionsJson: jest.fn(),
    onCopyResponseJson: jest.fn(),
    onCopySurveyJson: jest.fn(),
    onToggleQuestionsJson: jest.fn(),
    onToggleResponseJson: jest.fn(),
    onToggleSurveyJson: jest.fn(),
    renderJsonTree,
  };

  beforeEach(() => {
    renderJsonTree.mockClear();
    baseProps.onCopyQuestionsJson.mockClear();
    baseProps.onCopyResponseJson.mockClear();
    baseProps.onCopySurveyJson.mockClear();
    baseProps.onToggleQuestionsJson.mockClear();
    baseProps.onToggleResponseJson.mockClear();
    baseProps.onToggleSurveyJson.mockClear();
  });

  it('does not render when embedded debug UI is hidden', () => {
    const { container } = render(
      <SurveyQuestionsJsonControls
        {...baseProps}
        hidden
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showQuestionJsonControls: true,
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(renderJsonTree).not.toHaveBeenCalled();
  });

  it('renders collapsed full-survey toggles and preserves handler wiring', () => {
    render(
      <SurveyQuestionsJsonControls
        {...baseProps}
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showFullSurveyJsonControls: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Survey .json' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Response .json' }));

    expect(baseProps.onToggleSurveyJson).toHaveBeenCalledTimes(1);
    expect(baseProps.onToggleResponseJson).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Copy Survey Definition JSON')).toBeNull();
    expect(screen.queryByTitle('Copy Response JSON')).toBeNull();
    expect(renderJsonTree).not.toHaveBeenCalled();
  });

  it('keeps full-survey toggles visible for direct callers without a display descriptor', () => {
    render(
      <SurveyQuestionsJsonControls
        onCopyQuestionsJson={baseProps.onCopyQuestionsJson}
        onCopyResponseJson={baseProps.onCopyResponseJson}
        onCopySurveyJson={baseProps.onCopySurveyJson}
        onToggleQuestionsJson={baseProps.onToggleQuestionsJson}
        onToggleResponseJson={baseProps.onToggleResponseJson}
        onToggleSurveyJson={baseProps.onToggleSurveyJson}
        renderJsonTree={renderJsonTree}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Survey .json' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Response .json' }));

    expect(baseProps.onToggleSurveyJson).toHaveBeenCalledTimes(1);
    expect(baseProps.onToggleResponseJson).toHaveBeenCalledTimes(1);
  });

  it('renders expanded survey JSON and copy actions', () => {
    const surveyJson = { id: 'survey-1', questionIDs: ['q1'] };

    render(
      <SurveyQuestionsJsonControls
        {...baseProps}
        copiedSurveyJson
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showFullSurveyJsonControls: true,
          showSurveyJson: true,
          showSurveyJsonPanel: true,
          surveyJsonPanelClassName: 'single-panel',
          surveyJsonRowClassName: 'survey-row',
          surveyJsonToggleClassName: 'survey-toggle',
        })}
        surveyJson={surveyJson}
      />,
    );

    expect(screen.getByRole('button', { name: 'Hide Survey .json' })).toBeInTheDocument();
    expect(screen.getByTestId('json-tree')).toHaveTextContent('"survey-1"');
    fireEvent.click(screen.getByTitle('Copy Survey Definition JSON'));

    expect(baseProps.onCopySurveyJson).toHaveBeenCalledTimes(1);
    expect(renderJsonTree).toHaveBeenCalledWith(surveyJson);
  });

  it('renders single-question question and response panels with toggle and copy handlers', () => {
    const questionsJson = [{ id: 'q1', prompt: 'Question?' }];
    const responseJson = { responses: [{ questionID: 'q1', answer: 'Yes' }] };

    render(
      <SurveyQuestionsJsonControls
        {...baseProps}
        copiedQuestionsJson
        copiedResponseJson
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          questionJsonToggleClassName: 'question-toggle',
          responseJsonToggleClassName: 'response-toggle',
          showQuestionJsonControls: true,
          showQuestionsJson: true,
          showResponseJson: true,
          showQuestionsJsonPanel: true,
          showResponseJsonPanel: true,
        })}
        questionsJson={questionsJson}
        responseJson={responseJson}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'question .json' }));
    fireEvent.click(screen.getByRole('button', { name: 'response .json' }));
    fireEvent.click(screen.getByTitle('Copy Question Definition JSON'));
    fireEvent.click(screen.getByTitle('Copy Response JSON'));

    expect(baseProps.onToggleQuestionsJson).toHaveBeenCalledTimes(1);
    expect(baseProps.onToggleResponseJson).toHaveBeenCalledTimes(1);
    expect(baseProps.onCopyQuestionsJson).toHaveBeenCalledTimes(1);
    expect(baseProps.onCopyResponseJson).toHaveBeenCalledTimes(1);
    expect(renderJsonTree).toHaveBeenCalledWith(questionsJson);
    expect(renderJsonTree).toHaveBeenCalledWith(responseJson);
    expect(screen.getAllByTestId('json-tree')).toHaveLength(2);
  });

  it('renders response JSON fallback payloads supplied by SurveyQuestions', () => {
    const { rerender } = render(
      <SurveyQuestionsJsonControls
        {...baseProps}
        responseJson={{ info: 'Loading viewed response...' }}
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showResponseJsonPanel: true,
        })}
      />,
    );

    expect(screen.getByTestId('json-tree')).toHaveTextContent('Loading viewed response...');

    rerender(
      <SurveyQuestionsJsonControls
        {...baseProps}
        responseJson={{ message: 'No response found for survey from address: 0xabc' }}
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showResponseJsonPanel: true,
        })}
      />,
    );
    expect(screen.getByTestId('json-tree')).toHaveTextContent('No response found for survey from address: 0xabc');

    rerender(
      <SurveyQuestionsJsonControls
        {...baseProps}
        responseJson={{ responses: [{ questionID: 'q1', answer: 'Other response' }] }}
        jsonPanelDisplayState={buildJsonPanelDisplayState({
          showResponseJsonPanel: true,
        })}
      />,
    );
    expect(screen.getByTestId('json-tree')).toHaveTextContent('Other response');
  });
});
