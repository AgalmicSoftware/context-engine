import React from 'react';
import { Card, CardBody } from 'reactstrap';

import styles from './SurveyTool.module.scss';

export type PileActiveQuestionLike = {
  [key: string]: unknown;
};

export type RenderQuestionMaskedPromptCard = (args: {
  mode: 'pile';
  question: PileActiveQuestionLike;
}) => React.ReactNode;

export type PileCardShellProps = {
  promptHeader: React.ReactNode;
  questionComponent: React.ReactNode;
  questionContainerClass: string;
  footerSection?: React.ReactNode;
};

export type PileGatedPromptCardProps = {
  promptHeader: React.ReactNode;
  gatedPromptNotice: React.ReactNode;
};

export type PileActiveQuestionCardProps = PileCardShellProps & {
  question: PileActiveQuestionLike;
  promptMasked: boolean;
  renderQuestionMaskedPromptCard: RenderQuestionMaskedPromptCard;
};

export const renderPileCardShell = ({
  promptHeader,
  questionComponent,
  questionContainerClass,
  footerSection,
}: PileCardShellProps): React.ReactElement => (
  <Card className={styles.pileCardInner}>
    <CardBody className={styles.pileCardBody}>
      <div className={styles.pileCardHeader}>{promptHeader}</div>

      <div className={styles.pileCardMainContent}>
        <div className={questionContainerClass}>{questionComponent}</div>
      </div>

      {footerSection}
    </CardBody>
  </Card>
);

export const renderPileGatedPromptCard = ({
  promptHeader,
  gatedPromptNotice,
}: PileGatedPromptCardProps): React.ReactElement => (
  <Card className={styles.pileCardInner}>
    <CardBody className={styles.pileCardBody}>
      <div className={styles.pileCardHeader}>{promptHeader}</div>
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
}: PileActiveQuestionCardProps): React.ReactNode =>
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
      });
