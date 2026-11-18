import React from 'react';
import { Card, CardBody } from 'reactstrap';

import styles from './SurveyTool.module.scss';
import { QuadraticScrollControlsProvider } from './QuadraticScrollControls';
import PileQuestionPrompt from './PileQuestionPrompt';
import { usePileHalfRowCut } from './pileHalfRowCut';

/** The card's answer area. Where it scrolls (a phone's choice list), its last visible option is always cut through. */
const PileAnswerArea = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const ref = React.useRef<HTMLDivElement>(null);
  usePileHalfRowCut(ref, `.${styles.checkboxOptionText}`);
  return (
    <div className={styles.pileCardMainContent} ref={ref}>
      {children}
    </div>
  );
};

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
  questionType?: unknown;
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
  questionType,
}: PileCardShellProps): React.ReactElement => (
  <QuadraticScrollControlsProvider>
    <Card className={`${styles.pileCardInner} ${questionType === 'quadratic' ? styles.pileQuadraticCard : ''}`}>
      <CardBody className={styles.pileCardBody}>
        <PileQuestionPrompt>{promptHeader}</PileQuestionPrompt>

        <PileAnswerArea>
          <div className={questionContainerClass}>{questionComponent}</div>
        </PileAnswerArea>

        {footerSection}
      </CardBody>
    </Card>
  </QuadraticScrollControlsProvider>
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
        questionType: question.type || question.questionType,
      });
