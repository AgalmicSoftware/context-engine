import React from 'react';

import TagModal from '../TagPage/TagModal';
import type { SurveyQuestionsLayoutDisplayState } from './surveyQuestionsTypes.js';

const noop = () => {};

type SurveyQuestionsRouteTagModalProps = {
  onClose?: () => void;
};

type SurveyQuestionsTagModalSlotProps = {
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  tagModalProps?: SurveyQuestionsRouteTagModalProps;
};

const SurveyQuestionsTagModalSlot = ({
  layoutDisplayState = {},
  tagModalProps = {},
}: SurveyQuestionsTagModalSlotProps): React.ReactElement | null => {
  if (!layoutDisplayState.useTagModal) return null;

  const activeTagModalTag = layoutDisplayState.activeTagModalTag || null;

  return (
    <TagModal
      isOpen={!!activeTagModalTag}
      toggle={tagModalProps.onClose || noop}
      activeTag={activeTagModalTag}
    />
  );
};

export default SurveyQuestionsTagModalSlot;
