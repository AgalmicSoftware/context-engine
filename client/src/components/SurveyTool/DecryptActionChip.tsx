import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

type DecryptActionChipProps = {
  busy?: boolean;
  spinnerOnly?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  actionLabel: string;
  busyLabel?: string;
};

export const resolveDecryptActionChipSpinnerStyle = (): React.CSSProperties => ({
  marginRight: 8,
});

const DecryptActionChip = ({
  busy = false,
  spinnerOnly = false,
  onClick,
  disabled = false,
  title,
  actionLabel,
  busyLabel = 'Decrypting...',
}: DecryptActionChipProps) => {
  if (spinnerOnly) {
    if (!busy) return null;
    return (
      <div className={styles.decryptChip}>
        <FontAwesomeIcon icon={faSpinner} spin style={resolveDecryptActionChipSpinnerStyle()} />
        <span>{busyLabel}</span>
      </div>
    );
  }

  return (
    <div className={styles.decryptChip}>
      <Button onClick={onClick} className={styles.decryptQuestionButton} disabled={disabled} title={title}>
        {busy ? busyLabel : actionLabel}
      </Button>
    </div>
  );
};

export default DecryptActionChip;
