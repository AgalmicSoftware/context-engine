import React from 'react';

type SurveyQuestionsSurveyAnswersViewProps = {
  isOwnResponse?: unknown;
  onWarning?: (...args: unknown[]) => void;
  questionPool?: any[];
  renderQuestionAnswer: (question: any, response: any, index: number, isOwnResponse: unknown) => React.ReactNode;
  responses?: any[];
};

const SurveyQuestionsSurveyAnswersView = ({
  isOwnResponse,
  onWarning = () => {},
  questionPool = undefined,
  renderQuestionAnswer,
  responses = undefined,
}: SurveyQuestionsSurveyAnswersViewProps): React.ReactElement => {
  if (!questionPool || !Array.isArray(responses)) {
    onWarning('renderSurveyAnswers: questionPool or responses not ready.', questionPool, responses);
    return <div>Loading answers...</div>;
  }

  const questionMap: Record<string, any> = {};
  questionPool.forEach((question) => {
    if (question && question.id) {
      questionMap[question.id] = question;
    } else {
      onWarning('Invalid question object found in questionPool:', question);
    }
  });

  return (
    <>
      {responses.map((response, index) => {
        if (!response || !response.questionID) {
          onWarning('Invalid response object at index:', index, response);
          return null;
        }

        const question = questionMap[response.questionID];
        if (question) {
          return renderQuestionAnswer(question, response, index, isOwnResponse);
        }
        onWarning(`Question not found in pool for response ID: ${response.questionID}`);
        return null;
      })}
    </>
  );
};

export default SurveyQuestionsSurveyAnswersView;
