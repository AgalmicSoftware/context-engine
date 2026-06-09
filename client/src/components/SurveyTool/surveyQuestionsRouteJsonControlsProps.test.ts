import { buildSurveyQuestionsRouteJsonControlsProps } from './surveyQuestionsRouteJsonControlsProps.js';

describe('surveyQuestionsRouteJsonControlsProps', () => {
  it('maps route JSON controls to explicit display props and copy payload actions', () => {
    const bottomRef = { current: null };
    const copyJsonToClipboard = jest.fn();
    const onToggleQuestionsJson = jest.fn();
    const onToggleResponseJson = jest.fn();
    const onToggleSurveyJson = jest.fn();
    const renderJsonTree = jest.fn();
    const jsonPanelDisplayState = { showSurveyJsonPanel: true };
    const questionsJson = [{ id: 'q1' }];
    const responseJson = { responses: [{ questionID: 'q1', answer: 'Yes' }] };
    const surveyJson = { id: 'survey-1' };

    const props = buildSurveyQuestionsRouteJsonControlsProps({
      bottomRef,
      copiedQuestionsJson: true,
      copiedResponseJson: false,
      copiedSurveyJson: true,
      copyJsonToClipboard,
      hidden: true,
      jsonPanelDisplayState,
      onToggleQuestionsJson,
      onToggleResponseJson,
      onToggleSurveyJson,
      questionsJson,
      renderJsonTree,
      responseJson,
      surveyJson,
    });

    expect(props.bottomRef).toBe(bottomRef);
    expect(props.copiedQuestionsJson).toBe(true);
    expect(props.copiedResponseJson).toBe(false);
    expect(props.copiedSurveyJson).toBe(true);
    expect(props.hidden).toBe(true);
    expect(props.jsonPanelDisplayState).toBe(jsonPanelDisplayState);
    expect(props.onToggleQuestionsJson).toBe(onToggleQuestionsJson);
    expect(props.onToggleResponseJson).toBe(onToggleResponseJson);
    expect(props.onToggleSurveyJson).toBe(onToggleSurveyJson);
    expect(props.questionsJson).toBe(questionsJson);
    expect(props.renderJsonTree).toBe(renderJsonTree);
    expect(props.responseJson).toBe(responseJson);
    expect(props.surveyJson).toBe(surveyJson);

    props.onCopyQuestionsJson?.();
    props.onCopyResponseJson?.();
    props.onCopySurveyJson?.();

    expect(copyJsonToClipboard).toHaveBeenNthCalledWith(1, questionsJson, 'questions');
    expect(copyJsonToClipboard).toHaveBeenNthCalledWith(2, responseJson, 'response');
    expect(copyJsonToClipboard).toHaveBeenNthCalledWith(3, surveyJson, 'survey');
  });
});
