import React from 'react';

import QuadraticTypePreview from '../../SurveyTool/QuadraticTypePreview';
import { buildQuestionFilterTypePillClassName } from '../../SurveyTool/questionFilterDisplayHelpers';
// The previews on the site's question-type tiles, as the question editor and the question filter draw them.
import tiles from '../../SurveyTool/QuestionFilter.module.scss';
import { SETUP_QUESTION_TYPES } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

const PREVIEWS: Record<string, React.ReactNode> = {
  binary: (
    <span className={tiles.typePreviewRow} aria-hidden="true">
      <span className={buildQuestionFilterTypePillClassName(tiles, 'agree')}>Agree</span>
      <span className={buildQuestionFilterTypePillClassName(tiles, 'unsure')}>Unsure</span>
      <span className={buildQuestionFilterTypePillClassName(tiles, 'disagree')}>Disagree</span>
    </span>
  ),
  freeform: (
    <span className={tiles.freeformPreview} aria-hidden="true">
      Write an answer...
    </span>
  ),
  rating: (
    <span className={tiles.ratingPreview} aria-hidden="true">
      <span className={tiles.ratingPreviewEndpoint}>1</span>
      <span className={tiles.ratingPreviewWrap}>
        <span className={tiles.ratingPreviewFill} />
        <span className={tiles.ratingPreviewHandle} />
      </span>
      <span className={tiles.ratingPreviewEndpoint}>10</span>
    </span>
  ),
  multichoice: (
    <span className={tiles.typePreviewRow} aria-hidden="true">
      <span className={tiles.typePill}>Opt 1</span>
      <span className={tiles.typePill}>Opt 2</span>
      <span className={tiles.typePill}>Opt 3</span>
    </span>
  ),
  quadratic: (
    <span className={`${tiles.typePreviewRow} ${tiles.typePreviewInk}`}>
      <QuadraticTypePreview plain />
    </span>
  ),
};

type Props = {
  value: string;
  onChange: (type: string) => void;
  /** The id of the "?" help's screen-reader copy. */
  describedBy?: string;
};

/** The new question's type, one tile per type; the pressed tile is the chosen one. */
const SetupQuestionTypes = ({ value, onChange, describedBy }: Props): React.ReactElement => (
  <div
    className={styles.typeTiles}
    role="group"
    aria-label="New question type"
    aria-describedby={describedBy}
    data-testid="ce-setup-question-types"
  >
    {SETUP_QUESTION_TYPES.map((type) => (
      <button
        key={type.value}
        type="button"
        className={styles.typeTile}
        aria-pressed={value === type.value}
        onClick={() => onChange(type.value)}
      >
        <span className={styles.typeTileTitle}>{type.label}</span>
        {PREVIEWS[type.value]}
      </button>
    ))}
  </div>
);

export default SetupQuestionTypes;
