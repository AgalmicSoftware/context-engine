import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';

import styles from './JsonControls.module.scss';

export const JsonIconButton = ({
  label,
  icon,
  onClick,
  title,
  className = '',
  disabled = false,
}) => (
  <button
    type="button"
    className={`${styles.jsonIconButton} ${className}`.trim()}
    onClick={onClick}
    title={title}
    aria-label={title || label}
    disabled={disabled}
  >
    <span className={styles.jsonIconLabel}>{label}</span>
    {icon && <FontAwesomeIcon icon={icon} className={styles.jsonIconGlyph} />}
  </button>
);

export const JsonToggleButton = ({
  label,
  active = false,
  onClick,
  title,
  className = '',
  disabled = false,
  icon,
  iconPosition = 'right',
}) => (
  <button
    type="button"
    className={`${styles.jsonToggleButton} ${active ? styles.jsonToggleButtonActive : ''} ${className}`.trim()}
    onClick={onClick}
    title={title}
    aria-label={label}
    disabled={disabled}
  >
    {icon && iconPosition === 'left' && (
      <FontAwesomeIcon icon={icon} className={styles.jsonToggleIcon} />
    )}
    <span className={styles.jsonToggleLabel}>{label}</span>
    {icon && iconPosition === 'right' && (
      <FontAwesomeIcon icon={icon} className={styles.jsonToggleIcon} />
    )}
  </button>
);

export const JsonPanel = ({
  onCopy,
  copied = false,
  copyTitle = 'Copy JSON',
  children,
  as: Component = 'div',
  contentProps = {},
  className = '',
}) => {
  const mergedContentClassName = `${styles.jsonContent} ${contentProps.className || ''}`.trim();

  return (
    <div className={`${styles.jsonPanel} ${className}`.trim()}>
      {onCopy && (
        <button
          type="button"
          className={`${styles.jsonCopyButton} ${copied ? styles.jsonCopySuccess : ''}`.trim()}
          onClick={onCopy}
          title={copyTitle}
          aria-label={copyTitle}
        >
          <FontAwesomeIcon icon={copied ? faCheck : faClipboard} />
        </button>
      )}
      <Component {...contentProps} className={mergedContentClassName}>
        {children}
      </Component>
    </div>
  );
};

export const JsonButtonRow = ({
  children,
  align = 'start',
  className = '',
}) => {
  const alignmentClass =
    align === 'center'
      ? styles.jsonButtonRowCenter
      : align === 'end'
        ? styles.jsonButtonRowEnd
        : '';

  return (
    <div className={`${styles.jsonButtonRow} ${alignmentClass} ${className}`.trim()}>
      {children}
    </div>
  );
};
