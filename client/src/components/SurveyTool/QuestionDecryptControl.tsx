import React from 'react';
import type { CSSProperties } from 'react';
import DecryptActionChip from './DecryptActionChip';

type QuestionDecryptControlProps = {
  autoDecryptEnabled?: boolean;
  showBusySpinnerWhenAutoDecryptEnabled?: boolean;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  actionLabel: string;
  onClick?: (() => void) | null;
  wrapperStyle?: CSSProperties;
};

const QuestionDecryptControl = ({
  autoDecryptEnabled = false,
  showBusySpinnerWhenAutoDecryptEnabled = false,
  busy = false,
  disabled = false,
  title,
  actionLabel,
  onClick = null,
  wrapperStyle,
}: QuestionDecryptControlProps) => {
  let content = null;

  if (autoDecryptEnabled) {
    if (!showBusySpinnerWhenAutoDecryptEnabled) return null;
    content = <DecryptActionChip spinnerOnly busy={busy} actionLabel={actionLabel} />;
  } else {
    content = (
      <DecryptActionChip
        onClick={onClick || undefined}
        disabled={disabled}
        title={title}
        actionLabel={actionLabel}
        busy={busy}
      />
    );
  }

  if (!content) return null;
  if (!wrapperStyle) return content;

  return <div style={wrapperStyle}>{content}</div>;
};

export default QuestionDecryptControl;
