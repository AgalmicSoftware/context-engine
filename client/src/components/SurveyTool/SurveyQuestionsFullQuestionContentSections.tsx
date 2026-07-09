import React from 'react';
import { InputGroup } from 'reactstrap';

import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import styles from './SurveyTool.module.scss';

type RenderNode = () => React.ReactNode;

type SurveyQuestionsFullQuestionContentSectionsArgs = {
  commentsOpen?: boolean;
  maskedAnswer?: boolean;
  maskedAdditional?: boolean;
  renderAdditionalDecryptControl: RenderNode;
  renderAdditionalInput: RenderNode;
  renderAdditionalLockControl: RenderNode;
  renderAnswerDecryptControl: RenderNode;
  renderResponseInput: RenderNode;
};

type SurveyQuestionsFullQuestionContentSections = {
  commentsSection: React.ReactNode;
  mainContent: React.ReactNode;
};

const renderFullQuestionCommentsSection = (content: React.ReactNode): React.ReactNode => {
  if (!content) return null;
  return <div className={styles.fullQuestionComments}>{content}</div>;
};

export const buildSurveyQuestionsFullQuestionContentSections = ({
  commentsOpen = false,
  maskedAnswer = false,
  maskedAdditional = false,
  renderAdditionalDecryptControl,
  renderAdditionalInput,
  renderAdditionalLockControl,
  renderAnswerDecryptControl,
  renderResponseInput,
}: SurveyQuestionsFullQuestionContentSectionsArgs): SurveyQuestionsFullQuestionContentSections => {
  const mainContent = maskedAnswer ? (
    renderAnswerDecryptControl()
  ) : (
    <InputGroup id={styles.responseInputSection}>{renderResponseInput()}</InputGroup>
  );

  if (!commentsOpen) {
    return {
      mainContent,
      commentsSection: null,
    };
  }

  if (maskedAnswer && !maskedAdditional) {
    return {
      mainContent,
      commentsSection: renderFullQuestionCommentsSection(renderAdditionalInput()),
    };
  }

  if (maskedAnswer || maskedAdditional) {
    return {
      mainContent,
      commentsSection: renderFullQuestionCommentsSection(renderAdditionalDecryptControl()),
    };
  }

  return {
    mainContent,
    commentsSection: renderFullQuestionCommentsSection(
      <AdditionalCommentsInlineRow input={renderAdditionalInput()} lockControl={renderAdditionalLockControl()} />,
    ),
  };
};
