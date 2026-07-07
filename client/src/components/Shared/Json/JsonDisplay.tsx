import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCode, faCopy, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { copyJsonToClipboard, formatJsonForDisplay } from '../../../utilities/ui/jsonFunctions';
import styles from './JsonDisplay.module.scss';

type JsonDisplayProps = {
  data: unknown;
  label?: string;
  defaultOpen?: boolean;
  maxHeight?: number | string;
};

const JsonDisplay = ({ data, label = 'View .json', defaultOpen = false, maxHeight = 300 }: JsonDisplayProps) => {
  const [open, setOpen] = useState(defaultOpen);

  if (data == null) return null;

  const formatted = formatJsonForDisplay(data);

  return (
    <div className={styles.jsonContainer}>
      <button className={styles.toggleButton} onClick={() => setOpen(!open)} type="button" aria-expanded={open}>
        <FontAwesomeIcon icon={faCode} style={{ marginRight: 6 }} />
        {label}
        <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ marginLeft: 6, fontSize: '0.8em' }} />
      </button>
      {open && (
        <div className={styles.jsonBody}>
          <button
            className={styles.copyButton}
            onClick={() => {
              void copyJsonToClipboard(data);
            }}
            type="button"
            title="Copy JSON"
            aria-label="Copy JSON"
          >
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <pre className={styles.jsonPre} style={{ maxHeight }}>
            {formatted}
          </pre>
        </div>
      )}
    </div>
  );
};

export default JsonDisplay;
