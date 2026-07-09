import React from 'react';
import type { CSSProperties } from 'react';
import QuestionTagDropdown, { getQuestionTagDisplayList } from './QuestionTagDropdown';

type SurveyQuestionTagControlProps = {
  tags?: unknown[];
  sessionSlug?: string;
  useTagModal?: boolean;
  onTagSelect?: ((tag: string) => void) | null;
  rowStyle?: CSSProperties;
};

const SurveyQuestionTagControl = ({
  tags = [],
  sessionSlug = '',
  useTagModal = false,
  onTagSelect = null,
  rowStyle,
}: SurveyQuestionTagControlProps) => {
  if (!getQuestionTagDisplayList(tags).length) return null;

  const dropdown = (
    <QuestionTagDropdown tags={tags} sessionSlug={sessionSlug} onTagSelect={useTagModal ? onTagSelect : null} />
  );

  if (!rowStyle) return dropdown;

  return <div style={rowStyle}>{dropdown}</div>;
};

export default SurveyQuestionTagControl;
