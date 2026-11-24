import React from 'react';
import { Card, CardBody } from 'reactstrap';

import styles from './SurveyTool.module.scss';
import { ListScrollCue, QuadraticScrollControlsProvider } from './QuadraticScrollControls';
import PileQuestionPrompt from './PileQuestionPrompt';
import { usePileHalfRowCut } from './pileHalfRowCut';

const PILE_LIST_ROW_SELECTOR = `.${styles.checkboxOptionText}`;

/**
 * An answer area that scrolls up and down. Where it scrolls, its last visible option is always cut through, and the
 * up and down chevrons show in the card's footer slot while options are out of view above or below. Their place
 * stays in the footer while none shows, so the footer, and the room it leaves the list, never changes with them.
 */
export const ScrollingAnswerArea = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}): React.ReactElement => {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = `answers-${React.useId().replace(/:/g, '')}`;
  const cue = usePileHalfRowCut(ref, PILE_LIST_ROW_SELECTOR);
  return (
    <>
      <div className={className} ref={ref} id={id}>
        {children}
      </div>
      {cue !== 'off' && (
        <ListScrollCue
          listRef={ref}
          rows={() => Array.from(ref.current?.querySelectorAll(PILE_LIST_ROW_SELECTOR) || [])}
          controlsId={id}
          canScrollUp={cue === 'middle' || cue === 'end'}
          canScrollDown={cue === 'start' || cue === 'middle'}
          // A card without the footer slot (the agent's question list) keeps only the cut.
          inline={false}
        />
      )}
    </>
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

        <ScrollingAnswerArea className={styles.pileCardMainContent}>
          <div className={questionContainerClass}>{questionComponent}</div>
        </ScrollingAnswerArea>

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
