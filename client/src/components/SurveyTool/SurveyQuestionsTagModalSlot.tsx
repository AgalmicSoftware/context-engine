import React from 'react';

import TagModal from '../TagPage/TagModal';
import type { SurveyQuestionsTagModalSlotProps } from './surveyQuestionsRouteSurfaceTypes.js';

const noop = () => {};

const SurveyQuestionsTagModalSlot = ({
  layoutDisplayState = {},
  tagModalProps = {},
}: SurveyQuestionsTagModalSlotProps): React.ReactElement | null => {
  if (!layoutDisplayState.useTagModal) return null;

  const activeTagModalTag = layoutDisplayState.activeTagModalTag || null;

  return <TagModal isOpen={!!activeTagModalTag} toggle={tagModalProps.onClose || noop} activeTag={activeTagModalTag} />;
};

export default SurveyQuestionsTagModalSlot;
