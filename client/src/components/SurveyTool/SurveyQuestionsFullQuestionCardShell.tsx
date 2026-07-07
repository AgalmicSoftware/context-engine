import React from 'react';
import { Card, CardBody } from 'reactstrap';

import FullQuestionHeader from './FullQuestionHeader';
import styles from './SurveyTool.module.scss';

type SurveyQuestionsFullQuestionCardShellProps = {
  cardIcons?: React.ReactNode;
  cardKey?: React.Key;
  commentsSection?: React.ReactNode;
  footerIcons?: React.ReactNode;
  mainContent?: React.ReactNode;
  promptContent?: React.ReactNode;
  sliderSection?: React.ReactNode;
};

const SurveyQuestionsFullQuestionCardShell = ({
  cardIcons = null,
  cardKey,
  commentsSection = null,
  footerIcons = null,
  mainContent = null,
  promptContent = null,
  sliderSection = null,
}: SurveyQuestionsFullQuestionCardShellProps): React.ReactElement => (
  <Card key={cardKey} className={styles.fullQuestionCard}>
    <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
      <FullQuestionHeader>
        {promptContent}
        {cardIcons}
      </FullQuestionHeader>

      <div className={styles.fullQuestionMain}>{mainContent}</div>

      <div className={styles.fullQuestionFooter}>
        {sliderSection}
        {footerIcons}
      </div>

      {commentsSection}
    </CardBody>
  </Card>
);

export default SurveyQuestionsFullQuestionCardShell;
