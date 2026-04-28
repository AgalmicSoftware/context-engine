// @ts-nocheck

import React from 'react';
import { Card, CardBody } from 'reactstrap';

import styles from './SurveyTool.module.scss';

export const renderPileCardShell = ({
  promptHeader,
  questionComponent,
  questionContainerClass,
  footerSection,
}) => (
  <Card className={styles.pileCardInner}>
    <CardBody className={styles.pileCardBody}>
      <div className={styles.pileCardHeader}>
        {promptHeader}
      </div>

      <div className={styles.pileCardMainContent}>
        <div className={questionContainerClass}>
          {questionComponent}
        </div>
      </div>

      {footerSection}
    </CardBody>
  </Card>
);

export const renderPileGatedPromptCard = ({
  promptHeader,
  gatedPromptNotice,
}) => (
  <Card className={styles.pileCardInner}>
    <CardBody className={styles.pileCardBody}>
      <div className={styles.pileCardHeader}>
        {promptHeader}
      </div>
      {gatedPromptNotice}
    </CardBody>
  </Card>
);

export const renderPileActiveQuestionCard = ({
  question,
  promptMasked,
  renderQuestionMaskedPromptCard,
  promptHeader,
  questionComponent,
  questionContainerClass,
  footerSection,
}) => (
  promptMasked
    ? renderQuestionMaskedPromptCard({
        mode: 'pile',
        question,
      })
    : renderPileCardShell({
        promptHeader,
        questionComponent,
        questionContainerClass,
        footerSection,
      })
);
