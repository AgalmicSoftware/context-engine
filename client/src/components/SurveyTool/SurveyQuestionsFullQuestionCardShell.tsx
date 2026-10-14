import React from 'react';
import { Card, CardBody } from 'reactstrap';

import FullQuestionHeader from './FullQuestionHeader';
import styles from './SurveyTool.module.scss';
import quadraticStyles from './QuadraticAllocationInput.module.scss';
import { QuadraticScrollControlsProvider, QuadraticScrollControlsSlot } from './QuadraticScrollControls';

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
  <QuadraticScrollControlsProvider>
    <Card key={cardKey} className={styles.fullQuestionCard}>
      <CardBody className={`${styles.questionTitleBody} ${styles.fullQuestionBody}`}>
        <FullQuestionHeader>
          {promptContent}
          {cardIcons}
        </FullQuestionHeader>

        <div className={styles.fullQuestionMain}>{mainContent}</div>

        <div className={`${styles.fullQuestionFooter} ${quadraticStyles.footerRow}`}>
          {sliderSection}
          <QuadraticScrollControlsSlot />
          {footerIcons}
        </div>

        {commentsSection}
      </CardBody>
    </Card>
  </QuadraticScrollControlsProvider>
);

export default SurveyQuestionsFullQuestionCardShell;
