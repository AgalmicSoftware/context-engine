import type React from 'react';

export const QUESTION_FILTER_ACTIONS_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  paddingLeft: '15px',
  display: 'flex',
  alignItems: 'center',
};

export const QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE: React.CSSProperties = {
  color: 'var(--ce-status-warning-text)',
  fontSize: '0.85em',
  fontStyle: 'italic',
};

export const QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE: React.CSSProperties = {
  marginRight: '3px',
  fontSize: '0.85em',
};

export const QUESTION_FILTER_SBT_SPINNER_STYLE: React.CSSProperties = {
  marginLeft: '8px',
};

export const QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE: React.CSSProperties = {
  marginBottom: '10px',
};

export const QUESTION_FILTER_MODAL_HEADER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
};

export const QUESTION_FILTER_MODAL_TITLE_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

export const resolveQuestionFilterSectionHeaderStyle = ({
  clickable,
  disabled,
}: {
  clickable: boolean;
  disabled: boolean;
}): React.CSSProperties => ({
  cursor: clickable ? 'pointer' : 'not-allowed',
  opacity: disabled ? 0.5 : 1,
});

export const buildQuestionFilterSectionIconClassName = (styleMap: Record<string, string>, isOpen: unknown) =>
  `${styleMap.icon} ${isOpen ? styleMap.expanded : ''}`;

export const resolveQuestionFilterSectionBodyStyle = (isOpen: unknown, disabled: unknown): React.CSSProperties => ({
  display: isOpen && !disabled ? 'block' : 'none',
});

export const resolveQuestionFilterClearIconStyle = (isDefault: unknown): React.CSSProperties => ({
  cursor: isDefault ? 'not-allowed' : 'pointer',
  marginRight: '12px',
});

export const resolveQuestionFilterCopyIconStyle = (
  isDefault: unknown,
  copiedUrlSuccess: unknown,
): React.CSSProperties => ({
  cursor: isDefault || copiedUrlSuccess ? 'not-allowed' : 'pointer',
  color: copiedUrlSuccess
    ? 'var(--ce-status-success-text)'
    : isDefault
      ? 'var(--ce-control-disabled-text)'
      : 'var(--ce-text-muted)',
  fontSize: '1.1em',
  marginRight: '15px',
});

export const resolveQuestionFilterBookmarkIconStyle = (
  isDefault: unknown,
  isCurrentFilterBookmarked: unknown,
  filterBookmarkedFeedback: unknown,
): React.CSSProperties => ({
  cursor: isDefault ? 'not-allowed' : 'pointer',
  color:
    isCurrentFilterBookmarked || filterBookmarkedFeedback
      ? 'var(--ce-status-warning)'
      : isDefault
        ? 'var(--ce-control-disabled-text)'
        : 'var(--ce-text-muted)',
  fontSize: '1.1em',
  marginRight: '8px',
});

export const resolveQuestionFilterEncryptedCountBadgeStyle = (
  marginLeft: React.CSSProperties['marginLeft'] = '8px',
): React.CSSProperties => ({
  marginLeft,
  opacity: 0.7,
});

export const buildQuestionFilterTagBubbleClassName = (styleMap: Record<string, string>, isSelected: unknown) =>
  [styleMap.tagBubble, isSelected ? styleMap.tagBubbleSelected : ''].filter(Boolean).join(' ');

export const buildQuestionFilterTypeButtonClassName = (styleMap: Record<string, string>, isSelected: unknown) =>
  [styleMap.typeButton, isSelected ? styleMap.typeButtonActive : ''].filter(Boolean).join(' ');

export const buildQuestionFilterTypePillClassName = (
  styleMap: Record<string, string>,
  variant?: 'agree' | 'unsure' | 'disagree',
) => {
  const variantClassName =
    variant === 'agree'
      ? styleMap.typePillAgree
      : variant === 'unsure'
        ? styleMap.typePillUnsure
        : variant === 'disagree'
          ? styleMap.typePillDisagree
          : '';
  return [styleMap.typePill, variantClassName].filter(Boolean).join(' ');
};

export const buildQuestionFilterAiCombineRowClassName = (styleMap: Record<string, string>) =>
  [styleMap.filterOption, styleMap.aiCombineRow].filter(Boolean).join(' ');

export const buildQuestionFilterDisabledSectionClassName = (styleMap: Record<string, string>, isDisabled: unknown) =>
  isDisabled ? styleMap.disabledSection : '';

export const resolveQuestionFilterInlineVisibilityStyle = (filterModalOpen: unknown): React.CSSProperties => ({
  display: filterModalOpen ? 'block' : 'none',
});
