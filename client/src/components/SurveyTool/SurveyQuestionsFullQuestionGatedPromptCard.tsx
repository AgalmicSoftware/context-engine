import React from 'react';
import { Card, CardBody } from 'reactstrap';

import FullQuestionHeader from './FullQuestionHeader';
import styles from './SurveyTool.module.scss';

type SurveyQuestionsFullQuestionGatedPromptCardProps = {
  cardKey?: React.Key;
  cardIcons?: React.ReactNode;
  gatedPromptNotice: React.ReactNode;
  promptContent: React.ReactNode;
  tagDropdownRow: React.ReactNode;
};

export const renderSurveyQuestionsFullQuestionGatedPromptCard = ({
  cardKey,
  cardIcons = null,
  gatedPromptNotice,
  promptContent,
  tagDropdownRow,
}: SurveyQuestionsFullQuestionGatedPromptCardProps): React.ReactElement => (
  <Card key={cardKey} className={styles.fullQuestionCard}>
    <CardBody className={`${styles.questionTitleBody} ${styles.fullQuestionBody}`}>
      <FullQuestionHeader>
        {promptContent}
        {cardIcons}
      </FullQuestionHeader>
      {gatedPromptNotice}
      {tagDropdownRow}
    </CardBody>
  </Card>
);
