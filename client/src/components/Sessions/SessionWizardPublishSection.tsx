import React from 'react';

import SessionPublishSummary, { type SessionPublishSummaryProps } from './SessionPublishSummary';

export type SessionWizardPublishSectionProps = Omit<SessionPublishSummaryProps, 'isCollapsed' | 'onToggleCollapsed'> & {
  isCollapsed: boolean;
  isNormalMode: boolean;
  onToggleCollapsed: () => void;
};

const SessionWizardPublishSection = ({
  isCollapsed,
  isNormalMode,
  onToggleCollapsed,
  ...summaryProps
}: SessionWizardPublishSectionProps): React.ReactElement | null => {
  if (isNormalMode && isCollapsed) return null;

  return <SessionPublishSummary {...summaryProps} isCollapsed={isCollapsed} onToggleCollapsed={onToggleCollapsed} />;
};

export default SessionWizardPublishSection;
